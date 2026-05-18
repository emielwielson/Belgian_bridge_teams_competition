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

3. Copy keys from **Project Settings → [API Keys](https://supabase.com/dashboard/project/_/settings/api-keys)**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_...`) → `SUPABASE_SECRET_KEY`  
   Do not use legacy **anon** / **service_role** JWT keys.

4. Create `.env.local` from the template:

   ```bash
   cp .env.example .env.local
   # Fill in values from the Dashboard
   ```

## Database migrations (SQL Editor)

Migration files live in [`supabase/migrations/`](supabase/migrations/). Apply them **in filename order** using the Dashboard:

1. Open **SQL Editor** → **New query**
2. Paste the contents of each migration file (e.g. `0001_core_schema.sql`, then `0002_...`)
3. Run the query and confirm success before running the next file

Optional: use **Database** → **Migrations** in the Dashboard if you prefer its migration UI.

Reference seed script: [`supabase/seed.sql`](supabase/seed.sql) (task 1.6).

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

Never commit `.env.local` or expose `SUPABASE_SECRET_KEY` in the browser. See [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Template: [`.env.example`](.env.example).

## Repository layout

```
supabase/
  migrations/      # SQL migrations — run in order via SQL Editor
  seed.sql         # Seed data (task 1.6)
  config.toml      # Optional reference (not required without CLI)
internal-docs/     # PRD and task list
web/               # Next.js app (task 1.8)
```

## Documentation

- [Product requirements](internal-docs/prd-belgian-bridge-competition-platform.md)
- [Implementation tasks](internal-docs/tasks-prd-belgian-bridge-competition-platform.md)
