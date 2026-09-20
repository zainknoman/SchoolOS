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

## Clarification (2026-09-20)
`User.schoolId/campusId` scope **staff** users. **Parent `User` rows carry no `schoolId`**; a parent reaches students only through `StudentParent` (BR-SCOPE-02), and the identity (`User.identifier`, `ParentProfile.cnic`) is already global. The owner's multi-school guardian rule therefore does not require re-scoping parent users; it requires school-scoped relationships, fan-out and PII boundaries (BL-23). `Circular` and `Holiday` have no school anchor (BL-20, migration M2).
