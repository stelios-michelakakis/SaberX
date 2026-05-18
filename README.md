# EDF SABER

**A database-native engineering repository for structured documents — CONOPS, ICDs, RTMs, and similar workbook-shaped artefacts.**

Engineering teams typically manage these as a fleet of interdependent Excel files. EDF SABER replaces that fleet with a single, structured repository:

- **PostgreSQL is the system of record.** Excel is an import/export format.
- **Every row has a stable UUID.** Cross-document references survive renumbering.
- **Schema is first-class data.** Field types, descriptions, validation rules, and reference bindings are stored and audited.
- **Everything is auditable, snapshottable, and reversible.** Soft deletes, immutable audit log, named baselines with diff.
- **Agents are first-class users.** A built-in MCP server exposes the same operations to LLMs as a typed tool surface.

> Personal / early-stage project. Not yet hardened for multi-tenant production. See [LICENSE](LICENSE) (MIT).

## Highlights

- **Document workspace.** Every document is created with the three reserved sections (`INSTRUCTIONS`, `GLOSSARY`, `OPEN ISSUES`) plus any user-defined sheets. Glossary entries are derived automatically from the schema.
- **Type-aware grid.** Text, long-text, numbers, booleans, dates, single/multi enums, status, tags, URLs, and single/multi references — each cell has a type-appropriate editor (date picker, enum dropdown, reference picker constrained by sheet bindings).
- **Trace links.** Cross-sheet/cross-document row references stored as UUIDs, with a graph view and incoming-reference lookup. Reference cells are blocked from deletion when something points at them.
- **Sources.** A global library of uploaded files (PDF, DOCX, MD, TXT — up to 50 MB each). Files are content-addressed by SHA-256 so duplicate uploads dedupe automatically. Any reference field can opt in to allow source targets alongside row targets; chips render with a file icon and click through to an inline viewer (PDF preview, MD/TXT rendered as text).
- **Snapshots & diff.** Named, immutable point-in-time captures of a document with added/changed/removed reporting.
- **Excel I/O.** Import an `.xlsx` workbook as a new document with inferred field types; export any document back to a deterministic `.xlsx`.
- **Search.** Full-text + trigram across documents, sheets, fields, rows, glossary, and open issues. Optional 1-hop relation expansion.
- **Audit log.** Every meaningful action — schema changes, cell edits, imports/exports, snapshots, security events — stored with actor, timestamp, before/after, diff, and transaction id. Filterable by actor / action / document.
- **Undo.** ⌘Z / Ctrl+Z reverses the user's last reversible action (row create/delete, cell update, document delete).
- **Auth.** No public registration. Invitation-only onboarding with single-use hashed tokens, Argon2id password hashing, forced first-login password change, and role-based authorization (Admin / Editor / Reviewer).
- **MCP server.** A `/api/mcp` endpoint speaks Model Context Protocol over Streamable HTTP with tools covering the same surface area as the UI (documents, sheets, fields, rows, cells, snapshots, sources, search, audit). Tokens are minted per-user from the profile page and inherit that user's role. See **[MCP.md](MCP.md)**.

For the full product spec, see **[FEATURES.md](FEATURES.md)**.

## Quick start

Requirements: Node 20+, Docker (for the bundled Postgres), and npm.

```bash
# 1. Clone and install
git clone https://github.com/stelios-michelakakis/SaberX.git
cd SaberX
npm install

# 2. Copy the env template — defaults work out of the box for local dev
cp .env.example .env

# 3. Start Postgres (Docker Desktop must be running)
docker compose up -d postgres

# 4. Run migrations and seed the bootstrap admin
npm run db:migrate
npm run db:seed

# 5. Start the app
npm run dev
```

Open <http://localhost:3000> and sign in as **`admin` / `admin`**. The first login forces a password change before the dashboard is accessible.

To wipe local data and start clean:

```bash
docker compose down -v && docker compose up -d postgres
npm run db:migrate && npm run db:seed
```

## Connecting an agent

Once logged in, go to **Profile → API tokens for agents (MCP)**, mint a token (optionally read-only), and plug it into any MCP client. Example with Claude Desktop:

```json
{
  "mcpServers": {
    "edf-saber": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "http://localhost:3000/api/mcp",
        "--header", "Authorization: Bearer sbx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      ]
    }
  }
}
```

Full reference, tool list, and `curl` examples in [MCP.md](MCP.md).

## Stack

- **[Next.js](https://nextjs.org)** 15 (App Router) + React 19
- **[PostgreSQL](https://www.postgresql.org)** 17 (with `pgcrypto` for UUIDs and `pg_trgm` for trigram search)
- **[Drizzle ORM](https://orm.drizzle.team)** for schema and migrations
- **[Argon2id](https://github.com/ranisalt/node-argon2)** for password hashing
- **[ExcelJS](https://github.com/exceljs/exceljs)** for `.xlsx` import/export
- **[@modelcontextprotocol/sdk](https://modelcontextprotocol.io)** for the MCP server

## Architecture notes

- Services in [`src/services/`](src/services/) own all mutations; API routes and the MCP server are thin wrappers around the same functions. Audit, search-index refresh, and glossary refresh are baked into the service layer so they cannot be skipped.
- Soft deletes with tombstone snapshots on rows; documents and sheets soft-delete with `deletedAt`. The `undo` service reverses the user's most recent reversible action using `audit_events.before_json`.
- Reference integrity is enforced at the service layer: deleting a row that has inbound `cellValueLinks` is blocked until those references are cleared.
- The frontend uses scoped design tokens (`.sx-shell`, `--sx-*`) so the dashboard styles don't bleed into the auth pages.

## Production deployment

Full recipe for a single Ubuntu VM (with Docker, Caddy auto-TLS, backups, and an ops cheatsheet) lives in **[DEPLOY.md](DEPLOY.md)**. Short version:

- Run behind an HTTPS reverse proxy (the middleware sets HSTS in production mode).
- Set real values for `APP_ORIGIN`, `POSTGRES_PASSWORD`, `INVITATION_SECRET`, and `SESSION_COOKIE_NAME` in the deployment environment.
- Use the production override: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` — it pulls every secret from `.env`, takes Postgres off the public port, and binds the web container to `127.0.0.1` only.
- Don't expose `/api/mcp` without HTTPS — bearer tokens travel in the `Authorization` header.
- Disable `npm run db:seed` (or run it exactly once at bootstrap) so the trivial default admin doesn't exist.
- The base `docker-compose.yml` is for local development only — its postgres credentials are deliberately weak.

## License

[MIT](LICENSE) © 2026 Stylianos Michelakakis
