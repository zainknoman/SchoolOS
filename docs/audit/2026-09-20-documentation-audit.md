# Documentation Audit — 2026-09-20

> **Status:** CURRENT (dated record) · **Audited:** `main@15362b7` · **Scope:** the canonical documentation set produced by the documentation program (Phases 1A–12) · **Owner:** project owner
> Phase 13 of `docs/PLAN-DOCUMENTATION-PRODUCTION-READINESS.md`. Done by the same agent that wrote the docs, so it is a **consistency and evidence check, not an independent review** — an independent human read-through is recommended before relying on any document.

## 1. Method
1. Mechanical audit script over all non-archived Markdown (80 files, including this report): relative-link resolution, status-header presence, reachability from `README.md` / `docs/README.md`, and existence + line-range validity of every `path:line` citation (141 citations).
2. Numeric cross-checks against the repository (below).
3. Re-derivation of role permissions from a second, corrected controller scan (found and fixed defects — §3).
4. Test suites executed on 2026-09-20 ([TESTING-STRATEGY](../testing/TESTING-STRATEGY.md)); `npm audit` run; migrations applied to an empty database.
5. Diff of touched paths: **no file under `backend/src`, `backend/test`, `backend/prisma`, `staff-console/src`, `parent-app/lib`, `parent-app/test` or `.github/` was modified.**

## 2. Numeric claims re-verified against the repository
| Claim (where used) | Verified value |
|---|---|
| Controllers 41; route handlers 185 (README, PROJECT-STATUS, ENDPOINTS) | 41; 185 (scan) |
| Postman collection vs routes | 185/185 match, no extras |
| Prisma models 57, enums 14, FK edges 108 | 57 / 14 / 108 (generated) |
| Migrations 13; no `DROP` statements | 13; 0 DROP TABLE/COLUMN |
| Backend unit specs 78; e2e specs 22; console specs 73; Flutter test files 29 | 78 / 22 / 73 / 29 |
| Superpowers plans 36, specs 23 | 36 / 23 |
| `@Roles` on 147 routes, 32 any-authenticated, 6 public | derived from scan (147+32+6 = 185) |
| Test results (579 / 196 / 512 / 100) | recorded from executed runs |

## 3. Defects found by this audit (all fixed in docs; none in code)
| # | Defect | Fix |
|---|---|---|
| 1 | Phase 3 role matrix/feature catalog said campuses and classes were SUPER_ADMIN-only; the corrected scan shows SCHOOL_ADMIN can create/list campuses and create/update/delete classes (method-level `@Roles` overrides the class-level one) | matrix, catalog, journey, guides corrected; root cause: first scanner ignored method-level overrides — the generated ENDPOINTS reference uses the corrected scanner |
| 2 | Three wrong line citations (an out-of-range range in `auth.constants.ts` and two ranges attributed to `enrollment.service.ts` that actually live in `student.service.ts`) | re-pointed to `auth.constants.ts:13-20` and `student/student.service.ts:59-71` |
| 3 | BR-SCOPE-04 / NFR-DAT-01 claimed "most FKs are `Restrict`"; the schema mixes 30 Restrict, 38 Cascade, 25 SetNull, 15 default | corrected |
| 4 | BR-ENR-01 said single-ACTIVE-enrollment uniqueness was UNKNOWN; schema shows none | corrected; same for per-month vouchers |
| 5 | README earlier described seeded schools as placeholders ("Test School A/B"); seed uses a real-sounding name | recorded (SEED-3), README seed section removed |
| 6 | Sub-project READMEs lacked status headers; two index gaps (architecture, requirements) | added |
| 7 | Doc claim that `isLocked` is unused: first wording "no matches" was inaccurate (spec fixtures use it) | reworded |

## 4. Remaining mechanical findings after fixes
See §7 (re-run results). Intentionally unreachable from the indexes: none, apart from the two deprecated stubs `docs/database/data-model-design.md` and `migration-plan.md` (kept only for code-comment references).

## 5. UNKNOWN / unverified claims (explicitly marked in the docs)
| Area | Unknown |
|---|---|
| User guides | not click-tested; button/field wording unverified |
| Requirements | several acceptance criteria marked `UNVERIFIED` (FR-ORG-02, FR-ATT-02, FR-PPL-05, FR-FIL-01, …) |
| Security | staff-console XSS posture (`v-html`, CSP) not reviewed; proxy/IP behaviour of throttling; database privileges |
| Architecture | how parent-app users complete a reset link (`FRONTEND_URL`); FCM invalid-token cleanup; Anthropic error path |
| API | attendance-correction semantics (overwrite vs error); whether all date DTOs use ISO validation (74 `IsDateString` decorators found, not exhaustively mapped) |
| Migrations | per-migration table lists inferred from names, not read line by line |
| Legal/privacy | all retention/consent/regulatory questions |

## 6. Code issues discovered (program total)
Recorded, **not fixed**: [KNOWN-GAPS](../security/KNOWN-GAPS.md) (23 security/isolation items), [KNOWN-ISSUES](../release/KNOWN-ISSUES.md) (25 engineering items), TENANT-1..6, AUTH-1..3, AUTHZ-1..3, API-1..4, DB-1..6, SEED-1..4. Most severe: KG-1 (school-wide circulars reach every school's parents), KG-2/3/4 (unsafe defaults/logging of reset links), KG-5 (9 high backend vulnerabilities), KG-7 (global academic session).

## 7. Final mechanical results
Final run of the audit script (80 documents, includes this file): **250 relative links, 0 broken · 0 documents missing a status header · 141 `path:line` citations, all resolve to an existing file with a sufficient line count (0 wrong, 0 unresolved) · 2 unreachable files (the deprecated stubs, intentional).**

**Limits of the check:** a citation resolving to a valid line range proves the location exists, not that the cited line supports the claim; claim-to-code agreement was spot-checked by hand (about 60 claims across architecture, API, security, database and rules) plus the defect discoveries in §3. Links inside `docs/archive/`, `docs/superpowers/` and `docs/design-reference/` are not checked (historical).

## 8. Open items for the owner
1. Independent review of the docs, especially user guides (click-test) and the role matrix.
2. Decide Q1–Q9 ([BUSINESS-RULES](../product/BUSINESS-RULES.md) §8), license, security contact, hosting, retention policy.
3. Close `docs/UI-Screenshots/sample4` (Windows lock) and move it; review the two uncommitted CSV edits inside it.
4. Prune stale worktrees (`.claude/worktrees/*`) after confirming nothing unpushed (untouched by this program).
5. Authorize engineering work from [PRODUCTION-READINESS](../release/PRODUCTION-READINESS.md) §3 — the documentation program deliberately fixed no code.
6. Commit the documentation changes (nothing is committed; snapshot tag `docs-pre-cleanup` marks the pre-cleanup state).
