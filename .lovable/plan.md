The audit above is the deliverable for this turn — no file changes are proposed.

To move forward, pick one:

1. **Close the functional UI gaps** (feature-level, stays on Lovable Cloud): NC drag-and-drop board, NC delete for admins, Mark N/A + camera-capture placeholder, admin invite/create user, add-role + `list`/`assign` permission actions, PDF export + export-job list, avatar upload, global confirmation modal, real charts on Reports, "Close NC only when all CAs verified", overdue-column, complete-inspection required-measurement guard, search on Users, pagination on Users.

2. **Close the schema/infrastructure gaps to satisfy the literal AC wording** (larger): make the `api/` Express service actually build and run against the docker-compose Postgres, port the full 15-table schema into `api/db/init/`, implement JWT+refresh auth, REST endpoints with `{data, meta}` envelopes, keyset pagination, structured JSON logging, `{error:{code,message,details}}` shape. This effectively builds a second backend alongside the running Lovable Cloud one.

3. **Both** — first (1) on the running app, then (2) as the self-hosted parity layer.

Tell me which track (1, 2, or 3) and I'll produce a concrete implementation plan for it.