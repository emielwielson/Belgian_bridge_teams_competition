# PRD: Belgian Bridge Competition Platform (PWA) - Core League Flow MVP

## 1. Introduction / Overview

This project is a mobile-first Progressive Web App (PWA) for managing Belgian bridge team competitions across:

- National League
- Flanders Regional League
- Wallonia Regional League

The platform must support end-to-end competition operations for the MVP core flow: setup, team and player management, scheduling, score entry, standings, and operational workflows. This PRD intentionally focuses on the core league flow first, while keeping structural hooks for playoff support and future clients (mobile/native) through explicit API-oriented requirements.

At this stage, the system assumes **one active season only**. Historical and multi-season workflows are explicitly deferred.

## 2. Goals

1. Deliver a reliable MVP that covers full regular-season competition operations for administrators and participating teams.
2. Enable role-based workflows for Player, Captain, Club Manager, Arbiter, Admin, and Competition Manager.
3. Provide immediate and authoritative scoring updates without approval bottlenecks.
4. Keep standings always up to date based on scored matches and corrections.
5. Ensure all key date-time data is stored in UTC and displayed in Europe/Brussels.
6. Provide installable mobile-first PWA UX with English-only UI for v1.
7. Expose clean, versionable backend APIs suitable for future mobile clients.

## 3. User Stories

- As an Admin, I want to configure leagues, divisions, groups, teams, and match calendars so the competition can be run centrally.
- As a Club Manager, I want to manage my club's eligible players and team compositions so that teams are valid before competition starts.
- As a Captain, I want to coordinate postponements and pre-match logistics so scheduling conflicts can be resolved.
- As a Player, I want to enter a match score once and have it immediately counted so results are visible without delay.
- As an Arbiter, I want to receive rulings/board requests with evidence files so disputes can be handled consistently.
- As a Competition Manager, I want full operational visibility and authority over competition progress and exceptions.
- As a non-logged-in visitor, I want to view standings publicly so competition progress is transparent.

## 4. Functional Requirements

### 4.1 Competition Structure and Scope

1. The system must model competition hierarchy as League -> Division -> Group.
2. The system must support National and Regional leagues, where regional leagues are associated with a region.
3. The system must support divisions (Honor, 1st, 2nd, 3rd) with ordering by level.
4. The system must support the group-level configuration field `max_matches_per_day_per_team` (nullable).
5. The MVP must support regular-season round-robin operations fully.
6. The PRD must keep playoff-related schema fields and data structures in scope for compatibility, while full playoff workflow implementation is not required for MVP release.

### 4.2 Single Active Season Assumption (MVP Simplification)

7. The system must operate under a single active season assumption.
8. Season-selection UX is out of scope in MVP; all operations implicitly apply to the active season.
9. Data models may retain season references for forward compatibility, but no multi-season user flows are required.

### 4.3 Regions, Clubs, Players, and Membership

10. The system must support regions: `flanders`, `wallonia`.
11. The system must support clubs with fields: `id`, `name`, `region_id`.
12. The system must support players with fields: `id`, `name`, `member_number`, `email`.
13. The system must support player-club membership with one-club-per-season validation (interpreted as one club in active season).
14. Once competition is active, player-club membership changes must be blocked.

### 4.4 Teams and Team Players

15. The system must support teams with fields: `id`, `group_id`, `club_id`, `name`, `captain_id`, `location`.
16. Team rosters must be managed through a team-player relation (`team_id`, `player_id`).
17. A player must not be assigned to multiple teams in the same active season.
18. Teams and rosters must be locked once competition starts (active state).
19. Team player removals after competition start must be blocked.
20. Regional league team assignment must match region rules.

### 4.5 Matches and Scheduling

21. The system must store matches with fields:
   - `id`, `group_id`, `round`, `datetime` (UTC)
   - `home_team_id`, `away_team_id`
   - `board_count`
   - `imps_home`, `imps_away`
   - `vp_home`, `vp_away`
   - `last_modified_by`, `last_modified_at`
22. `round` must be required for each match.
23. The system must enforce one match per team per round within a group.
24. The system must allow multiple matches per day per team only when permitted by group configuration.
25. Match deletion must be allowed only before competition start (setup context for active season).
26. The system must prevent invalid team pairings (same team as home/away, duplicate fixture conflicts in same round/group).
27. The system must store and expose timestamps in UTC while showing local time in Europe/Brussels in UI.

### 4.6 Match Players and Substitutes

28. The system must support match-level player assignments (`match_players`) with:
   - `match_id`, `team_id`, `player_id`, `is_substitute`
29. Each participating team must register at least 4 players per match.
30. Substitutes must be allowed without an upper limit.
31. Substitutes may be non-roster players.
32. Substitutes may play for multiple teams.

### 4.7 Score Entry and Match State

33. Authorized roles for initial score submission must include:
   - Players from either team in the match
   - Club Managers
   - Competition Managers
   - System Admins
34. Score entry must have no approval workflow.
35. First valid score submission must immediately become official.
36. After initial submission, score edits must be restricted to Competition Managers and System Admins only; when performed, the new edit overwrites the previous official score.
37. A match must be considered "played" once an official score submission is saved.
38. The system must log score submission events and admin-initiated score changes; player score edits after first submission must not be stored because they are not allowed.

### 4.8 VP Tables and Standings

39. The system must support VP tables scoped to group and board count.
40. VP table rows must define IMP ranges and mapped `vp_home`, `vp_away`.
41. Standings must be derived from scored matches only.
42. Standings must support corrections (manual adjustments/penalties).
43. Sorting must be:
   1. `vp_total` descending
   2. `team_name` ascending
44. Standings must refresh automatically on score entry/edit and correction updates.

### 4.9 Penalties, Warnings, Rulings, and Files

45. The system must support penalties with date, team, reason, and VP deduction.
46. The system must support warnings with date, team, and reason.
47. The system must support rulings with date, match, board, and PDF attachment.
48. Allowed file types must be PDF and images.
49. Maximum file size must be 10 MB.
50. File retention policy must be indefinite (keep forever).

### 4.10 Match Actions and Requests

51. The system must support postponement workflow:
   - Home captain proposes
   - Away captain approves
   - Competition Manager is notified
52. The system must support home/away switch only:
   - Before match is played
   - For double round-robin contexts, defined as the fixed 14-round 8-team RBBF schedule template where rounds 8-14 mirror rounds 1-7 with swapped home/away.
53. The system must support arbiter requests including board reference and image attachment.
54. Arbiter requests must notify arbiter(s), admins, and captains involved.

### 4.11 Notifications

55. The system must support email notifications only in v1.
56. In-app notification center is out of scope for MVP.
57. Email notifications must cover at minimum postponements, arbiter requests, and key admin workflow events.

### 4.12 Logging and Auditability

58. The system must store match logs with `match_id`, `action`, `user_id`, `timestamp`.
59. The log must always include score submission events and all Competition Manager/System Admin actions that impact competition state.
60. Logs must be queryable by authorized admin-level roles.

### 4.13 Authentication and Authorization

61. The system must authenticate users through Supabase Magic Link.
62. The system must support multi-role assignments per user.
63. Access control must be role-based across API and UI, not only at UI level.
64. Non-authenticated users must only access public pages (for MVP: standings and related public competition info).

### 4.14 UI and PWA

65. The application must be installable as a PWA.
66. UX must be mobile-first with desktop support.
67. UI language for MVP must be English only.
68. Role-based views must include:
   - Public (unauthenticated): standings
   - Player: matches and scoring access where authorized
   - Captain: scheduling and captain workflows
   - Club Manager: team and player management
   - Arbiter: request and ruling workflows
   - Competition Manager: competition operations
   - System Admin: full operations

### 4.15 API and Future Mobile Readiness

69. Core domain actions (teams, matches, scoring, standings, penalties, requests) must be available via stable API endpoints.
70. API contracts must be documented and versionable to support future mobile/native client integration.
71. Business rules (validation and permissions) must be enforced server-side, independent of frontend client.

### 4.16 Playoff Data Compatibility (Non-MVP Execution)

72. Match schema must support playoff flags/fields for forward compatibility:
   - `is_playoff` (boolean)
   - `playoff_type` (`title`, `promotion`, `relegation`)
   - `playoff_round` (`semi`, `final`, `third_place`, `step1`, `step2`)
   - `leg` (1 or 2)
   - `parent_match_id`
73. Match sessions schema must support:
   - `match_id`
   - `session_number` (1-6)
   - `imps_home`, `imps_away`
74. Full playoff progression logic for Honor and 1st divisions is planned but out of MVP release scope.

## 5. Non-Goals (Out of Scope for MVP)

- Multi-season management (setup/active/finished lifecycle UI and season history).
- Full playoff orchestration and automatic progression workflows.
- In-app notification center or push notifications.
- Reporting/export suite (CSV/PDF exports).
- Native iOS/Android apps (only API readiness for future clients).
- French/Dutch localization in MVP.

## 6. Design Considerations

- Visual direction: Glide-like, clean, touch-friendly interfaces.
- Prioritize fast score-entry flows and minimal friction on mobile devices.
- Use role-aware navigation to reduce clutter and prevent accidental actions.
- Public pages should remain simple and fast, with standings prominence.
- Display all times in Europe/Brussels while preserving UTC storage.

## 7. Technical Considerations

- Stack assumptions: Supabase-backed auth and data layer with Magic Link authentication.
- Enforce constraints in database and/or backend service layer (not frontend-only).
- Use optimistic but safe concurrency handling for score edits (last write wins for authorized admin edits only, with audit trail).
- File storage must validate mime type and size on upload.
- Email delivery must be implemented via Make.com scenarios/webhooks, with retry handling for delivery failures.
- API versioning at launch should use URL path versioning (`/v1`) for clarity and future client compatibility.
- API should be documented (e.g., OpenAPI or equivalent) and treated as a stable product contract.
- Keep data model season-aware internally, while exposing only active season behavior in MVP UX.

## 8. Acceptance Criteria

1. Competition Manager/System Admin can configure active-season competition structure and schedule matches with valid constraints.
2. Club Manager and Captain workflows function with role-based permissions and lock behavior after start.
3. Authorized users can submit scores immediately, and only Competition Managers/System Admins can edit afterward; standings refresh correctly on each allowed change.
4. Standings sorting and correction behavior matches specified rules.
5. Penalties, warnings, rulings, and file uploads (PDF/images up to 10 MB) work end-to-end.
6. Postponement and arbiter request workflows send required emails and persist audit logs.
7. Public users can view standings without authentication.
8. App is installable as a PWA and usable on mobile form factors.
9. All date-times are stored in UTC and displayed as Europe/Brussels.
10. Server-side validations enforce critical competition rules.
11. Core API endpoints are documented and usable by a future non-web client.
12. "Everything works" is interpreted as all critical user journeys completing successfully without blocking defects in UAT.

## 9. Open Questions

No open questions currently. Latest decisions captured in this PRD:

1. Competition Manager and System Admin are distinct roles; System Admin has full access.
2. Email notifications are implemented via Make.com.
3. No additional legal/compliance constraints are currently required for indefinite storage.
4. No full score edit history is required for player edits; only score submission events and admin-initiated changes are logged.
5. Double round-robin references the fixed 14-round mirrored 8-team RBBF schedule template.
6. API versioning uses URL path versioning (`/v1`) at launch.

## 10. Appendix: Scheduling Template (8 Teams)

This appendix defines the deterministic match-generation template for an 8-team double round-robin group.

- Teams are labeled `1` through `8`.
- Rounds `1-7` are the first leg.
- Rounds `8-14` are the mirror of rounds `1-7` with home/away swapped.
- This template is the reference for automatic fixture generation once teams and match dates are provided.

### 10.1 Round Pairings (First Leg)

1. Round 1: `1-2`, `3-4`, `5-6`, `7-8`
2. Round 2: `1-6`, `2-5`, `3-8`, `4-7`
3. Round 3: `7-1`, `6-2`, `5-3`, `8-4`
4. Round 4: `1-8`, `2-7`, `3-6`, `4-5`
5. Round 5: `5-1`, `8-2`, `7-3`, `6-4`
6. Round 6: `1-3`, `2-4`, `8-6`, `7-5`
7. Round 7: `4-1`, `3-2`, `5-8`, `6-7`

### 10.2 Round Pairings (Second Leg / Mirrored)

8. Round 8: `2-1`, `4-3`, `6-5`, `8-7`
9. Round 9: `6-1`, `5-2`, `8-3`, `7-4`
10. Round 10: `1-7`, `2-6`, `3-5`, `4-8`
11. Round 11: `8-1`, `7-2`, `6-3`, `5-4`
12. Round 12: `1-5`, `2-8`, `3-7`, `4-6`
13. Round 13: `3-1`, `4-2`, `6-8`, `5-7`
14. Round 14: `1-4`, `2-3`, `8-5`, `7-6`

### 10.3 Pair Constraints (Validation Rules)

- Always together (if in same group, except when playing each other): `1-2`, `3-4`, `5-6`, `7-8`.
- Never together (except when playing each other): `1-6`, `2-5`, `3-8`, `4-7`.
- Exactly one round not together (if in same group): `1-3`, `2-4`, `5-7`, `6-8`.
