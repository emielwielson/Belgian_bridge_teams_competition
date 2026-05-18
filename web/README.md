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

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), [http://localhost:3000/login](http://localhost:3000/login), and [http://localhost:3000/api/health](http://localhost:3000/api/health).

Apply migrations `0005`–`0007` before testing auth and RLS. See the [root README](../README.md).

## Auth routes

| Path | Purpose |
|------|---------|
| `/login` | Magic link sign-in |
| `/auth/callback` | OAuth callback (sets session cookies) |
| `/api/auth/me` | Current user + roles |
| `/api/auth/signout` | POST — sign out |

Public: `/standings`, `/api/public/*`, `/api/standings/*`. Protected: `/admin`, `/player`, `/captain`, `/club-manager`, `/arbiter`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm test` — Vitest unit tests

The health endpoint uses the **secret** Supabase client (bypasses RLS). User-facing APIs use the **session** client (publishable key + cookies).
