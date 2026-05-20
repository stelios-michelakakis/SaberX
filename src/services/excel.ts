import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fields } from "@/db/schema";
import { createDocument, createField, createImportJob, createRow, createUserSheet, getDocumentExportModel, markExportJob } from "./repository";
import { slugify } from "@/lib/utils";
import { writeAudit } from "./audit";

type ActorUser = { userId: string; username: string };

function normalizeSheetName(name: string) {
  return name.replace(/[\s_-]+/g, " ").trim().toUpperCase();
}

type ImportedFieldType =
  | "short_text"
  | "long_text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "single_enum";

function inferFieldType(samples: unknown[]): ImportedFieldType {
  const nonEmpty = samples
    .map((s) => (s == null ? "" : String(s)))
    .map((s) => s.trim())
    .filter(Boolean);
  if (nonEmpty.length === 0) return "short_text";
  if (nonEmpty.every((value) => /^-?\d+$/.test(value))) return "integer";
  if (nonEmpty.every((value) => /^-?\d+(\.\d+)?$/.test(value))) return "decimal";
  if (nonEmpty.every((value) => /^(true|false|yes|no)$/i.test(value))) return "boolean";
  if (nonEmpty.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))) return "date";
  if (nonEmpty.every((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))) return "datetime";
  if (nonEmpty.length > 4 && new Set(nonEmpty.map((v) => v.toLowerCase())).size <= Math.ceil(nonEmpty.length / 2)) {
    return "single_enum";
  }
  if (nonEmpty.some((value) => value.length > 80 || /\n/.test(value))) return "long_text";
  return "short_text";
}

export async function importWorkbook(user: ActorUser, filename: string, bytes: Buffer) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const importJob = await createImportJob(user, filename, hash);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const sourceSheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0);
  const title = filename.replace(/\.xlsx$/i, "");
  const document = await createDocument(user, {
    title,
    description: `Imported from ${filename}`,
    provenance: { originalFilename: filename, fileHash: hash, importJobId: importJob.id, importedAt: new Date().toISOString() }
  });

  let sheetCount = 0;
  let rowCount = 0;

  const skipped: { sheet: string; reason: string }[] = [];

  for (const worksheet of sourceSheets) {
    const normalizedName = normalizeSheetName(worksheet.name);
    if (["INSTRUCTIONS", "GLOSSARY", "OPEN ISSUES"].includes(normalizedName)) continue;
    const headerRow = worksheet.getRow(1);
    const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
    const headers = headerValues
      .map((value: unknown) => String(value ?? "").trim())
      .filter(Boolean);
    if (!headers.length) continue;

    // Derive a 1-20 char alphanumeric prefix. Strip ALL non-alphanumerics from
    // every candidate path so separators in header names (e.g. "part-id") don't
    // bubble into createUserSheet and trip assertNoCompoundPrefix.
    const sanitize = (s: string) => s.replace(/[^a-z0-9]/gi, "");
    const fromHeader = headers.find((header) => /_?id$/i.test(header))?.replace(/_?id$/i, "") ?? "";
    const prefix =
      sanitize(fromHeader).slice(0, 8) ||
      sanitize(worksheet.name).slice(0, 3) ||
      "ID";

    let sheet;
    try {
      sheet = await createUserSheet(user, document.id, {
        name: worksheet.name,
        description: `Imported worksheet ${worksheet.name}`,
        idPrefix: prefix.toUpperCase(),
        zeroPad: 2
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[import] skipped sheet "${worksheet.name}": ${reason}`);
      skipped.push({ sheet: worksheet.name, reason });
      continue;
    }
    sheetCount += 1;

    const dataRows: unknown[][] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) dataRows.push(Array.isArray(row.values) ? row.values.slice(1) : []);
    });

    // Resolve a unique (label, slug) per data column up front. Headers that
    // collide get a "(2)", "(3)", ... suffix so slugify() produces unique
    // slugs and the (sheet_id, slug) unique index isn't violated.
    const usedSlugs = new Set<string>(["id"]);
    const resolvedColumns: { label: string; slug: string; columnIndex: number }[] = [];
    for (const [columnIndex, header] of headers.entries()) {
      if (/_?id$/i.test(header)) continue;
      const baseSlug = slugify(header);
      if (!baseSlug || baseSlug === "id") continue; // unmappable header
      let slug = baseSlug;
      let label = header;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        label = `${header} (${suffix})`;
        slug = slugify(label);
        suffix += 1;
      }
      usedSlugs.add(slug);
      resolvedColumns.push({ label, slug, columnIndex });
    }

    for (const column of resolvedColumns) {
      const samples = dataRows.map((row) => row[column.columnIndex]);
      const inferred = inferFieldType(samples);
      // When the heuristic picks single_enum we MUST seed it with the
      // distinct sample values — otherwise normalizeFieldValue throws
      // "<field> has no options defined" on the first cell write.
      const options =
        inferred === "single_enum"
          ? Array.from(
              new Set(
                samples
                  .map((s) => (s == null ? "" : String(s).trim()))
                  .filter(Boolean)
              )
            )
          : [];
      await createField(user, sheet.id, {
        label: column.label,
        type: inferred,
        description: `Imported field ${column.label}`,
        required: false,
        unique: false,
        editable: true,
        options
      });
    }

    const sheetFields = await db.select().from(fields).where(eq(fields.sheetId, sheet.id));
    for (const row of dataRows) {
      const cells: Record<string, unknown> = {};
      for (const column of resolvedColumns) {
        const field = sheetFields.find((item) => item.slug === column.slug);
        if (field && field.type !== "auto_id") cells[field.id] = row[column.columnIndex] ?? "";
      }
      await createRow(user, sheet.id, { cells });
      rowCount += 1;
    }
  }

  await writeAudit({
    actor: { id: user.userId, username: user.username },
    actionType: "IMPORT_COMPLETE",
    entityType: "import_job",
    entityId: importJob.id,
    parentDocumentId: document.id,
    parentDocumentName: document.title,
    after: { sheetCount, rowCount, skipped },
    summary:
      skipped.length > 0
        ? `Imported ${filename}: ${sheetCount} sheets, ${rowCount} rows. Skipped ${skipped.length} sheet(s): ${skipped.map((s) => `${s.sheet} (${s.reason})`).join("; ")}`
        : `Imported ${filename}: ${sheetCount} sheets, ${rowCount} rows`,
    sourceType: "import"
  });

  return { importJob, document, summary: { sheetCount, rowCount, skipped } };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" } // slate-800
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FFFFFFFF" },
  bold: true,
  size: 11
};
const ZEBRA_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF7F8FA" } // very light grey
};
const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE5E7EB" } },
  left: { style: "thin", color: { argb: "FFE5E7EB" } },
  bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
  right: { style: "thin", color: { argb: "FFE5E7EB" } }
};

function safeSheetName(name: string): string {
  // Excel: 31-char limit, can't contain : \ / ? * [ ]
  return name.replace(/[:\\/?*\[\]]/g, "_").slice(0, 31) || "Sheet";
}

function valueToCell(value: unknown): string | number | boolean | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "object" && "label" in (item as object)) {
          return (item as { label?: unknown }).label ?? "";
        }
        return String(item);
      })
      .filter((s) => s !== "")
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeMdTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export async function exportWorkbook(user: ActorUser, documentId: string) {
  const model = await getDocumentExportModel(documentId);
  const doc = model.document;

  // 1. Build the workbook: headers + data only, styled.
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EDF SABER";
  workbook.created = new Date();
  workbook.title = doc.title;

  for (const grid of model.sheets) {
    if (grid.sheet.sheetKind === "instructions" || grid.sheet.sheetKind === "glossary") {
      // Skip in the workbook — full content goes into the markdown side car.
      continue;
    }
    const worksheet = workbook.addWorksheet(safeSheetName(grid.sheet.name));
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const headers = grid.fields.map((f) => f.label);
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
      cell.border = BORDER_STYLE;
    });

    let rowIndex = 2;
    for (const row of grid.rows) {
      const cellMap = row.cells as Record<string, unknown>;
      const values = grid.fields.map((field) => {
        const raw = cellMap[field.id] ?? cellMap[field.slug] ?? "";
        return valueToCell(raw);
      });
      const xlRow = worksheet.addRow(values);
      const zebra = rowIndex % 2 === 0;
      xlRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = BORDER_STYLE;
        if (zebra) cell.fill = ZEBRA_FILL;
      });
      rowIndex += 1;
    }

    // Width: take the longest of (header, first 30 sampled cells per column),
    // capped to 60 chars. Empty columns get a sensible minimum.
    const sampleRows = grid.rows.slice(0, 30);
    grid.fields.forEach((field, i) => {
      const headerLen = field.label.length;
      let maxLen = headerLen;
      for (const row of sampleRows) {
        const cellMap = row.cells as Record<string, unknown>;
        const raw = cellMap[field.id] ?? cellMap[field.slug] ?? "";
        const s = String(valueToCell(raw) ?? "");
        // Wrap-aware: count the longest single line, not whole text.
        const longest = s.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0);
        if (longest > maxLen) maxLen = longest;
      }
      worksheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 12), 60);
    });

    if (grid.rows.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length }
      };
    }
  }

  // 2. Build the markdown sidecar with document metadata + per-sheet schema.
  const md = buildMarkdownMetadata(model);

  // 3. ZIP both files.
  const xlsxBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const titleSlug = doc.title.replace(/[^a-z0-9_-]+/gi, "_") || "document";
  const zip = new JSZip();
  zip.file(`${titleSlug}.xlsx`, xlsxBuffer);
  zip.file(`${titleSlug}.md`, md);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `${titleSlug}.zip`;

  const job = await markExportJob(
    doc.id,
    user,
    "complete",
    { sheets: model.sheets.length, bundle: ["xlsx", "md"] },
    { filename, base64: buffer.toString("base64") }
  );
  return { job, filename, buffer };
}

function buildMarkdownMetadata(model: Awaited<ReturnType<typeof getDocumentExportModel>>): string {
  const doc = model.document;
  const lines: string[] = [];
  lines.push(`# ${doc.title}`);
  lines.push("");
  if (doc.description) {
    lines.push(doc.description);
    lines.push("");
  }

  lines.push("## Metadata");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Title | ${escapeMdTableCell(doc.title)} |`);
  lines.push(`| Status | ${escapeMdTableCell(doc.status ?? "—")} |`);
  lines.push(`| Classification | ${escapeMdTableCell(doc.classification ?? "—")} |`);
  lines.push(`| Baseline | ${escapeMdTableCell(doc.baselineState ?? "—")} |`);
  if (doc.templateType) {
    lines.push(`| Template | ${escapeMdTableCell(doc.templateType)} |`);
  }
  lines.push(`| Version | ${doc.version ?? 1} |`);
  lines.push(`| Exported at | ${new Date().toISOString()} |`);
  lines.push("");

  for (const grid of model.sheets) {
    const kind = grid.sheet.sheetKind;
    if (kind === "glossary") continue; // glossary is derived, no point exporting its schema
    lines.push(`## ${grid.sheet.name}`);
    lines.push("");
    if (grid.sheet.description) {
      lines.push(grid.sheet.description);
      lines.push("");
    }
    if (kind === "instructions") {
      // Treat instructions as free-form prose, not a fielded sheet.
      for (const row of grid.rows) {
        const cellMap = row.cells as Record<string, unknown>;
        for (const f of grid.fields) {
          const v = cellMap[f.id] ?? cellMap[f.slug] ?? "";
          const s = String(valueToCell(v) ?? "");
          if (s.trim()) lines.push(s);
        }
      }
      lines.push("");
      continue;
    }
    if (grid.fields.length === 0) {
      lines.push("_No fields defined._");
      lines.push("");
      continue;
    }
    lines.push("| Field | Type | Required | Unique | Description |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const field of grid.fields) {
      lines.push(
        `| ${escapeMdTableCell(field.label)} | ${field.type} | ${field.required ? "yes" : ""} | ${field.unique ? "yes" : ""} | ${escapeMdTableCell(field.description ?? "")} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
