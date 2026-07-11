# CORTA QC — Quality Control for Food Manufacturers

Multi-user, role-based quality control system: product specifications, scheduled inspections, non-conformances (NC), corrective actions (CAPA), dashboards and reports.

Two deployment paths are supported side by side:

1. **Lovable Cloud (managed)** — TanStack Start on Cloudflare Workers + managed Postgres/Auth (Supabase). Sign-up self-serve, roles auto-assigned (first user → administrator).
2. **Self-hosted (docker compose)** — Node/Express REST API + Postgres 16. Full 15-table schema, JWT + refresh tokens, `{data, meta}` envelopes, keyset/offset pagination, structured JSON logging, and a global error handler with `{error:{code,message,details}}` responses.

## Self-hosted deployment (docker compose)

```bash
cp .env.example .env       # tweak secrets if desired
docker compose up --build  # builds the api image, starts db + api
# API on http://localhost:3000  (health: /health)
# Default admin user: admin@corta.local / admin123 (change immediately)
```

Compose services:

| Service | Image / build            | Purpose                                                                 |
| ------- | ------------------------ | ----------------------------------------------------------------------- |
| `db`    | `postgres:16-alpine`     | Persistent DB (`corta_db_data` volume). Schema + seed in `api/db/init/`.|
| `api`   | Built from `./api`       | Express REST API. Multi-stage Dockerfile (`npm run build` → `node dist`).|

### Environment variables

All variables are documented in `.env.example`. Highlights:

- `DATABASE_URL` — Postgres URL used by the API.
- `JWT_SECRET`, `JWT_EXPIRY`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRY` — auth tokens.
- `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `LOG_LEVEL` — HTTP / logging.
- `SMTP_*` — optional email transport.

### API surface

- `POST /auth/register`, `POST /auth/login` → `{accessToken, refreshToken, user}` in a `{data, meta}` envelope.
- `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- CRUD for `products`, `product-categories`, `inspections`, `non-conformances`, `corrective-actions`, `roles`, `users` (admin), `settings/units`, `settings/severities`, `audit-logs`.
- `POST /inspections/:id/transition` — start / complete / cancel (with reason) / reopen (admin).
- `POST /inspections/:id/measurements` — supports `is_na` and `attachment_url`.
- `GET /dashboard/summary`, `GET /reports/*`, `GET /exports/:type` (CSV).
- Every error returns `{error: {code, message, details?}}`; every list returns `{data, meta: {total, page, limit, nextCursor}}`.
- Every request emits a JSON log line with `correlationId`, method, path, status, ms.

### Database schema (self-hosted)

15 tables — `users`, `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `product_categories`, `products`, `quality_specifications`, `specification_items`, `measurement_units`, `severities`, `inspection_schedules`, `inspections`, `inspection_measurements`, `non_conformances`, `corrective_actions`, `audit_logs`. `audit_logs.id` is `BIGSERIAL`, with a BRIN index on `created_at` and BTREE on `(entity_type, entity_id)` and `user_id`.

## Managed cloud (Lovable Cloud)

The React SPA in `src/` talks directly to Supabase with row-level security (RLS) policies gating writes by role. Auth flow is email/password on `/auth`. Roles enforced with RLS: `administrator`, `quality_manager`, `inspector`, `auditor`, `viewer`.

## Roles

| Role            | Highlights                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| administrator   | Full access, incl. user/role/permission management and destructive actions |
| quality_manager | Manages products, specs, NC workflow, verifies CAs                         |
| inspector       | Executes inspections, records measurements, raises NCs                     |
| auditor         | Read-only across the platform, verifies CAs                                |
| viewer          | Read-only dashboards                                                       |

## Tech stack

- Frontend: React 19 + TanStack Router/Query, Tailwind v4, shadcn/ui, Recharts, dnd-kit, jsPDF.
- Cloud backend: Managed Supabase (Postgres + Auth + Storage), RLS.
- Self-hosted backend: Node 20 + Express, `pg`, Zod, Winston (JSON logs), JWT + bcrypt.

## Notable routes (SPA)

- `/` Dashboard · `/products` Products · `/inspections` Inspections (+ `/inspections/calendar`)
- `/non-conformances` NC board (drag-and-drop) · `/non-conformances/list` NC table
- `/corrective-actions` CAPA workflow · `/reports` KPIs + charts + CSV/PDF export
- `/admin` Users, roles, permissions, system settings · `/profile` Profile + avatar
- `/auth`, `/login` sign-in
