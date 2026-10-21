#!/bin/bash
set -euo pipefail
umask 077
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS qc_deploy;
REVOKE ALL ON SCHEMA qc_deploy FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS qc_deploy.migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE qc_deploy.migrations ADD COLUMN IF NOT EXISTS disposition text NOT NULL DEFAULT 'applied';
SQL
for file in /tmp/qc-migrations/*.sql; do
 name=$(basename "$file")
 digest=$(sha256sum "$file" | cut -d ' ' -f1)
 existing=$(psql -U supabase_admin -d postgres -Atc "SELECT checksum FROM qc_deploy.migrations WHERE version='$name'")
 if [ -n "$existing" ]; then
  test "$existing" = "$digest" || { echo "Checksum mismatch: $name"; exit 1; }
  continue
 fi
 if [ "$name" = "20260715165721_0b8ed039-3e31-4fc2-87ff-a7a35e9d06f7.sql" ]; then
  present=$(psql -U supabase_admin -d postgres -Atc "SELECT count(*) FROM auth.users WHERE id='a142dc9a-0fc3-458f-8366-e787268a9abc'")
  if [ "$present" = 0 ]; then
   psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -c "INSERT INTO qc_deploy.migrations(version,checksum,disposition) VALUES ('$name','$digest','skipped-old-cloud-user-grant')"
   echo "Skipped grant for absent old cloud user: $name"
   continue
  fi
 fi
 { printf 'BEGIN;\n'; cat "$file"; printf "\nINSERT INTO qc_deploy.migrations(version,checksum) VALUES ('%s','%s');\nCOMMIT;\n" "$name" "$digest"; } | psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q > /tmp/qc-migration.log 2>&1 || { echo "Failed: $name"; tail -10 /tmp/qc-migration.log; exit 1; }
 echo "Applied: $name"
done
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO storage.buckets(id,name,public) VALUES ('avatars','avatars',false),('attachments','attachments',false) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  CREATE PUBLICATION supabase_realtime;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
 END IF;
END $$;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
NOTIFY pgrst, 'reload schema';
SELECT count(*) AS verified_migrations FROM qc_deploy.migrations;
SQL
