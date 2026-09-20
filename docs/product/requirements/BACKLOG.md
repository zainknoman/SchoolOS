# SchoolOS — Requirements Backlog (PLANNED / NOT IMPLEMENTED)

> **Status:** PLANNED · **Verified:** 2026-09-20 · **Owner:** project owner
> Everything here is **not** a current requirement or feature. Items are collected from open decisions (Q-items in [BUSINESS-RULES](../BUSINESS-RULES.md)), evidence gaps and archived planning documents. No priority or commitment is implied; prioritisation is a product decision.

| ID | Item | Origin | Depends on |
|---|---|---|---|
| BL-01 | School-scoped academic sessions (and correct "active session" resolution per school) | Q1, BR-ORG-01/02 | Product decision + schema migration + data backfill |
| BL-02 | Subject management (create/edit/retire; per-school scope) | Q2, F-ORG-06 | Decision |
| BL-03 | Fee-structure edit/delete; school scoping for `FeeStructure` and `Term` | Q3 | Decision + migration |
| BL-04 | Guardian rules (limits, relationship types) | Q4 | Decision |
| BL-05 | Promotion eligibility rules (marks/attendance/fees) | Q5 | Decision |
| BL-06 | Report cards generated from gradebook | Q6 | Decision |
| BL-07 | Data retention/soft-delete/privacy policy for PII | Q7, NFR-PRV-01 | Legal/owner decision |
| BL-08 | Fee extras: discounts, late fees, refunds, installments, carry-forward | Q9 | Decision |
| BL-09 | Parent web portal | Archived status log | Product decision |
| BL-10 | Object storage (S3-compatible) adapter | README/PROJECT-STATUS known gaps | Engineering |
| BL-11 | Health/readiness endpoint, structured logging, metrics, alerting | NFR-AVL-01, NFR-OPS-01 | Engineering |
| BL-12 | Security headers (`helmet`), dependency scanning in CI | NFR-SEC-08 | Engineering |
| BL-13 | Deployment tooling (container image, IaC), backup/restore procedures | NFR-DAT-02, NFR-SCL-01 | Engineering + hosting decision |
| BL-14 | Live verification of JazzCash, EasyPaisa, FCM, SMTP, SMS, WhatsApp | PROJECT-STATUS | External credentials |
| BL-15 | Performance and availability targets + load tests | NFR-PERF-01, NFR-AVL-01 | Decision |
| BL-16 | Multi-tenant SaaS direction (per project memory: user's stated future goal) | Owner intent, not code | Separate audit before any refactor |
| BL-17 | Seed/session consistency (seed creates one active session per school, contradicting the API rule) | `seed.ts:154` | Q1 |
| BL-18 | E2E coverage for staff, hiring, files, risk job | TRACEABILITY | Engineering |
| BL-19 | OpenAPI/Swagger contract generated from controllers | API-4 | Engineering |
| BL-20 | Fix tenant-isolation defects (circulars to all parents, platform-wide holidays) and add regression tests | KG-1, KG-6 | Engineering (+ Q1) |
| BL-21 | Server-side account disable/unlock, session revocation, `mustChangePassword` enforcement | KG-10, KG-11, KG-23 | Engineering |
| BL-22 | Bootstrap procedure for the first SUPER_ADMIN | KI-23 | Engineering/ops |
