# Web app

Next.js frontend for the Belgian Bridge Competition Platform.

## Setup

1. Copy environment variables from the repo root:

   ```bash
   cp ../.env .env.local
   ```

   Or create `web/.env.local` with the same keys as [`.env.example`](../.env.example).

2. Configure Supabase **Authentication** (Dashboard):
   - Enable **Email** (Magic Link / OTP)
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
   - **Magic Link** email template (required for PKCE / cross-device login): use a link with `token_hash`, not only `{{ .ConfirmationURL }}`. Example:
     ```html
     <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a>
     ```
     Local Supabase already uses `supabase/templates/magic_link.html`. Copy the same template in the hosted project under **Authentication → Email Templates → Magic Link**.

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), [http://localhost:3000/login](http://localhost:3000/login), and [http://localhost:3000/api/health](http://localhost:3000/api/health).

Apply migrations through `0008` before competition admin. See the [root README](../README.md).

Deploy the `schedule-generate-rbbf` Edge Function from [`supabase/functions/schedule-generate-rbbf/`](../supabase/functions/schedule-generate-rbbf/) via the Supabase Dashboard (Edge Functions → deploy). Schedule generation requires it.

## Competition admin (task 3)

| Path | Purpose |
|------|---------|
| `/admin/competition` | Scope picker (national / regional) |
| `/admin/competition/national` | Leagues, groups, dates, teams, generate schedule |
| `/club-manager` | Assigned clubs and player memberships |

Assign club managers in SQL (both steps required):

```sql
-- 1. Role (middleware / dashboard access)
insert into public.user_roles (user_id, role)
values ('<auth.users.id>', 'club_manager')
on conflict (user_id, role) do nothing;

-- 2. Which club they manage
insert into public.club_manager_assignments (user_id, club_id)
values ('<auth.users.id>', '<clubs.id>')
on conflict (user_id, club_id) do nothing;
```

## Auth routes

| Path | Purpose |
|------|---------|
| `/login` | Magic link sign-in |
| `/auth/callback` | OAuth callback (sets session cookies) |
| `/api/auth/me` | Current user + roles |
| `/api/auth/signout` | POST — sign out |

Public: `/standings`, `/api/public/*`, `/api/standings/*`. Protected: `/admin`, `/player`, `/club-manager`, `/arbiter`. Postponement propose/approve: `/player/matches/[matchId]`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm test` — Vitest unit tests

The health endpoint uses the **secret** Supabase client (bypasses RLS). User-facing APIs use the **session** client (publishable key + cookies).
