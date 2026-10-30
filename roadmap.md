# QMS master-data simplification

- [x] Review UX report and source-portal code; prepare modification plan for approval.
- [x] Verify source contracts; document missing master-data export/feed and ownership prerequisites.
- [x] Add opt-in read-only catalogue safeguards and distinct load-failure recovery; retain current controls.
- [ ] Establish secure integration, reconcile existing records, and validate data availability. Blocked: neither source exposes a verified Products/Lines/Stations export/feed; per-entity source ownership and authorized initial data access remain unresolved.
- [ ] Make externally owned master data read-only without affecting QMS-owned quality work.
- [ ] Validate dependent workflows, historical references, and self-hosted deployment; refresh public documentation.

Plan approved. Cutover awaits source-side contract implementation and ownership/access confirmation; do not disable QMS management before integration validation.