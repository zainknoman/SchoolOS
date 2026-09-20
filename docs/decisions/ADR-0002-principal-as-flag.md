# ADR-0002: Principal is a flag on SCHOOL_ADMIN, not a Role

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
A principal needs school-level oversight views but the same administrative rights as a school administrator.

## Decision
Model Principal as `User.isPrincipal = true` on a `SCHOOL_ADMIN` user; the role enum stays five values.

## Evidence
- `enum Role` in `schema.prisma` has no PRINCIPAL; `User.isPrincipal` at `schema.prisma:139`.
- `dashboard.controller.ts:33-34` and route meta `requiresPrincipal` in `staff-console/src/router/index.ts`.
- `EmployeeType.PRINCIPAL` on staff records is a separate classification.

## Consequences
No new authorization role to maintain; but "Principal" appears in three unrelated places (flag, staff type, contact name), and `@Roles` cannot express it (the service checks the flag).

## Review trigger
Revisit if principals need permissions that differ from SCHOOL_ADMIN (would be a code change).
