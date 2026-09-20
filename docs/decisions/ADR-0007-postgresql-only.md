# ADR-0007: PostgreSQL is the only supported database

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
The project began on SQLite for local development.

## Decision
PostgreSQL only, via Prisma 7 with the `pg` driver adapter; SQLite support was dropped.

## Evidence
- `schema.prisma` datasource `postgresql`; baseline migration `20260908000000_postgres_baseline`; CI service `postgres:16`.

## Consequences
One dialect, production-like tests; requires a running Postgres for e2e tests.

## Review trigger
None.
