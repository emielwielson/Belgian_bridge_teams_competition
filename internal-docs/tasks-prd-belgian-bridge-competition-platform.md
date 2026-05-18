# Tasks: Belgian Bridge Competition Platform (Core League Flow MVP)

Based on: `internal-docs/prd-belgian-bridge-competition-platform.md`

## Relevant Files

- `supabase/config.toml` - Supabase project configuration for local development and deployments.
- `supabase/migrations/0001_core_schema.sql` - Core tables: seasons, regions, leagues, divisions, groups, clubs, players, teams, matches.
- `supabase/migrations/0002_constraints_and_indexes.sql` - Uniqueness, foreign keys, and performance indexes.
- `supabase/migrations/0003_scoring_standings_audit.sql` - VP tables, standings views/functions, penalties, warnings, rulings, match logs.
- `supabase/migrations/0004_policies_roles.sql` - Row Level Security policies per role.
- `supabase/migrations/0005_auth_helpers.sql` - Role assignment helpers and authorization SQL functions.
- `supabase/migrations/0006_competition_management.sql` - Competition state, roster locks, schedule constraints, regional rules.
- `supabase/migrations/0007_match_ops_constraints.sql` - Score state, match player rules, postponement/switch constraints.
- `supabase/migrations/0008_operational_workflows.sql` - Arbiter requests, postponement records, notification triggers/hooks.
- `supabase/tests/task1_smoke_test.sql` - Smoke tests for schema and core constraints.
- `supabase/tests/task2_auth_smoke_test.sql` - Smoke tests for auth helpers and RLS.
- `supabase/tests/task3_schedule_smoke_test.sql` - Smoke tests for schedule generation and competition locks.
- `supabase/tests/task4_match_ops_smoke_test.sql` - Smoke tests for scoring, VP, and standings.
- `supabase/tests/task5_operational_smoke_test.sql` - Smoke tests for postponement, arbiter, and discipline workflows.
- `supabase/functions/schedule-generate-rbbf/index.ts` - Edge function for 8-team double round-robin fixture generation.
- `supabase/functions/match-operations/index.ts` - Edge function for score submission and authorized edits.
- `supabase/functions/operational-workflows/index.ts` - Edge function for postponement, home/away switch, arbiter requests.
- `supabase/functions/file-upload-guard/index.ts` - Edge function validating file type and size on upload.
- `supabase/functions/make-webhook-email/index.ts` - Webhook handler for Make.com email delivery.
- `web/package.json` - Next.js app dependencies and scripts.
- `web/next.config.ts` - Next.js configuration.
- `web/app/layout.tsx` - Root layout, metadata, PWA hooks.
- `web/app/manifest.webmanifest` - PWA install manifest.
- `web/public/sw.js` - Service worker for installable PWA.
- `web/middleware.ts` - Locale routing and authenticated route protection.
- `web/middleware.test.ts` - Tests for middleware auth redirects.
- `web/lib/supabase/env.ts` - Validated Supabase environment variables (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`).
- `web/lib/supabase/browser-client.ts` - Browser Supabase client.
- `web/lib/supabase/server-client.ts` - Server Supabase client for RSC and route handlers.
- `web/lib/auth/roles.ts` - Role constants and helpers.
- `web/lib/auth/session.ts` - Session read helpers.
- `web/lib/auth/route-auth.ts` - API route authorization wrapper.
- `web/lib/auth/user-access.ts` - User-to-team/club access resolution.
- `web/lib/time/brussels.ts` - UTC storage / Europe-Brussels display utilities.
- `web/lib/scheduling/rbbf-8-team-template.ts` - RBBF 14-round pairing template (PRD appendix).
- `web/lib/scheduling/rbbf-8-team-template.test.ts` - Unit tests for schedule template.
- `web/lib/competition/season.ts` - Active season resolution (single-season MVP).
- `web/lib/competition/scopes.ts` - National vs regional scope helpers.
- `web/lib/http/api-response.ts` - Consistent JSON response helpers.
- `web/lib/http/error-status.ts` - HTTP status mapping for domain errors.
- `web/lib/http/edge-function.ts` - Invoke Supabase edge functions from API routes.
- `web/app/auth/callback/route.ts` - Magic link OAuth callback handler.
- `web/app/auth/callback/route.test.ts` - Tests for auth callback.
- `web/app/[locale]/login/page.tsx` - Magic link login page.
- `web/app/[locale]/login/page.test.tsx` - Login page tests.
- `web/components/auth/LoginForm.tsx` - Login form component.
- `web/components/auth/AuthNavControls.tsx` - Sign in/out navigation controls.
- `web/app/api/auth/me/route.ts` - Current user session endpoint.
- `web/app/api/auth/signout/route.ts` - Sign-out endpoint.
- `web/app/api/public/active-season/route.ts` - Public active season metadata.
- `web/app/api/public/groups/route.ts` - Public group listing for standings navigation.
- `web/app/api/standings/[groupId]/route.ts` - Group standings API.
- `web/app/api/standings/regions/route.ts` - Regional standings aggregation API.
- `web/app/api/admin/competition/route.ts` - Competition structure CRUD.
- `web/app/api/admin/competition/teams/route.ts` - Team assignment within groups.
- `web/app/api/admin/competition/dates/route.ts` - Match date configuration per scope.
- `web/app/api/admin/competition/groups/[groupId]/generate/route.ts` - Trigger schedule generation for a group.
- `web/app/api/admin/users/route.ts` - User listing for role management.
- `web/app/api/admin/users/[userId]/roles/route.ts` - Assign roles to users.
- `web/app/api/matches/[matchId]/route.ts` - Match detail endpoint.
- `web/app/api/matches/[matchId]/score/route.ts` - Score submission and admin edit.
- `web/app/api/matches/[matchId]/players/route.ts` - Match lineup registration.
- `web/app/api/matches/[matchId]/postpone/route.ts` - Postponement workflow API.
- `web/app/api/matches/scorable/route.ts` - List matches the current user may score.
- `web/app/api/files/upload/route.ts` - File upload with validation.
- `web/app/api/v1/leagues/route.ts` - Versioned leagues API.
- `web/app/api/v1/standings/[groupId]/route.ts` - Versioned standings API.
- `web/app/api/v1/matches/[matchId]/score/route.ts` - Versioned scoring API.
- `web/app/[locale]/standings/page.tsx` - Public standings landing page.
- `web/app/[locale]/standings/[groupId]/page.tsx` - Group standings page.
- `web/components/standings/StandingsTable.tsx` - Standings table component.
- `web/components/standings/StandingsTable.test.tsx` - Standings table tests.
- `web/app/[locale]/player/page.tsx` - Player dashboard and scoring entry point.
- `web/app/[locale]/captain/page.tsx` - Captain workflows (postpone, switch).
- `web/app/[locale]/club-manager/page.tsx` - Club and roster management.
- `web/app/[locale]/arbiter/page.tsx` - Arbiter request and ruling workflows.
- `web/app/[locale]/admin/page.tsx` - Admin hub.
- `web/app/[locale]/admin/competition/page.tsx` - Competition management entry.
- `web/components/admin/CompetitionScopePage.tsx` - Scoped competition admin UI.
- `web/components/player/RegularSeasonScoring.tsx` - Mobile-first score entry UI.
- `web/components/captain/PostponeWorkflow.tsx` - Postponement propose/approve UI.
- `web/components/pwa/RegisterServiceWorker.tsx` - Client-side service worker registration.
- `web/vitest.config.ts` - Vitest configuration.
- `web/vitest.setup.ts` - Vitest setup file.

### Notes

- Unit tests should typically live alongside the code they test (e.g. `StandingsTable.tsx` and `StandingsTable.test.tsx`).
- Run web tests with `cd web && npm test` (Vitest).
- Run SQL smoke tests against a local or linked Supabase instance per project README once added.
- Enforce PRD rules in the database and server layer; UI validations are supplementary only.
- MVP assumes one active season; no season-picker UX.

## Tasks

- [ ] 1.0 Platform foundation and core data model
  - [x] 1.1 Initialize Supabase in the repo (`supabase init`, `config.toml`) and document required env vars for local and hosted projects.
  - [ ] 1.2 Create migration `0001_core_schema.sql`: `seasons` (with single active season support), `regions` (`flanders`, `wallonia`), `leagues`, `divisions`, `groups` (including nullable `max_matches_per_day_per_team`), `clubs`, `players`, `player_club_memberships`, `teams`, `team_players`, `matches`, `match_players`.
  - [ ] 1.3 Create migration `0002_constraints_and_indexes.sql`: league hierarchy FKs, one club per player per active season, one team per player per season, one match per team per round per group, no home=away, unique fixtures per round/group.
  - [ ] 1.4 Create migration `0003_scoring_standings_audit.sql`: `vp_tables`, `vp_table_rows`, standings computation (view or function), `penalties`, `warnings`, `rulings`, `match_logs`, score fields on `matches`.
  - [ ] 1.5 Add competition lifecycle fields (e.g. season/group `status` or `competition_started_at`) to support setup vs active lock behavior (FR 13, 17–18, 24).
  - [ ] 1.6 Seed reference data: regions, division levels (Honor–3rd), VP table templates per board count, and a single active season row.
  - [ ] 1.7 Write `supabase/tests/task1_smoke_test.sql` verifying schema creation, FK integrity, and core uniqueness constraints.
  - [ ] 1.8 Scaffold Next.js app under `web/` (App Router, TypeScript, Tailwind) with base layout and health check route.

- [ ] 2.0 Authentication, roles, and authorization
  - [ ] 2.1 Enable Supabase Magic Link auth and configure redirect URLs for local and production.
  - [ ] 2.2 Create `user_roles` (or equivalent) table supporting multi-role assignment per user: Player, Captain, Club Manager, Arbiter, Competition Manager, System Admin (FR 60–61).
  - [ ] 2.3 Implement SQL helpers to resolve current user roles and permissions (migration `0005_auth_helpers.sql`).
  - [ ] 2.4 Add RLS policies in `0004_policies_roles.sql` for all core tables: public read for standings-related data; write access scoped by role and team/club membership (FR 62–63).
  - [ ] 2.5 Build login flow: `LoginForm.tsx`, `[locale]/login/page.tsx`, `auth/callback/route.ts`, `api/auth/me`, `api/auth/signout`.
  - [ ] 2.6 Implement `middleware.ts` to protect admin and role-specific routes; allow unauthenticated access only to public standings routes (FR 63).
  - [ ] 2.7 Add `lib/auth/route-auth.ts` and use it in all mutating API routes to enforce server-side authorization (FR 70).
  - [ ] 2.8 Write `supabase/tests/task2_auth_smoke_test.sql` and `web/middleware.test.ts` for auth and access control.

- [ ] 3.0 Competition administration (structure, clubs, players, teams, scheduling)
  - [ ] 3.1 Build admin API `api/admin/competition/route.ts` for CRUD on leagues, divisions, and groups within the active season (FR 1–4, 6–8).
  - [ ] 3.2 Implement club and player management APIs and Club Manager UI: create/edit clubs, players, memberships; enforce one-club-per-season (FR 9–13).
  - [ ] 3.3 Implement team and roster APIs: assign teams to groups/clubs, set captain and location, manage `team_players`; block duplicate player-team assignment per season (FR 14–16).
  - [ ] 3.4 Enforce regional league rules: team club region must match league region (FR 19); add DB constraint or trigger.
  - [ ] 3.5 Implement competition start/lock: block membership changes, roster edits, and match deletion once active (FR 13, 17–18, 24).
  - [ ] 3.6 Implement `lib/scheduling/rbbf-8-team-template.ts` from PRD appendix §10 (14 rounds, mirrored home/away) with unit tests.
  - [ ] 3.7 Build schedule generation edge function and `api/admin/competition/groups/[groupId]/generate/route.ts`; assign round pairings and datetimes from admin-provided dates; respect `max_matches_per_day_per_team` (FR 20–26, 51).
  - [ ] 3.8 Build admin UI (`CompetitionScopePage.tsx`, competition scope pages) for national/regional setup, team assignment, match dates, and generate-schedule action.
  - [ ] 3.9 Add `api/admin/competition/dates/route.ts` for scope-level match date configuration.
  - [ ] 3.10 Write `supabase/tests/task3_schedule_smoke_test.sql` for generation output, round uniqueness, and lock behavior.

- [ ] 4.0 Match operations (lineups, scoring, VP tables, standings, corrections)
  - [ ] 4.1 Implement `api/matches/[matchId]/players/route.ts` and UI for match lineups: min 4 players per team, unlimited substitutes, non-roster subs allowed (FR 27–31).
  - [ ] 4.2 Implement VP lookup: given `board_count` and IMPs, compute `vp_home`/`vp_away` from group-scoped VP table (FR 38–39).
  - [ ] 4.3 Build score submission in `api/matches/[matchId]/score/route.ts` (or edge function): authorize Players (match teams), Club Managers, Competition Managers, System Admins; first submission is immediately official, no approval (FR 32–36).
  - [ ] 4.4 Restrict post-submission edits to Competition Manager and System Admin only; overwrite previous official score; log submission and admin edits (FR 35–37, 57–58).
  - [ ] 4.5 Mark match as played on first official score; expose match state in API and UI (FR 36).
  - [ ] 4.6 Implement standings query: derive from scored matches, apply penalties/corrections, sort by `vp_total` desc then `team_name` asc; auto-refresh on score/correction changes (FR 40–43).
  - [ ] 4.7 Build public standings pages (`standings/page.tsx`, `standings/[groupId]/page.tsx`, `StandingsTable.tsx`) and APIs (`api/standings/`, `api/public/groups`) (FR 63, 7).
  - [ ] 4.8 Build Player scoring UI (`RegularSeasonScoring.tsx`, `api/matches/scorable`) optimized for mobile (FR 65).
  - [ ] 4.9 Implement admin standings corrections and penalty CRUD (FR 41, 44–45) with audit logging.
  - [ ] 4.10 Implement `lib/time/brussels.ts` and use consistently in match UI (FR 26).
  - [ ] 4.11 Write `supabase/tests/task4_match_ops_smoke_test.sql` and component tests for scoring and standings.

- [ ] 5.0 Operational workflows (postponement, switches, arbiter, discipline, files, notifications, audit)
  - [ ] 5.1 Implement postponement workflow API and `PostponeWorkflow.tsx`: home captain proposes, away captain approves, notify Competition Manager (FR 50).
  - [ ] 5.2 Implement home/away switch API: only before match is played; only for double round-robin groups using RBBF template rounds 8–14 mirror rules (FR 51).
  - [ ] 5.3 Implement arbiter request API and Arbiter UI: board reference, image attachment, notify arbiters/admins/captains (FR 52–53).
  - [ ] 5.4 Implement warnings and rulings (PDF attachment) CRUD with role checks (FR 45–46).
  - [ ] 5.5 Implement file upload (`api/files/upload`, storage bucket, `file-upload-guard` edge function): PDF and images only, max 10 MB, indefinite retention (FR 47–49).
  - [ ] 5.6 Integrate Make.com email webhooks (`make-webhook-email` function) for postponements, arbiter requests, and key admin events; add retry handling (FR 54–56).
  - [ ] 5.7 Build admin match log viewer API queryable by Competition Manager and System Admin (FR 57–59).
  - [ ] 5.8 Write `supabase/tests/task5_operational_smoke_test.sql` covering postpone, switch, arbiter, and file validation paths.

- [ ] 6.0 Versioned API, PWA shell, and role-based user experience
  - [ ] 6.1 Expose core domain operations under `/api/v1/*` (leagues, standings, matches/score, schedule generate, files, arbiter requests) mirroring internal routes (FR 68–69).
  - [ ] 6.2 Document API contracts (OpenAPI spec or equivalent) and treat `/v1` as stable contract for future mobile clients.
  - [ ] 6.3 Configure PWA: `manifest.webmanifest`, `public/sw.js`, `RegisterServiceWorker.tsx`; verify installability on mobile (FR 64).
  - [ ] 6.4 Implement mobile-first responsive layout, Glide-like clean UI, English-only copy (FR 65–66).
  - [ ] 6.5 Build role-based navigation and dashboards: Public, Player, Captain, Club Manager, Arbiter, Competition Manager, System Admin (FR 67).
  - [ ] 6.6 Build remaining role pages: `club-manager`, `captain`, `arbiter`, `admin/users` (role assignment UI), `admin/competition` scopes.
  - [ ] 6.7 Add `api/admin/users` and role assignment UI for System Admin (FR 61).
  - [ ] 6.8 Run end-to-end UAT against PRD §8 acceptance criteria; fix blocking defects.
  - [ ] 6.9 Add project `web/README.md` with setup, env, test, and deployment instructions.
