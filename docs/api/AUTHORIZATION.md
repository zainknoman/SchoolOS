# Authorization

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `auth/guards/roles.guard.ts`, `auth/decorators/*`, `common/org-scope.service.ts`, `common/student-access.service.ts`, controllers · **Owner:** project owner
> Role capability matrix: [`docs/product/PERSONAS-AND-ROLES.md`](../product/PERSONAS-AND-ROLES.md). Route-by-route roles: [ENDPOINTS.md](ENDPOINTS.md).

## Three layers
1. **Authentication guard** (`JwtAuthGuard`, global): every route needs a valid bearer token unless marked `@Public()` (6 routes: `GET /`, login, refresh, forgot-password, reset-password, payment webhook).
2. **Role guard** (`RolesGuard`, global): `@Roles(...)` on a class or method; check is `requiredRoles.includes(user.role)` and returns 403 "Insufficient role for this action". **No implicit SUPER_ADMIN override.** Routes without `@Roles` (32) pass any authenticated role.
3. **Object/scope checks in services** — the real tenant boundary:
   - `OrgScopeService.resolve(user)` → `{unrestricted | denied | schoolId, campusId, campusWhere, allows()}`. SUPER_ADMIN unrestricted; other staff without `schoolId` are denied; `campusId` set ⇒ campus-confined (`org-scope.service.ts:41-70`). Reads the user's `schoolId/campusId` from the database on every call (not from the token).
   - `StudentAccessService` — `assertCanAccessStudent/Section/Class`: PARENT needs a `StudentParent` link; TEACHER needs timetable or class-teacher assignment to the section; SCHOOL_ADMIN/ACCOUNTS need campus/school match; anything else denied (`student-access.service.ts:33-122`).
   - `FilesAccessService` — per-file access derived from the resource the file is attached to.

## Rules of thumb for endpoint authors (as practised)
List endpoints must filter by scope inside the service (not by caller-supplied ids alone); single-resource endpoints call an `assert*` first. Known deviations: four lists have no school path in the schema (`GET /academic-sessions`, `/terms`, `/subjects`, `/fee-structures`) — see [`docs/database/TENANCY.md`](../database/TENANCY.md).

## Code issues discovered (recorded, not fixed)
| ID | Issue | Impact |
|---|---|---|
| AUTHZ-1 | 32 routes rely purely on service-level scoping; a service that forgets `assert*` is open to every authenticated role. Coverage is proven only by e2e specs `cross-tenant-boundary`, `sections-access`, `me`, `org-provisioning` | Regression risk on new endpoints |
| AUTHZ-2 | Access tokens carry only `sub` and `role`; role or lock changes take effect after token expiry (≤ 15 min) | Delayed revocation |
| AUTHZ-3 | `isPrincipal` is not part of `@Roles`; it is checked inside the service for one endpoint and by the client router elsewhere | Easy to forget on new principal-only endpoints |
