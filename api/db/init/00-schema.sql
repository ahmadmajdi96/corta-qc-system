-- CORTA QC — Local Postgres init (docker-compose deployment)
-- Mirrors the managed cloud schema. Loaded by postgres image on first boot.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- See supabase/migrations/ in the project root for the full authoritative schema.
-- This file re-runs only on first container start; extend by adding numbered SQL files here.
