# QC self-hosted backend

QC originally uses Supabase project ebomxvtlllhgckuizbfc. MES originally used rhzqncnxnglazqzvzjvl: these are different backends. The original QC cloud project is paused; its users, records and files have not been migrated or modified.

This setup runs independent QC backends in development, staging and manuqube. All three stay active as requested. PostgreSQL, Auth, REST, Realtime, Storage, HTTPS and backups run continuously; Studio and Meta start for a timed administration lease. No MES database, key or persistent volume is reused.

Pinned components and initialization SQL are based on Supabase self-hosted/v0.8.3 (bc27d2661edd09a5d0b8d76ce33da6d4071a756e). prepare.py writes credentials and secret manifests only to ignored .local/supabase. Keep the existing credentials.json after initialization; regeneration is not a password-rotation procedure. Never commit generated files.

App runtime uses SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY and NODE_EXTRA_CA_CERTS from Kubernetes Secrets/mounts. Privileged keys never become VITE variables. The self-hosted VITE_SELF_HOSTED_SUPABASE flag makes browser API requests use the same HTTPS origin under /supabase. Lovable builds without that flag retain their cloud URL.

PRs require the Build check. dev-* tags release development, staging-* tags release staging and main releases production. Immutable image records are published on deploy-releases and read by namespace-scoped consumers. Build output is a compiled Node server, not the root development Dockerfile. The legacy Express api directory is not deployed by this workflow.

Apply source SQL files in order using migrate.sh. Checksums and dispositions are recorded in qc_deploy.migrations. The cloud-only role grant in 20260715165721 is skipped only if its specific old cloud user does not exist; no dummy identity is fabricated. The remaining SQL is applied normally. Private attachments and avatars buckets are provisioned.

Longhorn persists database, files and daily local recovery dumps/roles/files. Recovery copies are retained for seven days. Production PVCs are 16/4/16 GiB (database/files/backups), dev and staging 8/2/8 GiB. These sizes are capacity ceilings, not RAM reservations. One database instance per environment supports recovery with volume reattachment, not zero-downtime DB failover. Backups remain inside the office; no offsite backup or full disaster-recovery rehearsal is implied.

App-to-backend and ingress-to-app HTTPS verifies the namespace CA. Dev/staging browser endpoints use the existing publicly trusted public-apps-tls wildcard Secret. Production is public at qc.manuqube.com; dev and staging require VPN. Every Studio endpoint requires VPN and separate authentication. Keep internal service certificates distinct from browser edge certificates.

To enable Studio temporarily, use an authorized kubeconfig and run `python3 deploy/supabase/admin-tools.py development --minutes 30` (or staging / manuqube). Use --off to stop early or omit flags to check status. The tools stop on expiry; data services remain online without a database restart. A paused dashboard returns an authenticated 503 explanation.

Signup is disabled. Bootstrap confirmed administrator accounts through the protected owner procedure. SMTP has not been configured: invitation, verification and password-reset email delivery require a provider and delivery tests before use. Keep cloud untouched until any future migration has verified exports and acceptance tests.
