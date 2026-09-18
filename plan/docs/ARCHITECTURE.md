# ARCHITECTURE

## Module map
`backend/`         — NestJS API, Prisma schema/migrations, all business logic + RBAC enforcement.
`staff-console/`    — Vue 3 web app; Teacher + Admin/Accounts roles in one RBAC-gated shell.
`parent-app/`       — Flutter mobile app; the primary parent-facing surface.
`plan/docs/`        — specs (this directory).
`plan/state/`        — run state, dashboard, task graph (git-ignored).

## Boundaries / contracts
- `backend/` owns every entity and all authorization decisions. Neither client ever computes a
  financial total, marks its own attendance, or trusts a locally-cached role — they call the API and
  render what it returns.
- `staff-console/` and `parent-app/` are both thin clients against the same `/api/v1` contract; a field
  added for one surface is added to the API once, not duplicated per client.
- Auth tokens are opaque to both clients beyond standard JWT handling; role logic (which nav items,
  which actions) is a *rendering* decision driven by the token's role claim, never a *security*
  decision — the server re-checks on every request regardless of what the client shows.

## Data flow
Parent app / Staff console → HTTPS → NestJS `/api/v1/*` → Prisma → PostgreSQL.
Auth: client → `/api/v1/auth/login` → {access, refresh} → subsequent requests carry `Authorization:
Bearer <access>` → NestJS guard resolves role + ownership (e.g. "is this parent linked to this
student?") before touching Prisma.

## Run scoping (why this run stops at FEAT-005)

The full platform is three applications sharing one schema — building all fourteen features across all
three surfaces in a single unattended pass would mean dozens of subagents writing a huge, unreviewed
amount of code before the user (or anyone) looks at any of it. That's exactly the failure mode the
validated MVP plan (`SchoolOS/apk/MVP-Plan-V3.md`) was written to avoid — vertical slices, checked in at
sprint boundaries, not a big-bang delivery.

This run therefore builds the foundation every later feature depends on:
- FEAT-001 (schema) and FEAT-002 (auth/RBAC) are the backend's load-bearing base.
- FEAT-003 (multi-campus/multi-child) is the data-modeling decision hardest to retrofit later.
- FEAT-004 and FEAT-005 give both clients a real, running, authenticated shell — proof the three
  pieces actually talk to each other end to end — without yet building any feature screens.

FEAT-006 through FEAT-014 are fully specified now (so the planner has the whole dependency graph and
nothing is re-discovered later) but their implementation is left queued. Sprint 2 onward picks up
exactly where this leaves off: `plan/state/framework-state.json` records `done_set` for FEAT-001..005,
so a follow-up run resumes rather than restarts.
