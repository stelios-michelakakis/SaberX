export const RESERVED_SHEETS = [
  { kind: "instructions", name: "INSTRUCTIONS", position: 1 },
  { kind: "glossary", name: "GLOSSARY", position: 2 },
  { kind: "open_issues", name: "OPEN ISSUES", position: 3 }
] as const;

export const SHEET_KINDS = ["instructions", "glossary", "open_issues", "standard"] as const;

export const FIELD_TYPES = [
  "auto_id",
  "short_text",
  "long_text",
  "integer",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "single_enum",
  "multi_enum",
  "single_reference",
  "multi_reference",
  "url",
  "status",
  "tag_list",
  "rich_note"
] as const;

export const OPEN_ISSUES_FIELDS = [
  { label: "OP_ID", slug: "op_id", type: "auto_id", description: "System managed open point identifier.", required: true, editable: false },
  { label: "Topic", slug: "topic", type: "short_text", description: "Issue topic or grouping.", required: true, editable: true },
  { label: "Related Field", slug: "related_field", type: "multi_reference", description: "Constrained references to ID-bearing rows in other sheets in this document.", required: false, editable: true },
  { label: "Question or Open Point", slug: "question_or_open_point", type: "long_text", description: "The unresolved question, gap, decision, or open point.", required: true, editable: true },
  { label: "Why It Matters", slug: "why_it_matters", type: "long_text", description: "The engineering impact of leaving the item unresolved.", required: false, editable: true },
  { label: "Requested By", slug: "requested_by", type: "short_text", description: "Person or organization requesting closure.", required: false, editable: true },
  { label: "Requested From", slug: "requested_from", type: "short_text", description: "Person or organization expected to respond.", required: false, editable: true },
  { label: "Priority", slug: "priority", type: "single_enum", description: "Issue priority.", required: false, editable: true, options: ["Low", "Medium", "High", "Critical"] },
  { label: "Status", slug: "status", type: "single_enum", description: "Issue status.", required: false, editable: true, options: ["Open", "Under Review", "Waiting for Input", "Answered", "Closed"] },
  { label: "Response or Decision", slug: "response_or_decision", type: "long_text", description: "Resolution, answer, or decision once available.", required: false, editable: true },
  { label: "Notes", slug: "notes", type: "long_text", description: "Supporting notes.", required: false, editable: true }
] as const;

export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

export const ACTION_TYPES = [
  "DOCUMENT_CREATE",
  "DOCUMENT_UPDATE",
  "DOCUMENT_DELETE",
  "SHEET_CREATE",
  "SHEET_UPDATE",
  "SHEET_DELETE",
  "FIELD_CREATE",
  "FIELD_UPDATE",
  "FIELD_DELETE",
  "ROW_CREATE",
  "ROW_UPDATE",
  "ROW_DELETE",
  "CELL_UPDATE",
  "BINDING_CREATE",
  "BINDING_UPDATE",
  "BINDING_DELETE",
  "IMPORT_START",
  "IMPORT_COMPLETE",
  "IMPORT_FAIL",
  "EXPORT_START",
  "EXPORT_COMPLETE",
  "EXPORT_FAIL",
  "USER_CREATE",
  "USER_UPDATE",
  "USER_DISABLE",
  "USER_ARCHIVE",
  "INVITATION_CREATE",
  "INVITATION_REVOKE",
  "INVITATION_ACCEPT",
  "LOGIN_SUCCESS",
  "LOGIN_FAIL",
  "LOGOUT",
  "PASSWORD_CHANGE",
  "PROFILE_UPDATE",
  "PERMISSION_CHANGE",
  "SNAPSHOT_CREATE",
  "RENUMBER_APPLY",
  "GLOSSARY_REFRESH",
  "INTEGRITY_WARNING",
  "INTEGRITY_ERROR",
  "SOURCE_CREATE",
  "SOURCE_UPDATE",
  "SOURCE_DELETE"
] as const;

export type SheetKind = (typeof SHEET_KINDS)[number];
export type FieldType = (typeof FIELD_TYPES)[number];
export type ActionType = (typeof ACTION_TYPES)[number];
