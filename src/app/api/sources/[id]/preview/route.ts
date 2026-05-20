import ExcelJS from "exceljs";
import { mapError, ok } from "@/lib/api";
import { requireUser } from "@/services/auth";
import { getSourceForDownload } from "@/services/sources";

const MAX_ROWS = 200;
const MAX_COLS = 40;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const url = new URL(request.url);
    const sheetParam = url.searchParams.get("sheet");

    const source = await getSourceForDownload(id);
    if (!source) throw new Error("Source not found");

    const lowerName = source.vm.filename.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xlsm")) {
      throw new Error("Preview is only available for Excel sources");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      source.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );

    const sheetNames = workbook.worksheets.map((w) => w.name);
    const activeName =
      sheetParam && sheetNames.includes(sheetParam) ? sheetParam : sheetNames[0] ?? null;
    if (!activeName) {
      return ok({ sheets: [], activeSheet: null, rows: [] });
    }

    const worksheet = workbook.getWorksheet(activeName);
    if (!worksheet) {
      return ok({ sheets: sheetNames, activeSheet: activeName, rows: [] });
    }

    const rows: (string | number | boolean | null)[][] = [];
    let truncatedRows = false;
    let truncatedCols = false;
    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      if (rowIndex > MAX_ROWS) {
        truncatedRows = true;
        return;
      }
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const clipped = values.slice(0, MAX_COLS);
      if (values.length > MAX_COLS) truncatedCols = true;
      rows.push(
        clipped.map((value: unknown) => {
          if (value == null) return null;
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return value;
          }
          if (value instanceof Date) return value.toISOString();
          if (typeof value === "object" && "text" in (value as object)) {
            return String((value as { text?: unknown }).text ?? "");
          }
          if (typeof value === "object" && "result" in (value as object)) {
            return String((value as { result?: unknown }).result ?? "");
          }
          return String(value);
        })
      );
    });

    return ok({
      sheets: sheetNames,
      activeSheet: activeName,
      rows,
      truncated: { rows: truncatedRows, cols: truncatedCols, maxRows: MAX_ROWS, maxCols: MAX_COLS }
    });
  } catch (error) {
    return mapError(error);
  }
}
