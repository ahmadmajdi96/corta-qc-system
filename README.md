# CORTA QC — Quality Control Platform

Role-based quality control platform for food manufacturers. Product specifications, scheduled inspections, measurement recording, non-conformance tracking, corrective actions (CAPA), dashboards, and reports.

## Two deployment paths

### 1) Managed (Lovable Cloud) — the running system
The app in this repo runs on **TanStack Start** with a managed **PostgreSQL + Auth** backend (Lovable Cloud). Sign up on `/auth`, then use the app. The first user to sign up automatically receives the `administrator` role; subsequent users default to `viewer` (an admin can promote them under **Administration → Users**).

### 2) Self-hosted (docker compose)
For local/on-prem deployment mirroring the Node/Express + Postgres architecture in the product documentation:

```bash
cp .env.example .env
# edit secrets in .env
docker compose up --build
```

Services:
- `api` — Node/Express, port `3000`, multi-stage Docker build
- `db` — `postgres:16-alpine`, healthchecked with `pg_isready`, data in the named volume `corta_db_data`

The full schema (all 15 tables, RLS, triggers, seed data) is in `supabase/migrations/`. Extend `api/db/init/*.sql` with the same statements to bootstrap the self-hosted database.

## Roles

| Role | Purpose |
|---|---|
| administrator | Users, roles, permissions, settings |
| quality_manager | Products, specs, schedules, NCs, CAs, reports |
| inspector | Perform inspections, record measurements, raise NCs |
| auditor | Read-only review of historical data |
| viewer | Read-only dashboards and reports |

## Tech

- **Frontend**: React 19 + TanStack Router + TanStack Query + Tailwind v4 + shadcn/ui
- **Backend**: PostgreSQL 16 with RLS enforcing role permissions on every table
- **Auth**: Email/password with server-side JWT (managed) or JWT + refresh tokens (self-hosted)
- **Validation**: Zod schemas on every form
- **State**: React Query with pagination on every list

## Notable routes

- `/` Dashboard · KPIs, today's inspections, urgent NCs, my overdue actions
- `/products` · `/products/:id` — product catalogue, versioned specifications, inspection history
- `/inspections` · `/inspections/calendar` · `/inspections/:id` · `/inspections/:id/execute`
- `/non-conformances` (board) · `/non-conformances/list` · `/non-conformances/:id`
- `/corrective-actions` · `/corrective-actions/:id`
- `/reports` — trends, NC analysis, CAPA effectiveness, CSV export
- `/admin` — users, roles & permissions, measurement units, severities
- `/profile` — full name, password change
