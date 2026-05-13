import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { fields } from "@/db/schema";
import { slugify } from "@/lib/utils";
import { createDocument, createField, createImportJob, createRow, createUserSheet, getDocumentExportModel, markExportJob } from "./repository";
import { writeAudit } from "./audit";

type ActorUser = { userId: string; username: string };

function inferFieldType(values: unknown[]) {
  const samples = values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "").slice(0, 20);
  if (!samples.length) return "short_text" as const;
  if (samples.every((value) => !Number.isNaN(Number(value)))) return "decimal" as const;
  if (samples.every((value) => ["true", "false", "yes", "no", "0", "1"].includes(String(value).toLowerCase()))) return "boolean" as const;
  if (samples.every((value) => !Number.isNaN(Date.parse(String(value))))) return "date" as const;
  if (samples.some((value) => String(value).length > 120)) return "long_text" as const;
  return "short_text" as const;
}

function normalizeSheetName(name: string) {
  return name.trim().toUpperCase().replace(/[_\s-]+/g, " ");
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

  for (const worksheet of sourceSheets) {
    const normalizedName = normalizeSheetName(worksheet.name);
    if (["INSTRUCTIONS", "GLOSSARY", "OPEN ISSUES"].includes(normalizedName)) continue;
    const headerRow = worksheet.getRow(1);
    const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
    const headers = headerValues
      .map((value: unknown) => String(value ?? "").trim())
      .filter(Boolean);
    if (!headers.length) continue;

    const prefix = headers.find((header) => /_?id$/i.test(header))?.replace(/_?id$/i, "").slice(0, 8) || worksheet.name.slice(0, 3).replace(/[^a-z0-9]/gi, "") || "ID";
    const sheet = await createUserSheet(user, document.id, { name: worksheet.name, description: `Imported worksheet ${worksheet.name}`, idPrefix: prefix.toUpperCase(), zeroPad: 2 });
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
      await createField(user, sheet.id, {
        label: column.label,
        type: inferFieldType(samples),
        description: `Imported field ${column.label}`,
        required: false,
        unique: false,
        editable: true
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
    after: { sheetCount, rowCount },
    summary: `Imported ${filename}: ${sheetCount} sheets, ${rowCount} rows`,
    sourceType: "import"
  });

  return { importJob, document, summary: { sheetCount, rowCount } };
}

export async function exportWorkbook(user: ActorUser, documentId: string) {
  const model = await getDocumentExportModel(documentId);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EDF SABER";
  workbook.created = new Date();

  for (const grid of model.sheets) {
    const worksheet = workbook.addWorksheet(grid.sheet.name.slice(0, 31));
    if (grid.sheet.sheetKind === "instructions") {
      worksheet.addRow(["Instructions"]);
      worksheet.addRow([grid.sheet.description || ""]);
      continue;
    }

    if (grid.sheet.sheetKind === "standard") {
      worksheet.addRow(["Sheet Description"]);
      worksheet.addRow([grid.sheet.description || ""]);
      worksheet.addRow([]);
      worksheet.addRow(["Field Legend"]);
      worksheet.addRow(["Field", "Type", "Description"]);
      for (const field of grid.fields) {
        worksheet.addRow([field.label, field.type, field.description]);
      }
      worksheet.addRow([]);
    }

    worksheet.addRow(grid.fields.map((field) => field.label));
    for (const row of grid.rows) {
      worksheet.addRow(grid.fields.map((field) => {
        const cellMap = row.cells as Record<string, unknown>;
        const value = cellMap[field.id] ?? cellMap[field.slug] ?? "";
        if (Array.isArray(value)) return value.map((item) => item.label ?? String(item)).join(", ");
        return value;
      }));
    }
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const filename = `${model.document.title.replace(/[^a-z0-9_-]+/gi, "_")}.xlsx`;
  const job = await markExportJob(model.document.id, user, "complete", { sheets: model.sheets.length }, { filename, base64: buffer.toString("base64") });
  return { job, filename, buffer };
}
