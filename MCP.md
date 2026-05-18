# EDF SABER MCP Server

EDF SABER exposes a [Model Context Protocol](https://modelcontextprotocol.io) server so
agents can read and mutate the engineering repository the same way a user can
through the UI. Every action runs as the token's owner, inherits that user's
role-based permissions, and is recorded in the immutable audit log with a
`mcp` source tag.

## Endpoint

```
POST /api/mcp
Authorization: Bearer <token>
```

The server speaks MCP over [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http)
with JSON responses enabled. It is stateless: each request initializes a fresh
session, handles the call, and closes.

## Getting a token

1. Open **Profile** in the sidebar.
2. Scroll to **API tokens for agents (MCP)**.
3. Name the token (e.g. _"Claude Desktop · laptop"_), optionally tick **Read-only**,
   click **Generate token**.
4. Copy the token shown once — it cannot be retrieved later.

Permissions inherit your account role:

| Role | Can use MCP tools | Can mutate | Can call `list_audit_events` |
|---|---|---|---|
| Admin | Yes | Yes | Yes |
| Editor | Yes | Yes (unless token is read-only) | No |
| Reviewer | Yes | No (treated as read-only) | No |

A **read-only token** can never mutate, regardless of role.

## Connecting Claude Desktop

Add an entry to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "edf-saber": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/api/mcp",
        "--header",
        "Authorization: Bearer sbx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      ]
    }
  }
}
```

Replace the token with one you generated. Restart Claude Desktop and EDF SABER
tools will appear in the model's tool list.

## Connecting `claude` CLI (Claude Code)

```
claude mcp add edf-saber --transport http http://localhost:3000/api/mcp \
  --header "Authorization: Bearer sbx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Tools

### Documents

- `list_documents` — list workspace documents with sheet summaries.
- `get_document` — full metadata + sheet/field skeleton for one document.
- `create_document` — create a new document (auto-creates the 3 reserved sheets).
- `update_document` — patch title / description / status / classification /
  baseline state. Supports optimistic concurrency via `version`.
- `delete_document` — soft-delete (archive); reversible by an administrator.
- `export_document_json` — dump full content (sheets + fields + all rows) for
  large-context model use.

### Sheets

- `create_sheet` — add a user-defined sheet with an ID prefix and zero-padding.
- `update_sheet` — rename or re-describe a sheet.
- `get_sheet` — fields (with options + reference bindings) and every row in the
  sheet, with cell values.

### Fields (columns)

- `create_field` — add a column. `options` for enum-family types,
  `bindings` for reference-family types. Each binding can carry
  `displayFieldId` (which target column to render in chips/picker, defaults to
  the ID field) and `allowSources` (when true, the picker also lists uploaded
  sources from the global library alongside row targets).
- `update_field` — change label, description, required, unique, editable,
  options, or bindings.
- `archive_field` — hide a field without deleting row data.
- `reorder_fields` — reorder columns within a sheet.
- `list_reference_targets_for_field` — list rows valid as targets for a
  reference field (respects bindings). When any binding has `allowSources`,
  sources are mixed in with `kind: "source"`.

### Rows and cells

- `create_row` — insert a row, optionally pre-filling cells.
- `delete_row` — soft-delete a row.
- `set_cell_value` — update one cell. Reference fields accept either bare row
  UUIDs (legacy shape) or arrays of `{ kind: "row" | "source", id: uuid }` so a
  single cell can mix row links and source links when the binding allows it.
  Enum multi-fields take arrays; dates take ISO strings.

### Sources

- `list_sources` — list uploaded sources (PDF/DOCX/MD/TXT) in the global source
  library. Optional `q` filters by filename substring.
- `get_source` — metadata for one source: filename, mime type, size, sha256,
  uploader, timestamps.
- `create_source` — upload a file. Provide one of `contentBase64` (for binary
  formats like PDF/DOCX) or `contentText` (for MD/TXT). The filename's
  extension determines the stored MIME type. Max 50 MB. Sources are content-
  addressed by sha256 — re-uploading identical bytes returns the existing row
  without duplicating storage.
- `delete_source` — soft-delete a source. Fails if any cell still references
  it; clear the references first via `set_cell_value`.
- `download_source` — return a source's bytes. Text formats come back as
  `contentText` (utf8); binary formats come back as `contentBase64`.

### Snapshots and diff

- `create_snapshot` — name an immutable point-in-time capture of a document.
- `diff_snapshots` — compare two snapshots of the same document; returns
  added / changed / removed entities with before/after JSON.

### Inspection

- `search` — full-text search across the repository.
- `list_integrity_issues` — open integrity issues (broken links, type errors,
  missing required values).
- `preview_impact` — preview a destructive op (row_delete / field_delete /
  sheet_delete / document_delete / field_type_change) before running it.
- `list_audit_events` — **admin only**; recent audit events.

## Security notes

- Tokens are SHA-256 hashed at rest. The plaintext is shown once on creation.
- Tokens may be revoked at any time from the profile page; revocation takes
  effect immediately.
- Every mutating tool call writes to `audit_events` with `actingUserId` = the
  token's owner and `requestMeta.tokenName` set to the token's name so you can
  see which agent did what.
- The MCP endpoint enforces HTTPS-only sessions in production via the existing
  HSTS middleware. Use plaintext HTTP only for local development.

## Examples (`curl`)

List tools:

```
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Create a document:

```
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tools/call",
    "params":{"name":"create_document","arguments":{"title":"Cooling subsystem CONOPS"}}
  }'
```
