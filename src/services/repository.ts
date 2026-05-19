import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, max, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cellValueLinks,
  cellValuesScalar,
  documents,
  exportJobs,
  fieldOptions,
  fields,
  glossaryEntries,
  idPolicies,
  importJobs,
  integrityIssues,
  referenceBindings,
  rows,
  searchIndex,
  sheets,
  snapshotItems,
  snapshots,
  sources,
  tombstones,
  type Field,
  type Row,
  type Sheet
} from "@/db/schema";
import { FIELD_TYPES, OPEN_ISSUES_FIELDS, RESERVED_SHEETS, type FieldType } from "@/lib/constants";
import { assertNoCompoundPrefix, slugify, visibleId } from "@/lib/utils";
import { writeAudit, type AuditActor } from "./audit";

type ActorUser = { userId: string; username: string };

function actor(user: ActorUser): AuditActor {
  return { id: user.userId, username: user.username };
}

const URL_ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:", "ftp:"]);
const BOOLEAN_TRUE = new Set(["true", "yes", "1", "on"]);
const BOOLEAN_FALSE = new Set(["false", "no", "0", "off"]);

const EMPTY_NORMALIZED = {
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
  valueDate: null,
  valueDateTime: null,
  valueJson: null,
  normalizedText: "",
  displayText: ""
} as const;

function normalizeFieldValue(field: Field, value: unknown, allowedOptions: string[] = []) {
  if (value === null || value === undefined || value === "") {
    return { ...EMPTY_NORMALIZED };
  }

  switch (field.type as FieldType) {
    case "integer": {
      const numberValue = Number.parseInt(String(value), 10);
      if (Number.isNaN(numberValue)) throw new Error(`${field.label} must be an integer`);
      return { valueNumber: String(numberValue), valueText: null, valueBoolean: null, valueDate: null, valueDateTime: null, valueJson: null, normalizedText: String(numberValue), displayText: String(numberValue) };
    }
    case "decimal": {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue)) throw new Error(`${field.label} must be a decimal`);
      return { valueNumber: String(numberValue), valueText: null, valueBoolean: null, valueDate: null, valueDateTime: null, valueJson: null, normalizedText: String(numberValue), displayText: String(numberValue) };
    }
    case "boolean": {
      let bool: boolean;
      if (typeof value === "boolean") {
        bool = value;
      } else {
        const lower = String(value).trim().toLowerCase();
        if (BOOLEAN_TRUE.has(lower)) bool = true;
        else if (BOOLEAN_FALSE.has(lower)) bool = false;
        else throw new Error(`${field.label} must be a boolean (true/false)`);
      }
      return { valueBoolean: bool, valueText: null, valueNumber: null, valueDate: null, valueDateTime: null, valueJson: null, normalizedText: String(bool), displayText: bool ? "Yes" : "No" };
    }
    case "date": {
      const dateText = String(value).slice(0, 10);
      if (Number.isNaN(Date.parse(dateText))) throw new Error(`${field.label} must be a date`);
      return { valueDate: dateText, valueDateTime: null, valueText: null, valueNumber: null, valueBoolean: null, valueJson: null, normalizedText: dateText, displayText: dateText };
    }
    case "datetime": {
      const parsed = new Date(String(value));
      if (Number.isNaN(parsed.getTime())) throw new Error(`${field.label} must be a date/time`);
      return { valueDateTime: parsed, valueDate: null, valueText: null, valueNumber: null, valueBoolean: null, valueJson: null, normalizedText: parsed.toISOString(), displayText: parsed.toISOString() };
    }
    case "url": {
      const text = String(value).trim();
      let parsed: URL;
      try {
        parsed = new URL(text);
      } catch {
        throw new Error(`${field.label} must be a valid URL`);
      }
      if (!URL_ALLOWED_SCHEMES.has(parsed.protocol)) {
        throw new Error(`${field.label} URL scheme "${parsed.protocol}" is not allowed`);
      }
      return { valueText: text, valueNumber: null, valueBoolean: null, valueDate: null, valueDateTime: null, valueJson: null, normalizedText: text.toLowerCase(), displayText: text };
    }
    case "single_enum":
    case "status": {
      const text = String(value);
      if (allowedOptions.length === 0) {
        throw new Error(`${field.label} has no options defined`);
      }
      if (!allowedOptions.includes(text)) {
        throw new Error(`${field.label} value "${text}" is not one of: ${allowedOptions.join(", ")}`);
      }
      return { valueText: text, valueNumber: null, valueBoolean: null, valueDate: null, valueDateTime: null, valueJson: null, normalizedText: text.toLowerCase(), displayText: text };
    }
    case "multi_enum": {
      const values = Array.isArray(value) ? value.map(String) : String(value).split(",").map((item) => item.trim()).filter(Boolean);
      if (allowedOptions.length === 0) {
        throw new Error(`${field.label} has no options defined`);
      }
      const invalid = values.filter((v) => !allowedOptions.includes(v));
      if (invalid.length) {
        throw new Error(`${field.label} value(s) ${invalid.map((v) => `"${v}"`).join(", ")} not in option list`);
      }
      return { valueJson: values, valueText: null, valueNumber: null, valueBoolean: null, valueDate: null, valueDateTime: null, normalizedText: values.join(" "), displayText: values.join(", ") };
    }
    case "tag_list": {
      const values = Array.isArray(value) ? value.map(String) : String(value).split(",").map((item) => item.trim()).filter(Boolean);
      return { valueJson: values, valueText: null, valueNumber: null, valueBoolean: null, valueDate: null, valueDateTime: null, normalizedText: values.join(" "), displayText: values.join(", ") };
    }
    case "auto_id":
      throw new Error("Auto ID fields are system managed");
    case "single_reference":
    case "multi_reference":
      throw new Error("Reference values must be handled through link storage");
    default: {
      const text = String(value);
      return { valueText: text, valueNumber: null, valueBoolean: null, valueDate: null, valueDateTime: null, valueJson: null, normalizedText: text.toLowerCase(), displayText: text };
    }
  }
}

async function loadFieldOptionsIfEnum(client: any, field: Field): Promise<string[]> {
  if (field.type !== "single_enum" && field.type !== "multi_enum" && field.type !== "status") {
    return [];
  }
  const optionRows = await client
    .select({ value: fieldOptions.value })
    .from(fieldOptions)
    .where(and(eq(fieldOptions.fieldId, field.id), eq(fieldOptions.archived, false)));
  return optionRows.map((r: { value: string }) => r.value);
}

async function nextDisplayOrder(documentId: string, client: any) {
  const [result] = await client.select({ value: max(sheets.displayOrder) }).from(sheets).where(and(eq(sheets.documentId, documentId), isNull(sheets.deletedAt)));
  return Math.max(Number(result?.value ?? 3) + 1, 4);
}

async function nextRowOrder(sheetId: string, client: any) {
  const [result] = await client.select({ value: max(rows.canonicalOrder) }).from(rows).where(and(eq(rows.sheetId, sheetId), isNull(rows.deletedAt)));
  return Number(result?.value ?? 0) + 1;
}

async function getIdPolicyForSheet(sheetId: string, client: any) {
  const [policy] = await client.select().from(idPolicies).where(eq(idPolicies.sheetId, sheetId)).limit(1);
  return policy ?? null;
}

async function computeVisibleId(sheetId: string, sequence: number, client: any) {
  const policy = await getIdPolicyForSheet(sheetId, client);
  if (!policy) return null;
  return visibleId(policy.prefix, sequence, policy.zeroPad);
}

export async function createDocument(user: ActorUser, input: { title: string; description?: string; classification?: string; templateType?: string | null; provenance?: Record<string, unknown> }) {
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [document] = await tx
      .insert(documents)
      .values({
        title: input.title,
        description: input.description ?? "",
        classification: input.classification ?? "unclassified",
        templateType: input.templateType ?? null,
        ownerId: user.userId,
        createdBy: user.userId,
        updatedBy: user.userId,
        provenance: input.provenance ?? {}
      })
      .returning();

    const createdSheets: Sheet[] = [];
    for (const reserved of RESERVED_SHEETS) {
      const [sheet] = await tx
        .insert(sheets)
        .values({
          documentId: document.id,
          name: reserved.name,
          sheetKind: reserved.kind,
          isSystemReserved: true,
          fixedPosition: reserved.position,
          displayOrder: reserved.position,
          createdBy: user.userId,
          updatedBy: user.userId
        })
        .returning();
      createdSheets.push(sheet);

      if (reserved.kind === "glossary") {
        await tx.insert(fields).values([
          { sheetId: sheet.id, label: "Block", slug: "block", type: "short_text", description: "Metadata block.", required: true, editable: false, displayOrder: 1, createdBy: user.userId, updatedBy: user.userId },
          { sheetId: sheet.id, label: "Field or Code", slug: "field_or_code", type: "short_text", description: "Field label, schema code, or enum code.", required: true, editable: false, displayOrder: 2, createdBy: user.userId, updatedBy: user.userId },
          { sheetId: sheet.id, label: "Value or Meaning", slug: "value_or_meaning", type: "long_text", description: "Meaning, description, or system-generated definition.", required: true, editable: false, displayOrder: 3, createdBy: user.userId, updatedBy: user.userId }
        ]);
      }

      if (reserved.kind === "open_issues") {
        await tx.insert(idPolicies).values({ sheetId: sheet.id, prefix: "OP", zeroPad: 2 });
        for (const [index, field] of OPEN_ISSUES_FIELDS.entries()) {
          const [createdField] = await tx
            .insert(fields)
            .values({
              sheetId: sheet.id,
              label: field.label,
              slug: field.slug,
              type: field.type,
              description: field.description,
              required: field.required,
              editable: field.editable,
              displayOrder: index + 1,
              isIdField: field.type === "auto_id",
              createdBy: user.userId,
              updatedBy: user.userId
            })
            .returning();
          if ("options" in field && field.options?.length) {
            await tx.insert(fieldOptions).values(
              field.options.map((option, optionIndex) => ({
                fieldId: createdField.id,
                label: option,
                value: option,
                displayOrder: optionIndex + 1
              }))
            );
          }
        }
      }
    }

    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: "DOCUMENT_CREATE",
        entityType: "document",
        entityId: document.id,
        parentDocumentId: document.id,
        parentDocumentName: document.title,
        after: { document, sheets: createdSheets },
        summary: `Created document ${document.title}`
      },
      tx
    );
    await refreshGlossary(document.id, user, tx, txId);
    await refreshSearchIndex(document.id, tx);
    return document;
  });
}

export async function listDocuments() {
  return db.select().from(documents).where(isNull(documents.deletedAt)).orderBy(desc(documents.updatedAt));
}

export async function restoreDocument(user: ActorUser, id: string) {
  const [before] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!before) throw new Error("Document not found");
  if (!before.deletedAt) throw new Error("Document is not deleted");
  const [after] = await db
    .update(documents)
    .set({ deletedAt: null, updatedBy: user.userId, updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning();
  await writeAudit({
    actor: actor(user),
    actionType: "DOCUMENT_UPDATE",
    entityType: "document",
    entityId: id,
    parentDocumentId: id,
    parentDocumentName: before.title,
    before,
    after,
    summary: `Restored document ${before.title}`
  });
  await refreshSearchIndex(id);
  return after;
}

export async function getWorkspaceData() {
  const docs = await db.select().from(documents).where(isNull(documents.deletedAt)).orderBy(desc(documents.updatedAt));
  const documentIds = docs.map((document) => document.id);
  if (!documentIds.length) return { documents: [] };

  const sheetRows = await db.select().from(sheets).where(and(inArray(sheets.documentId, documentIds), isNull(sheets.deletedAt))).orderBy(asc(sheets.displayOrder));
  const sheetIds = sheetRows.map((sheet) => sheet.id);
  const fieldRows = sheetIds.length ? await db.select().from(fields).where(and(inArray(fields.sheetId, sheetIds), eq(fields.archived, false))).orderBy(asc(fields.displayOrder)) : [];
  const issueCounts = sheetIds.length ? await db.select({ documentId: integrityIssues.documentId, count: sql<number>`count(*)::int` }).from(integrityIssues).where(eq(integrityIssues.status, "open")).groupBy(integrityIssues.documentId) : [];
  const countMap = new Map(issueCounts.map((item) => [item.documentId, Number(item.count)]));

  return {
    documents: docs.map((document) => ({
      ...document,
      integrityIssueCount: countMap.get(document.id) ?? 0,
      sheets: sheetRows
        .filter((sheet) => sheet.documentId === document.id)
        .map((sheet) => ({ ...sheet, fields: fieldRows.filter((field) => field.sheetId === sheet.id) }))
    }))
  };
}

export async function updateDocument(user: ActorUser, id: string, input: Partial<{ title: string; description: string; status: string; classification: string; baselineState: string; version: number }>) {
  const [before] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!before || before.deletedAt) throw new Error("Document not found");
  if (input.version && input.version !== before.version) throw new Error("Document has changed since it was loaded");
  const [after] = await db
    .update(documents)
    .set({
      title: input.title ?? before.title,
      description: input.description ?? before.description,
      status: input.status ?? before.status,
      classification: input.classification ?? before.classification,
      baselineState: input.baselineState ?? before.baselineState,
      updatedBy: user.userId,
      updatedAt: new Date(),
      version: before.version + 1
    })
    .where(eq(documents.id, id))
    .returning();
  await writeAudit({
    actor: actor(user),
    actionType: "DOCUMENT_UPDATE",
    entityType: "document",
    entityId: id,
    parentDocumentId: id,
    parentDocumentName: after.title,
    before,
    after,
    summary: `Updated document ${after.title}`
  });
  await refreshSearchIndex(id);
  return after;
}

export async function softDeleteSheet(user: ActorUser, sheetId: string) {
  const [before] = await db.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
  if (!before) throw new Error("Sheet not found");
  if (before.deletedAt) return before;
  if (before.isSystemReserved)
    throw new Error("Reserved sheets (Instructions / Glossary / Open Issues) cannot be deleted.");
  const impact = await impactAnalysis("sheet_delete", sheetId);
  if (impact.blocked) throw new Error(impact.blockers[0]);
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [after] = await tx
      .update(sheets)
      .set({ deletedAt: new Date(), updatedBy: user.userId, updatedAt: new Date() })
      .where(eq(sheets.id, sheetId))
      .returning();
    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: "SHEET_DELETE",
        entityType: "sheet",
        entityId: sheetId,
        parentDocumentId: before.documentId,
        parentSheetId: sheetId,
        parentSheetName: before.name,
        before,
        after,
        summary: `Archived sheet ${before.name}`
      },
      tx
    );
    await refreshGlossary(before.documentId, user, tx, txId);
    await refreshSearchIndex(before.documentId, tx);
    return after;
  });
}

export async function restoreSheet(user: ActorUser, sheetId: string) {
  const [before] = await db.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
  if (!before) throw new Error("Sheet not found");
  if (!before.deletedAt) throw new Error("Sheet is not deleted");
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [after] = await tx
      .update(sheets)
      .set({ deletedAt: null, updatedBy: user.userId, updatedAt: new Date() })
      .where(eq(sheets.id, sheetId))
      .returning();
    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: "SHEET_UPDATE",
        entityType: "sheet",
        entityId: sheetId,
        parentDocumentId: before.documentId,
        parentSheetId: sheetId,
        parentSheetName: before.name,
        before,
        after,
        summary: `Restored sheet ${before.name}`
      },
      tx
    );
    await refreshGlossary(before.documentId, user, tx, txId);
    await refreshSearchIndex(before.documentId, tx);
    return after;
  });
}

export async function createUserSheet(user: ActorUser, documentId: string, input: { name: string; description?: string; idPrefix: string; zeroPad: number }) {
  assertNoCompoundPrefix(input.idPrefix);
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [document] = await tx.select().from(documents).where(and(eq(documents.id, documentId), isNull(documents.deletedAt))).limit(1);
    if (!document) throw new Error("Document not found");
    const order = await nextDisplayOrder(documentId, tx);
    const [sheet] = await tx
      .insert(sheets)
      .values({
        documentId,
        name: input.name,
        sheetKind: "standard",
        displayOrder: order,
        description: input.description ?? "",
        createdBy: user.userId,
        updatedBy: user.userId
      })
      .returning();
    await tx.insert(idPolicies).values({ sheetId: sheet.id, prefix: input.idPrefix.toUpperCase(), zeroPad: input.zeroPad });
    const [idField] = await tx
      .insert(fields)
      .values({
        sheetId: sheet.id,
        label: "ID",
        slug: "id",
        type: "auto_id",
        description: "System-generated visible engineering ID. References use the hidden immutable row UUID.",
        required: true,
        editable: false,
        displayOrder: 1,
        isIdField: true,
        createdBy: user.userId,
        updatedBy: user.userId
      })
      .returning();
    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: "SHEET_CREATE",
        entityType: "sheet",
        entityId: sheet.id,
        parentDocumentId: document.id,
        parentDocumentName: document.title,
        parentSheetId: sheet.id,
        parentSheetName: sheet.name,
        after: { sheet, idField },
        summary: `Created sheet ${sheet.name}`
      },
      tx
    );
    await refreshGlossary(documentId, user, tx, txId);
    await refreshSearchIndex(documentId, tx);
    return sheet;
  });
}

export async function updateSheet(user: ActorUser, sheetId: string, input: Partial<{ name: string; description: string; version: number }>) {
  const [before] = await db.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
  if (!before || before.deletedAt) throw new Error("Sheet not found");
  if (before.isSystemReserved && input.name && input.name !== before.name) throw new Error("Reserved sheets cannot be renamed");
  if (input.version && input.version !== before.version) throw new Error("Sheet has changed since it was loaded");
  const [document] = await db.select().from(documents).where(eq(documents.id, before.documentId)).limit(1);
  const [after] = await db
    .update(sheets)
    .set({
      name: input.name ?? before.name,
      description: input.description ?? before.description,
      updatedBy: user.userId,
      updatedAt: new Date(),
      version: before.version + 1
    })
    .where(eq(sheets.id, sheetId))
    .returning();
  await writeAudit({
    actor: actor(user),
    actionType: "SHEET_UPDATE",
    entityType: "sheet",
    entityId: sheetId,
    parentDocumentId: before.documentId,
    parentDocumentName: document?.title,
    parentSheetId: sheetId,
    parentSheetName: after.name,
    before,
    after,
    summary: `Updated sheet ${after.name}`
  });
  await refreshGlossary(before.documentId, user);
  await refreshSearchIndex(before.documentId);
  return after;
}

export async function createField(
  user: ActorUser,
  sheetId: string,
  input: {
    label: string;
    type: FieldType;
    description?: string;
    required?: boolean;
    unique?: boolean;
    editable?: boolean;
    options?: string[];
    validation?: Record<string, unknown>;
    bindings?: { allowedSheetId: string | null; allowSelfReference?: boolean; displayFieldId?: string | null; allowSources?: boolean }[];
  }
) {
  if (!FIELD_TYPES.includes(input.type)) throw new Error("Unsupported field type");
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [sheet] = await tx.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
    if (!sheet || sheet.deletedAt) throw new Error("Sheet not found");
    if (sheet.sheetKind === "glossary") throw new Error("GLOSSARY schema is system controlled");
    if (sheet.sheetKind === "open_issues") throw new Error("OPEN ISSUES schema is system controlled in MVP");
    if (input.type === "auto_id") throw new Error("Each sheet already has one system-managed Auto ID field");
    const [order] = await tx.select({ value: max(fields.displayOrder) }).from(fields).where(eq(fields.sheetId, sheetId));
    const [field] = await tx
      .insert(fields)
      .values({
        sheetId,
        label: input.label,
        slug: slugify(input.label),
        type: input.type,
        description: input.description ?? "",
        required: input.required ?? false,
        unique: input.unique ?? false,
        editable: input.editable ?? true,
        validationJson: input.validation ?? {},
        displayOrder: Number(order?.value ?? 0) + 1,
        createdBy: user.userId,
        updatedBy: user.userId
      })
      .returning();
    if (input.options?.length) {
      await tx.insert(fieldOptions).values(input.options.map((option, index) => ({ fieldId: field.id, label: option, value: option, displayOrder: index + 1 })));
    }
    const isReference = input.type === "single_reference" || input.type === "multi_reference";
    if (isReference && input.bindings && input.bindings.length > 0) {
      const sheetBound = input.bindings.filter(
        (b): b is typeof b & { allowedSheetId: string } => b.allowedSheetId !== null
      );
      const sourceOnly = input.bindings.filter((b) => b.allowedSheetId === null && b.allowSources);
      const sheetDocByBindingId = new Map<string, string>();
      if (sheetBound.length > 0) {
        const validSheets = await tx
          .select({ id: sheets.id, documentId: sheets.documentId })
          .from(sheets)
          .where(
            and(
              isNull(sheets.deletedAt),
              inArray(
                sheets.id,
                sheetBound.map((b) => b.allowedSheetId)
              )
            )
          );
        for (const s of validSheets) sheetDocByBindingId.set(s.id, s.documentId);
      }
      const acceptedSheetBound = sheetBound.filter((b) => sheetDocByBindingId.has(b.allowedSheetId));
      const bindingRows = [
        ...acceptedSheetBound.map((b) => ({
          fieldId: field.id,
          allowedDocumentId: sheetDocByBindingId.get(b.allowedSheetId) ?? sheet.documentId,
          allowedSheetId: b.allowedSheetId,
          allowSelfReference: b.allowSelfReference ?? false,
          displayFieldId: b.displayFieldId ?? null,
          allowSources: b.allowSources ?? false
        })),
        ...sourceOnly.map(() => ({
          fieldId: field.id,
          allowedDocumentId: sheet.documentId,
          allowedSheetId: null,
          allowSelfReference: false,
          displayFieldId: null,
          allowSources: true
        }))
      ];
      if (bindingRows.length > 0) {
        await tx.insert(referenceBindings).values(bindingRows);
      }
    }
    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: "FIELD_CREATE",
        entityType: "field",
        entityId: field.id,
        parentDocumentId: sheet.documentId,
        parentSheetId: sheet.id,
        parentSheetName: sheet.name,
        fieldId: field.id,
        fieldLabel: field.label,
        after: field,
        summary: `Created field ${field.label}`
      },
      tx
    );
    await refreshGlossary(sheet.documentId, user, tx, txId);
    await refreshSearchIndex(sheet.documentId, tx);
    return field;
  });
}

export async function updateField(
  user: ActorUser,
  fieldId: string,
  input: Partial<{
    label: string;
    description: string;
    required: boolean;
    unique: boolean;
    editable: boolean;
    options: string[];
    validation: Record<string, unknown>;
    archived: boolean;
    bindings: { allowedSheetId: string | null; allowSelfReference?: boolean; displayFieldId?: string | null; allowSources?: boolean }[];
  }>
) {
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(fields).where(eq(fields.id, fieldId)).limit(1);
    if (!before) throw new Error("Field not found");
    if (before.isIdField) throw new Error("ID field cannot be edited");
    const [sheet] = await tx.select().from(sheets).where(eq(sheets.id, before.sheetId)).limit(1);
    if (!sheet) throw new Error("Sheet not found");
    if (sheet.sheetKind === "glossary") throw new Error("GLOSSARY schema is system controlled");
    const [after] = await tx
      .update(fields)
      .set({
        label: input.label ?? before.label,
        // Slug is immutable after creation — renaming the label does not
        // regenerate the slug, since clients may address cells by slug.
        slug: before.slug,
        description: input.description ?? before.description,
        required: input.required ?? before.required,
        unique: input.unique ?? before.unique,
        editable: input.editable ?? before.editable,
        validationJson: input.validation ?? before.validationJson,
        archived: input.archived ?? before.archived,
        updatedBy: user.userId,
        updatedAt: new Date()
      })
      .where(eq(fields.id, fieldId))
      .returning();
    if (input.options) {
      await tx.delete(fieldOptions).where(eq(fieldOptions.fieldId, fieldId));
      if (input.options.length) {
        await tx.insert(fieldOptions).values(
          input.options.map((option, index) => ({
            fieldId,
            label: option,
            value: option,
            displayOrder: index + 1
          }))
        );
      }
    }
    const isReference = after.type === "single_reference" || after.type === "multi_reference";
    if (isReference && input.bindings !== undefined) {
      await tx.delete(referenceBindings).where(eq(referenceBindings.fieldId, fieldId));
      if (input.bindings.length > 0) {
        const sheetBound = input.bindings.filter(
          (b): b is typeof b & { allowedSheetId: string } => b.allowedSheetId !== null
        );
        const sourceOnly = input.bindings.filter(
          (b) => b.allowedSheetId === null && b.allowSources
        );
        const sheetDocByBindingId = new Map<string, string>();
        if (sheetBound.length > 0) {
          const validSheets = await tx
            .select({ id: sheets.id, documentId: sheets.documentId })
            .from(sheets)
            .where(
              and(
                isNull(sheets.deletedAt),
                inArray(
                  sheets.id,
                  sheetBound.map((b) => b.allowedSheetId)
                )
              )
            );
          for (const s of validSheets) sheetDocByBindingId.set(s.id, s.documentId);
        }
        const acceptedSheetBound = sheetBound.filter((b) =>
          sheetDocByBindingId.has(b.allowedSheetId)
        );
        const bindingRows = [
          ...acceptedSheetBound.map((b) => ({
            fieldId,
            allowedDocumentId: sheetDocByBindingId.get(b.allowedSheetId) ?? sheet.documentId,
            allowedSheetId: b.allowedSheetId,
            allowSelfReference: b.allowSelfReference ?? false,
            displayFieldId: b.displayFieldId ?? null,
            allowSources: b.allowSources ?? false
          })),
          ...sourceOnly.map(() => ({
            fieldId,
            allowedDocumentId: sheet.documentId,
            allowedSheetId: null,
            allowSelfReference: false,
            displayFieldId: null,
            allowSources: true
          }))
        ];
        if (bindingRows.length > 0) {
          await tx.insert(referenceBindings).values(bindingRows);
        }
      }
    }
    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: input.archived === true ? "FIELD_DELETE" : "FIELD_UPDATE",
        entityType: "field",
        entityId: fieldId,
        parentDocumentId: sheet.documentId,
        parentSheetId: sheet.id,
        parentSheetName: sheet.name,
        fieldId,
        fieldLabel: after.label,
        before,
        after,
        summary:
          input.archived === true
            ? `Archived field ${before.label}`
            : `Updated field ${after.label}`
      },
      tx
    );
    await refreshGlossary(sheet.documentId, user, tx, txId);
    await refreshSearchIndex(sheet.documentId, tx);
    return after;
  });
}

export async function reorderFields(user: ActorUser, sheetId: string, orderedFieldIds: string[]) {
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [sheet] = await tx.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
    if (!sheet) throw new Error("Sheet not found");
    if (sheet.sheetKind === "glossary") throw new Error("GLOSSARY field order is system controlled");
    for (let i = 0; i < orderedFieldIds.length; i++) {
      await tx
        .update(fields)
        .set({ displayOrder: i + 1, updatedBy: user.userId, updatedAt: new Date() })
        .where(and(eq(fields.id, orderedFieldIds[i]), eq(fields.sheetId, sheetId)));
    }
    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: "FIELD_UPDATE",
        entityType: "field_order",
        entityId: sheetId,
        parentDocumentId: sheet.documentId,
        parentSheetId: sheet.id,
        parentSheetName: sheet.name,
        after: { order: orderedFieldIds },
        summary: `Reordered fields on ${sheet.name}`
      },
      tx
    );
    return { sheetId, order: orderedFieldIds };
  });
}

export async function ensureInstructionsReady(user: ActorUser, sheetId: string) {
  // Concurrent calls (e.g. React 19 strict-mode double-effect in dev) used to
  // race on the unique (sheet_id, slug) constraint when both tried to insert
  // the Body field. Serialize per-sheet with an advisory lock held for the
  // life of the transaction.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${sheetId}))`);

    const [sheet] = await tx.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
    if (!sheet || sheet.sheetKind !== "instructions") return null;

    const existing = await tx
      .select()
      .from(fields)
      .where(and(eq(fields.sheetId, sheetId), eq(fields.archived, false)));
    let bodyField = existing.find((f) => f.slug === "body");
    if (!bodyField) {
      const [created] = await tx
        .insert(fields)
        .values({
          sheetId,
          label: "Body",
          slug: "body",
          type: "long_text",
          description: "Document-specific instructions, guidance, or context.",
          required: false,
          editable: true,
          displayOrder: 1,
          createdBy: user.userId,
          updatedBy: user.userId
        })
        .returning();
      bodyField = created;
    }

    const existingRows = await tx
      .select()
      .from(rows)
      .where(and(eq(rows.sheetId, sheetId), isNull(rows.deletedAt)));
    if (existingRows.length === 0) {
      await tx
        .insert(rows)
        .values({
          sheetId,
          canonicalOrder: 1,
          createdBy: user.userId,
          updatedBy: user.userId
        })
        .returning();
    }

    return bodyField;
  });
}

export async function getSheetGrid(sheetId: string) {
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
  if (!sheet || sheet.deletedAt) throw new Error("Sheet not found");
  const fieldRows = await db.select().from(fields).where(and(eq(fields.sheetId, sheetId), eq(fields.archived, false))).orderBy(asc(fields.displayOrder));
  const fieldIds = fieldRows.map((f) => f.id);
  const optionRows = fieldIds.length
    ? await db
        .select()
        .from(fieldOptions)
        .where(and(inArray(fieldOptions.fieldId, fieldIds), eq(fieldOptions.archived, false)))
        .orderBy(asc(fieldOptions.displayOrder))
    : [];
  const bindingRows = fieldIds.length
    ? await db
        .select()
        .from(referenceBindings)
        .where(inArray(referenceBindings.fieldId, fieldIds))
    : [];
  const fieldsWithOptions = fieldRows.map((f) => ({
    ...f,
    options: optionRows.filter((o) => o.fieldId === f.id).map((o) => ({ label: o.label, value: o.value })),
    bindings: bindingRows
      .filter((b) => b.fieldId === f.id)
      .map((b) => ({
        allowedSheetId: b.allowedSheetId,
        allowSelfReference: b.allowSelfReference,
        displayFieldId: b.displayFieldId,
        allowSources: b.allowSources
      }))
  }));

  if (sheet.sheetKind === "glossary") {
    const entries = await db.select().from(glossaryEntries).where(eq(glossaryEntries.documentId, sheet.documentId)).orderBy(asc(glossaryEntries.block), asc(glossaryEntries.fieldOrCode));
    return { sheet, fields: fieldsWithOptions, rows: entries.map((entry) => ({ id: entry.id, visibleId: "", canonicalOrder: 0, cells: { block: entry.block, field_or_code: entry.fieldOrCode, value_or_meaning: entry.valueOrMeaning } })) };
  }

  const rowRows = await db.select().from(rows).where(and(eq(rows.sheetId, sheetId), isNull(rows.deletedAt))).orderBy(asc(rows.canonicalOrder));
  const rowIds = rowRows.map((row) => row.id);
  const scalarCells = rowIds.length ? await db.select().from(cellValuesScalar).where(inArray(cellValuesScalar.rowId, rowIds)) : [];
  const linkCells = rowIds.length
    ? await db
        .select({
          sourceRowId: cellValueLinks.sourceRowId,
          sourceFieldId: cellValueLinks.sourceFieldId,
          targetRowId: cellValueLinks.targetRowId,
          targetSourceId: cellValueLinks.targetSourceId,
          ordinal: cellValueLinks.ordinal,
          targetVisibleId: rows.visibleId,
          targetSheetId: rows.sheetId,
          targetSheetName: sheets.name,
          targetSourceFilename: sources.filename,
          targetSourceDisplayName: sources.displayName,
          targetSourceMime: sources.mimeType
        })
        .from(cellValueLinks)
        .leftJoin(rows, eq(rows.id, cellValueLinks.targetRowId))
        .leftJoin(sheets, eq(sheets.id, rows.sheetId))
        .leftJoin(sources, eq(sources.id, cellValueLinks.targetSourceId))
        .where(
          and(
            inArray(cellValueLinks.sourceRowId, rowIds),
            // Hide chips that point at a soft-deleted target. Row-links: the
            // joined row/sheet must still be live; source-links: the source
            // row must still be live. The dangling cell_value_links rows
            // themselves are left in place so a future restore brings them
            // back.
            or(
              and(
                isNotNull(cellValueLinks.targetRowId),
                isNull(rows.deletedAt),
                isNull(sheets.deletedAt)
              ),
              and(isNotNull(cellValueLinks.targetSourceId), isNull(sources.deletedAt))
            )
          )
        )
    : [];

  // Resolve per-binding display values. Map: `${sourceFieldId}|${targetSheetId}` -> displayFieldId.
  const displayMap = new Map<string, string>();
  for (const b of bindingRows) {
    if (b.displayFieldId && b.allowedSheetId) {
      displayMap.set(`${b.fieldId}|${b.allowedSheetId}`, b.displayFieldId);
    }
  }
  const displayPairs = new Map<string, string>(); // `${targetRowId}|${displayFieldId}` -> displayText
  if (linkCells.length && displayMap.size) {
    const needed: { rowId: string; fieldId: string }[] = [];
    const seen = new Set<string>();
    for (const link of linkCells) {
      if (!link.targetRowId || !link.targetSheetId) continue;
      const df = displayMap.get(`${link.sourceFieldId}|${link.targetSheetId}`);
      if (!df) continue;
      const key = `${link.targetRowId}|${df}`;
      if (seen.has(key)) continue;
      seen.add(key);
      needed.push({ rowId: link.targetRowId, fieldId: df });
    }
    if (needed.length) {
      const scalarRows = await db
        .select({
          rowId: cellValuesScalar.rowId,
          fieldId: cellValuesScalar.fieldId,
          displayText: cellValuesScalar.displayText
        })
        .from(cellValuesScalar)
        .where(
          and(
            inArray(
              cellValuesScalar.rowId,
              Array.from(new Set(needed.map((n) => n.rowId)))
            ),
            inArray(
              cellValuesScalar.fieldId,
              Array.from(new Set(needed.map((n) => n.fieldId)))
            )
          )
        );
      for (const s of scalarRows) {
        displayPairs.set(`${s.rowId}|${s.fieldId}`, s.displayText);
      }
    }
  }

  return {
    sheet,
    fields: fieldsWithOptions,
    rows: rowRows.map((row) => {
      const cells: Record<string, unknown> = {};
      for (const field of fieldRows) {
        if (field.type === "auto_id") {
          cells[field.id] = row.visibleId;
          continue;
        }
        const scalar = scalarCells.find((cell) => cell.rowId === row.id && cell.fieldId === field.id);
        if (scalar) cells[field.id] = scalar.displayText;
        const links = linkCells
          .filter((link) => link.sourceRowId === row.id && link.sourceFieldId === field.id)
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((link) => {
            if (link.targetSourceId) {
              const filename = link.targetSourceFilename ?? "(missing)";
              const label = link.targetSourceDisplayName?.trim() || filename;
              return {
                id: link.targetSourceId,
                kind: "source" as const,
                label,
                display: label,
                visibleId: label,
                sheetId: null,
                mimeType: link.targetSourceMime ?? null
              };
            }
            const visibleId = link.targetVisibleId ?? "(no ID)";
            const df = link.targetSheetId
              ? displayMap.get(`${link.sourceFieldId}|${link.targetSheetId}`)
              : undefined;
            const dv = df && link.targetRowId ? displayPairs.get(`${link.targetRowId}|${df}`) : null;
            const display = dv && dv.trim().length > 0 ? dv : visibleId;
            return {
              id: link.targetRowId ?? "",
              kind: "row" as const,
              label: `${display} - ${link.targetSheetName ?? ""}`,
              display,
              visibleId,
              sheetId: link.targetSheetId,
              mimeType: null
            };
          });
        if (links.length) cells[field.id] = links;
      }
      return { ...row, cells };
    })
  };
}

export async function createRow(user: ActorUser, sheetId: string, input: { cells?: Record<string, unknown> }) {
  const txId = randomUUID();
  return db.transaction(async (tx) => {
    const [sheet] = await tx.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
    if (!sheet || sheet.deletedAt) throw new Error("Sheet not found");
    if (sheet.sheetKind === "glossary" || sheet.sheetKind === "instructions") throw new Error("Rows cannot be added to this reserved sheet");

    const cellsInput = input.cells ?? {};
    // Required-field enforcement applies to atomic creates (callers that pass
    // cells up front, e.g. MCP). The UI creates a stub row then fills cells
    // incrementally, so we skip the check when no cells were provided.
    if (Object.keys(cellsInput).length > 0) {
      const sheetFields: Field[] = await tx
        .select()
        .from(fields)
        .where(and(eq(fields.sheetId, sheetId), eq(fields.archived, false)));
      const isMeaningful = (v: unknown) =>
        v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
      const missingRequired = sheetFields.filter((f) => {
        if (!f.required || f.isIdField || f.type === "auto_id") return false;
        const provided =
          Object.prototype.hasOwnProperty.call(cellsInput, f.id) ||
          Object.prototype.hasOwnProperty.call(cellsInput, f.slug);
        if (!provided) return true;
        const value =
          (cellsInput as Record<string, unknown>)[f.id] ?? (cellsInput as Record<string, unknown>)[f.slug];
        return !isMeaningful(value);
      });
      if (missingRequired.length) {
        throw new Error(`Missing required field(s): ${missingRequired.map((f) => f.label).join(", ")}`);
      }
    }

    const order = await nextRowOrder(sheetId, tx);
    const rowVisibleId = await computeVisibleId(sheetId, order, tx);
    const [row] = await tx
      .insert(rows)
      .values({ sheetId, canonicalOrder: order, visibleId: rowVisibleId, createdBy: user.userId, updatedBy: user.userId })
      .returning();
    await applyCellPatchSet(tx, user, row, cellsInput);
    await writeAudit(
      {
        transactionId: txId,
        actor: actor(user),
        actionType: "ROW_CREATE",
        entityType: "row",
        entityId: row.id,
        parentDocumentId: sheet.documentId,
        parentSheetId: sheet.id,
        parentSheetName: sheet.name,
        rowId: row.id,
        rowVisibleId: row.visibleId,
        after: row,
        summary: `Created row ${row.visibleId ?? row.id}`
      },
      tx
    );
    await refreshSearchIndex(sheet.documentId, tx);
    return row;
  });
}

async function applyCellPatchSet(client: any, user: ActorUser, row: Row, cells: Record<string, unknown>) {
  const fieldRows = await client.select().from(fields).where(and(eq(fields.sheetId, row.sheetId), eq(fields.archived, false)));
  for (const [fieldKey, value] of Object.entries(cells)) {
    const field = fieldRows.find((item: Field) => item.id === fieldKey || item.slug === fieldKey);
    if (!field || field.type === "auto_id") continue;
    await patchCellInternal(client, user, row, field, value, undefined);
  }
}

export async function patchCell(user: ActorUser, rowId: string, input: { fieldId: string; value?: unknown; rowVersion?: number }) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(rows).where(eq(rows.id, rowId)).limit(1);
    if (!row || row.deletedAt) throw new Error("Row not found");
    if (input.rowVersion && input.rowVersion !== row.version) throw new Error("Row has changed since it was loaded");
    const [field] = await tx.select().from(fields).where(eq(fields.id, input.fieldId)).limit(1);
    if (!field || field.archived) throw new Error("Field not found");
    const [sheet] = await tx.select().from(sheets).where(eq(sheets.id, row.sheetId)).limit(1);
    const patched = await patchCellInternal(tx, user, row, field, input.value, sheet);
    const [updatedRow] = await tx.update(rows).set({ version: row.version + 1, updatedBy: user.userId, updatedAt: new Date() }).where(eq(rows.id, row.id)).returning();
    if (sheet) await refreshSearchIndex(sheet.documentId, tx);
    return { row: updatedRow, cell: patched };
  });
}

async function patchCellInternal(client: any, user: ActorUser, row: Row, field: Field, value: unknown, sheetMaybe?: Sheet) {
  if (!field.editable) throw new Error(`${field.label} is read-only`);
  const sheet = sheetMaybe ?? (await client.select().from(sheets).where(eq(sheets.id, row.sheetId)).limit(1))[0];
  if (field.type === "single_reference" || field.type === "multi_reference") {
    const parsed = parseReferenceValue(value);
    if (field.type === "single_reference" && parsed.length > 1) throw new Error(`${field.label} accepts one reference`);
    await validateReferenceTargets(client, sheet, field, parsed);
    const before = await client.select().from(cellValueLinks).where(and(eq(cellValueLinks.sourceRowId, row.id), eq(cellValueLinks.sourceFieldId, field.id)));
    await client.delete(cellValueLinks).where(and(eq(cellValueLinks.sourceRowId, row.id), eq(cellValueLinks.sourceFieldId, field.id)));
    if (parsed.length) {
      await client.insert(cellValueLinks).values(
        parsed.map((target, ordinal) => ({
          sourceRowId: row.id,
          sourceFieldId: field.id,
          targetRowId: target.kind === "row" ? target.id : null,
          targetSourceId: target.kind === "source" ? target.id : null,
          ordinal,
          createdBy: user.userId
        }))
      );
    }
    const after = parsed;
    await writeAudit(
      {
        actor: actor(user),
        actionType: "CELL_UPDATE",
        entityType: "cell_link",
        entityId: row.id,
        parentDocumentId: sheet.documentId,
        parentSheetId: sheet.id,
        parentSheetName: sheet.name,
        rowId: row.id,
        rowVisibleId: row.visibleId,
        fieldId: field.id,
        fieldLabel: field.label,
        before,
        after,
        summary: `Updated ${field.label} on ${row.visibleId ?? row.id}`
      },
      client
    );
    return after;
  }

  const allowedOptions = await loadFieldOptionsIfEnum(client, field);
  const normalized = normalizeFieldValue(field, value, allowedOptions);
  const [before] = await client.select().from(cellValuesScalar).where(and(eq(cellValuesScalar.rowId, row.id), eq(cellValuesScalar.fieldId, field.id))).limit(1);
  const [after] = await client
    .insert(cellValuesScalar)
    .values({ rowId: row.id, fieldId: field.id, ...normalized, updatedBy: user.userId })
    .onConflictDoUpdate({
      target: [cellValuesScalar.rowId, cellValuesScalar.fieldId],
      set: { ...normalized, updatedBy: user.userId, updatedAt: new Date() }
    })
    .returning();
  await writeAudit(
    {
      actor: actor(user),
      actionType: "CELL_UPDATE",
      entityType: "cell",
      entityId: after.id,
      parentDocumentId: sheet.documentId,
      parentSheetId: sheet.id,
      parentSheetName: sheet.name,
      rowId: row.id,
      rowVisibleId: row.visibleId,
      fieldId: field.id,
      fieldLabel: field.label,
      before,
      after,
      summary: `Updated ${field.label} on ${row.visibleId ?? row.id}`
    },
    client
  );
  return after;
}

type ReferenceTargetInput = { kind: "row"; id: string } | { kind: "source"; id: string };

function parseReferenceValue(value: unknown): ReferenceTargetInput[] {
  const items: unknown[] = Array.isArray(value) ? value : value ? [value] : [];
  const out: ReferenceTargetInput[] = [];
  for (const raw of items) {
    if (typeof raw === "string") {
      if (raw.trim()) out.push({ kind: "row", id: raw });
    } else if (raw && typeof raw === "object") {
      const obj = raw as { kind?: string; id?: string; rowId?: string; sourceId?: string };
      if (obj.kind === "source" && typeof obj.id === "string") {
        out.push({ kind: "source", id: obj.id });
      } else if (obj.kind === "row" && typeof obj.id === "string") {
        out.push({ kind: "row", id: obj.id });
      } else if (typeof obj.sourceId === "string") {
        out.push({ kind: "source", id: obj.sourceId });
      } else if (typeof obj.rowId === "string") {
        out.push({ kind: "row", id: obj.rowId });
      } else if (typeof obj.id === "string") {
        // Fall back to row when kind isn't specified — matches legacy behavior.
        out.push({ kind: "row", id: obj.id });
      }
    }
  }
  return out;
}

async function validateReferenceTargets(client: any, sheet: Sheet, field: Field, targets: ReferenceTargetInput[]) {
  if (!targets.length) return;
  const rowIds = targets.filter((t) => t.kind === "row").map((t) => t.id);
  const sourceIds = targets.filter((t) => t.kind === "source").map((t) => t.id);

  const [sourceSheet] = await client.select().from(sheets).where(eq(sheets.id, field.sheetId)).limit(1);
  const bindings = await client
    .select()
    .from(referenceBindings)
    .where(eq(referenceBindings.fieldId, field.id));
  const allowSources = bindings.some((b: { allowSources: boolean }) => b.allowSources);

  if (sourceIds.length > 0) {
    if (bindings.length > 0 && !allowSources) {
      throw new Error(`${field.label} is not configured to allow source references`);
    }
    const validSources = await client
      .select({ id: sources.id })
      .from(sources)
      .where(and(inArray(sources.id, sourceIds), isNull(sources.deletedAt)));
    if (validSources.length !== sourceIds.length) {
      throw new Error("One or more source references are invalid");
    }
  }

  if (rowIds.length > 0) {
    const targetRows = await client
      .select({ row: rows, sheet: sheets })
      .from(rows)
      .innerJoin(sheets, eq(sheets.id, rows.sheetId))
      .where(and(inArray(rows.id, rowIds), isNull(rows.deletedAt), isNull(sheets.deletedAt)));
    if (targetRows.length !== rowIds.length) throw new Error("One or more references are invalid");

    if (bindings.length > 0) {
      const allowedSheetIds = new Set(
        bindings
          .map((b: { allowedSheetId: string | null }) => b.allowedSheetId)
          .filter((id: string | null): id is string => Boolean(id))
      );
      const allowSelf = bindings.some((b: { allowSelfReference: boolean }) => b.allowSelfReference);
      for (const target of targetRows as { row: Row; sheet: Sheet }[]) {
        if (!allowedSheetIds.has(target.sheet.id)) {
          throw new Error(
            `${field.label} cannot reference ${target.row.visibleId ?? target.row.id}: target sheet "${target.sheet.name}" is not in the binding allowlist`
          );
        }
        if (!allowSelf && target.sheet.id === field.sheetId) {
          throw new Error(`${field.label} cannot reference rows in its own sheet`);
        }
      }
    }

    if (sourceSheet?.sheetKind === "open_issues") {
      const invalid = targetRows.some((target: { sheet: Sheet }) => target.sheet.sheetKind === "open_issues");
      if (invalid) throw new Error("OPEN ISSUES references cannot target OPEN ISSUES rows");
    }
  }
}

async function enrichTargetsWithDisplay<T extends { rowId: string; sheetId: string; visibleId: string | null }>(
  targets: T[],
  displayBySheet: Map<string, string>
): Promise<(T & { display: string | null })[]> {
  if (!targets.length || displayBySheet.size === 0) {
    return targets.map((t) => ({ ...t, display: null }));
  }
  const needed: { rowId: string; fieldId: string }[] = [];
  for (const t of targets) {
    const df = displayBySheet.get(t.sheetId);
    if (df) needed.push({ rowId: t.rowId, fieldId: df });
  }
  if (!needed.length) return targets.map((t) => ({ ...t, display: null }));
  const rowsSet = Array.from(new Set(needed.map((n) => n.rowId)));
  const fieldsSet = Array.from(new Set(needed.map((n) => n.fieldId)));
  const scalarRows = await db
    .select({
      rowId: cellValuesScalar.rowId,
      fieldId: cellValuesScalar.fieldId,
      displayText: cellValuesScalar.displayText
    })
    .from(cellValuesScalar)
    .where(and(inArray(cellValuesScalar.rowId, rowsSet), inArray(cellValuesScalar.fieldId, fieldsSet)));
  const lookup = new Map<string, string>();
  for (const s of scalarRows) lookup.set(`${s.rowId}|${s.fieldId}`, s.displayText);
  return targets.map((t) => {
    const df = displayBySheet.get(t.sheetId);
    const dv = df ? lookup.get(`${t.rowId}|${df}`) : null;
    return { ...t, display: dv && dv.trim().length > 0 ? dv : null };
  });
}

export async function listReferenceTargetsForField(fieldId: string) {
  const [field] = await db.select().from(fields).where(eq(fields.id, fieldId)).limit(1);
  if (!field) throw new Error("Field not found");
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, field.sheetId)).limit(1);
  if (!sheet) throw new Error("Sheet not found");

  const fieldBindings = await db
    .select()
    .from(referenceBindings)
    .where(eq(referenceBindings.fieldId, fieldId));

  const displayBySheet = new Map<string, string>();
  for (const b of fieldBindings) {
    if (b.allowedSheetId && b.displayFieldId) displayBySheet.set(b.allowedSheetId, b.displayFieldId);
  }
  // When bindings exist and at least one has allow_sources, the picker also
  // includes uploaded sources. When the field has no bindings configured
  // (default = allow any sheet in this document), sources are NOT auto-included
  // — the user has to opt in by checking "Include sources" on a binding.
  const includeSources = fieldBindings.some((b) => b.allowSources);
  const sourceCandidates = includeSources
    ? await db
        .select({
          rowId: sources.id,
          visibleId: sql<string>`coalesce(${sources.displayName}, ${sources.filename})`,
          sheetId: sql<string | null>`null::uuid`,
          sheetName: sql<string>`'Sources'`,
          kind: sql<string>`'source'`,
          mimeType: sources.mimeType
        })
        .from(sources)
        .where(isNull(sources.deletedAt))
        .orderBy(asc(sql`coalesce(${sources.displayName}, ${sources.filename})`))
    : [];

  const baseQuery = db
    .select({
      rowId: rows.id,
      visibleId: rows.visibleId,
      sheetId: sheets.id,
      sheetName: sheets.name,
      documentId: documents.id,
      documentTitle: documents.title
    })
    .from(rows)
    .innerJoin(sheets, eq(sheets.id, rows.sheetId))
    .innerJoin(documents, eq(documents.id, sheets.documentId))
    .innerJoin(fields, and(eq(fields.sheetId, sheets.id), eq(fields.isIdField, true)));

  let targets: {
    rowId: string;
    visibleId: string | null;
    sheetId: string;
    sheetName: string;
    documentId: string;
    documentTitle: string;
  }[] = [];
  if (fieldBindings.length > 0) {
    const allowedSheetIds = fieldBindings
      .map((b) => b.allowedSheetId)
      .filter((id): id is string => Boolean(id));
    const allowSelf = fieldBindings.some((b) => b.allowSelfReference);
    if (allowedSheetIds.length > 0) {
      targets = await baseQuery
        .where(
          and(
            isNull(rows.deletedAt),
            isNull(sheets.deletedAt),
            inArray(sheets.id, allowedSheetIds),
            allowSelf ? sql`true` : sql`${sheets.id} <> ${field.sheetId}`
          )
        )
        .orderBy(asc(sheets.displayOrder), asc(rows.canonicalOrder));
    }
  } else {
    targets = await baseQuery
      .where(
        and(
          eq(sheets.documentId, sheet.documentId),
          isNull(rows.deletedAt),
          isNull(sheets.deletedAt),
          sql`${sheets.id} <> ${field.sheetId}`,
          sql`${sheets.sheetKind} <> 'open_issues'`
        )
      )
      .orderBy(asc(sheets.displayOrder), asc(rows.canonicalOrder));
  }

  const enrichedRows = (await enrichTargetsWithDisplay(targets, displayBySheet)).map((t) => ({
    ...t,
    kind: "row" as const,
    mimeType: null as string | null
  }));
  const enrichedSources = sourceCandidates.map((s) => ({
    rowId: s.rowId,
    visibleId: s.visibleId,
    sheetId: null as string | null,
    sheetName: "Sources",
    kind: "source" as const,
    display: null as string | null,
    mimeType: s.mimeType
  }));
  return [...enrichedRows, ...enrichedSources];
}

export async function listReferenceTargets(sheetId: string) {
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, sheetId)).limit(1);
  if (!sheet) throw new Error("Sheet not found");
  const targets = await db
    .select({
      rowId: rows.id,
      visibleId: rows.visibleId,
      sheetId: sheets.id,
      sheetName: sheets.name,
      kind: sql<string>`'row'`,
      mimeType: sql<string | null>`null::text`
    })
    .from(rows)
    .innerJoin(sheets, eq(sheets.id, rows.sheetId))
    .innerJoin(fields, and(eq(fields.sheetId, sheets.id), eq(fields.isIdField, true)))
    .where(and(eq(sheets.documentId, sheet.documentId), isNull(rows.deletedAt), isNull(sheets.deletedAt), sql`${sheets.id} <> ${sheetId}`, sql`${sheets.sheetKind} <> 'open_issues'`))
    .orderBy(asc(sheets.displayOrder), asc(rows.canonicalOrder));
  return targets.map((t) => ({ ...t, display: null as string | null }));
}

export async function refreshGlossary(documentId: string, user: ActorUser | null = null, client: any = db, transactionId = randomUUID()) {
  const before = await client.select().from(glossaryEntries).where(eq(glossaryEntries.documentId, documentId));
  await client.delete(glossaryEntries).where(eq(glossaryEntries.documentId, documentId));
  const [document] = await client.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!document) return [];
  const sheetRows = await client.select().from(sheets).where(and(eq(sheets.documentId, documentId), isNull(sheets.deletedAt))).orderBy(asc(sheets.displayOrder));
  const sheetIds = sheetRows.map((sheet: Sheet) => sheet.id);
  const fieldRows = sheetIds.length ? await client.select().from(fields).where(and(inArray(fields.sheetId, sheetIds), eq(fields.archived, false))).orderBy(asc(fields.displayOrder)) : [];
  const optionRows = fieldRows.length ? await client.select().from(fieldOptions).where(and(inArray(fieldOptions.fieldId, fieldRows.map((field: Field) => field.id)), eq(fieldOptions.archived, false))).orderBy(asc(fieldOptions.displayOrder)) : [];
  const policyRows = sheetIds.length ? await client.select().from(idPolicies).where(inArray(idPolicies.sheetId, sheetIds)) : [];

  const entries = [
    { documentId, block: "Document", fieldOrCode: "Title", valueOrMeaning: document.title, sourceEntityType: "document", sourceEntityId: document.id },
    { documentId, block: "Document", fieldOrCode: "Classification", valueOrMeaning: document.classification, sourceEntityType: "document", sourceEntityId: document.id },
    ...sheetRows.map((sheet: Sheet) => ({ documentId, block: "Sheet", fieldOrCode: sheet.name, valueOrMeaning: sheet.description || `${sheet.sheetKind} sheet`, sourceEntityType: "sheet", sourceEntityId: sheet.id })),
    ...fieldRows.map((field: Field) => {
      const sheet = sheetRows.find((item: Sheet) => item.id === field.sheetId);
      return { documentId, block: sheet?.name ?? "Field", fieldOrCode: field.label, valueOrMeaning: field.description || field.type, sourceEntityType: "field", sourceEntityId: field.id };
    }),
    ...optionRows.map((option: typeof fieldOptions.$inferSelect) => {
      const field = fieldRows.find((item: Field) => item.id === option.fieldId);
      const sheet = sheetRows.find((item: Sheet) => item.id === field?.sheetId);
      return { documentId, block: sheet?.name ?? "Enum", fieldOrCode: `${field?.label ?? "Enum"}: ${option.value}`, valueOrMeaning: option.description || option.label, sourceEntityType: "field_option", sourceEntityId: option.id };
    }),
    ...policyRows.map((policy: typeof idPolicies.$inferSelect) => {
      const sheet = sheetRows.find((item: Sheet) => item.id === policy.sheetId);
      return { documentId, block: sheet?.name ?? "ID Policy", fieldOrCode: "ID Prefix", valueOrMeaning: `${policy.prefix}-<sequence>, zero padded to ${policy.zeroPad}`, sourceEntityType: "id_policy", sourceEntityId: policy.id };
    })
  ];

  if (entries.length) await client.insert(glossaryEntries).values(entries);

  const signature = (
    list: {
      block: string;
      fieldOrCode: string;
      valueOrMeaning: string;
      sourceEntityType: string;
      sourceEntityId: string;
    }[]
  ) =>
    JSON.stringify(
      list
        .map((e) => [e.block, e.fieldOrCode, e.valueOrMeaning, e.sourceEntityType, e.sourceEntityId])
        .sort()
    );
  const changed = signature(before) !== signature(entries);

  if (changed) {
    await writeAudit(
      {
        transactionId,
        actor: user ? actor(user) : { id: null, username: "system" },
        actionType: "GLOSSARY_REFRESH",
        entityType: "glossary",
        entityId: documentId,
        parentDocumentId: documentId,
        parentDocumentName: document.title,
        before: { count: before.length },
        after: { count: entries.length },
        summary: `Refreshed glossary for ${document.title}`,
        sourceType: "system"
      },
      client
    );
  }
  return entries;
}

export async function refreshSearchIndex(documentId: string, client: any = db) {
  await client.delete(searchIndex).where(eq(searchIndex.documentId, documentId));
  const [document] = await client.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!document || document.deletedAt) return;
  const sheetRows = await client.select().from(sheets).where(and(eq(sheets.documentId, documentId), isNull(sheets.deletedAt))).orderBy(asc(sheets.displayOrder));
  const sheetIds = sheetRows.map((sheet: Sheet) => sheet.id);
  const fieldRows = sheetIds.length ? await client.select().from(fields).where(and(inArray(fields.sheetId, sheetIds), eq(fields.archived, false))) : [];
  const rowRows = sheetIds.length ? await client.select().from(rows).where(and(inArray(rows.sheetId, sheetIds), isNull(rows.deletedAt))) : [];
  const scalarRows = rowRows.length ? await client.select().from(cellValuesScalar).where(inArray(cellValuesScalar.rowId, rowRows.map((row: Row) => row.id))) : [];
  const glossaryRows = await client.select().from(glossaryEntries).where(eq(glossaryEntries.documentId, documentId));

  const entries = [
    { documentId, documentName: document.title, matchType: "Document", searchableText: `${document.title} ${document.description} ${document.classification}`, excerpt: document.description || document.title },
    ...sheetRows.map((sheet: Sheet) => ({ documentId, documentName: document.title, sheetId: sheet.id, sheetName: sheet.name, matchType: "Sheet Description", searchableText: `${sheet.name} ${sheet.description}`, excerpt: sheet.description || sheet.name })),
    ...fieldRows.map((field: Field) => {
      const sheet = sheetRows.find((item: Sheet) => item.id === field.sheetId);
      return { documentId, documentName: document.title, sheetId: sheet?.id, sheetName: sheet?.name, fieldId: field.id, fieldLabel: field.label, matchType: "Field Metadata", searchableText: `${field.label} ${field.slug} ${field.type} ${field.description}`, excerpt: field.description || field.label };
    }),
    ...rowRows.flatMap((row: Row) => {
      const sheet = sheetRows.find((item: Sheet) => item.id === row.sheetId);
      const cells = scalarRows.filter((cell: typeof cellValuesScalar.$inferSelect) => cell.rowId === row.id);
      const text = [row.visibleId, ...cells.map((cell: typeof cellValuesScalar.$inferSelect) => cell.displayText)].filter(Boolean).join(" ");
      return text ? [{ documentId, documentName: document.title, sheetId: sheet?.id, sheetName: sheet?.name, rowId: row.id, rowVisibleId: row.visibleId, matchType: sheet?.sheetKind === "open_issues" ? "Open Issue" : "Row Data", searchableText: text, excerpt: text.slice(0, 280) }] : [];
    }),
    ...glossaryRows.map((entry: typeof glossaryEntries.$inferSelect) => ({ documentId, documentName: document.title, matchType: "Glossary", searchableText: `${entry.block} ${entry.fieldOrCode} ${entry.valueOrMeaning}`, excerpt: `${entry.block} / ${entry.fieldOrCode}: ${entry.valueOrMeaning}` }))
  ];

  if (entries.length) {
    await client.insert(searchIndex).values(entries);
    await client.execute(sql`update search_index set search_vector = to_tsvector('english', coalesce(searchable_text, '')) where document_id = ${documentId}`);
  }
}

export async function searchRepository(query: string) {
  const like = `%${query}%`;
  return db
    .select()
    .from(searchIndex)
    .where(sql`${searchIndex.searchVector} @@ plainto_tsquery('english', ${query}) or ${searchIndex.searchableText} ilike ${like}`)
    .orderBy(asc(searchIndex.documentName), asc(searchIndex.sheetName), desc(sql`similarity(${searchIndex.searchableText}, ${query})`))
    .limit(100);
}

export async function impactAnalysis(operation: string, entityId: string) {
  // A link only "blocks" deletion if its SOURCE row, sheet, and document are
  // all still live — stale links left behind by previous soft-deletes don't
  // count.
  const liveInboundQuery = (predicate: ReturnType<typeof eq> | ReturnType<typeof inArray>) =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cellValueLinks)
      .innerJoin(rows, eq(rows.id, cellValueLinks.sourceRowId))
      .innerJoin(sheets, eq(sheets.id, rows.sheetId))
      .innerJoin(documents, eq(documents.id, sheets.documentId))
      .where(
        and(
          predicate,
          isNull(rows.deletedAt),
          isNull(sheets.deletedAt),
          isNull(documents.deletedAt)
        )
      );

  if (operation === "row_delete") {
    const [{ count }] = await liveInboundQuery(eq(cellValueLinks.targetRowId, entityId));
    const n = Number(count ?? 0);
    return {
      blocked: n > 0,
      blockers: n > 0 ? [`${n} inbound reference(s) must be removed first.`] : [],
      affectedLinks: n,
      snapshotRequired: n > 0
    };
  }
  if (operation === "sheet_delete") {
    const [sheet] = await db.select().from(sheets).where(eq(sheets.id, entityId)).limit(1);
    if (!sheet) throw new Error("Sheet not found");
    if (sheet.isSystemReserved) return { blocked: true, blockers: ["Reserved sheets cannot be deleted in MVP."], affectedRows: 0, snapshotRequired: false };
    const sheetRows = await db.select({ id: rows.id }).from(rows).where(and(eq(rows.sheetId, entityId), isNull(rows.deletedAt)));
    let n = 0;
    if (sheetRows.length) {
      const [{ count }] = await liveInboundQuery(
        inArray(
          cellValueLinks.targetRowId,
          sheetRows.map((row) => row.id)
        )
      );
      n = Number(count ?? 0);
    }
    return {
      blocked: n > 0,
      blockers: n > 0 ? [`${n} inbound reference(s) target rows in this sheet.`] : [],
      affectedRows: sheetRows.length,
      affectedLinks: n,
      snapshotRequired: true
    };
  }
  if (operation === "document_delete") {
    const sheetRows = await db.select({ id: sheets.id }).from(sheets).where(and(eq(sheets.documentId, entityId), isNull(sheets.deletedAt)));
    const sheetIds = sheetRows.map((sheet) => sheet.id);
    const rowCount = sheetIds.length ? await db.select({ count: sql<number>`count(*)::int` }).from(rows).where(and(inArray(rows.sheetId, sheetIds), isNull(rows.deletedAt))) : [{ count: 0 }];
    return { blocked: false, blockers: [], affectedSheets: sheetRows.length, affectedRows: Number(rowCount[0]?.count ?? 0), snapshotRequired: true };
  }
  return { blocked: false, blockers: [], snapshotRequired: false };
}

export async function restoreRow(user: ActorUser, rowId: string) {
  const [before] = await db.select().from(rows).where(eq(rows.id, rowId)).limit(1);
  if (!before) throw new Error("Row not found");
  if (!before.deletedAt) throw new Error("Row is not deleted");
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, before.sheetId)).limit(1);
  return db.transaction(async (tx) => {
    const [after] = await tx
      .update(rows)
      .set({ deletedAt: null, updatedBy: user.userId, updatedAt: new Date() })
      .where(eq(rows.id, rowId))
      .returning();
    await writeAudit(
      {
        actor: actor(user),
        actionType: "ROW_UPDATE",
        entityType: "row",
        entityId: rowId,
        parentDocumentId: sheet?.documentId,
        parentSheetId: sheet?.id,
        parentSheetName: sheet?.name,
        rowId,
        rowVisibleId: before.visibleId,
        before,
        after,
        summary: `Restored row ${before.visibleId ?? before.id}`
      },
      tx
    );
    if (sheet) await refreshSearchIndex(sheet.documentId, tx);
    return after;
  });
}

export async function softDeleteRow(user: ActorUser, rowId: string) {
  const impact = await impactAnalysis("row_delete", rowId);
  if (impact.blocked) throw new Error(impact.blockers[0]);
  const [before] = await db.select().from(rows).where(eq(rows.id, rowId)).limit(1);
  if (!before || before.deletedAt) throw new Error("Row not found");
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, before.sheetId)).limit(1);
  return db.transaction(async (tx) => {
    await tx.insert(tombstones).values({ entityType: "row", entityId: before.id, parentDocumentId: sheet?.documentId, parentSheetId: sheet?.id, deletedBy: user.userId, stateJson: before });
    const [after] = await tx.update(rows).set({ deletedAt: new Date(), updatedBy: user.userId, updatedAt: new Date() }).where(eq(rows.id, rowId)).returning();
    await writeAudit(
      {
        actor: actor(user),
        actionType: "ROW_DELETE",
        entityType: "row",
        entityId: before.id,
        parentDocumentId: sheet?.documentId,
        parentSheetId: sheet?.id,
        parentSheetName: sheet?.name,
        rowId: before.id,
        rowVisibleId: before.visibleId,
        before,
        after,
        summary: `Deleted row ${before.visibleId ?? before.id}`
      },
      tx
    );
    if (sheet) await refreshSearchIndex(sheet.documentId, tx);
    return after;
  });
}

export async function createSnapshot(user: ActorUser, documentId: string, input: { name: string; baselineState?: string; reason?: string }) {
  return db.transaction(async (tx) => {
    const [document] = await tx.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (!document) throw new Error("Document not found");
    const [snapshot] = await tx
      .insert(snapshots)
      .values({ documentId, name: input.name, baselineState: input.baselineState ?? "draft", reason: input.reason, createdBy: user.userId })
      .returning();
    const sheetRows = await tx.select().from(sheets).where(eq(sheets.documentId, documentId));
    const sheetIds = sheetRows.map((sheet: Sheet) => sheet.id);
    const fieldRows = sheetIds.length ? await tx.select().from(fields).where(inArray(fields.sheetId, sheetIds)) : [];
    const rowRows = sheetIds.length ? await tx.select().from(rows).where(inArray(rows.sheetId, sheetIds)) : [];
    const items = [
      { snapshotId: snapshot.id, entityType: "document", entityId: document.id, stateJson: document },
      ...sheetRows.map((sheet: Sheet) => ({ snapshotId: snapshot.id, entityType: "sheet", entityId: sheet.id, stateJson: sheet })),
      ...fieldRows.map((field: Field) => ({ snapshotId: snapshot.id, entityType: "field", entityId: field.id, stateJson: field })),
      ...rowRows.map((row: Row) => ({ snapshotId: snapshot.id, entityType: "row", entityId: row.id, stateJson: row }))
    ];
    await tx.insert(snapshotItems).values(items);
    await writeAudit(
      {
        actor: actor(user),
        actionType: "SNAPSHOT_CREATE",
        entityType: "snapshot",
        entityId: snapshot.id,
        parentDocumentId: documentId,
        parentDocumentName: document.title,
        after: { snapshot, itemCount: items.length },
        summary: `Created snapshot ${snapshot.name}`
      },
      tx
    );
    return snapshot;
  });
}

export async function listAuditEvents(limit = 100) {
  return db.select().from((await import("@/db/schema")).auditEvents).orderBy(desc((await import("@/db/schema")).auditEvents.timestamp)).limit(limit);
}

export async function listIntegrityIssues() {
  return db.select().from(integrityIssues).where(eq(integrityIssues.status, "open")).orderBy(desc(integrityIssues.createdAt));
}

export async function getDocumentExportModel(documentId: string) {
  const [document] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!document) throw new Error("Document not found");
  const sheetRows = await db.select().from(sheets).where(and(eq(sheets.documentId, documentId), isNull(sheets.deletedAt))).orderBy(asc(sheets.displayOrder));
  const grids = [];
  for (const sheet of sheetRows) {
    grids.push(await getSheetGrid(sheet.id));
  }
  return { document, sheets: grids };
}

export async function markExportJob(documentId: string, user: ActorUser, status: string, summary: Record<string, unknown>, file?: { filename: string; base64: string }) {
  const [job] = await db
    .insert(exportJobs)
    .values({
      documentId,
      requestedBy: user.userId,
      status,
      filename: file?.filename,
      fileBytes: file ? { base64: file.base64 } : {},
      summaryJson: summary,
      completedAt: status === "complete" ? new Date() : null
    })
    .returning();
  await writeAudit({
    actor: actor(user),
    actionType: status === "complete" ? "EXPORT_COMPLETE" : "EXPORT_FAIL",
    entityType: "export_job",
    entityId: job.id,
    parentDocumentId: documentId,
    after: job,
    summary: `Export ${status} for document ${documentId}`,
    sourceType: "export",
    success: status === "complete"
  });
  return job;
}

export async function createImportJob(user: ActorUser, filename: string, fileHash: string) {
  const [job] = await db.insert(importJobs).values({ originalFilename: filename, fileHash, importedBy: user.userId, status: "pending" }).returning();
  await writeAudit({
    actor: actor(user),
    actionType: "IMPORT_START",
    entityType: "import_job",
    entityId: job.id,
    after: job,
    summary: `Started import for ${filename}`,
    sourceType: "import"
  });
  return job;
}
