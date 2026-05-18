# Web app

Next.js frontend for the Belgian Bridge Competition Platform.

## Setup

1. Copy environment variables from the repo root:

   ```bash
   cp ../.env .env.local
   ```

   Or create `web/.env.local` with the same keys as [`.env.example`](../.env.example).

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) and [http://localhost:3000/api/health](http://localhost:3000/api/health).

The health endpoint checks Supabase connectivity (requires migrations applied on your hosted project).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
