# Belgian Bridge Competition Platform

Mobile-first PWA for managing Belgian bridge team competitions (National, Flanders, Wallonia). See the [PRD](internal-docs/prd-belgian-bridge-competition-platform.md) and [implementation tasks](internal-docs/tasks-prd-belgian-bridge-competition-platform.md).

**Stack:** Hosted Supabase (Postgres, Auth, Storage) + Next.js (task 1.8+).

Development uses the **Supabase Dashboard** (no Docker or Supabase CLI required).

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Supabase](https://supabase.com/dashboard) account and project | Database, Auth, Storage, SQL Editor |
| Node.js 20+ (from task 1.8) | Next.js app under `web/` |

## One-time project setup (Dashboard)

1. Create a project in the [Supabase Dashboard](https://supabase.com/dashboard).

2. Configure **Authentication** → **URL configuration**:
   - Site URL: `http://localhost:3000` (add production URL when deployed)
   - Redirect URLs: `http://localhost:3000/auth/callback`
   - **Providers:** enable **Email** (Magic Link / OTP)
   - **Email Templates → Magic Link:** use `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` in the sign-in link (see `supabase/templates/magic_link.html`). The default `{{ .ConfirmationURL }}` PKCE flow fails when the link is opened outside the browser that requested it.

3. Copy keys from **Project Settings → [API Keys](https://supabase.com/dashboard/project/_/settings/api-keys)**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_...`) → `SUPABASE_SECRET_KEY`  
   Do not use legacy **anon** / **service_role** JWT keys.

4. Create `.env` (or `.env.local`) from the template:

   ```bash
   cp .env.example .env
   # Fill in values from the Dashboard
   ```

## Database migrations (SQL Editor)

Migration files live in [`supabase/migrations/`](supabase/migrations/). Apply them **in filename order** using the Dashboard:

1. `0001_core_schema.sql`
2. `0002_constraints_and_indexes.sql`
3. `0003_scoring_standings_audit.sql`
4. `0004_competition_lifecycle.sql`
5. `0005_user_roles.sql`
6. `0006_auth_helpers.sql`
7. `0007_policies_roles.sql`
8. `0008_task3_competition_admin.sql`
9. [`supabase/seed.sql`](supabase/seed.sql)
10. [`supabase/tests/task1_smoke_test.sql`](supabase/tests/task1_smoke_test.sql) — should return `task1_smoke_test passed`
11. [`supabase/tests/task2_auth_smoke_test.sql`](supabase/tests/task2_auth_smoke_test.sql) — should return `task2_auth_smoke_test passed`
12. [`supabase/tests/task3_schedule_smoke_test.sql`](supabase/tests/task3_schedule_smoke_test.sql) — should return `task3_schedule_smoke_test passed`

After your first Magic Link sign-in, grant yourself admin in the SQL Editor (replace with your `auth.users` id):

```sql
insert into public.user_roles (user_id, role)
values ('<your-auth-users-id>', 'system_admin');
```

For each step, open **SQL Editor** → **New query**, paste the file contents, and run.

Optional: use **Database** → **Migrations** in the Dashboard if you prefer its migration UI.

**Task 5 (operational workflows):** apply through `0026_arbiter_requests.sql` (includes `0021`–`0025` for postponement, home/away switch, operational file storage, warnings/rulings audit, arbiter requests). Then run [`supabase/tests/task5_operational_smoke_test.sql`](supabase/tests/task5_operational_smoke_test.sql). Assign the `arbiter` role in `user_roles` for users who should use `/arbiter`. Storage bucket: `operational-files` (private; uploads via `/api/files/upload`).

VP template rows in the seed use sample IMP bands — verify against your competition rules before production.

[`supabase/config.toml`](supabase/config.toml) is kept as reference for local/auth defaults only; you do not need the CLI to run the project.

## Environment variables

| Variable | Used by | Source (Dashboard) |
|----------|---------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser, Next.js | API Keys → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser, Next.js | API Keys → **Publishable key** |
| `SUPABASE_SECRET_KEY` | Server only (API routes, admin scripts) | API Keys → **Secret key** |
| `SUPABASE_PROJECT_REF` | Optional reference / docs | General → Reference ID |
| `DATABASE_URL` | Optional (external SQL tools) | Database → Connection string |
| `MAKE_WEBHOOK_URL` | Email notifications (task 5.6) | Make.com scenario webhook |

Never commit `.env` / `.env.local` or expose `SUPABASE_SECRET_KEY` in the browser. See [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Template: [`.env.example`](.env.example).

## Web app (task 1.8)

```bash
cp .env web/.env.local   # or symlink; Next.js reads env from web/
cd web && npm install && npm run dev
```

See [`web/README.md`](web/README.md). Health check: `http://localhost:3000/api/health`

## Demo data (optional)

After migrations and seed, you can load sample competition data:

| Competition | SQL Editor | Full load (teams + schedules) |
|-------------|------------|--------------------------------|
| National | [`supabase/demo-data/national-2024-25-demo.sql`](supabase/demo-data/national-2024-25-demo.sql) | `cd web && npm run demo:national` |
| Flanders | [`supabase/demo-data/flanders-2024-25-demo.sql`](supabase/demo-data/flanders-2024-25-demo.sql) | `cd web && npm run demo:flanders` |

Both need `SUPABASE_SECRET_KEY` in `web/.env.local`. The npm scripts generate schedules for all regional groups (RBBF template for 8 teams, generic round-robin otherwise).

**Regional bye VP (odd team counts):** resting teams receive 12 VP after each match day. Run automation against `POST /api/cron/award-bye-scores` with header `x-award-bye-secret` (set `AWARD_BYE_SCORES_SECRET` in `web/.env.local`), or the Supabase edge function `award-bye-scores`. See [internal-docs/regional-bye-automation.md](internal-docs/regional-bye-automation.md).

Apply migration [`0018_regional_round_robin_byes.sql`](supabase/migrations/0018_regional_round_robin_byes.sql) before loading regional demo data.

## Repository layout

```
supabase/
  migrations/      # SQL migrations — run in order via SQL Editor
  demo-data/       # Optional national / Flanders demo SQL
  seed.sql         # Seed data (task 1.6)
  config.toml      # Optional reference (not required without CLI)
internal-docs/     # PRD and task list
web/               # Next.js app (task 1.8)
```

## Documentation

- [Product requirements](internal-docs/prd-belgian-bridge-competition-platform.md)
- [Implementation tasks](internal-docs/tasks-prd-belgian-bridge-competition-platform.md)
