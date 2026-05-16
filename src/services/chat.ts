import { and, asc, desc, eq, ilike, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMentions, chatMessages, documents, fields, rows, sheets, users } from "@/db/schema";
import { emitChatToDocument } from "@/realtime/hub";

export const MENTION_KINDS = ["user", "document", "sheet", "row", "cell"] as const;
export type MentionKind = (typeof MENTION_KINDS)[number];

export const mentionInputSchema = z.object({
  kind: z.enum(MENTION_KINDS),
  offset: z.number().int().nonnegative(),
  length: z.number().int().positive(),
  targetUserId: z.string().uuid().optional(),
  targetDocumentId: z.string().uuid().optional(),
  targetSheetId: z.string().uuid().optional(),
  targetRowId: z.string().uuid().optional(),
  targetFieldId: z.string().uuid().optional()
});

export const postChatSchema = z.object({
  body: z.string().min(1).max(4000),
  mentions: z.array(mentionInputSchema).max(50).default([])
});

export type ChatMessageVm = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; username: string; firstName: string | null; lastName: string | null };
  mentions: ChatMentionVm[];
};

export type ChatMentionVm = {
  kind: MentionKind;
  offset: number;
  length: number;
  target: {
    userId?: string;
    documentId?: string;
    sheetId?: string;
    rowId?: string;
    fieldId?: string;
    label: string;
  };
};

async function hydrateMentions(messageIds: string[]): Promise<Map<string, ChatMentionVm[]>> {
  if (messageIds.length === 0) return new Map();
  const raw = await db
    .select()
    .from(chatMentions)
    .where(or(...messageIds.map((id) => eq(chatMentions.messageId, id))))
    .orderBy(asc(chatMentions.offset));

  const userIds = new Set<string>();
  const docIds = new Set<string>();
  const sheetIds = new Set<string>();
  const rowIds = new Set<string>();
  const fieldIds = new Set<string>();
  for (const m of raw) {
    if (m.targetUserId) userIds.add(m.targetUserId);
    if (m.targetDocumentId) docIds.add(m.targetDocumentId);
    if (m.targetSheetId) sheetIds.add(m.targetSheetId);
    if (m.targetRowId) rowIds.add(m.targetRowId);
    if (m.targetFieldId) fieldIds.add(m.targetFieldId);
  }

  const [uRows, dRows, sRows, rRows, fRows] = await Promise.all([
    userIds.size
      ? db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(or(...Array.from(userIds).map((id) => eq(users.id, id))))
      : Promise.resolve([] as { id: string; username: string }[]),
    docIds.size
      ? db
          .select({ id: documents.id, title: documents.title })
          .from(documents)
          .where(or(...Array.from(docIds).map((id) => eq(documents.id, id))))
      : Promise.resolve([] as { id: string; title: string }[]),
    sheetIds.size
      ? db
          .select({ id: sheets.id, name: sheets.name })
          .from(sheets)
          .where(or(...Array.from(sheetIds).map((id) => eq(sheets.id, id))))
      : Promise.resolve([] as { id: string; name: string }[]),
    rowIds.size
      ? db
          .select({ id: rows.id, visibleId: rows.visibleId })
          .from(rows)
          .where(or(...Array.from(rowIds).map((id) => eq(rows.id, id))))
      : Promise.resolve([] as { id: string; visibleId: string | null }[]),
    fieldIds.size
      ? db
          .select({ id: fields.id, label: fields.label })
          .from(fields)
          .where(or(...Array.from(fieldIds).map((id) => eq(fields.id, id))))
      : Promise.resolve([] as { id: string; label: string }[])
  ]);

  const uMap = new Map(uRows.map((r) => [r.id, r.username]));
  const dMap = new Map(dRows.map((r) => [r.id, r.title]));
  const sMap = new Map(sRows.map((r) => [r.id, r.name]));
  const rMap = new Map(rRows.map((r) => [r.id, r.visibleId ?? r.id.slice(0, 8)]));
  const fMap = new Map(fRows.map((r) => [r.id, r.label]));

  const out = new Map<string, ChatMentionVm[]>();
  for (const m of raw) {
    let label = "?";
    const target: ChatMentionVm["target"] = { label: "?" };
    if (m.kind === "user" && m.targetUserId) {
      label = `@${uMap.get(m.targetUserId) ?? "unknown"}`;
      target.userId = m.targetUserId;
    } else if (m.kind === "document" && m.targetDocumentId) {
      label = `#${dMap.get(m.targetDocumentId) ?? "doc"}`;
      target.documentId = m.targetDocumentId;
    } else if (m.kind === "sheet" && m.targetSheetId) {
      label = `#${sMap.get(m.targetSheetId) ?? "sheet"}`;
      target.sheetId = m.targetSheetId;
      if (m.targetDocumentId) target.documentId = m.targetDocumentId;
    } else if (m.kind === "row" && m.targetRowId) {
      label = `#${rMap.get(m.targetRowId) ?? "row"}`;
      target.rowId = m.targetRowId;
      if (m.targetSheetId) target.sheetId = m.targetSheetId;
      if (m.targetDocumentId) target.documentId = m.targetDocumentId;
    } else if (m.kind === "cell" && m.targetRowId && m.targetFieldId) {
      label = `#${rMap.get(m.targetRowId) ?? "row"}.${fMap.get(m.targetFieldId) ?? "field"}`;
      target.rowId = m.targetRowId;
      target.fieldId = m.targetFieldId;
      if (m.targetSheetId) target.sheetId = m.targetSheetId;
      if (m.targetDocumentId) target.documentId = m.targetDocumentId;
    }
    target.label = label;
    const list = out.get(m.messageId) ?? [];
    list.push({ kind: m.kind as MentionKind, offset: m.offset, length: m.length, target });
    out.set(m.messageId, list);
  }
  return out;
}

export async function listChatMessages(documentId: string, opts: { before?: string; limit?: number } = {}): Promise<ChatMessageVm[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const conds = [eq(chatMessages.documentId, documentId), isNull(chatMessages.deletedAt)];
  if (opts.before) conds.push(lt(chatMessages.createdAt, new Date(opts.before)));
  const msgs = await db
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
      authorId: users.id,
      authorUsername: users.username,
      authorFirstName: users.firstName,
      authorLastName: users.lastName
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .where(and(...conds))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  const ids = msgs.map((m) => m.id);
  const mentionMap = await hydrateMentions(ids);

  return msgs
    .map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt ? m.editedAt.toISOString() : null,
      author: {
        id: m.authorId,
        username: m.authorUsername,
        firstName: m.authorFirstName,
        lastName: m.authorLastName
      },
      mentions: mentionMap.get(m.id) ?? []
    }))
    .reverse();
}

export async function createChatMessage(
  documentId: string,
  authorId: string,
  input: z.infer<typeof postChatSchema>
): Promise<ChatMessageVm> {
  const [inserted] = await db
    .insert(chatMessages)
    .values({ documentId, authorId, body: input.body })
    .returning();

  if (input.mentions.length) {
    await db.insert(chatMentions).values(
      input.mentions.map((m) => ({
        messageId: inserted.id,
        kind: m.kind,
        offset: m.offset,
        length: m.length,
        targetUserId: m.targetUserId ?? null,
        targetDocumentId: m.targetDocumentId ?? null,
        targetSheetId: m.targetSheetId ?? null,
        targetRowId: m.targetRowId ?? null,
        targetFieldId: m.targetFieldId ?? null
      }))
    );
  }

  const [vm] = await listChatMessages(documentId, { limit: 1 });
  // listChatMessages returns latest-last; we just inserted the latest.
  // If somehow racing, fall back to a direct fetch by id.
  const message = vm && vm.id === inserted.id ? vm : (await listChatMessages(documentId, { limit: 5 })).find((m) => m.id === inserted.id)!;
  emitChatToDocument(documentId, message);
  return message;
}

export type MentionSuggestion = {
  kind: MentionKind;
  id: string;
  label: string;
  hint?: string;
  documentId?: string;
  sheetId?: string;
};

export async function searchMentionTargets(
  documentId: string,
  kind: MentionKind,
  query: string,
  limit = 8
): Promise<MentionSuggestion[]> {
  const q = `%${query.replace(/[%_]/g, "")}%`;
  if (kind === "user") {
    const found = await db
      .select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.accountStatus, "active"), ilike(users.username, q)))
      .limit(limit);
    return found.map((u) => ({
      kind: "user",
      id: u.id,
      label: u.username,
      hint: [u.firstName, u.lastName].filter(Boolean).join(" ") || undefined
    }));
  }
  if (kind === "document") {
    const found = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(and(isNull(documents.deletedAt), ilike(documents.title, q)))
      .limit(limit);
    return found.map((d) => ({ kind: "document", id: d.id, label: d.title, documentId: d.id }));
  }
  if (kind === "sheet") {
    const found = await db
      .select({ id: sheets.id, name: sheets.name, documentId: sheets.documentId })
      .from(sheets)
      .where(and(isNull(sheets.deletedAt), eq(sheets.documentId, documentId), ilike(sheets.name, q)))
      .limit(limit);
    return found.map((s) => ({ kind: "sheet", id: s.id, label: s.name, documentId: s.documentId, sheetId: s.id }));
  }
  if (kind === "row") {
    const found = await db
      .select({
        id: rows.id,
        visibleId: rows.visibleId,
        sheetId: rows.sheetId,
        sheetName: sheets.name,
        documentId: sheets.documentId
      })
      .from(rows)
      .innerJoin(sheets, eq(sheets.id, rows.sheetId))
      .where(
        and(
          isNull(rows.deletedAt),
          isNull(sheets.deletedAt),
          eq(sheets.documentId, documentId),
          query.length > 0 ? ilike(rows.visibleId, q) : isNull(rows.deletedAt)
        )
      )
      .limit(limit);
    return found.map((r) => ({
      kind: "row",
      id: r.id,
      label: r.visibleId ?? r.id.slice(0, 8),
      hint: r.sheetName,
      documentId: r.documentId,
      sheetId: r.sheetId
    }));
  }
  return [];
}
