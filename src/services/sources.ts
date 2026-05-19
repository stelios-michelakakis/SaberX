import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cellValueLinks,
  documents,
  fields,
  rows,
  sheets,
  sources,
  users
} from "@/db/schema";
import { writeAudit } from "./audit";
import {
  ALLOWED_SOURCE_EXTENSIONS,
  MIME_BY_EXTENSION,
  extensionFromFilename,
  readSourceFile,
  writeSourceFile,
  type AllowedExtension
} from "./source-storage";

type Actor = { userId: string; username: string };

export type SourceVm = {
  id: string;
  filename: string;
  displayName: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  uploadedByUsername: string | null;
  referenceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SourceReferenceVm = {
  documentId: string;
  documentTitle: string;
  sheetId: string;
  sheetName: string;
  rowId: string;
  rowVisibleId: string | null;
  fieldId: string;
  fieldLabel: string;
};

function toVm(
  row: {
    id: string;
    filename: string;
    displayName: string | null;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    uploadedBy: string | null;
    uploaderUsername: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  referenceCount = 0
): SourceVm {
  return {
    id: row.id,
    filename: row.filename,
    displayName: row.displayName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    uploadedBy: row.uploadedBy,
    uploadedByUsername: row.uploaderUsername,
    referenceCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function referenceCounts(sourceIds: string[]): Promise<Map<string, number>> {
  if (sourceIds.length === 0) return new Map();
  // Count only references that originate from a live cell — a row whose
  // document or sheet has been soft-deleted no longer counts as a reference.
  const counts = await db
    .select({
      sourceId: cellValueLinks.targetSourceId,
      n: sql<number>`count(*)::int`
    })
    .from(cellValueLinks)
    .innerJoin(rows, eq(rows.id, cellValueLinks.sourceRowId))
    .innerJoin(sheets, eq(sheets.id, rows.sheetId))
    .innerJoin(documents, eq(documents.id, sheets.documentId))
    .where(
      and(
        isNotNull(cellValueLinks.targetSourceId),
        sql`${cellValueLinks.targetSourceId} IN (${sql.join(
          sourceIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        isNull(rows.deletedAt),
        isNull(sheets.deletedAt),
        isNull(documents.deletedAt)
      )
    )
    .groupBy(cellValueLinks.targetSourceId);
  const map = new Map<string, number>();
  for (const row of counts) {
    if (row.sourceId) map.set(row.sourceId, Number(row.n));
  }
  return map;
}

const baseSelect = {
  id: sources.id,
  filename: sources.filename,
  displayName: sources.displayName,
  mimeType: sources.mimeType,
  sizeBytes: sources.sizeBytes,
  sha256: sources.sha256,
  uploadedBy: sources.uploadedBy,
  uploaderUsername: users.username,
  createdAt: sources.createdAt,
  updatedAt: sources.updatedAt
};

export async function listSources(filter: { q?: string } = {}): Promise<SourceVm[]> {
  const conds = [isNull(sources.deletedAt)];
  if (filter.q && filter.q.trim()) {
    const term = `%${filter.q.trim()}%`;
    conds.push(
      sql`(${sources.filename} ILIKE ${term} OR ${sources.displayName} ILIKE ${term})`
    );
  }
  const sourceRows = await db
    .select(baseSelect)
    .from(sources)
    .leftJoin(users, eq(users.id, sources.uploadedBy))
    .where(and(...conds))
    .orderBy(desc(sources.createdAt))
    .limit(500);
  const counts = await referenceCounts(sourceRows.map((s) => s.id));
  return sourceRows.map((s) => toVm(s, counts.get(s.id) ?? 0));
}

export async function getSource(id: string): Promise<SourceVm | null> {
  const [row] = await db
    .select(baseSelect)
    .from(sources)
    .leftJoin(users, eq(users.id, sources.uploadedBy))
    .where(and(eq(sources.id, id), isNull(sources.deletedAt)))
    .limit(1);
  if (!row) return null;
  const counts = await referenceCounts([row.id]);
  return toVm(row, counts.get(row.id) ?? 0);
}

export async function getSourceReferences(sourceId: string): Promise<SourceReferenceVm[]> {
  const result = await db
    .select({
      documentId: documents.id,
      documentTitle: documents.title,
      sheetId: sheets.id,
      sheetName: sheets.name,
      rowId: rows.id,
      rowVisibleId: rows.visibleId,
      fieldId: fields.id,
      fieldLabel: fields.label
    })
    .from(cellValueLinks)
    .innerJoin(rows, eq(rows.id, cellValueLinks.sourceRowId))
    .innerJoin(sheets, eq(sheets.id, rows.sheetId))
    .innerJoin(documents, eq(documents.id, sheets.documentId))
    .innerJoin(fields, eq(fields.id, cellValueLinks.sourceFieldId))
    .where(
      and(
        eq(cellValueLinks.targetSourceId, sourceId),
        isNull(rows.deletedAt),
        isNull(sheets.deletedAt),
        isNull(documents.deletedAt)
      )
    )
    .orderBy(asc(documents.title), asc(sheets.displayOrder), asc(rows.canonicalOrder));
  return result;
}

export async function getSourceForDownload(id: string): Promise<{
  vm: SourceVm;
  buffer: Buffer;
} | null> {
  const [row] = await db
    .select({
      ...baseSelect,
      storagePath: sources.storagePath
    })
    .from(sources)
    .leftJoin(users, eq(users.id, sources.uploadedBy))
    .where(and(eq(sources.id, id), isNull(sources.deletedAt)))
    .limit(1);
  if (!row) return null;
  const buffer = await readSourceFile(row.storagePath);
  return { vm: toVm(row), buffer };
}

export async function createSource(
  actor: Actor,
  input: { filename: string; buffer: Buffer; displayName?: string | null }
): Promise<SourceVm> {
  const extension = extensionFromFilename(input.filename);
  if (!extension) {
    throw new Error(
      `Unsupported file type. Allowed: ${ALLOWED_SOURCE_EXTENSIONS.join(", ")}`
    );
  }
  const stored = await writeSourceFile(input.buffer, extension);
  // Dedup: if an existing row already has this sha256, reuse it.
  const [existing] = await db
    .select(baseSelect)
    .from(sources)
    .leftJoin(users, eq(users.id, sources.uploadedBy))
    .where(and(eq(sources.sha256, stored.sha256), isNull(sources.deletedAt)))
    .limit(1);
  if (existing) return toVm(existing);

  const mimeType = MIME_BY_EXTENSION[extension as AllowedExtension];
  const [inserted] = await db
    .insert(sources)
    .values({
      filename: input.filename,
      mimeType,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      storagePath: stored.storagePath,
      displayName: input.displayName?.trim() || null,
      uploadedBy: actor.userId
    })
    .returning();

  await writeAudit({
    actor: { id: actor.userId, username: actor.username },
    actionType: "SOURCE_CREATE",
    entityType: "source",
    entityId: inserted.id,
    after: { filename: inserted.filename, mimeType, sizeBytes: stored.sizeBytes, sha256: stored.sha256 },
    summary: `Uploaded source ${inserted.filename}`,
    sourceType: "UI"
  });

  const [vm] = await db
    .select(baseSelect)
    .from(sources)
    .leftJoin(users, eq(users.id, sources.uploadedBy))
    .where(eq(sources.id, inserted.id))
    .limit(1);
  return toVm(vm);
}

export async function renameSource(
  actor: Actor,
  id: string,
  nextDisplayName: string | null
): Promise<SourceVm> {
  const trimmed = nextDisplayName?.trim() ?? "";
  const nextValue = trimmed.length === 0 ? null : trimmed;
  if (nextValue && nextValue.length > 320) {
    throw new Error("Display name too long (max 320 chars)");
  }

  const [before] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  if (!before || before.deletedAt) throw new Error("Source not found");

  if (nextValue === before.displayName) {
    const current = await getSource(id);
    if (!current) throw new Error("Source not found");
    return current;
  }

  await db
    .update(sources)
    .set({ displayName: nextValue, updatedAt: new Date() })
    .where(eq(sources.id, id));

  await writeAudit({
    actor: { id: actor.userId, username: actor.username },
    actionType: "SOURCE_UPDATE",
    entityType: "source",
    entityId: id,
    before: { displayName: before.displayName, filename: before.filename },
    after: { displayName: nextValue, filename: before.filename },
    summary: nextValue
      ? `Renamed source ${before.filename} → ${nextValue}`
      : `Cleared display name for source ${before.filename}`,
    sourceType: "UI"
  });

  const updated = await getSource(id);
  if (!updated) throw new Error("Source vanished after rename");
  return updated;
}

export async function deleteSource(actor: Actor, id: string): Promise<void> {
  const [before] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  if (!before) throw new Error("Source not found");
  if (before.deletedAt) return;

  // Refuse deletion only if a LIVE cell still references this source. A row
  // whose document, sheet, or row itself has been soft-deleted is considered
  // unreachable — its lingering link rows shouldn't block source cleanup.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cellValueLinks)
    .innerJoin(rows, eq(rows.id, cellValueLinks.sourceRowId))
    .innerJoin(sheets, eq(sheets.id, rows.sheetId))
    .innerJoin(documents, eq(documents.id, sheets.documentId))
    .where(
      and(
        eq(cellValueLinks.targetSourceId, id),
        isNotNull(cellValueLinks.targetSourceId),
        isNull(rows.deletedAt),
        isNull(sheets.deletedAt),
        isNull(documents.deletedAt)
      )
    );
  if (Number(count) > 0) {
    throw new Error(`Source is referenced by ${count} cell(s); remove those references first`);
  }

  await db
    .update(sources)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(sources.id, id));

  await writeAudit({
    actor: { id: actor.userId, username: actor.username },
    actionType: "SOURCE_DELETE",
    entityType: "source",
    entityId: id,
    before: { filename: before.filename, sha256: before.sha256 },
    summary: `Deleted source ${before.filename}`,
    sourceType: "UI"
  });
}

