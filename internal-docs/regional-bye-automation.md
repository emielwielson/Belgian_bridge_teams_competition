# Regional bye VP automation

For Flanders and Wallonia groups with an **odd** number of teams, each round has one resting team. That team receives **12 VP** after the competition match date for that round has passed.

## Endpoints

**Next.js (recommended for Make.com):**

```
POST https://<your-app>/api/cron/award-bye-scores
Header: x-award-bye-secret: <AWARD_BYE_SCORES_SECRET>
Body (optional): { "seasonId": "<uuid>" }
```

**Supabase Edge Function:**

```
POST https://<project-ref>.supabase.co/functions/v1/award-bye-scores
Header: x-award-bye-secret: <AWARD_BYE_SCORES_SECRET>
   or Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Body (optional): { "seasonId": "<uuid>" }
```

## Response

```json
{ "awarded": 3, "pending": 12 }
```

- `awarded`: bye rows granted VP this run (idempotent).
- `pending`: bye rows still waiting for a future match date.

## When to run

After each regional match day (e.g. Saturday 14:00 Brussels), once the round’s `competition_match_dates.datetime` is in the past.

## Setup

1. Apply migration `0018_regional_round_robin_byes.sql`.
2. Set `AWARD_BYE_SCORES_SECRET` in `web/.env.local` (and Edge Function secrets if used).
3. Configure your automation to call the endpoint on a schedule.
