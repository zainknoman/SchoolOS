# ADR-0001: One backend serves both clients

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
The staff console and the parent app need the same school data with different permissions.

## Decision
A single NestJS API (`/api/v1`) is the only backend; both clients are thin and never compute authorization or money totals themselves.

## Evidence
- `backend/` is the only server; `staff-console/src/lib/api.ts` and `parent-app/lib/src/api/api_client.dart` call the same paths.
- Original rationale: archived `docs/archive/original-mvp-plan/ARCHITECTURE.md`.

## Consequences
Consistent rules and one deploy unit; but every client change that needs new data touches one shared API, and there is no BFF layer.

## Review trigger
Revisit if a third client with divergent needs (parent web portal) is built.
