# CORTA QC → MES-Grade QC (Design + Feature Overhaul)

## Phase A — Design system full clone

Adopt MES Command Center's dark industrial theme verbatim:
- Replace `src/styles.css` with MES tokens: graphite/cyan/amber palette, Space Grotesk + JetBrains Mono, `glass-panel`, `text-glow`, `status-dot`, `animate-pulse-glow`, `animate-ticker` utilities, radial gradient body background.
- Load Space Grotesk + JetBrains Mono via `<link>` in `src/routes/__root.tsx`.
- Rebuild app shell (`src/components/app-shell.tsx`) as a `SidebarProvider` layout with a persistent icon-collapsible sidebar (cyan glow on active), top ticker/status bar, glass header. Sidebar sections: **Operations** (Dashboard, Live, Work Orders, Execution), **Quality** (Inspections, Non-Conformances, Corrective Actions, Holds, SPC, Calibration), **Master Data** (Products, Lines, Stations, Gages, Suppliers), **Admin** (Users, Settings, Audit).
- Retheme all shadcn primitives (Button, Card, Badge, Table, Dialog, Tabs) to use the new tokens; no hardcoded colors.
- Rebrand auth card + login with the new theme.

## Phase B — Data model (native tables)

One Supabase migration + matching self-hosted DDL in `api/db/init/00-schema.sql`:

New tables (with RLS + GRANTs):
- `production_lines` (name, area, is_active)
- `stations` (line_id, name, code, station_type, is_active)
- `work_orders` (number, product_id, lot_number, quantity_planned, quantity_produced, status[planned|released|in_progress|completed|closed|on_hold], line_id, planned_start, planned_end, actual_start, actual_end)
- `wo_operations` (work_order_id, station_id, sequence, status)
- `inspection_plans` (name, plan_type[incoming|in_process|final], product_id, aql_level, sample_size_rule, is_active)
- `plan_characteristics` (plan_id, spec_item_id, sample_frequency)
- `suppliers` (name, code, rating, is_active)
- `incoming_lots` (supplier_id, product_id, po_number, lot_number, received_qty, received_at, status)
- `gages` (code, name, type, manufacturer, serial, resolution, last_cal_date, next_cal_date, status[active|due|overdue|out_of_service])
- `calibration_records` (gage_id, performed_at, performed_by, result[pass|fail|conditional], certificate_ref, notes, next_due)
- `msa_studies` (gage_id, study_type[gage_rr|linearity|bias], performed_at, result_json, verdict)
- `quality_holds` (lot_number, work_order_id, product_id, reason, severity_id, status[open|under_review|released|scrapped|rework], created_by, resolved_by, resolved_at, disposition[use_as_is|rework|scrap|return_to_supplier])
- `capa_records` (nc_id, methodology[8d|5why|fishbone], d1_team, d2_problem, d3_containment, d4_root_cause, d5_corrective, d6_implement, d7_prevent, d8_recognition, effectiveness_verified_at, effectiveness_verified_by, status)
- `spc_samples` (spec_item_id, product_id, station_id, sample_time, subgroup_id, x_bar, r_value, sigma, ucl, lcl, out_of_control_rules jsonb)

Extend existing tables:
- `inspections`: add `work_order_id`, `station_id`, `line_id`, `operator_id`, `plan_id`, `plan_type` (default in_process), `hold_id`.
- `non_conformances`: add `work_order_id`, `hold_id`, `capa_id`.
- `inspection_measurements`: add `gage_id`.

RLS: viewer read-all, inspector/qc_engineer/quality_manager write per role, administrator full. GRANTs to authenticated + service_role for every table.

## Phase C — Backend API (self-hosted)

Extend `api/src/routes/crud.ts` with endpoints for every new table (list/get/create/update/delete + role gates). Add:
- `POST /work-orders/:id/release`, `/complete`, `/hold`
- `POST /holds/:id/disposition`
- `POST /gages/:id/calibrate`
- `GET /spc/:specItemId?station=&from=&to=` — returns subgroups, X-bar/R/Cp/Cpk, WE rule violations
- `POST /inspections/from-wo` — auto-create inspection from WO operation + plan
- Zod schemas for all new payloads.

## Phase D — Frontend routes / features

New routes under `src/routes/`:
- `work-orders.index.tsx`, `work-orders.$id.tsx` — kanban + detail (linked inspections, holds).
- `stations.index.tsx`, `lines.index.tsx` — master data grids.
- `live.tsx` — WIP dashboard (ticker of active WOs, live inspection queue, hold alerts).
- `holds.index.tsx`, `holds.$id.tsx` — quality hold list + disposition wizard.
- `spc.tsx` — SPC control charts (recharts X-bar/R chart with UCL/LCL bands, Cp/Cpk display, WE rule flags), spec/product/station selector.
- `calibration.index.tsx` — gage registry with due/overdue badges.
- `calibration.$id.tsx` — gage detail with calibration history + MSA studies.
- `inspection-plans.index.tsx` — plan library (incoming / in-process / final tabs).
- `suppliers.index.tsx`, `incoming.index.tsx` — receiving inspection queue.
- `capa.$id.tsx` — 8D form (D1-D8 stepper) linked from NC detail.

Retheme existing pages (dashboard, inspections, ncs, corrective-actions, products, admin, reports, profile) to match the new shell — glass cards, gradient KPIs, cyan accents, mono numeric readouts.

## Phase E — Integration touches

- Inspection execution: when opened from a WO operation, pre-fills plan characteristics; a failing inspection auto-creates a Hold in `open` state on the WO + lot.
- NC detail: "Open CAPA" action creates a `capa_records` row and links; CAPA effectiveness verification unlocks NC closure.
- Measurements: gage selector on numeric measurements; if gage is `overdue`, blocks record.
- Dashboard: new KPI cards — Active WOs, Open Holds, Overdue Calibrations, Cp/Cpk trend.

## Phase F — Verify

- Typecheck (tsgo + tsc), lint.
- Smoke-check preview navigates through new sidebar sections without runtime errors.

## Technical notes

- Design tokens copied verbatim (oklch values, gradients, shadows). No new palette invention.
- Dark-only for now (matches MES source).
- All new tables: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` + trigger, `created_by uuid references auth.users`.
- SPC math done in a small server util (`api/src/spc.ts` + `src/lib/spc.ts` mirror) for consistency.
- Recharts already available for charts.
- No new packages except possibly `date-fns` (already installed check).

## Out of scope

- Realtime WebSocket push (polling with react-query is fine).
- Full ERP/PLM sync.
- Mobile-native shells (responsive web only).
- Migrating existing rows to link to newly created WOs (backfill left manual).
