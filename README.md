# SaberX Engineering Workbook Repository

Database-native engineering document repository for workbook-like artifacts such as CONOPS, ICD, and RTM. Excel is treated as an import/export format; PostgreSQL is the system of record.

## Local Setup

1. Copy environment values:

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL. With Docker Desktop running:

   ```bash
   docker compose up -d postgres
   ```

3. Apply migrations and seed the bootstrap admin:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

Bootstrap login is `admin` / `admin`. The first successful login forces an immediate password change before workspace access.

## Implemented MVP Surface

- Next.js App Router application with REST route handlers.
- PostgreSQL/Drizzle schema and generated migration for the repository model.
- Custom username/password auth, server-side sessions, bootstrap admin, invitations, profile/password flows, and admin user screen.
- Document creation with mandatory reserved sheets: `INSTRUCTIONS`, `GLOSSARY`, `OPEN ISSUES`.
- User-created sheets with ID policies, field descriptions, field legend, grid data entry, UUID-backed references, and persistent new row.
- Audit logging for security, document, sheet, field, row, cell, import/export, snapshot, and derived glossary events.
- Soft deletion/tombstone path for rows, impact analysis endpoint, snapshots/diff, integrity issue dashboard, search index, and floating analysis overlay.
- Excel `.xlsx` import/export using server-side ExcelJS.

## Notes

- The migration enables `pgcrypto` and `pg_trgm` for UUID generation and trigram search.
- Production deployments should place the app behind an HTTPS reverse proxy and set `APP_ORIGIN`, `DATABASE_URL`, and `INVITATION_SECRET`.
- Docker Compose includes `web`, `worker`, and `postgres`; the `worker` refreshes glossary/search derived data.
