import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  }
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 80 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }),
    organization: varchar("organization", { length: 180 }),
    accountStatus: varchar("account_status", { length: 40 }).notNull().default("pending_activation"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    tutorialSeen: boolean("tutorial_seen").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    statusIdx: index("users_status_idx").on(table.accountStatus)
  })
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps
  },
  (table) => ({
    nameUnique: uniqueIndex("roles_name_unique").on(table.name)
  })
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 120 }).notNull(),
    description: text("description")
  },
  (table) => ({
    codeUnique: uniqueIndex("permissions_code_unique").on(table.code)
  })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
    roleIdx: index("role_permissions_role_id_idx").on(table.roleId),
    permissionIdx: index("role_permissions_permission_id_idx").on(table.permissionId)
  })
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
    userIdx: index("user_roles_user_id_idx").on(table.userId),
    roleIdx: index("user_roles_role_id_idx").on(table.roleId)
  })
);

export const accessGrants = pgTable(
  "access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scopeType: varchar("scope_type", { length: 40 }).notNull(),
    scopeId: uuid("scope_id"),
    permissionCode: varchar("permission_code", { length: 120 }).notNull(),
    grantedBy: uuid("granted_by").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    userIdx: index("access_grants_user_id_idx").on(table.userId),
    scopeIdx: index("access_grants_scope_idx").on(table.scopeType, table.scopeId)
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    ...timestamps
  },
  (table) => ({
    tokenUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    userIdx: index("sessions_user_id_idx").on(table.userId),
    expiresIdx: index("sessions_expires_at_idx").on(table.expiresAt)
  })
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    readOnly: boolean("read_only").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    userIdx: index("api_tokens_user_id_idx").on(table.userId),
    tokenHashIdx: uniqueIndex("api_tokens_token_hash_unique").on(table.tokenHash)
  })
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 120 }).notNull(),
    success: boolean("success").notNull(),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    failureReason: varchar("failure_reason", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    usernameCreatedIdx: index("login_attempts_username_created_idx").on(table.username, table.createdAt),
    ipCreatedIdx: index("login_attempts_ip_created_idx").on(table.ipAddress, table.createdAt)
  })
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitedEmail: varchar("invited_email", { length: 320 }).notNull(),
    intendedRoles: jsonb("intended_roles").$type<string[]>().notNull().default([]),
    preassignedUsername: varchar("preassigned_username", { length: 80 }).notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    tokenUnique: uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    emailIdx: index("invitations_email_idx").on(table.invitedEmail),
    statusIdx: index("invitations_status_idx").on(table.status)
  })
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description").notNull().default(""),
    status: varchar("status", { length: 60 }).notNull().default("draft"),
    classification: varchar("classification", { length: 80 }).notNull().default("unclassified"),
    ownerId: uuid("owner_id").references(() => users.id),
    templateType: varchar("template_type", { length: 80 }),
    baselineState: varchar("baseline_state", { length: 60 }).notNull().default("draft"),
    importJobId: uuid("import_job_id"),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    ownerIdx: index("documents_owner_id_idx").on(table.ownerId),
    titleIdx: index("documents_title_idx").on(table.title),
    deletedIdx: index("documents_deleted_at_idx").on(table.deletedAt)
  })
);

export const sheets = pgTable(
  "sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    sheetKind: varchar("sheet_kind", { length: 40 }).notNull().default("standard"),
    isSystemReserved: boolean("is_system_reserved").notNull().default(false),
    fixedPosition: integer("fixed_position"),
    displayOrder: integer("display_order").notNull(),
    description: text("description").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    documentIdx: index("sheets_document_id_idx").on(table.documentId),
    documentOrderIdx: index("sheets_document_order_idx").on(table.documentId, table.displayOrder),
    activeNameUnique: uniqueIndex("sheets_document_name_unique").on(table.documentId, table.name).where(sql`${table.deletedAt} is null`),
    reservedKindUnique: uniqueIndex("sheets_reserved_kind_unique")
      .on(table.documentId, table.sheetKind)
      .where(sql`${table.isSystemReserved} = true and ${table.deletedAt} is null`)
  })
);

export const fields = pgTable(
  "fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => sheets.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    description: text("description").notNull().default(""),
    required: boolean("required").notNull().default(false),
    unique: boolean("unique").notNull().default(false),
    editable: boolean("editable").notNull().default(true),
    defaultJson: jsonb("default_json").$type<unknown>(),
    validationJson: jsonb("validation_json").$type<Record<string, unknown>>().notNull().default({}),
    referenceConfig: jsonb("reference_config").$type<Record<string, unknown>>().notNull().default({}),
    visible: boolean("visible").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    displayOrder: integer("display_order").notNull(),
    isIdField: boolean("is_id_field").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps
  },
  (table) => ({
    sheetIdx: index("fields_sheet_id_idx").on(table.sheetId),
    sheetOrderIdx: index("fields_sheet_order_idx").on(table.sheetId, table.displayOrder),
    slugUnique: uniqueIndex("fields_sheet_slug_unique").on(table.sheetId, table.slug).where(sql`${table.archived} = false`),
    idFieldUnique: uniqueIndex("fields_sheet_id_field_unique").on(table.sheetId).where(sql`${table.isIdField} = true and ${table.archived} = false`)
  })
);

export const fieldOptions = pgTable(
  "field_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 160 }).notNull(),
    value: varchar("value", { length: 180 }).notNull(),
    description: text("description").notNull().default(""),
    displayOrder: integer("display_order").notNull(),
    archived: boolean("archived").notNull().default(false),
    ...timestamps
  },
  (table) => ({
    fieldIdx: index("field_options_field_id_idx").on(table.fieldId),
    valueUnique: uniqueIndex("field_options_value_unique").on(table.fieldId, table.value).where(sql`${table.archived} = false`)
  })
);

export const idPolicies = pgTable(
  "id_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => sheets.id, { onDelete: "cascade" }),
    prefix: varchar("prefix", { length: 20 }).notNull(),
    zeroPad: integer("zero_pad").notNull().default(2),
    nextSequenceHint: integer("next_sequence_hint").notNull().default(1),
    ...timestamps
  },
  (table) => ({
    sheetUnique: uniqueIndex("id_policies_sheet_unique").on(table.sheetId)
  })
);

export const referenceBindings = pgTable(
  "reference_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    allowedDocumentId: uuid("allowed_document_id").references(() => documents.id, { onDelete: "cascade" }),
    allowedSheetId: uuid("allowed_sheet_id").references(() => sheets.id, { onDelete: "cascade" }),
    allowedIdFieldId: uuid("allowed_id_field_id").references(() => fields.id, { onDelete: "cascade" }),
    allowSelfReference: boolean("allow_self_reference").notNull().default(false),
    // When set, reference chips and pickers render this field's value from the
    // target row instead of the row's visible ID. Falls back to visible ID if null
    // or if the referenced field's value is empty.
    displayFieldId: uuid("display_field_id").references(() => fields.id, { onDelete: "set null" }),
    ...timestamps
  },
  (table) => ({
    fieldIdx: index("reference_bindings_field_id_idx").on(table.fieldId),
    sourceIdx: index("reference_bindings_source_idx").on(table.allowedDocumentId, table.allowedSheetId)
  })
);

export const rows = pgTable(
  "rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => sheets.id, { onDelete: "cascade" }),
    canonicalOrder: integer("canonical_order").notNull(),
    visibleId: varchar("visible_id", { length: 80 }),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    sheetIdx: index("rows_sheet_id_idx").on(table.sheetId),
    sheetOrderIdx: index("rows_sheet_order_idx").on(table.sheetId, table.canonicalOrder),
    visibleUnique: uniqueIndex("rows_sheet_visible_id_unique").on(table.sheetId, table.visibleId).where(sql`${table.deletedAt} is null and ${table.visibleId} is not null`)
  })
);

export const cellValuesScalar = pgTable(
  "cell_values_scalar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rowId: uuid("row_id")
      .notNull()
      .references(() => rows.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    valueText: text("value_text"),
    valueNumber: numeric("value_number"),
    valueBoolean: boolean("value_boolean"),
    valueDate: date("value_date"),
    valueDateTime: timestamp("value_datetime", { withTimezone: true }),
    valueJson: jsonb("value_json").$type<unknown>(),
    normalizedText: text("normalized_text").notNull().default(""),
    displayText: text("display_text").notNull().default(""),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps
  },
  (table) => ({
    rowIdx: index("cell_values_scalar_row_id_idx").on(table.rowId),
    fieldIdx: index("cell_values_scalar_field_id_idx").on(table.fieldId),
    rowFieldUnique: uniqueIndex("cell_values_scalar_row_field_unique").on(table.rowId, table.fieldId)
  })
);

export const cellValueLinks = pgTable(
  "cell_value_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceRowId: uuid("source_row_id")
      .notNull()
      .references(() => rows.id, { onDelete: "cascade" }),
    sourceFieldId: uuid("source_field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    targetRowId: uuid("target_row_id")
      .notNull()
      .references(() => rows.id, { onDelete: "restrict" }),
    ordinal: integer("ordinal").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps
  },
  (table) => ({
    sourceIdx: index("cell_value_links_source_idx").on(table.sourceRowId, table.sourceFieldId),
    targetIdx: index("cell_value_links_target_idx").on(table.targetRowId),
    uniqueOrdinal: uniqueIndex("cell_value_links_source_target_ordinal_unique").on(table.sourceRowId, table.sourceFieldId, table.targetRowId, table.ordinal)
  })
);

export const glossaryEntries = pgTable(
  "glossary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    block: text("block").notNull(),
    fieldOrCode: text("field_or_code").notNull(),
    valueOrMeaning: text("value_or_meaning").notNull(),
    sourceEntityType: varchar("source_entity_type", { length: 60 }).notNull(),
    sourceEntityId: uuid("source_entity_id"),
    ...timestamps
  },
  (table) => ({
    documentIdx: index("glossary_entries_document_id_idx").on(table.documentId)
  })
);

export const integrityIssues = pgTable(
  "integrity_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    severity: varchar("severity", { length: 40 }).notNull(),
    issueType: varchar("issue_type", { length: 80 }).notNull(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    sheetId: uuid("sheet_id").references(() => sheets.id, { onDelete: "cascade" }),
    rowId: uuid("row_id").references(() => rows.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id").references(() => fields.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    detailJson: jsonb("detail_json").$type<Record<string, unknown>>().notNull().default({}),
    status: varchar("status", { length: 40 }).notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    documentIdx: index("integrity_issues_document_id_idx").on(table.documentId),
    statusIdx: index("integrity_issues_status_idx").on(table.status)
  })
);

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    baselineState: varchar("baseline_state", { length: 60 }).notNull().default("draft"),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    documentIdx: index("snapshots_document_id_idx").on(table.documentId)
  })
);

export const snapshotItems = pgTable(
  "snapshot_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    stateJson: jsonb("state_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    snapshotIdx: index("snapshot_items_snapshot_id_idx").on(table.snapshotId),
    entityIdx: index("snapshot_items_entity_idx").on(table.entityType, table.entityId)
  })
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    actingUserId: uuid("acting_user_id").references(() => users.id),
    actingUsername: varchar("acting_username", { length: 120 }).notNull().default("system"),
    actionType: varchar("action_type", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    parentDocumentId: uuid("parent_document_id").references(() => documents.id),
    parentDocumentName: text("parent_document_name"),
    parentSheetId: uuid("parent_sheet_id").references(() => sheets.id),
    parentSheetName: text("parent_sheet_name"),
    rowId: uuid("row_id"),
    rowVisibleId: varchar("row_visible_id", { length: 80 }),
    fieldId: uuid("field_id"),
    fieldLabel: text("field_label"),
    beforeJson: jsonb("before_json").$type<unknown>(),
    afterJson: jsonb("after_json").$type<unknown>(),
    diffJson: jsonb("diff_json").$type<unknown>(),
    summaryText: text("summary_text").notNull(),
    sourceType: varchar("source_type", { length: 40 }).notNull(),
    success: boolean("success").notNull().default(true),
    requestMeta: jsonb("request_meta").$type<Record<string, unknown>>().notNull().default({})
  },
  (table) => ({
    txIdx: index("audit_events_transaction_id_idx").on(table.transactionId),
    actorIdx: index("audit_events_acting_user_id_idx").on(table.actingUserId),
    actionIdx: index("audit_events_action_type_idx").on(table.actionType),
    documentIdx: index("audit_events_document_id_idx").on(table.parentDocumentId),
    timestampIdx: index("audit_events_timestamp_idx").on(table.timestamp)
  })
);

export const tombstones = pgTable(
  "tombstones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    parentDocumentId: uuid("parent_document_id").references(() => documents.id),
    parentSheetId: uuid("parent_sheet_id").references(() => sheets.id),
    deletedBy: uuid("deleted_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
    stateJson: jsonb("state_json").$type<Record<string, unknown>>().notNull(),
    reason: text("reason")
  },
  (table) => ({
    entityIdx: index("tombstones_entity_idx").on(table.entityType, table.entityId),
    documentIdx: index("tombstones_document_id_idx").on(table.parentDocumentId)
  })
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    originalFilename: text("original_filename").notNull(),
    fileHash: varchar("file_hash", { length: 128 }),
    importedBy: uuid("imported_by").references(() => users.id),
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>().notNull().default({}),
    errorText: text("error_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => ({
    statusIdx: index("import_jobs_status_idx").on(table.status),
    userIdx: index("import_jobs_imported_by_idx").on(table.importedBy)
  })
);

export const importJobItems = pgTable(
  "import_job_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importJobId: uuid("import_job_id")
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    itemType: varchar("item_type", { length: 80 }).notNull(),
    sourceName: text("source_name"),
    targetEntityId: uuid("target_entity_id"),
    status: varchar("status", { length: 40 }).notNull(),
    detailJson: jsonb("detail_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    jobIdx: index("import_job_items_job_id_idx").on(table.importJobId)
  })
);

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    requestedBy: uuid("requested_by").references(() => users.id),
    filename: text("filename"),
    fileBytes: jsonb("file_bytes").$type<{ base64?: string }>().notNull().default({}),
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>().notNull().default({}),
    errorText: text("error_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => ({
    documentIdx: index("export_jobs_document_id_idx").on(table.documentId),
    statusIdx: index("export_jobs_status_idx").on(table.status)
  })
);

export const searchIndex = pgTable(
  "search_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    documentName: text("document_name").notNull(),
    sheetId: uuid("sheet_id").references(() => sheets.id, { onDelete: "cascade" }),
    sheetName: text("sheet_name"),
    fieldId: uuid("field_id").references(() => fields.id, { onDelete: "cascade" }),
    fieldLabel: text("field_label"),
    rowId: uuid("row_id").references(() => rows.id, { onDelete: "cascade" }),
    rowVisibleId: text("row_visible_id"),
    matchType: varchar("match_type", { length: 80 }).notNull(),
    searchableText: text("searchable_text").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    relationHints: jsonb("relation_hints").$type<Record<string, unknown>>().notNull().default({}),
    searchVector: tsvector("search_vector"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    documentIdx: index("search_index_document_id_idx").on(table.documentId),
    sheetIdx: index("search_index_sheet_id_idx").on(table.sheetId),
    rowIdx: index("search_index_row_id_idx").on(table.rowId),
    vectorIdx: index("search_index_vector_idx").using("gin", table.searchVector),
    trigramIdx: index("search_index_text_trgm_idx").using("gin", sql`${table.searchableText} gin_trgm_ops`)
  })
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    documentIdx: index("chat_messages_document_id_idx").on(table.documentId),
    documentCreatedIdx: index("chat_messages_document_created_idx").on(table.documentId, table.createdAt),
    authorIdx: index("chat_messages_author_id_idx").on(table.authorId)
  })
);

export const chatMentions = pgTable(
  "chat_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).notNull(),
    offset: integer("offset").notNull(),
    length: integer("length").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    targetDocumentId: uuid("target_document_id").references(() => documents.id, { onDelete: "set null" }),
    targetSheetId: uuid("target_sheet_id").references(() => sheets.id, { onDelete: "set null" }),
    targetRowId: uuid("target_row_id").references(() => rows.id, { onDelete: "set null" }),
    targetFieldId: uuid("target_field_id").references(() => fields.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    messageIdx: index("chat_mentions_message_id_idx").on(table.messageId),
    targetUserIdx: index("chat_mentions_target_user_id_idx").on(table.targetUserId)
  })
);

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Sheet = typeof sheets.$inferSelect;
export type Field = typeof fields.$inferSelect;
export type Row = typeof rows.$inferSelect;
