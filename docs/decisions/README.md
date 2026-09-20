# Architecture Decision Records

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Engineering Lead
> All ADRs are **retroactive**: they record decisions already embodied in the code, with evidence. Status `Accepted (retroactive)` means the decision is in force, not that it was formally reviewed. Decision gate G6 (ADR list) resolved by recording only decisions with clear code evidence.

| ADR | Decision |
|---|---|
| [ADR-0001](ADR-0001-single-backend-two-clients.md) | One backend serves both clients |
| [ADR-0002](ADR-0002-principal-as-flag.md) | Principal is a flag on SCHOOL_ADMIN, not a Role |
| [ADR-0003](ADR-0003-enrollment-as-history.md) | Enrollment is a dated history entity |
| [ADR-0004](ADR-0004-adapter-pattern.md) | External services sit behind adapters with dev fallbacks |
| [ADR-0005](ADR-0005-additive-migrations.md) | Migrations are additive-only |
| [ADR-0006](ADR-0006-tenancy-by-scoping-columns.md) | Tenancy via scoping columns and service checks, not row-level security |
| [ADR-0007](ADR-0007-postgresql-only.md) | PostgreSQL is the only supported database |
| [ADR-0008](ADR-0008-in-process-cron.md) | Scheduled work runs in-process |
| [ADR-0009](ADR-0009-refresh-token-rotation.md) | Refresh tokens are opaque, hashed and rotated on use |
