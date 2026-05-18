# Belgian Bridge Competition Platform

Mobile-first PWA for managing Belgian bridge team competitions (National, Flanders, Wallonia). See the [PRD](internal-docs/prd-belgian-bridge-competition-platform.md) and [implementation tasks](internal-docs/tasks-prd-belgian-bridge-competition-platform.md).

**Stack:** Supabase (Postgres, Auth, Storage) + Next.js (task 1.8+).

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Supabase CLI](https://supabase.com/docs/guides/cli) | Local stack, migrations, `db push` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Required for `supabase start` |
| Node.js 20+ (later) | Next.js app under `web/` (task 1.8) |

Install CLI (macOS):

```bash
brew install supabase/tap/supabase
```

## One-time cloud setup

1. Create an empty project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Log in to the CLI:

   ```bash
   supabase login
   ```

3. Link this repo (from the project root):

   ```bash
   supabase link --project-ref <PROJECT_REF>
   ```

   `PROJECT_REF` is in **Project Settings → General**.

4. In the Dashboard, configure **Authentication**:

   - **URL configuration**
     - Site URL: `http://localhost:3000`
     - Redirect URLs: `http://localhost:3000/auth/callback` (add production URLs when deployed)
   - **Providers:** enable **Email** (Magic Link / OTP)

5. Copy API keys from **Project Settings → [API Keys](https://supabase.com/dashboard/project/_/settings/api-keys)** into `.env.local`:
   - **Publishable key** (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_...`) → `SUPABASE_SECRET_KEY`  
   Do not use the legacy **anon** / **service_role** JWT keys.

After migrations exist (task 1.2+), apply them to the cloud project:

```bash
supabase db push
```

Ensure `major_version` in [`supabase/config.toml`](supabase/config.toml) matches your hosted Postgres version.

## Local development

1. Start Docker Desktop.
2. From the repo root:

   ```bash
   supabase start
   supabase status
   ```

3. Copy keys from `supabase status` into `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Print env-style output with this repo’s variable names:

   ```bash
   supabase status -o env \
     --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
     --override-name api.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
     --override-name api.secret_key=SUPABASE_SECRET_KEY
   ```

   If your CLI still shows legacy `ANON_KEY` / `SERVICE_ROLE_KEY`, map them to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in `.env.local`, or create publishable/secret keys in the Dashboard for hosted use.

4. Open Studio at the URL shown in `supabase status` (default `http://127.0.0.1:54323`).

5. Stop the stack when finished:

   ```bash
   supabase stop
   ```

## Environment variables

| Variable | Used by | Local source | Hosted source |
|----------|---------|--------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser, Next.js | `http://127.0.0.1:54321` from `supabase status` | Dashboard → API Keys → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser, Next.js | `supabase status` → publishable key (`sb_publishable_...`) | Dashboard → API Keys → **Publishable key** |
| `SUPABASE_SECRET_KEY` | Server only (API routes, admin scripts) | `supabase status` → secret key (`sb_secret_...`) | Dashboard → API Keys → **Secret key** |
| `SUPABASE_PROJECT_REF` | CLI (`link`, `db push`) | N/A | Dashboard → General → Reference ID |
| `DATABASE_URL` | Optional direct SQL / tools | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Dashboard → Database → connection string |
| `MAKE_WEBHOOK_URL` | Email notifications (task 5.6) | N/A | Make.com scenario webhook |

Never commit `.env.local` or expose `SUPABASE_SECRET_KEY` to the client. Legacy `anon` and `service_role` keys are deprecated; see [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Template: [`.env.example`](.env.example).

## Repository layout

```
supabase/
  config.toml      # Local stack config (auth redirects, DB version)
  migrations/      # SQL migrations (from task 1.2)
  seed.sql         # Seed data (from task 1.6)
internal-docs/     # PRD and task list
web/               # Next.js app (task 1.8)
```

## Documentation

- [Product requirements](internal-docs/prd-belgian-bridge-competition-platform.md)
- [Implementation tasks](internal-docs/tasks-prd-belgian-bridge-competition-platform.md)
