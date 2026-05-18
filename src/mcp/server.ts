import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FIELD_TYPES } from "@/lib/constants";
import type { ApiUser } from "@/services/api-tokens";
import { userIsAdmin, userIsReadOnly } from "@/services/api-tokens";
import {
  createDocument,
  createField,
  createRow,
  createSnapshot,
  createUserSheet,
  ensureInstructionsReady,
  getDocumentExportModel,
  getSheetGrid,
  getWorkspaceData,
  impactAnalysis,
  listIntegrityIssues,
  listReferenceTargetsForField,
  patchCell,
  reorderFields,
  restoreDocument,
  restoreRow,
  restoreSheet,
  searchRepository,
  softDeleteRow,
  softDeleteSheet,
  updateDocument,
  updateField,
  updateSheet
} from "@/services/repository";
import { undoLastAction, NothingToUndoError } from "@/services/undo";
import {
  createSource as createSourceService,
  deleteSource as deleteSourceService,
  getSource as getSourceService,
  getSourceForDownload as getSourceForDownloadService,
  listSources as listSourcesService
} from "@/services/sources";
import { db } from "@/db";
import {
  auditEvents,
  cellValueLinks,
  documents,
  fields,
  rows,
  sheets,
  snapshotItems,
  snapshots
} from "@/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { writeAudit } from "@/services/audit";

type ActorContext = {
  user: ApiUser;
};

function actorFor(user: ApiUser) {
  return { userId: user.userId, username: user.username };
}

function auditActor(user: ApiUser) {
  return { id: user.userId, username: user.username };
}

function assertCanMutate(user: ApiUser) {
  if (userIsReadOnly(user)) {
    throw new Error(
      "This MCP token is read-only. Mutating operations require an editor/admin token."
    );
  }
}

function assertAdmin(user: ApiUser) {
  if (!userIsAdmin(user)) {
    throw new Error("This action requires the Admin role.");
  }
}

function jsonText(value: unknown): { content: { type: "text"; text: string }[] } {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ]
  };
}

function jsonError(message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: message
      }
    ]
  };
}

async function logMcp(
  user: ApiUser,
  summary: string,
  extra: Record<string, unknown> = {}
) {
  await writeAudit({
    actor: { id: user.userId, username: user.username },
    actionType: "PROFILE_UPDATE",
    entityType: "mcp",
    summary,
    sourceType: "system",
    requestMeta: { tokenId: user.tokenId, tokenName: user.tokenName, ...extra }
  });
}

export function buildMcpServer(user: ApiUser): McpServer {
  const server = new McpServer(
    {
      name: "edf-saber",
      version: "0.1.0"
    },
    {
      capabilities: { tools: {} },
      instructions: [
        "EDF SABER engineering repository — document, sheet, row, and cell operations.",
        `Authenticated as user "${user.username}"${user.roles.length ? ` (roles: ${user.roles.join(", ")})` : ""}${user.readOnly ? "; this token is READ-ONLY." : ""}.`,
        "Tools that mutate data write to an immutable audit log and respect role-based authorization.",
        "Reference cells store immutable row UUIDs; use list_reference_targets_for_field to discover valid targets.",
        "Field types: " + FIELD_TYPES.join(", ") + "."
      ].join("\n")
    }
  );

  const ctx: ActorContext = { user };
  registerDocumentTools(server, ctx);
  registerSheetTools(server, ctx);
  registerFieldTools(server, ctx);
  registerRowAndCellTools(server, ctx);
  registerSnapshotTools(server, ctx);
  registerInspectionTools(server, ctx);
  registerSourceTools(server, ctx);

  return server;
}

function registerDocumentTools(server: McpServer, { user }: ActorContext) {
  server.registerTool(
    "list_documents",
    {
      description:
        "List all documents in the workspace with their sheets and field summaries. Returns ids, titles, status, baseline state, classification, and per-sheet field counts.",
      inputSchema: {}
    },
    async () => {
      const data = await getWorkspaceData();
      return jsonText({
        documents: data.documents.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          status: d.status,
          classification: d.classification,
          baselineState: d.baselineState,
          templateType: d.templateType,
          integrityIssueCount: d.integrityIssueCount,
          sheets: d.sheets.map((s) => ({
            id: s.id,
            name: s.name,
            sheetKind: s.sheetKind,
            isSystemReserved: s.isSystemReserved,
            fieldCount: s.fields.length
          }))
        }))
      });
    }
  );

  server.registerTool(
    "get_document",
    {
      description:
        "Get a document's metadata and the full structure of its sheets and fields (no row data — use get_sheet for that).",
      inputSchema: { documentId: z.string().uuid() }
    },
    async ({ documentId }) => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
        .limit(1);
      if (!doc) return jsonError(`Document ${documentId} not found.`);
      const data = await getWorkspaceData();
      const full = data.documents.find((d) => d.id === documentId);
      return jsonText({ document: doc, sheets: full?.sheets ?? [] });
    }
  );

  server.registerTool(
    "create_document",
    {
      description:
        "Create a new document. Three reserved sheets (INSTRUCTIONS, GLOSSARY, OPEN ISSUES) are added automatically.",
      inputSchema: {
        title: z.string().min(1).max(220),
        description: z.string().max(10_000).optional(),
        classification: z.string().max(80).optional(),
        templateType: z.string().max(80).nullable().optional()
      }
    },
    async (input) => {
      assertCanMutate(user);
      const doc = await createDocument(actorFor(user), input);
      await logMcp(user, `MCP created document ${doc.title}`, { documentId: doc.id });
      return jsonText({ document: doc });
    }
  );

  server.registerTool(
    "update_document",
    {
      description:
        "Update a document's metadata. Provide only the fields you want to change. Version is checked for optimistic concurrency if supplied.",
      inputSchema: {
        documentId: z.string().uuid(),
        title: z.string().min(1).max(220).optional(),
        description: z.string().max(10_000).optional(),
        status: z.string().max(60).optional(),
        classification: z.string().max(80).optional(),
        baselineState: z.string().max(60).optional(),
        version: z.number().int().positive().optional()
      }
    },
    async ({ documentId, ...patch }) => {
      assertCanMutate(user);
      const doc = await updateDocument(actorFor(user), documentId, patch);
      await logMcp(user, `MCP updated document ${doc.title}`, { documentId });
      return jsonText({ document: doc });
    }
  );

  server.registerTool(
    "delete_document",
    {
      description:
        "Soft-delete (archive) a document. Reversible by an administrator. Returns impact analysis alongside the result.",
      inputSchema: { documentId: z.string().uuid() }
    },
    async ({ documentId }) => {
      assertCanMutate(user);
      const impact = await impactAnalysis("document_delete", documentId);
      const [before] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);
      if (!before) return jsonError(`Document ${documentId} not found.`);
      const [after] = await db
        .update(documents)
        .set({ deletedAt: new Date(), updatedBy: user.userId, updatedAt: new Date() })
        .where(eq(documents.id, documentId))
        .returning();
      await writeAudit({
        actor: auditActor(user),
        actionType: "DOCUMENT_DELETE",
        entityType: "document",
        entityId: documentId,
        parentDocumentId: documentId,
        parentDocumentName: before.title,
        before,
        after: { ...after, impact },
        summary: `Archived document ${before.title}`,
        sourceType: "system",
        requestMeta: { tokenId: user.tokenId, tokenName: user.tokenName }
      });
      return jsonText({ document: after, impact });
    }
  );

  server.registerTool(
    "restore_document",
    {
      description:
        "Un-archive a previously soft-deleted document. The document and all its sheets become visible again.",
      inputSchema: { documentId: z.string().uuid() }
    },
    async ({ documentId }) => {
      assertCanMutate(user);
      const doc = await restoreDocument(actorFor(user), documentId);
      await logMcp(user, `MCP restored document ${doc.title}`, { documentId });
      return jsonText({ document: doc });
    }
  );
}

function registerSheetTools(server: McpServer, { user }: ActorContext) {
  server.registerTool(
    "create_sheet",
    {
      description:
        "Add a new user-defined sheet to a document. The sheet automatically gets a system-managed Auto ID field with the given prefix and zero-pad.",
      inputSchema: {
        documentId: z.string().uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(20_000).optional(),
        idPrefix: z
          .string()
          .min(1)
          .max(20)
          .regex(/^[A-Za-z0-9]+$/)
          .default("ID"),
        zeroPad: z.number().int().min(1).max(8).default(2)
      }
    },
    async ({ documentId, ...input }) => {
      assertCanMutate(user);
      const sheet = await createUserSheet(actorFor(user), documentId, {
        name: input.name,
        description: input.description ?? "",
        idPrefix: input.idPrefix,
        zeroPad: input.zeroPad
      });
      await logMcp(user, `MCP created sheet ${sheet.name}`, { documentId, sheetId: sheet.id });
      return jsonText({ sheet });
    }
  );

  server.registerTool(
    "update_sheet",
    {
      description: "Update a sheet's name or description.",
      inputSchema: {
        sheetId: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(20_000).optional()
      }
    },
    async ({ sheetId, ...patch }) => {
      assertCanMutate(user);
      const sheet = await updateSheet(actorFor(user), sheetId, patch);
      await logMcp(user, `MCP updated sheet ${sheet.name}`, { sheetId });
      return jsonText({ sheet });
    }
  );

  server.registerTool(
    "get_sheet",
    {
      description:
        "Get a sheet's full content: fields (with options + reference bindings) and all rows with cell values. The Glossary sheet returns system-generated entries keyed by slug.",
      inputSchema: { sheetId: z.string().uuid() }
    },
    async ({ sheetId }) => {
      const grid = await getSheetGrid(sheetId);
      return jsonText({
        sheet: grid.sheet,
        fields: grid.fields,
        rows: grid.rows
      });
    }
  );

  server.registerTool(
    "delete_sheet",
    {
      description:
        "Soft-delete a user-defined sheet. Reserved sheets (Instructions / Glossary / Open Issues) cannot be deleted. Fails if any row in the sheet is referenced by another sheet — call list_incoming_references on those rows or remove the inbound references first.",
      inputSchema: { sheetId: z.string().uuid() }
    },
    async ({ sheetId }) => {
      assertCanMutate(user);
      const sheet = await softDeleteSheet(actorFor(user), sheetId);
      await logMcp(user, `MCP archived sheet ${sheet.name}`, {
        documentId: sheet.documentId,
        sheetId
      });
      return jsonText({ sheet });
    }
  );

  server.registerTool(
    "restore_sheet",
    {
      description: "Un-archive a previously soft-deleted sheet.",
      inputSchema: { sheetId: z.string().uuid() }
    },
    async ({ sheetId }) => {
      assertCanMutate(user);
      const sheet = await restoreSheet(actorFor(user), sheetId);
      await logMcp(user, `MCP restored sheet ${sheet.name}`, {
        documentId: sheet.documentId,
        sheetId
      });
      return jsonText({ sheet });
    }
  );
}

function registerFieldTools(server: McpServer, { user }: ActorContext) {
  server.registerTool(
    "create_field",
    {
      description:
        "Add a field (column) to a sheet. For enum/status/tag_list pass `options`. For single_reference / multi_reference pass `bindings` to restrict which sheets are valid targets (empty array = allow all sheets in this document). Each binding: `allowedSheetId` (UUID, or null for a sources-only binding), optional `displayFieldId` to pick which field's value is shown in reference chips for that target (defaults to the ID field), `allowSelfReference`, and `allowSources` to also accept uploaded sources as targets.",
      inputSchema: {
        sheetId: z.string().uuid(),
        label: z.string().min(1).max(160),
        type: z.enum(FIELD_TYPES),
        description: z.string().max(10_000).optional(),
        required: z.boolean().optional(),
        unique: z.boolean().optional(),
        editable: z.boolean().optional(),
        options: z.array(z.string().min(1).max(160)).optional(),
        bindings: z
          .array(
            z.object({
              allowedSheetId: z.string().uuid().nullable(),
              allowSelfReference: z.boolean().default(false),
              displayFieldId: z.string().uuid().nullable().optional(),
              allowSources: z.boolean().default(false)
            })
          )
          .optional()
      }
    },
    async ({ sheetId, ...input }) => {
      assertCanMutate(user);
      const field = await createField(actorFor(user), sheetId, {
        label: input.label,
        type: input.type,
        description: input.description,
        required: input.required,
        unique: input.unique,
        editable: input.editable,
        options: input.options ?? [],
        bindings: input.bindings ?? []
      });
      await logMcp(user, `MCP created field ${field.label}`, { sheetId, fieldId: field.id });
      return jsonText({ field });
    }
  );

  server.registerTool(
    "update_field",
    {
      description:
        "Edit a field's metadata. Field type cannot be changed. Pass `options` to replace the enum option list, `bindings` to replace reference target restrictions (see create_field for binding shape — including null `allowedSheetId` plus `allowSources: true` for a sources-only binding, and optional `displayFieldId` per target).",
      inputSchema: {
        fieldId: z.string().uuid(),
        label: z.string().min(1).max(160).optional(),
        description: z.string().max(10_000).optional(),
        required: z.boolean().optional(),
        unique: z.boolean().optional(),
        editable: z.boolean().optional(),
        options: z.array(z.string().min(1).max(160)).optional(),
        bindings: z
          .array(
            z.object({
              allowedSheetId: z.string().uuid().nullable(),
              allowSelfReference: z.boolean().default(false),
              displayFieldId: z.string().uuid().nullable().optional(),
              allowSources: z.boolean().default(false)
            })
          )
          .optional()
      }
    },
    async ({ fieldId, ...patch }) => {
      assertCanMutate(user);
      const field = await updateField(actorFor(user), fieldId, patch);
      await logMcp(user, `MCP updated field ${field.label}`, { fieldId });
      return jsonText({ field });
    }
  );

  server.registerTool(
    "archive_field",
    {
      description: "Archive (hide) a field. Rows keep their values; the field disappears from the grid.",
      inputSchema: { fieldId: z.string().uuid() }
    },
    async ({ fieldId }) => {
      assertCanMutate(user);
      const field = await updateField(actorFor(user), fieldId, { archived: true });
      await logMcp(user, `MCP archived field ${field.label}`, { fieldId });
      return jsonText({ field });
    }
  );

  server.registerTool(
    "reorder_fields",
    {
      description: "Reorder fields within a sheet by passing the full ordered list of field IDs.",
      inputSchema: {
        sheetId: z.string().uuid(),
        order: z.array(z.string().uuid()).min(1)
      }
    },
    async ({ sheetId, order }) => {
      assertCanMutate(user);
      const result = await reorderFields(actorFor(user), sheetId, order);
      await logMcp(user, `MCP reordered fields on sheet ${sheetId}`, { sheetId });
      return jsonText(result);
    }
  );

  server.registerTool(
    "list_reference_targets_for_field",
    {
      description:
        "List rows that can be assigned to a reference cell on this field. Respects reference bindings if configured.",
      inputSchema: { fieldId: z.string().uuid() }
    },
    async ({ fieldId }) => {
      const targets = await listReferenceTargetsForField(fieldId);
      return jsonText({ targets });
    }
  );
}

function registerRowAndCellTools(server: McpServer, { user }: ActorContext) {
  server.registerTool(
    "get_row",
    {
      description:
        "Fetch one row by id, with all its cell values resolved (references appear as link objects). Cheap alternative to get_sheet when you only need a single row.",
      inputSchema: { rowId: z.string().uuid() }
    },
    async ({ rowId }) => {
      const [row] = await db
        .select()
        .from(rows)
        .where(and(eq(rows.id, rowId), isNull(rows.deletedAt)))
        .limit(1);
      if (!row) return jsonError(`Row ${rowId} not found.`);
      const grid = await getSheetGrid(row.sheetId);
      const hydrated = grid.rows.find((r) => r.id === rowId);
      if (!hydrated) return jsonError(`Row ${rowId} not visible in its sheet.`);
      return jsonText({
        row: hydrated,
        sheet: { id: grid.sheet.id, name: grid.sheet.name, sheetKind: grid.sheet.sheetKind },
        fields: grid.fields
      });
    }
  );

  server.registerTool(
    "create_row",
    {
      description:
        "Create a row in a sheet. `cells` is a map of fieldId (or field slug) → value. Reference cells expect row UUIDs (array for multi-reference).",
      inputSchema: {
        sheetId: z.string().uuid(),
        cells: z.record(z.unknown()).optional()
      }
    },
    async ({ sheetId, cells }) => {
      assertCanMutate(user);
      const row = await createRow(actorFor(user), sheetId, { cells: cells ?? {} });
      await logMcp(user, `MCP created row ${row.visibleId ?? row.id}`, {
        sheetId,
        rowId: row.id
      });
      return jsonText({ row });
    }
  );

  server.registerTool(
    "delete_row",
    {
      description: "Soft-delete a row. Returns the row's pre-delete state.",
      inputSchema: { rowId: z.string().uuid() }
    },
    async ({ rowId }) => {
      assertCanMutate(user);
      const row = await softDeleteRow(actorFor(user), rowId);
      await logMcp(user, `MCP deleted row ${row.visibleId ?? row.id}`, { rowId });
      return jsonText({ row });
    }
  );

  server.registerTool(
    "set_cell_value",
    {
      description:
        "Set a single cell's value. For boolean pass true/false. For date pass an ISO string. For single_reference pass a row UUID. For multi_reference/multi_enum/tag_list pass an array.",
      inputSchema: {
        rowId: z.string().uuid(),
        fieldId: z.string().uuid(),
        value: z.unknown(),
        rowVersion: z.number().int().positive().optional()
      }
    },
    async ({ rowId, fieldId, value, rowVersion }) => {
      assertCanMutate(user);
      const result = await patchCell(actorFor(user), rowId, { fieldId, value, rowVersion });
      await logMcp(user, `MCP updated cell on row ${rowId}`, { rowId, fieldId });
      return jsonText(result);
    }
  );

  server.registerTool(
    "restore_row",
    {
      description: "Un-soft-delete a previously deleted row.",
      inputSchema: { rowId: z.string().uuid() }
    },
    async ({ rowId }) => {
      assertCanMutate(user);
      const row = await restoreRow(actorFor(user), rowId);
      await logMcp(user, `MCP restored row ${row.visibleId ?? row.id}`, { rowId });
      return jsonText({ row });
    }
  );

  server.registerTool(
    "list_incoming_references",
    {
      description:
        "List rows that reference this row (incoming links). Useful before deleting a row to see what depends on it.",
      inputSchema: { rowId: z.string().uuid() }
    },
    async ({ rowId }) => {
      const incoming = await db
        .select({
          sourceRowId: cellValueLinks.sourceRowId,
          sourceFieldId: cellValueLinks.sourceFieldId,
          fieldLabel: fields.label,
          sourceVisibleId: rows.visibleId,
          sheetId: rows.sheetId,
          sheetName: sheets.name,
          documentId: sheets.documentId,
          documentTitle: documents.title
        })
        .from(cellValueLinks)
        .innerJoin(rows, eq(rows.id, cellValueLinks.sourceRowId))
        .innerJoin(sheets, eq(sheets.id, rows.sheetId))
        .innerJoin(documents, eq(documents.id, sheets.documentId))
        .innerJoin(fields, eq(fields.id, cellValueLinks.sourceFieldId))
        .where(and(eq(cellValueLinks.targetRowId, rowId), isNull(rows.deletedAt)));
      return jsonText({ count: incoming.length, references: incoming });
    }
  );

  server.registerTool(
    "set_document_instructions",
    {
      description:
        "Set the body of a document's INSTRUCTIONS sheet. Automatically initialises the Body field + row on first use. Pass an empty string to clear the instructions.",
      inputSchema: {
        documentId: z.string().uuid(),
        body: z.string().max(50_000)
      }
    },
    async ({ documentId, body }) => {
      assertCanMutate(user);
      const [instructions] = await db
        .select()
        .from(sheets)
        .where(
          and(
            eq(sheets.documentId, documentId),
            eq(sheets.sheetKind, "instructions"),
            isNull(sheets.deletedAt)
          )
        )
        .limit(1);
      if (!instructions)
        return jsonError(`Document ${documentId} has no instructions sheet.`);
      const bodyField = await ensureInstructionsReady(actorFor(user), instructions.id);
      if (!bodyField) return jsonError("Could not initialise instructions sheet.");
      const [row] = await db
        .select()
        .from(rows)
        .where(and(eq(rows.sheetId, instructions.id), isNull(rows.deletedAt)))
        .limit(1);
      if (!row) return jsonError("Instructions row missing after init.");
      const result = await patchCell(actorFor(user), row.id, {
        fieldId: bodyField.id,
        value: body
      });
      await logMcp(user, `MCP set instructions on document ${documentId}`, { documentId });
      return jsonText({ ok: true, fieldId: bodyField.id, rowId: row.id, ...result });
    }
  );
}

function registerSnapshotTools(server: McpServer, { user }: ActorContext) {
  server.registerTool(
    "list_snapshots",
    {
      description: "List snapshots for a document, newest first.",
      inputSchema: { documentId: z.string().uuid() }
    },
    async ({ documentId }) => {
      const rows = await db
        .select()
        .from(snapshots)
        .where(eq(snapshots.documentId, documentId))
        .orderBy(desc(snapshots.createdAt));
      return jsonText({ snapshots: rows });
    }
  );

  server.registerTool(
    "create_snapshot",
    {
      description: "Capture a named, immutable snapshot of a document at this point in time.",
      inputSchema: {
        documentId: z.string().uuid(),
        name: z.string().min(1).max(180),
        baselineState: z.string().max(60).optional(),
        reason: z.string().max(2000).optional()
      }
    },
    async ({ documentId, ...input }) => {
      assertCanMutate(user);
      const snap = await createSnapshot(actorFor(user), documentId, {
        name: input.name,
        baselineState: input.baselineState ?? "draft",
        reason: input.reason
      });
      await logMcp(user, `MCP created snapshot ${snap.name}`, { documentId, snapshotId: snap.id });
      return jsonText({ snapshot: snap });
    }
  );

  server.registerTool(
    "diff_snapshots",
    {
      description:
        "Diff two snapshots of the same document. Returns added / changed / removed entities and their before/after JSON.",
      inputSchema: {
        leftSnapshotId: z.string().uuid(),
        rightSnapshotId: z.string().uuid()
      }
    },
    async ({ leftSnapshotId, rightSnapshotId }) => {
      const left = await db
        .select()
        .from(snapshotItems)
        .where(eq(snapshotItems.snapshotId, leftSnapshotId));
      const right = await db
        .select()
        .from(snapshotItems)
        .where(eq(snapshotItems.snapshotId, rightSnapshotId));
      const rightMap = new Map(right.map((i) => [`${i.entityType}:${i.entityId}`, i]));
      const changes: {
        type: "added" | "removed" | "changed";
        entityType: string;
        entityId: string;
        before: unknown;
        after: unknown;
      }[] = [];
      for (const item of left) {
        const key = `${item.entityType}:${item.entityId}`;
        const other = rightMap.get(key);
        if (!other)
          changes.push({
            type: "removed",
            entityType: item.entityType,
            entityId: item.entityId,
            before: item.stateJson,
            after: null
          });
        if (other && JSON.stringify(item.stateJson) !== JSON.stringify(other.stateJson))
          changes.push({
            type: "changed",
            entityType: item.entityType,
            entityId: item.entityId,
            before: item.stateJson,
            after: other.stateJson
          });
      }
      const leftSet = new Set(left.map((i) => `${i.entityType}:${i.entityId}`));
      for (const item of right) {
        const key = `${item.entityType}:${item.entityId}`;
        if (!leftSet.has(key))
          changes.push({
            type: "added",
            entityType: item.entityType,
            entityId: item.entityId,
            before: null,
            after: item.stateJson
          });
      }
      return jsonText({ changes });
    }
  );
}

function registerInspectionTools(server: McpServer, { user }: ActorContext) {
  server.registerTool(
    "get_me",
    {
      description:
        "Return the user that this MCP token is authenticated as (id, username, email, roles, token name, read-only flag). Useful for an agent to identify itself before mutating anything.",
      inputSchema: {}
    },
    async () => {
      return jsonText({
        userId: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organization: user.organization,
        roles: user.roles,
        tokenName: user.tokenName,
        readOnly: user.readOnly
      });
    }
  );

  server.registerTool(
    "search",
    {
      description:
        "Full-text search across documents, sheets, fields, rows, glossary, and open issues. Returns ranked results with match type and excerpt. When relationExpansion=true, also surfaces rows linked to direct matches.",
      inputSchema: {
        query: z.string().min(1).max(300),
        limit: z.number().int().min(1).max(100).default(25),
        relationExpansion: z.boolean().default(false)
      }
    },
    async ({ query, limit, relationExpansion }) => {
      const direct = await searchRepository(query);
      let results: unknown[] = direct.slice(0, limit);

      if (relationExpansion && direct.length > 0) {
        const matchedRowIds = direct
          .map((r) => r.rowId)
          .filter((id): id is string => Boolean(id));
        if (matchedRowIds.length > 0) {
          const links = await db
            .select({
              source: cellValueLinks.sourceRowId,
              target: cellValueLinks.targetRowId
            })
            .from(cellValueLinks)
            .where(inArray(cellValueLinks.sourceRowId, matchedRowIds));
          const expandedIds = Array.from(
            new Set(
              links
                .flatMap((l) => [l.source, l.target])
                .filter((id): id is string => Boolean(id) && !matchedRowIds.includes(id as string))
            )
          );
          if (expandedIds.length > 0) {
            const expanded = await db
              .select({
                id: rows.id,
                visibleId: rows.visibleId,
                sheetName: sheets.name,
                documentTitle: documents.title
              })
              .from(rows)
              .innerJoin(sheets, eq(sheets.id, rows.sheetId))
              .innerJoin(documents, eq(documents.id, sheets.documentId))
              .where(and(inArray(rows.id, expandedIds), isNull(rows.deletedAt)));
            results = [
              ...results,
              ...expanded.map((r) => ({
                matchType: "Linked",
                rowId: r.id,
                rowVisibleId: r.visibleId,
                sheetName: r.sheetName,
                documentName: r.documentTitle,
                excerpt: "Linked from a direct match"
              }))
            ];
          }
        }
      }

      return jsonText({ results });
    }
  );

  server.registerTool(
    "list_integrity_issues",
    {
      description:
        "List open integrity issues across the workspace (broken links, type errors, missing required values, etc.).",
      inputSchema: {}
    },
    async () => {
      const issues = await listIntegrityIssues();
      return jsonText({ issues });
    }
  );

  server.registerTool(
    "list_audit_events",
    {
      description:
        "List recent audit events. Admin tokens see all; non-admin tokens see only their own activity. Supports filtering by actor username, action type, and document id.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).default(100),
        actor: z.string().min(1).max(120).optional(),
        action: z.string().min(1).max(80).optional(),
        documentId: z.string().uuid().optional()
      }
    },
    async ({ limit, actor, action, documentId }) => {
      const conditions: ReturnType<typeof eq>[] = [];
      if (!userIsAdmin(user)) {
        conditions.push(eq(auditEvents.actingUserId, user.userId));
      } else if (actor) {
        conditions.push(eq(auditEvents.actingUsername, actor));
      }
      if (action) conditions.push(eq(auditEvents.actionType, action));
      if (documentId) conditions.push(eq(auditEvents.parentDocumentId, documentId));
      const events = await db
        .select()
        .from(auditEvents)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(auditEvents.timestamp))
        .limit(limit);
      return jsonText({ events });
    }
  );

  server.registerTool(
    "undo_last_action",
    {
      description:
        "Undo this user's most recent reversible action (row create, row delete, cell update, or document delete). Returns the action that was undone, or an error if nothing is undoable.",
      inputSchema: {}
    },
    async () => {
      assertCanMutate(user);
      try {
        const result = await undoLastAction(actorFor(user));
        await logMcp(user, `MCP undid ${result.undone.actionType}`, {
          undoneEventId: result.undone.eventId
        });
        return jsonText(result);
      } catch (error) {
        if (error instanceof NothingToUndoError)
          return jsonText({ undone: null, message: "Nothing to undo." });
        throw error;
      }
    }
  );

  server.registerTool(
    "list_trace_links",
    {
      description:
        "List trace links (row → row references) across the workspace. Optional filters: limit to a document, a source sheet, or a target sheet. Returns each link's source and target row identifiers, sheet/document names, and the source field that carries the reference.",
      inputSchema: {
        documentId: z.string().uuid().optional(),
        sourceSheetId: z.string().uuid().optional(),
        targetSheetId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(2000).default(500)
      }
    },
    async ({ documentId, sourceSheetId, targetSheetId, limit }) => {
      // Fetch all eligible links + every row/sheet/document needed to label them,
      // then resolve in JS. Avoids the awkward aliased-self-join SQL.
      const rawLinks = await db
        .select({
          sourceRowId: cellValueLinks.sourceRowId,
          sourceFieldId: cellValueLinks.sourceFieldId,
          targetRowId: cellValueLinks.targetRowId,
          ordinal: cellValueLinks.ordinal
        })
        .from(cellValueLinks)
        .limit(limit);

      if (rawLinks.length === 0) return jsonText({ count: 0, links: [] });

      const rowIds = Array.from(
        new Set(
          rawLinks
            .flatMap((l) => [l.sourceRowId, l.targetRowId])
            .filter((id): id is string => Boolean(id))
        )
      );
      const fieldIds = Array.from(new Set(rawLinks.map((l) => l.sourceFieldId)));

      const rowRows = await db
        .select({
          id: rows.id,
          visibleId: rows.visibleId,
          sheetId: rows.sheetId,
          deletedAt: rows.deletedAt
        })
        .from(rows)
        .where(inArray(rows.id, rowIds));

      const sheetIds = Array.from(
        new Set(rowRows.map((r) => r.sheetId).filter((id): id is string => Boolean(id)))
      );
      const sheetRows = sheetIds.length
        ? await db
            .select({
              id: sheets.id,
              name: sheets.name,
              documentId: sheets.documentId,
              deletedAt: sheets.deletedAt
            })
            .from(sheets)
            .where(inArray(sheets.id, sheetIds))
        : [];

      const docIds = Array.from(new Set(sheetRows.map((s) => s.documentId)));
      const docRows = docIds.length
        ? await db
            .select({
              id: documents.id,
              title: documents.title,
              deletedAt: documents.deletedAt
            })
            .from(documents)
            .where(inArray(documents.id, docIds))
        : [];

      const fieldRows = fieldIds.length
        ? await db
            .select({ id: fields.id, label: fields.label })
            .from(fields)
            .where(inArray(fields.id, fieldIds))
        : [];

      const rowMap = new Map(rowRows.map((r) => [r.id, r]));
      const sheetMap = new Map(sheetRows.map((s) => [s.id, s]));
      const docMap = new Map(docRows.map((d) => [d.id, d]));
      const fieldMap = new Map(fieldRows.map((f) => [f.id, f]));

      const enriched = rawLinks
        .map((l) => {
          // Source links (l.targetSourceId set, l.targetRowId null) are skipped
          // by this MCP tool — it surfaces row-to-row trace links only.
          if (!l.targetRowId) return null;
          const src = rowMap.get(l.sourceRowId);
          const tgt = rowMap.get(l.targetRowId);
          if (!src || !tgt) return null;
          if (src.deletedAt || tgt.deletedAt) return null;
          const ss = sheetMap.get(src.sheetId);
          const ts = sheetMap.get(tgt.sheetId);
          if (!ss || !ts || ss.deletedAt || ts.deletedAt) return null;
          const sd = docMap.get(ss.documentId);
          const td = docMap.get(ts.documentId);
          if (!sd || !td || sd.deletedAt || td.deletedAt) return null;
          if (sourceSheetId && ss.id !== sourceSheetId) return null;
          if (targetSheetId && ts.id !== targetSheetId) return null;
          if (documentId && sd.id !== documentId && td.id !== documentId) return null;
          return {
            sourceRowId: l.sourceRowId,
            sourceFieldId: l.sourceFieldId,
            sourceFieldLabel: fieldMap.get(l.sourceFieldId)?.label ?? null,
            sourceVisibleId: src.visibleId,
            sourceSheetId: ss.id,
            sourceSheetName: ss.name,
            sourceDocumentId: sd.id,
            sourceDocumentTitle: sd.title,
            targetRowId: l.targetRowId,
            targetVisibleId: tgt.visibleId,
            targetSheetId: ts.id,
            targetSheetName: ts.name,
            targetDocumentId: td.id,
            targetDocumentTitle: td.title,
            ordinal: l.ordinal
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return jsonText({ count: enriched.length, links: enriched });
    }
  );

  server.registerTool(
    "export_document_json",
    {
      description:
        "Export a document's complete content (sheets + fields + rows) as a single JSON blob. Useful for snapshotting state into a model's context.",
      inputSchema: { documentId: z.string().uuid() }
    },
    async ({ documentId }) => {
      const model = await getDocumentExportModel(documentId);
      return jsonText(model);
    }
  );

  server.registerTool(
    "preview_impact",
    {
      description:
        "Preview the impact of a destructive operation before applying it (row_delete, field_delete, sheet_delete, document_delete, field_type_change). Returns blockers and counts of affected records.",
      inputSchema: {
        operation: z.enum([
          "row_delete",
          "field_delete",
          "sheet_delete",
          "document_delete",
          "field_type_change"
        ]),
        entityId: z.string().uuid()
      }
    },
    async ({ operation, entityId }) => {
      const impact = await impactAnalysis(operation, entityId);
      return jsonText(impact);
    }
  );
}

function registerSourceTools(server: McpServer, { user }: ActorContext) {
  server.registerTool(
    "list_sources",
    {
      description:
        "List uploaded sources (PDF/DOCX/MD/TXT) from the global source library. Filter by filename substring with `q`. Sources can be referenced from reference cells when the field's binding has allow_sources=true.",
      inputSchema: {
        q: z.string().max(300).optional()
      }
    },
    async ({ q }) => {
      const list = await listSourcesService({ q });
      return jsonText({ count: list.length, sources: list });
    }
  );

  server.registerTool(
    "get_source",
    {
      description:
        "Fetch metadata for a single source (filename, mime, size, sha256, uploader, timestamps). Use download_source for the bytes.",
      inputSchema: { sourceId: z.string().uuid() }
    },
    async ({ sourceId }) => {
      const source = await getSourceService(sourceId);
      if (!source) return jsonError(`Source ${sourceId} not found.`);
      return jsonText({ source });
    }
  );

  server.registerTool(
    "create_source",
    {
      description:
        "Upload a source file. Provide either utf8 text content (for MD/TXT) or base64-encoded bytes (for PDF/DOCX). Filename's extension determines the type. Max 50 MB. Returns the created source; dedupes by sha256 when the same bytes already exist.",
      inputSchema: {
        filename: z.string().min(1).max(320),
        contentBase64: z.string().optional(),
        contentText: z.string().optional()
      }
    },
    async ({ filename, contentBase64, contentText }) => {
      assertCanMutate(user);
      if (!contentBase64 && contentText == null) {
        return jsonError("Provide contentBase64 or contentText.");
      }
      const buffer = contentBase64
        ? Buffer.from(contentBase64, "base64")
        : Buffer.from(contentText ?? "", "utf8");
      const source = await createSourceService(user, { filename, buffer });
      return jsonText({ source });
    }
  );

  server.registerTool(
    "delete_source",
    {
      description:
        "Soft-delete a source. Fails if any cell currently references it — drop those references first.",
      inputSchema: { sourceId: z.string().uuid() }
    },
    async ({ sourceId }) => {
      assertCanMutate(user);
      await deleteSourceService(user, sourceId);
      return jsonText({ ok: true });
    }
  );

  server.registerTool(
    "download_source",
    {
      description:
        "Return a source's bytes. PDF/DOCX come back as base64; MD/TXT come back as utf8 text. Use the appropriate field based on the source's mime_type.",
      inputSchema: { sourceId: z.string().uuid() }
    },
    async ({ sourceId }) => {
      const result = await getSourceForDownloadService(sourceId);
      if (!result) return jsonError(`Source ${sourceId} not found.`);
      const isText = result.vm.mimeType.startsWith("text/");
      return jsonText({
        source: result.vm,
        contentText: isText ? result.buffer.toString("utf8") : undefined,
        contentBase64: isText ? undefined : result.buffer.toString("base64")
      });
    }
  );
}
