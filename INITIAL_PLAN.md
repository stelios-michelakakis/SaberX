You are to draft a full implementation plan for a web application that acts as a structured engineering-document management system for interdependent workbook-like artifacts such as CONOPS, ICD, and RTM.

The application is not a generic spreadsheet clone. It is a database-native, traceability-oriented engineering repository with a spreadsheet-like UI.

Your task is NOT to write code yet. Your task is to produce a complete, implementation-ready technical plan covering architecture, data model, API, frontend structure, workflows, integrity logic, versioning, logging, import/export, and phased delivery.

The system will be temporarily hosted in a personal space, but it must be designed in a way that can later be hardened and matured.

--------------------------------------------------
1. PRODUCT PURPOSE
--------------------------------------------------

Build a web application that replaces editing multiple interdependent Excel workbooks with one unified system.

The system must:

- manage multiple workbook-like documents
- manage multiple sheet-like tables inside each document
- support creation of new documents inside the app
- support import of new documents from Excel files
- support export of documents to Excel files
- support structured schema definition and schema evolution
- support row-based data entry in an Excel-like UI
- support cross-sheet and cross-document trace links
- prevent inconsistencies caused by cascading edits across linked artifacts
- support detailed backwards traceability for all actions
- support search/analysis across all documents, sheets, fields, metadata, and values
- use a standard relational database backend
- support user access control, with users created only by the admin

The first intended artifact families are:
- CONOPS
- ICD
- RTM

But the system must be generic enough to support new document types later.

--------------------------------------------------
2. CORE PRODUCT VISION
--------------------------------------------------

The system is a single source of truth for structured engineering artifacts.

The frontend should feel like a modern, elegant, intuitive, Access-like UI:
- tabular
- structured
- clear
- low friction
- suitable for engineering traceability work

The backend must be database-native, not file-native.

Excel is an import/export format, not the system of record.

--------------------------------------------------
3. USERS, ROLES, AND ACCESS CONTROL
--------------------------------------------------

There is no public signup.

Users are created only by the admin.

Minimum roles:
- Admin
- Document Manager
- Editor
- Reviewer / Read-only

Minimum permission scopes:
- application level
- document level
- optionally sheet level

Permissions themselves must be auditable.

--------------------------------------------------
4. CRITICAL IDENTITY RULE
--------------------------------------------------

Do NOT use visible engineering IDs as database primary keys.

Every row must have:
- an immutable internal UUID as the real database identity
- a visible auto-generated engineering ID for user display

All references must point to immutable row UUIDs, not visible IDs.

This is mandatory because visible IDs may be renumbered after creation/deletion/reordering.

--------------------------------------------------
5. DOCUMENT MODEL
--------------------------------------------------

A document is workbook-like.

Each document should have metadata such as:
- internal UUID
- title
- description
- status
- classification tag
- owner
- created_at
- updated_at
- created_by
- updated_by
- optional template type
- optional baseline state
- optional import provenance

For imported documents also store:
- original filename
- import timestamp
- importing user
- import job ID
- optional file hash
- optional provenance notes

--------------------------------------------------
6. SHEETS: RESERVED VS USER-CREATED
--------------------------------------------------

Every document must always contain exactly three reserved sheets, in this exact fixed order:

1. INSTRUCTIONS
2. GLOSSARY
3. OPEN ISSUES

These are system-reserved sheets and must be distinguished from user-created sheets.

Suggested sheet classification:
- instructions
- glossary
- open_issues
- standard

or equivalent.

Hard rules:
- INSTRUCTIONS must always be first
- GLOSSARY must always be second
- OPEN ISSUES must always be third
- user-created sheets must always appear after those three
- users must not be able to move user-created sheets above them
- users should not be able to rename them
- users should not be able to delete them in normal operation

Reserved sheets are permanent per document in the MVP.

--------------------------------------------------
7. INSTRUCTIONS SHEET
--------------------------------------------------

The INSTRUCTIONS sheet:
- always exists
- is always first
- is initially empty
- is editable by authorized users
- is intended for freeform document-specific instructions, usage notes, conventions, or editorial guidance

Preferred implementation:
- as a sheet-associated narrative area or structured text panel
- it does not need to behave like a strict row-oriented engineering table

Its existence, name, and fixed position are system-controlled.

All edits must be logged with before/after state.

--------------------------------------------------
8. GLOSSARY SHEET
--------------------------------------------------

The GLOSSARY sheet:
- always exists
- is always second
- is non-editable by users
- is updated only by the system
- is visible and searchable
- is exported like normal sheets
- is a live metadata glossary

Its fixed fields must be:
- Block
- Field or Code
- Value or Meaning

These labels should be fixed.

The GLOSSARY should be auto-generated from document metadata and schema metadata. At minimum it should capture:
- sheet names / logical blocks
- field labels
- field descriptions where available
- enum/code values where applicable
- relevant system-defined meanings
- optionally ID prefixes and their meaning

The GLOSSARY must refresh automatically when relevant changes occur, including:
- sheet creation
- sheet rename
- sheet deletion/archive
- field creation
- field rename
- field type change
- field description add/edit/delete
- enum option change
- ID policy change

Glossary updates must be auditable and marked as system-generated.

--------------------------------------------------
9. OPEN ISSUES SHEET
--------------------------------------------------

The OPEN ISSUES sheet:
- always exists
- is always third
- is editable
- is a structured built-in issue/question/decision-tracking sheet

It must contain exactly these standard fields, in this order:

1. OP_ID
2. Topic
3. Related Field
4. Question or Open Point
5. Why It Matters
6. Requested By
7. Requested From
8. Priority
9. Status
10. Response or Decision
11. Notes

Recommended default types:
- OP_ID -> Auto ID
- Topic -> Short text
- Related Field -> Multi reference
- Question or Open Point -> Long text
- Why It Matters -> Long text
- Requested By -> Short text
- Requested From -> Short text
- Priority -> Single choice enum
- Status -> Single choice enum
- Response or Decision -> Long text
- Notes -> Long text

Recommended default enum values:

Priority:
- Low
- Medium
- High
- Critical

Status:
- Open
- Under Review
- Waiting for Input
- Answered
- Closed

OP_ID must be auto-managed.

The Related Field field is NOT free text.
It must:
- be a constrained multi-reference selector
- only allow selection from ID-bearing rows of other sheets in the same document
- allow multiple selections
- exclude OPEN ISSUES entries themselves
- store internal row UUIDs, not plain text IDs
- display visible IDs plus optional context like sheet name

Example display:
- REQ-07 — REQUIREMENTS_REGISTER
- IF-03 — INTERFACE_CATALOG

All OPEN ISSUES edits must be fully audited.

--------------------------------------------------
10. USER-CREATED SHEETS
--------------------------------------------------

Each user-created sheet is a structured table belonging to one document.

Each user-created sheet has:
- internal UUID
- parent document UUID
- name
- display order
- description
- schema version
- optional ID policy
- created_at
- updated_at
- created_by
- updated_by

User-created sheets must support:
- creation
- renaming
- reordering
- duplication
- deletion
- schema editing
- row editing

All such changes must be logged.

--------------------------------------------------
11. DEFAULT TOP DESCRIPTION SECTION FOR USER-CREATED SHEETS
--------------------------------------------------

Every user-created sheet must have a built-in top description section above the table/grid.

This section is not the same as row data.

It must be:
- shown by default
- hidable/collapsible

It must contain exactly two parts:

1. Description field
2. Field legend

Part 1: Description field
- initially blank
- editable by authorized users
- intended as freeform narrative describing the purpose, semantics, scope, or usage of the sheet
- stored as sheet-level metadata/content
- fully audited with before/after logging

Part 2: Field legend
- non-editable by users
- auto-generated
- auto-updated
- displays the list of field labels and their descriptions
- updates automatically when fields are added, removed, renamed, reordered, or when field descriptions change

The field legend is derived content, so direct edits do not exist. Source schema edits must still be auditable.

--------------------------------------------------
12. FIELD MODEL
--------------------------------------------------

Fields are metadata-defined columns.

Each field must have at least:
- internal UUID
- parent sheet UUID
- label
- machine name / slug
- type
- description
- required flag
- unique flag
- editable flag
- default value
- help text if kept separate
- display order
- validation config
- reference-binding config if applicable
- visibility flag
- archived flag
- created_at
- updated_at
- created_by
- updated_by

Important: each field must store not only label and value type, but also a description.

Field descriptions are editable only in create/edit mode, not in normal data-entry mode.

Field descriptions must be used by:
- the field legend
- the GLOSSARY
- tooltips/help where relevant
- search/analysis metadata indexing

--------------------------------------------------
13. FIELD TYPES
--------------------------------------------------

At minimum support:
- Auto ID
- Short text
- Long text
- Integer
- Decimal
- Boolean
- Date
- DateTime
- Single choice enum
- Multi choice enum
- Single reference
- Multi reference

Optional:
- URL
- Status
- Tag list
- Rich note

Input constraints must follow field type.

--------------------------------------------------
14. ID GENERATION RULES
--------------------------------------------------

The user defines only the prefix.

Examples:
- FR
- IF
- REQ
- UC

Visible ID format:
<PREFIX>-<SEQUENCE>

Examples:
- FR-01
- FR-02
- IF-01

Multi-prefix IDs such as REQ-LOG-01 are NOT allowed.
If separation is needed, it must be modeled through separate sheets, not compound prefixes.

Zero padding should be configurable per sheet.

Visible IDs are generated from canonical row order.

Filtering/sorting in the UI must not change canonical sequence unless the user explicitly performs a reorder operation.

Renumbering events should be logged as system-generated display ID updates.

Again: references must never break because they use immutable row UUIDs.

--------------------------------------------------
15. REFERENCE BINDING MODEL
--------------------------------------------------

A field may be bound to ID fields from other sheets, either:
- in the same document
- or in a different document

For reference fields:
- the user chooses allowed source ID fields
- the current sheet’s own ID field cannot be used as a source for itself unless explicitly allowed in some future phase
- single and multi-reference fields must be supported
- multiple source sheets may be supported

Store references as immutable internal row UUID links.

UI should display visible ID plus optional context label.

When a referenced row is to be deleted, the system must not silently corrupt data.

Default deletion policy:
- block deletion with impact preview if references exist

Alternative policies may be designed for later phases, such as soft-delete with broken-link marker.

--------------------------------------------------
16. MAIN WORKSPACE MODES AND STATES
--------------------------------------------------

The system should have two main workspace views and one overlay state.

Main views:
1. Create/Edit Document/Sheet
2. Inspection/Data Entry

Overlay state:
3. Analysis

Analysis is NOT its own main page.
It is a floating pane overlay.

--------------------------------------------------
17. CREATE/EDIT DOCUMENT/SHEET MODE
--------------------------------------------------

This mode is for structure and schema management.

Document-level actions:
- create document manually
- create document from Excel import
- rename document
- describe document
- duplicate document
- delete document
- create sheets
- reorder sheets
- delete sheets
- manage reserved sheet behavior where applicable

Sheet-level actions:
- create sheet
- rename sheet
- duplicate sheet
- delete sheet
- edit sheet metadata
- set ID policy
- configure validation rules
- edit top description field for user-created sheets if appropriate

Field-level actions:
- add field
- delete field
- rename field
- change field type
- edit field description
- edit field options
- set required/optional
- set uniqueness
- set visibility
- configure bindings
- reorder fields

Field labels, field types, and field descriptions are editable only in this mode.

Before destructive or schema-changing actions, the system must show impact previews including:
- data affected
- references affected
- invalidations introduced
- whether the action is blocked or allowed
- whether snapshot/log creation is triggered

--------------------------------------------------
18. INSPECTION / DATA ENTRY MODE
--------------------------------------------------

This is the main operational mode.

The active sheet should be shown as a grid/table.

Requirements:
- scrollable top content area with existing content
- editable clickable cells where permitted
- type-aware editors
- validation feedback
- filter and sort
- keyboard navigation
- sticky headers
- resizable columns
- searchable pickers for reference fields

A blank new row must always be visible:
- either immediately after the last row
- or pinned at the bottom if the list is long and scrollable

This persistent new-row behavior is mandatory.

Editing behavior should include:
- select
- enter edit
- commit
- cancel
- move by keyboard
- dropdowns/pickers for enums and references

All data edits must generate detailed audit events.

--------------------------------------------------
19. ANALYSIS OVERLAY
--------------------------------------------------

Analysis is a floating pane, not a separate main view.

It must contain:
- search bar
- result list
- filters
- result details

Analysis is triggered either:
- when the user presses Enter in the search bar
- when a field/cell value is clicked while analysis state is active

When a field/cell is clicked in analysis state:
- the clicked value becomes the search query
- the search runs immediately

Search scope must include:
- all documents
- all sheets
- all fields
- all row values
- document names
- sheet names
- field labels
- field descriptions
- sheet description text
- GLOSSARY content
- OPEN ISSUES content

Results must be grouped:
1. by document
2. then by sheet

Each result should show:
- match type
- row if applicable
- field if applicable
- matched excerpt
- jump-to-record action

Suggested match types:
- Row Data
- Sheet Description
- Field Metadata
- Glossary
- Open Issue

If feasible, the plan should also include optional graph-aware relation expansion so that trace-linked records can be surfaced alongside direct text matches.

--------------------------------------------------
20. IMPORT FROM EXCEL
--------------------------------------------------

Import is a first-class required capability.

The system must be able to import new documents from Excel .xlsx files.

Import flow should include:
1. upload workbook
2. create import job
3. parse workbook tabs
4. detect headers
5. infer field types heuristically
6. allow user review/correction of mapping
7. create document
8. create reserved sheets if needed
9. reconcile imported sheets with reserved-sheet roles if possible
10. create user-created sheets
11. import rows and values
12. detect candidate ID fields
13. allow later refinement of reference bindings
14. produce import summary

Import reconciliation rules for reserved sheets:
- if INSTRUCTIONS / GLOSSARY / OPEN ISSUES clearly exist, map them accordingly
- if they do not exist, create them automatically
- if similar variant names exist, allow review/mapping during import
- after import, the internal model must still conform to the reserved-sheet rules

In v1:
- support .xlsx
- do not attempt to preserve arbitrary formulas/macros/layout fidelity
- Excel is treated as source input, not system of record

--------------------------------------------------
21. EXPORT TO EXCEL
--------------------------------------------------

Export is a first-class required capability.

The system must be able to export documents to Excel workbooks.

Export flow:
1. user selects document
2. user triggers export
3. system generates workbook
4. each sheet becomes a tab
5. field labels become headers
6. visible IDs are included
7. reserved sheets are included
8. file is downloaded
9. export job is logged

Reserved sheets must always be exported.

For user-created sheets, Codex must define a deterministic export convention for the top description section and field legend, for example:
- structured pre-table block above the tabular data
or
- another stable machine-clear layout

Exact visual fidelity with prior Excel files is not required.
Logical structure preservation is required.

--------------------------------------------------
22. CONSISTENCY / CASCADE CONTROL ENGINE
--------------------------------------------------

This is a central backend component.

It must detect and manage:
- broken references
- duplicate visible IDs
- invalid typed values
- missing required values
- deleted linked targets
- schema changes that invalidate data
- destructive actions with dependencies

Before destructive operations, the system must show impact preview:
- what will change
- what will break
- how many records are affected
- whether the action is blocked
- what derived/system changes will occur

Integrity checks should run:
- on write
- on import completion
- optionally periodically in the background

There should be an integrity dashboard showing:
- broken links
- invalid rows
- orphan records
- unresolved issues

--------------------------------------------------
23. DETAILED ACTION LOGGING / BACKWARDS TRACEABILITY
--------------------------------------------------

This is a core hard requirement.

All actions must be logged in detail for backwards traceability.

Every audit log entry must capture:
- action type
- user
- timestamp
- target entity type
- target entity identifier
- before value/state
- after value/state
- contextual metadata
- source type
- transaction or correlation ID

This applies to:
- data edits
- row creation
- row deletion
- field creation/edit/deletion
- sheet creation/edit/deletion
- document creation/edit/deletion
- import start/complete/fail
- export start/complete/fail
- reference-binding changes
- schema changes
- permission changes
- renumbering
- system-generated glossary updates
- other system-generated derived updates

Minimum audit event structure:
- audit event UUID
- transaction ID
- timestamp
- acting user UUID
- acting username
- action type
- entity type
- entity UUID
- parent document UUID/name
- parent sheet UUID/name if applicable
- row UUID and visible row ID if applicable
- field UUID and label if applicable
- before_json
- after_json
- diff_json
- summary_text
- source_type (UI / import / export / system / integrity process / renumbering)
- success flag

Action types should include at least:
- DOCUMENT_CREATE
- DOCUMENT_UPDATE
- DOCUMENT_DELETE
- SHEET_CREATE
- SHEET_UPDATE
- SHEET_DELETE
- FIELD_CREATE
- FIELD_UPDATE
- FIELD_DELETE
- ROW_CREATE
- ROW_UPDATE
- ROW_DELETE
- CELL_UPDATE
- BINDING_CREATE
- BINDING_UPDATE
- BINDING_DELETE
- IMPORT_START
- IMPORT_COMPLETE
- IMPORT_FAIL
- EXPORT_START
- EXPORT_COMPLETE
- EXPORT_FAIL
- USER_CREATE
- USER_DISABLE
- PERMISSION_CHANGE
- SNAPSHOT_CREATE
- RENUMBER_APPLY
- INTEGRITY_WARNING
- INTEGRITY_ERROR

Before/after rules:
- updates: exact value before and exact value after
- creations: before = null, after = full created payload
- deletions: before = full deleted payload, after = null/tombstone marker
- schema edits: before = old schema fragment, after = new schema fragment

Deletion traceability is mandatory.
Deletion of rows, fields, sheets, and documents must preserve reconstructable historical state.

Preferred approach:
- soft-delete by default
- tombstones
- full serialized pre-delete state
- optional snapshots

Derived/system updates must also be auditable and marked as system-generated.

There must be an audit log UI where authorized users can:
- filter by user
- filter by document
- filter by sheet
- filter by entity
- filter by action type
- filter by date range
- inspect before/after values
- inspect deleted entities through tombstone view where relevant

--------------------------------------------------
24. SNAPSHOTS, BASELINES, AND DIFF
--------------------------------------------------

Logging alone is not enough.

Support:
- manual snapshots
- automatic pre-destructive-change snapshots
- named baselines

Suggested baseline states:
- seed
- draft
- under review
- baselined
- superseded

Support diff between snapshots of:
- the same document
- the same sheet

Diff should show:
- added/deleted fields
- added/deleted rows
- changed cell values
- changed bindings
- changed descriptions/metadata where relevant

Snapshot creation must itself be logged.

--------------------------------------------------
25. SUGGESTED DATA ARCHITECTURE
--------------------------------------------------

Use a metadata-driven relational architecture, not one SQL table per sheet.

Suggested main tables/entities:
- users
- roles
- user_roles
- permissions
- documents
- sheets
- fields
- rows
- cell_values_scalar
- cell_value_links
- id_policies
- reference_bindings
- integrity_issues
- snapshots
- audit_events
- import_jobs
- import_job_items
- export_jobs
- search_index

Sheet metadata should include fields such as:
- sheet_kind
- is_system_reserved
- fixed_position
- user_description
- description_panel_collapsible
- description_panel_default_visible

Field metadata should include:
- description
- optional help_text
- any needed flags for legend/glossary participation

Recommended scalar cell storage:
cell_values_scalar with typed value columns such as:
- value_text
- value_number
- value_boolean
- value_date
- normalized_text
- display_text

Recommended reference storage:
cell_value_links with:
- source_row_uuid
- source_field_uuid
- target_row_uuid
- ordinal

Store audit logs in a dedicated audit_events table.
Preserve full serialized entity state for deletions in before_json.

--------------------------------------------------
26. SEARCH INDEX / ANALYSIS ARCHITECTURE
--------------------------------------------------

Maintain a denormalized search index or materialized view containing:
- document name
- sheet name
- field label
- field description
- row visible ID
- searchable text
- sheet description content
- glossary text
- open issue text
- optional relation hints

Search should support:
- keyword search
- partial match
- case-insensitive match
- grouped results
- optional relation expansion

Audit log search may be designed as a related capability.

--------------------------------------------------
27. UI / UX REQUIREMENTS
--------------------------------------------------

Suggested layout:
- left sidebar: document and sheet tree
- reserved sheets visually distinct from user-created sheets
- top toolbar: mode toggle, import, export, snapshot, analysis toggle, history
- center pane: active sheet grid or reserved-sheet content
- floating/right pane: analysis overlay
- bottom/status area: integrity and revision status

Reserved sheets should be visually distinguishable, for example using:
- icons
- grouping
- lock/system indicators
- separators

For user-created sheets, the top layout should be:
1. sheet title
2. collapsible description section
   - editable description
   - auto-generated field legend
3. main grid below

GLOSSARY should visually indicate that it is read-only and auto-generated.

OPEN ISSUES Related Field selector should support:
- multi-select
- search
- grouping by source sheet
- display of ID plus context
- no free-text manual entry

Toolbar must expose:
- import from Excel
- export to Excel
- audit/history
- snapshot
- analysis toggle

--------------------------------------------------
28. RECOMMENDED TECHNOLOGY DIRECTION
--------------------------------------------------

Unless there is a strongly justified better alternative, base the implementation plan around:

Frontend:
- React
- Next.js
- TypeScript
- shadcn/ui or equivalent
- TanStack Table or equivalent grid solution

Backend:
- TypeScript
- PostgreSQL
- Prisma or Drizzle
- REST or tRPC

Auth:
- username/email + password
- secure password hashing
- admin-created accounts only
- role-based authorization middleware
- secure sessions or JWT with disciplined refresh design

Excel handling:
- server-side .xlsx import/export libraries

Search:
- PostgreSQL full-text search
- optional trigram support
- application-level relation expansion

Logging:
- implement at service/transaction layer, not only in UI

--------------------------------------------------
29. CONCURRENCY AND EDIT SAFETY
--------------------------------------------------

Prevent silent overwrites.

Use optimistic locking at row level or equivalent.

Each row/save operation should detect stale edits and allow safe resolution.

Conflicts should be surfaced to the user and may also be logged.

Prefer soft-delete over hard-delete in MVP.

--------------------------------------------------
30. SECURITY REQUIREMENTS
--------------------------------------------------

Minimum:
- HTTPS
- hashed passwords
- server-side authorization
- admin-only account creation
- audit logs
- login rate limiting
- validated file upload handling
- secure import/export endpoints
- backup strategy

Although initially hosted in a personal space, the architecture should remain ready for later hardening:
- document classification tags
- export restrictions
- fine-grained access control
- access logging

--------------------------------------------------
31. HARD BUSINESS RULES
--------------------------------------------------

Treat the following as non-negotiable:

1. The true database key is never the visible engineering ID.
2. References are stored using immutable row UUIDs.
3. Visible IDs may be renumbered without breaking references.
4. Multi-prefix IDs are not allowed.
5. Every document must contain exactly these three leading reserved sheets:
   - INSTRUCTIONS
   - GLOSSARY
   - OPEN ISSUES
6. These reserved sheets must be distinguished from user-created sheets.
7. INSTRUCTIONS is editable and initially empty.
8. GLOSSARY is system-maintained, auto-updated, and non-editable by users.
9. GLOSSARY must contain the fixed fields:
   - Block
   - Field or Code
   - Value or Meaning
10. OPEN ISSUES must contain the fixed standard fields:
   - OP_ID
   - Topic
   - Related Field
   - Question or Open Point
   - Why It Matters
   - Requested By
   - Requested From
   - Priority
   - Status
   - Response or Decision
   - Notes
11. OPEN ISSUES.Related Field is not free text; it must be a multi-reference selector limited to ID entries from other sheets in the same document.
12. Every field must store label, type, and description.
13. Field labels, field types, and field descriptions are editable only in create/edit mode.
14. Every user-created sheet must have a default top description section.
15. That section must contain:
   - a user-editable description field
   - a non-editable auto-generated field legend
16. The field legend must display field labels and their descriptions.
17. The description section must be hidable/collapsible.
18. A blank new row must always be visible in inspection/data-entry mode.
19. Analysis is a floating overlay state, not a separate page.
20. Search must cover all documents, sheets, fields, values, and relevant metadata.
21. Search results must be grouped by document and then sheet.
22. Destructive actions must run impact analysis first.
23. The system must support import of new documents from Excel files.
24. The system must support export of documents to Excel files.
25. The system must maintain detailed audit logs with before/after values.
26. Logging applies also to deletion of rows, fields, sheets, and documents.
27. Deletion must preserve backwards traceability through tombstones, serialized pre-delete state, snapshots, or equivalent.
28. Import and export actions must also be logged.
29. Derived/system-generated updates must also be traceable.
30. The backend must be database-native even if the UI is spreadsheet-like.
31. The app is a structured engineering repository, not a generic spreadsheet engine.

--------------------------------------------------
32. WHAT YOU MUST DELIVER
--------------------------------------------------

Produce a full implementation plan including:

1. Proposed overall architecture
2. Normalized database schema
3. Entity model and relationships
4. API design
5. Frontend component map
6. State-management design for the two main views plus analysis overlay
7. Reserved-sheet architecture
8. GLOSSARY auto-generation logic
9. OPEN ISSUES reference-picker logic
10. Field-description support in DB/API/UI
11. Import workflow
12. Export workflow
13. Audit logging architecture
14. Deletion/tombstone strategy
15. Snapshot/baseline strategy
16. Integrity and impact-analysis logic
17. Search/indexing design
18. UI wireframe description
19. MVP vs later-phase breakdown
20. Phased implementation roadmap
21. Risks and mitigations
22. Suggested package/library choices
23. Sequence diagrams or at least stepwise interaction flows for:
   - create document
   - import document from Excel
   - create/edit schema
   - data entry
   - cross-sheet reference edit
   - row deletion with impact preview
   - sheet deletion with impact preview
   - document deletion with trace-preserving behavior
   - glossary refresh
   - analysis search
   - export to Excel
   - audit log inspection

--------------------------------------------------
33. DESIGN PHILOSOPHY
--------------------------------------------------

Optimize for:
- correctness over cleverness
- traceability over convenience
- safe change propagation over ad hoc editing
- schema flexibility over hardcoded table design
- relational integrity over spreadsheet looseness
- simple standard database mechanisms over exotic infrastructure
- usable engineering UI over generic spreadsheet mimicry

The MVP must already include:
- reserved sheets
- user-created sheets with top description/legend section
- Excel import
- Excel export
- detailed audit logging
- trace-preserving deletion behavior
- safe UUID-based references
- impact analysis for destructive actions
- searchable analysis overlay
- basic integrity checking

--------------------------------------------------
34. AUTHENTICATION, USER MANAGEMENT, AND ACCESS SECURITY
--------------------------------------------------

The platform is closed-access.

There must be:
- no public registration
- no public onboarding form
- no self-service account creation

Users may access the platform only through:
- the initial administrator bootstrap flow
- admin-created invitation links for all other users

--------------------------------------------------
34.1 LOGIN ENTRY POINT
--------------------------------------------------

The default root/landing page of the platform must be only a login page containing:
- username field
- password field
- login button

No registration link must be shown.

This requirement applies to normal access through the platform root URL.

Invitation links may open a dedicated account-activation page, but all ordinary access must begin from the login page.

--------------------------------------------------
34.2 INITIAL ADMINISTRATOR BOOTSTRAP
--------------------------------------------------

The system must initially provide a bootstrap administrator account with:

- username: admin
- password: admin

This bootstrap credential pair is one-time bootstrap only.

On the first successful login with admin/admin, the system must:
- immediately force the admin to define a new password
- require password confirmation
- block all access to the rest of the platform until the password change is completed

The bootstrap password must never remain valid after the first password change.

Recommended implementation details:
- the bootstrap admin account should have must_change_password = true
- no application actions should be allowed before password change
- the password change event must be fully audited
- optionally require the admin to complete basic profile fields immediately after first password change

--------------------------------------------------
34.3 INVITATION-BASED USER ONBOARDING
--------------------------------------------------

All non-bootstrap users must be onboarded only through admin-created invitations.

The admin must be able to create invitation links that are:
- bound to a specific email address
- single-use
- valid for 48 hours (2 days)
- revocable before use

The admin will distribute the links manually outside the platform.

Invitation records must store at least:
- invitation UUID
- invited email address
- intended role or roles
- optional preassigned username or username policy
- invited_by admin user ID
- created_at
- expires_at
- used_at
- revoked_at
- status (pending / used / expired / revoked)
- secure token hash

Important:
- raw invitation tokens must not be stored in plaintext
- store only a secure hash of the invitation token
- tokens must be cryptographically strong and unguessable

--------------------------------------------------
34.4 INVITATION ACCEPTANCE FLOW
--------------------------------------------------

When a user opens an invitation link:
- validate token
- verify token not expired
- verify token not revoked
- verify token not previously used
- verify the email binding

If valid, the user must be allowed to activate the account.

Activation must include:
- setting password
- confirming password
- optionally confirming username if not preassigned
- optionally filling profile basics such as first name, last name, and organization

After successful activation:
- mark invitation as used
- permanently invalidate the token
- activate the user account
- log the activation event

--------------------------------------------------
34.5 USERNAME, EMAIL, AND IDENTITY MODEL
--------------------------------------------------

The platform uses username + password login.

Each user must have:
- a unique username
- a unique email address

Invitation is bound to email.

Codex should choose one of these two identity policies and keep it consistent:
1. admin-assigned username
2. user-selectable username during invitation acceptance, subject to uniqueness

Preferred policy for control and simplicity:
- admin-assigned username

Regardless of the chosen policy, the implementation plan must keep username uniqueness and email uniqueness explicit.

--------------------------------------------------
34.6 PASSWORD MANAGEMENT
--------------------------------------------------

Both:
- invited users during first activation
- the bootstrap admin during first login

must define a password through a standard password dialog containing:
- new password
- confirm password

Password mismatch must be rejected.

Each logged-in user must also be able to change their own password.

Recommended password-change flow:
- current password
- new password
- confirm new password

Passwords must never be stored in plaintext.

Passwords must be stored using a strong password hashing algorithm:
- Argon2id preferred
- bcrypt acceptable if Argon2id is unavailable, with a strong cost factor

The implementation plan should include a minimum password policy, for example:
- minimum length
- password confirmation
- rejection of obviously trivial passwords if practical

Do not overcomplicate the MVP, but basic strength enforcement must exist.

Password-related actions must be fully audited.

--------------------------------------------------
34.7 USER PROFILE MANAGEMENT
--------------------------------------------------

Each user must be able to manage their own basic profile information.

Minimum self-editable fields:
- first name
- last name
- organization

The user should also be able to view:
- username
- email
- assigned roles or access scope, at least read-only

Profile edits must be logged with before/after values.

--------------------------------------------------
34.8 ADMIN USER MANAGEMENT
--------------------------------------------------

The admin must have full user-management capability.

The admin must be able to:
- create invitations
- revoke invitations
- inspect invitation status
- view users
- edit all user details
- change user roles
- enable users
- disable users
- force password change on next login
- reset/restart onboarding if needed through an admin flow
- archive/delete users

Important traceability rule:
- delete user must not normally perform hard physical deletion
- deletion should be implemented as soft delete / archive / disable by default
- historical identity must remain preserved for audit integrity
- the system must remain able to resolve historical audit events to the archived user identity

Hard delete, if ever supported later, must be treated as an exceptional administrative operation and must not compromise audit integrity.

For MVP, soft-delete/archive is the required design direction.

--------------------------------------------------
34.9 USER STORAGE MODEL
--------------------------------------------------

A dedicated users table is mandatory.

At minimum, the user entity should contain:
- user UUID
- username
- email
- password hash
- first name
- last name
- organization
- account status (pending_activation / active / disabled / archived)
- must_change_password flag
- created_at
- updated_at
- last_login_at
- created_by
- archived_at or deleted_at if soft delete is used

Related identity/security tables should include at least:
- users
- roles
- user_roles
- invitations
- sessions or refresh tokens
- audit_events

--------------------------------------------------
34.10 PERSONAL USER LOG / ACTIVITY HISTORY
--------------------------------------------------

Each user must have a personal log of their edits and actions.

Preferred design:
- maintain one central immutable audit log for the whole platform
- expose a per-user filtered history view rather than duplicating logs into separate storage

A user’s personal activity/history view should include actions such as:
- login events
- failed login attempts where appropriate
- logout
- password changes
- profile edits
- row edits
- row creation/deletion
- field edits
- sheet/document edits
- import/export actions
- admin actions if the user is an administrator

Visibility rules:
- each user may view their own activity log
- admin may view every user’s activity log
- ordinary users must not see other users’ activity unless explicitly authorized

--------------------------------------------------
34.11 SESSION AND LOGIN SECURITY
--------------------------------------------------

The implementation plan must include secure authenticated session management.

Recommended minimum design:
- secure server-side sessions or a disciplined JWT-based architecture
- session invalidation on logout
- HTTP-only cookies
- Secure cookies
- SameSite=Lax or stricter, depending on architecture

Also include:
- logging of successful login attempts
- logging of failed login attempts
- basic login rate limiting / brute-force protection
- optional temporary cooldown or lockout after repeated failures

If the app is deployed behind a reverse proxy, the plan must account for:
- trusted forwarded headers
- correct HTTPS detection
- correct secure-cookie behavior behind TLS termination

--------------------------------------------------
34.12 HTTPS-ONLY REQUIREMENT
--------------------------------------------------

The platform must accept only HTTPS connections.

This is a hard requirement.

The implementation plan must include:
- HTTP to HTTPS redirect or outright HTTP rejection
- secure cookie enforcement
- HTTPS-aware session handling
- HSTS if deployment context allows it

No authenticated platform operation should be allowed over plaintext HTTP.

--------------------------------------------------
34.13 SECURITY-RELEVANT AUDIT EVENTS
--------------------------------------------------

The audit/logging architecture must explicitly include identity and security events, not only document edits.

At minimum log:
- bootstrap admin first login
- forced bootstrap password change
- invitation creation
- invitation revocation
- invitation acceptance
- user activation
- successful login
- failed login
- logout
- password change
- admin-forced password reset or must_change_password flag update
- profile change
- role change
- account enable/disable
- account archive/delete

These security events should include, where relevant:
- actor
- target user
- timestamp
- before state
- after state
- source type
- success/failure status
- session or request metadata if feasible
- source IP if feasible and appropriate

--------------------------------------------------
34.14 HARD BUSINESS RULES FOR AUTH AND SECURITY
--------------------------------------------------

Treat the following as non-negotiable:

1. There is no public registration.
2. Users are onboarded only through admin-created invitation links.
3. Invitation links must be bound to a specific email address.
4. Invitation links must expire after 48 hours.
5. Invitation links must be single-use.
6. Invitation links must be revocable before use.
7. Raw invitation tokens must not be stored in plaintext.
8. The default platform entry page must be only a login page with username, password, and login button.
9. The bootstrap admin credentials are admin/admin only for the first login.
10. First bootstrap admin login must force immediate password change before any other platform action.
11. Invited users must set their password through a password + confirmation flow during first activation.
12. Each user must be able to change their own password.
13. Each user must be able to edit first name, last name, and organization.
14. A dedicated users table must exist.
15. A per-user activity log must be available, preferably as a filtered view over the central audit log.
16. The admin must be able to edit all user details.
17. The admin must be able to enable, disable, archive, or delete users.
18. User deletion must preserve auditability; soft-delete/archive is preferred over hard delete.
19. The platform must operate only over HTTPS.
20. Authentication, invitation, password, and user-management events must be auditable.

--------------------------------------------------
34.15 WHAT CODEX MUST DELIVER FOR THIS SECTION
--------------------------------------------------

For authentication, identity, and access security, produce:

1. Auth architecture
2. Invitation-token design
3. Bootstrap admin flow
4. User schema
5. Invitation schema
6. Session or token schema
7. Password-change flows
8. Admin user-management UI design
9. Personal activity-log UI design
10. HTTPS enforcement strategy
11. Security/audit event design
12. Recommended package/library choices for authentication and password hashing
13. Risk analysis and mitigations for:
   - bootstrap credentials
   - leaked invitation links
   - expired/reused tokens
   - brute-force login attempts
   - account disable/archive semantics
   - preserving auditability when users are deleted

Now produce the implementation plan in a structured, engineering-focused way.