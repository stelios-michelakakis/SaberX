import { and, desc, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cellValueLinks, sources, users } from "@/db/schema";
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
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  uploadedByUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

function toVm(row: {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  uploaderUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SourceVm {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    uploadedBy: row.uploadedBy,
    uploadedByUsername: row.uploaderUsername,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

const baseSelect = {
  id: sources.id,
  filename: sources.filename,
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
  if (filter.q && filter.q.trim()) conds.push(ilike(sources.filename, `%${filter.q.trim()}%`));
  const rows = await db
    .select(baseSelect)
    .from(sources)
    .leftJoin(users, eq(users.id, sources.uploadedBy))
    .where(and(...conds))
    .orderBy(desc(sources.createdAt))
    .limit(500);
  return rows.map(toVm);
}

export async function getSource(id: string): Promise<SourceVm | null> {
  const [row] = await db
    .select(baseSelect)
    .from(sources)
    .leftJoin(users, eq(users.id, sources.uploadedBy))
    .where(and(eq(sources.id, id), isNull(sources.deletedAt)))
    .limit(1);
  return row ? toVm(row) : null;
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
  input: { filename: string; buffer: Buffer }
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

export async function deleteSource(actor: Actor, id: string): Promise<void> {
  const [before] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  if (!before) throw new Error("Source not found");
  if (before.deletedAt) return;

  // Refuse deletion if the source is referenced by any cell.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cellValueLinks)
    .where(and(eq(cellValueLinks.targetSourceId, id), isNotNull(cellValueLinks.targetSourceId)));
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

