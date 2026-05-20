import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const STORAGE_ROOT = resolve(process.env.SOURCE_STORAGE_ROOT ?? "/app/var/sources");

export const SOURCE_MAX_BYTES = Number(process.env.SOURCE_MAX_BYTES ?? 50 * 1024 * 1024);

export const ALLOWED_SOURCE_EXTENSIONS = [
  "pdf",
  "docx",
  "md",
  "txt",
  "xlsx",
  "xlsm",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp"
] as const;
export type AllowedExtension = (typeof ALLOWED_SOURCE_EXTENSIONS)[number];

export const MIME_BY_EXTENSION: Record<AllowedExtension, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroenabled.12",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp"
};

export function extensionFromFilename(filename: string): AllowedExtension | null {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_SOURCE_EXTENSIONS) {
    if (lower.endsWith(`.${ext}`)) return ext;
  }
  return null;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// Files are stored content-addressed at /app/var/sources/<aa>/<bb>/<full-sha256><.ext>.
// Sharding by the first 4 hex chars keeps directory sizes sane even at scale.
function pathForSha(sha256: string, extension: AllowedExtension): string {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("Invalid sha256");
  return join(STORAGE_ROOT, sha256.slice(0, 2), sha256.slice(2, 4), `${sha256}.${extension}`);
}

export async function ensureStorageRoot(): Promise<void> {
  await mkdir(STORAGE_ROOT, { recursive: true });
}

export async function writeSourceFile(
  buffer: Buffer,
  extension: AllowedExtension
): Promise<{ sha256: string; storagePath: string; sizeBytes: number }> {
  if (buffer.byteLength === 0) throw new Error("Empty file");
  if (buffer.byteLength > SOURCE_MAX_BYTES) {
    throw new Error(`File too large (max ${SOURCE_MAX_BYTES} bytes)`);
  }
  const sha256 = sha256Hex(buffer);
  const absPath = pathForSha(sha256, extension);
  await mkdir(dirname(absPath), { recursive: true });
  // Content-addressed: skip rewrite if the exact byte sequence is already on disk.
  try {
    const existing = await stat(absPath);
    if (existing.size === buffer.byteLength) {
      return { sha256, storagePath: absPath, sizeBytes: buffer.byteLength };
    }
  } catch {
    // not present; fall through to write
  }
  await writeFile(absPath, buffer);
  return { sha256, storagePath: absPath, sizeBytes: buffer.byteLength };
}

export async function readSourceFile(storagePath: string): Promise<Buffer> {
  const abs = resolve(storagePath);
  if (!abs.startsWith(STORAGE_ROOT)) throw new Error("Storage path escapes root");
  return readFile(abs);
}

export async function deleteSourceFile(storagePath: string): Promise<void> {
  const abs = resolve(storagePath);
  if (!abs.startsWith(STORAGE_ROOT)) throw new Error("Storage path escapes root");
  try {
    await unlink(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
