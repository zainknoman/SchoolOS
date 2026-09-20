# Architecture Documentation

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Engineering Lead

| Document | Scope |
|---|---|
| [SYSTEM-OVERVIEW](SYSTEM-OVERVIEW.md) | components, request path, data/security summaries, CI, deployment status |
| [BACKEND](BACKEND.md) | NestJS module map, layering, adapters, scheduled jobs |
| [STAFF-CONSOLE](STAFF-CONSOLE.md) | Vue application structure |
| [PARENT-APP](PARENT-APP.md) | Flutter application structure |
| [INTEGRATIONS](INTEGRATIONS.md) | adapter architecture (operations detail: [`../operations/INTEGRATIONS.md`](../operations/INTEGRATIONS.md)) |
| [Decisions (ADRs)](../decisions/README.md) | nine retroactive decision records |

Data architecture lives in [`../database/`](../database/DATA-MODEL.md); security architecture in [`../security/`](../security/SECURITY-OVERVIEW.md).
