
# CORTA QC — Build Plan & One Architecture Decision Needed

I've read the full spec (1109 lines, 107 ACs, 20 screens, 15 tables, 5 roles). Before I start building, I need one decision from you because the spec's stack conflicts with this project's stack. Everything else I will build straight through without stopping.

## The conflict

The documentation describes a **Node/Express + PostgreSQL** system deployed via **`docker compose up`** (AC-1..AC-4 explicitly require `./api` Dockerfile, `docker-compose.yml` with `api` + `db` services, `.env.example` with `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, etc.).

This Lovable project is a **TanStack Start** app that runs on **Cloudflare Workers** with **Lovable Cloud (managed Supabase Postgres)** for auth/DB. It does not deploy via Docker Compose, does not have a `./api` Express service, and uses Supabase Auth (not hand-rolled JWT + refresh tokens).

The two stacks are mutually exclusive for a real deployment. I see three options:

### Option A — Build on Lovable's stack (recommended)
- Full app on **TanStack Start + Lovable Cloud (Supabase Postgres)**.
- All 15 tables, RLS-enforced roles, all 20 screens, all CRUD, real auth, real data.
- Runs immediately in the Lovable preview and when published — no Docker needed.
- I still ship a `docker-compose.yml` + `Dockerfile` + `.env.example` + README section at the repo root as a **secondary local-dev artifact** (Postgres + a thin Node/Express shim that mirrors the REST matrix against the same schema) so AC-1..AC-4 have a concrete answer. But the **primary** running system is the TanStack app on Lovable Cloud.
- Trade-off: AC-22 wording ("stores `accessToken`/`refreshToken` in client storage") is satisfied in spirit by Supabase Auth's session, not literally by a hand-rolled JWT pair.

### Option B — Build the Express API + Postgres exactly as the doc says
- I scaffold `./api` (Node/Express/TS, Zod, JWT + refresh tokens, pg pool) and a React SPA client, plus `docker-compose.yml`.
- Matches AC-1..AC-4 and the auth ACs literally.
- **Won't run in the Lovable preview at all** — you'd only see it by cloning and running `docker compose up` locally. The preview URL would be blank/broken.
- The Lovable Cloud tools (managed DB, RLS scanner, publish) don't apply.

### Option C — Do both fully
- Not realistic in a single turn. The Express+SPA build alone is a multi-day project.

## What I recommend

**Option A.** You get a working, previewable, publishable app with the full schema, all screens, real multi-user auth, and role enforcement — plus the Docker artifacts as a documented alternate path. It's the only option that produces a running system you can click through today.

## Reply with one word

- **"A"** → I start building on TanStack + Lovable Cloud immediately, ship Docker artifacts alongside, and work through all 20 screens / 107 ACs across as many turns as it takes without asking more questions.
- **"B"** → I scaffold the Express API + SPA + docker-compose instead. Preview will not work; you'll run it locally.
- **"C"** or anything else → tell me which parts to prioritize.

No code changes yet — waiting on your call.
