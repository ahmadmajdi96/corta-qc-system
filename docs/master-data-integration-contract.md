# Master-data integration: cutover prerequisites

Status: **blocked on source contract and ownership**, not live. Existing QMS catalogue controls remain enabled. This document is an implementation handoff, not proof of connected portals.

## Source review

- MES Command Center: ERP inbound POST handles production/material entities; ERP outbound GET exports confirmations, receipts, consumptions and activities. Neither exports Products, Lines or Stations. Portal intake accepts signed quality events, not master-data exports.
- MES Command Central: signed inbound integration messaging exists, but no reviewed Product/Line/Station export contract is available.
- Both contain overlapping product/order structures; choose a single owner per entity before importing. Confirm whether Products originate in an OMS upstream of these portals.
- Snapshots provide code, not access to private live data. Implement source changes in the respective source project's chat. For initial reconciliation, export the source catalogues there and upload CSVs here; never use source snapshot credentials to query private records.

## Required source implementation

Provide an authenticated, tenant-scoped, versioned read API or signed change feed for Products, Lines and Stations. Endpoint URLs below are intentionally not invented; the source implementation must supply them.

Required record fields:

| Entity | Required identity and values | Optional values |
| --- | --- | --- |
| Product | source ID, code/SKU, name, active flag, source revision | description, category ID/name |
| Line | source ID, code, name, active flag, source revision | area |
| Station | source ID, code, name, parent line source ID, active flag, source revision | type, sequence |

Specify organization/tenant scope, category mapping, timestamps in UTC, revision ordering, retirement semantics, pagination cursors and end-of-page behavior. Initial exports must include inactive records and a consistency watermark. Change delivery must include event ID, source, entity, external ID, operation and monotonic revision, plus a documented signature/authentication scheme. Deletion must retire records locally, never cascade QMS quality data.

Required operational guarantees: replayable changes, documented page/batch limits, retry behavior, credentials provisioning/rotation, and a synchronization target agreed with the owner. Five minutes is the plan's proposal, not a configured guarantee.

## QMS implementation after source readiness

1. Map `(source, entity, external ID)` uniquely to existing QMS IDs; review ambiguous seeded code matches manually.
2. Import Products/categories and Lines before Stations; defer unresolved parent relationships.
3. Apply each event and its progress marker transactionally. Reject stale revisions; duplicate events have no second effect.
4. Persist queue, failure, retry and freshness state. Keep last valid data available during outages.
5. Authenticate senders before privileged writes, scope each sender to its configured source, and keep credentials server-side.
6. Prevent ordinary QMS writes only after import reconciliation and authenticated end-to-end workflow tests. Keep quality specifications and quality review editable.
7. Preserve existing record IDs, historical relationships and useful historical labels. Do not infer missing records are deleted from a partial export.
8. Resolve actual production data access before deployment. Current Docker starts the web app only; do not assume the legacy API folder is deployed. Supply additive upgrades for existing databases rather than init scripts alone.

## Current safeguard

`SimpleList` accepts opt-in `readOnly` and `emptyDescription`. Read-only mode hides creation entry points and rejects creation submissions; it is a UI safeguard, not a data authorization boundary. No catalogue enables it yet. Load failures are now distinct from empty catalogues and include retry.

## Release evidence still required

- Source owner and verified API/feed for each entity.
- Authorized access and initial exports for seeded-data reconciliation.
- Server-side ownership enforcement and tests for duplicate/stale events, retirement and parent relations.
- Signed-in inspection save/readback, work-order release and request quality-review validation with synced records.
- Self-hosted connection/retry verification and refreshed public documentation/screenshots after actual cutover.