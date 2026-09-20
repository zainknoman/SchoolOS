# ADR-0006: Tenancy via scoping columns and service checks, not row-level security

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
Multiple schools and campuses share one database.

## Decision
Scope is derived from `User.schoolId/campusId` and enforced in services (`OrgScopeService`, `StudentAccessService`); PostgreSQL RLS was explicitly out of scope.

## Evidence
- `common/org-scope.service.ts`, `common/student-access.service.ts`; e2e `cross-tenant-boundary`.
- RLS exclusion: archived `DATA-MODEL-CORRECTION-PLAN.md`.
- Known gaps: `AcademicSession`, `Subject`, `FeeStructure`, `Term` have no school (`docs/database/TENANCY.md`).

## Consequences
Simple and testable; but every new query must remember to scope, and four tables are unscoped.

## Review trigger
**Review trigger:** owner intends a multi-tenant SaaS (see project memory); this ADR must be revisited by a dedicated audit before that work.
