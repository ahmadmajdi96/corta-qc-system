# QMS master-data simplification and portal integration

## Goal
Apply the attached **QMS UX Impact Analysis**: eliminate duplicate Product, Production Line, and Station management in QMS while preserving all quality workflows and historical records. Connect to the separate portals identified by you: **MES Command Center** and **MES Command Central**.

**Release gate:** Do not remove management controls until the relevant integration is working and dependent workflows have passed testing. Approval of this plan does not assume source access is already available.

## Findings from the current applications
- QMS has Product creation/editing and activation controls. Lines and Stations currently have creation controls; not every page implements all three Add/Edit/Delete operations.
- Product quality specifications and inspection history are QMS-owned functions and must remain available.
- QMS currently reads its own records; no established external master-data synchronization was found. The prior MES seed copy is a snapshot, not integration.
- Stations already have a production-line relationship, but the Station creation page does not collect it.
- MES Command Center contains line/station/product structures and an API/portal-event foundation worth reusing after contract verification. MES Command Central has overlapping product and production-order structures. Neither reviewed snapshot establishes the OMS product authority described in the PDF.
- The current Docker setup runs the web app only. A separate API folder exists, but must not be assumed to power the deployed screens.

## 1. Establish ownership and the integration contract
- Treat Lines and Stations as externally managed, consistent with your separate-portal decision. Inventory quality-specific station types before retiring controls so necessary quality setup is not accidentally removed.
- Assign exactly one authoritative source per entity across the named portals; confirm whether Products originate in an OMS upstream of them or in one of these portals. Do not synchronize conflicting catalogues in both directions.
- Define source identifiers, product code/name/category/status, line code/name/status, and station code/name/type/sequence/line/status mappings.
- Agree on authentication, initial export, incremental updates, deactivation events, and a measurable synchronization target. Proposed starting target: changes available within five minutes, subject to source support.
- Identify the responsible portal/team and its verified URL for each catalogue.

**Dependency:** Source-side endpoints, event delivery, exports, or permissions may require work in those projects. This chat can inspect their code but cannot modify those projects or read their private live records. If initial records require CSV export, export them from the source project's chat and upload them here.

## 2. Build reliable one-way data availability first
- Maintain a local QMS read model so inspections do not depend on a live source call for every selection.
- Map source-system + entity + external ID to existing QMS IDs. Reconcile the current seeded records before import; flag ambiguous code matches for review rather than creating duplicates or changing referenced IDs.
- Import Products, then Lines, then Stations, preserving station-to-line relationships. Resolve category mappings as part of the product contract.
- Implement initial backfill and incremental synchronization through verified source contracts, with idempotent writes, stale-event protection, bounded retries, durable failure records, and administrator retry/reconciliation.
- Track last successful synchronization, freshness, source ownership, and unresolved records. Keep the last valid data available during outages; never replace it with an empty catalogue.
- Validate the complete catalogue against the source before cutover, including paginated imports and updates during backfill.

## 3. Simplify QMS catalogue pages and enforce ownership
- Keep Products, Lines, and Stations as searchable, filterable, paginated, exportable read-only catalogues; preserve existing page sizes.
- Remove Add/Edit/Delete and activation controls wherever present for externally owned fields, including alternative detail pages and indirect write paths.
- Show a compact source label and synchronization status; offer a verified source-portal link where access is available.
- Retain Product quality specifications, acceptance criteria, inspection-plan configuration, quality records, and quality-specific routing relationships unless a reviewed contract explicitly makes those relationships external.
- Enforce the read-only boundary on data writes, not just buttons. Ordinary QMS users, including QMS administrators, cannot mutate externally managed fields; only the authorized integration path can update them.
- Review New Product requests: preserve quality review/approval, but prevent request completion from creating external master data locally. Reference the source product or hand off creation to the owner; do not add an unverified outbound API.

## 4. Preserve dependent quality workflows
Audit and update all entity selectors and save paths in:
- New Inspection, inspection scheduling/execution, and inspection-plan configuration.
- Work Order product/line selection, release-generated inspections, and station operations.
- NCRs, quality holds, incoming lots, complaints/SCARs where applicable, SPC, product routings, requests, reports, and global search.

Active synced records remain selectable without manual re-entry. Filter stations by their correct line where relevant. Previously linked inactive records remain readable on existing records, but are excluded from new selections. Missing or stale data gets an explicit state and recovery action; distinguish no matching search results from a failed integration. Validate activation and relationships again on save.

## 5. Protect history and deployment portability
- Convert source deletions into local retirement/deactivation rather than hard deletion. Preserve QMS IDs and historical product/line/station references.
- Review current mixed cascade/restrict/set-null relationships and prevent synchronization from deleting quality specifications, plans, inspections, NCRs, or traceability links.
- Retain descriptive snapshots where needed for historical interpretation when source names change.
- Make source addresses and private integration credentials deployment configuration, never browser-visible secrets. Verify connectivity, retry scheduling, and synchronization health on your server as well as the preview.
- Roll out entity by entity after reconciliation. During failure, retain read-only cached catalogues and repair synchronization; do not restore competing QMS edits as an outage workaround.

## 6. Validate before release and update documentation
Add focused automated tests for ownership, idempotency, ordering, activation, relationship validation, and historical retention, plus authenticated end-to-end workflow checks.

### Acceptance checks
1. Creating/updating a source Product makes it available in QMS within the agreed target without duplicate records; replaying its event changes no record count.
2. Source Line/Station updates preserve associations; mismatched or missing parents are held for recovery, not silently accepted.
3. No ordinary QMS UI or direct write path can create/edit/delete external master data; QMS quality specifications remain editable by authorized roles.
4. A synced Product/Line/Station can be selected, saved, and read back in an inspection; work-order release and plan execution still work with real linked data.
5. Retired entities are unavailable for new selection while old inspections, NCRs, reports, and traceability remain readable.
6. Integration delays and outages display accurate status, preserve cached data, and recover through retry/reconciliation without duplicates.
7. Existing seed records reconcile without losing their linked quality records; catalogue pagination, search, filters, and exports remain functional.
8. Requests no longer create duplicate local Products; quality-review steps remain functional.
9. Verify the same flow on self-hosted deployment, including integration connectivity and scheduled retries.
10. Refresh public `/docs` workflows and screenshots while preserving its existing MES-style design, chapter/full-guide views, bundled fonts, and server-served images.

## Technical implementation scope
- Frontend surfaces: `src/pages/products-list.tsx`, `src/pages/product-detail.tsx`, Lines/Stations routes, `src/components/mes/simple-list.tsx`, and affected inspection/work-order/plan/request/report/search consumers. Add opt-in read-only behaviour to shared tables without disabling unrelated QMS CRUD.
- Data changes: additive source mappings and durable synchronization state; reconcile existing records before enabling externally owned write restrictions. Apply migrations with explicit grants, RLS, and integration-only privileged writes.
- Use TanStack server functions for internal administrative actions and verified external server routes for inbound integration. Validate sender identity/signatures before privileged writes; keep credentials server-side.
- Determine the actual production data path before changing the legacy Express API. Update it only if it is deployed or offers a write path that must be closed; provide explicit self-hosted migration/configuration instructions rather than relying on init scripts for existing databases.
- Record final ownership and integration architecture once the contracts are verified; do not reuse source-project database credentials in QMS.

## Not included
No redesign of unrelated pages, no removal of catalogue data or QMS quality configuration, no bidirectional master-data editing, and no claim that source APIs or live data access are available until verified.
