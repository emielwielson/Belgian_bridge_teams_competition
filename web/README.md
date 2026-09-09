# Web app

Next.js frontend for the Belgian Bridge Competition Platform.

## Setup

1. Copy environment variables from the repo root:

   ```bash
   cp ../.env .env.local
   ```

   Or create `web/.env.local` with the same keys as [`.env.example`](../.env.example).

2. Configure Supabase **Authentication** (Dashboard):
   - Enable **Email** (Magic Link / OTP); email OTP length **8**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/confirm` (add production `/auth/confirm`; optional legacy `/auth/callback`)
   - **Magic Link** email template (Safe Links / shared Auth with Ledenbeheer): do **not** use `{{ .ConfirmationURL }}`. Example:
     ```html
     <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in</a>
     ```
     Also include `{{ .Token }}` (8-digit OTP). See `supabase/templates/magic_link.html`. Hosted Auth → Email Templates must match. The template is trilingual (en/nl/fr) via `{{ .Data.locale }}`; locale comes from the login UI when the user requests a magic link.

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), [http://localhost:3000/login](http://localhost:3000/login), and [http://localhost:3000/api/health](http://localhost:3000/api/health).

Apply migrations through `0008` before competition admin. See the [root README](../README.md). Competition managers can optionally be limited to kinds (`national` / `flanders` / `wallonia`) via `competition_manager_scopes` (migrations `0061`–`0062`).

Deploy the `schedule-generate-rbbf` Edge Function from [`supabase/functions/schedule-generate-rbbf/`](../supabase/functions/schedule-generate-rbbf/) via the Supabase Dashboard (Edge Functions → deploy). Schedule generation requires it.

## Competition admin (task 3)

| Path | Purpose |
|------|---------|
| `/admin/competition` | Scope picker (national / regional) |
| `/admin/competition/national` | Leagues, groups, dates, teams, generate schedule |

Competition managers create teams, assign captains, and manage club setup. Player club memberships are loaded via SQL/seeds.

## Auth routes

| Path | Purpose |
|------|---------|
| `/login` | Magic link sign-in (+ 8-digit OTP fallback) |
| `/auth/confirm` | Magic link interstitial; verify only on button click |
| `/auth/callback` | Legacy PKCE / older links (sets session cookies) |
| `/api/auth/confirm` | POST — `verifyOtp` with `token_hash` |
| `/api/auth/verify-otp` | POST — `verifyOtp` with email + 8-digit token |
| `/api/auth/me` | Current user + roles |
| `/api/auth/signout` | POST — sign out |

Public: `/standings`, `/api/public/*`, `/api/standings/*`. Protected: `/admin`, `/player`, `/arbiter`. Postponement propose/approve: `/player/matches/[matchId]`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm test` — Vitest unit tests

The health endpoint uses the **secret** Supabase client (bypasses RLS). User-facing APIs use the **session** client (publishable key + cookies).
