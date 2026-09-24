# Existing-School Data Migration Strategy (BL-62)

> **Status:** DRAFT — **awaiting owner approval** (Product Owner + Engineering Lead). Nothing in this document has been executed. · **Verified:** 2026-09-24 against `wave-0/foundations` (`backend/prisma/schema.prisma`, `attendance.service.ts`, `leave.service.ts`, `fee-vouchers.service.ts`; harness `backend/migration-harness/`) · **Sources:** [OWNER-DECISIONS](../product/OWNER-DECISIONS.md) Q1–Q4, RD-10, RD-11; [BACKLOG](../product/requirements/BACKLOG.md) BL-01/02/03/20/23/60/61/62/65; [EXECUTION-PLAN](../release/EXECUTION-PLAN.md) §3 · **Owner:** Engineering Lead (Technical Owner)
> This is the RD-11 gate: **no migration among M2–M7 runs on shared or production data until this strategy is approved**, its migration has passed a BL-65 harness scenario, the dry-run has been run on a fresh production copy, every *blocking* review row is resolved, and a verified backup exists. The decisions in §9 are the ones that need sign-off.

## 1. Principles (RD-11)
1. **Explicit and auditable.** Every automatic change follows a rule in this document; every row no rule covers goes to the manual-review queue (§7). Nothing is guessed, and no record is assigned to an arbitrary "current" session, school or guardian.
2. **Backward-aware.** Expand → backfill → contract ([EXECUTION-PLAN §3](../release/EXECUTION-PLAN.md)): new columns are nullable first, so the previous build keeps working; `NOT NULL`/unique constraints ship one release later, and only when zero blocking review rows remain.
3. **Idempotent.** Backfills only touch rows that are still unmapped (`schoolId IS NULL`, `markedByUserId IS NULL`, …). Clones are keyed by `(legacy<Entity>Id, schoolId)` with a unique index, so a re-run finds them instead of duplicating them. The harness runs every backfill twice and fails if the second run changes anything.
4. **History is preserved.** Nothing is deleted by a rule. A clone keeps `legacy<Entity>Id` pointing at its origin, and money amounts on vouchers are never recomputed.
5. **No needless duplication.** A row used by one school is assigned, not copied. A shared row stays with one deterministic *anchor school*, and only the other schools get clones.
6. **Guardian identity is global and is never merged by the migration.** Matching uses only the unique keys (CNIC, `User.identifier`); names are never used; duplicates are *reported*, and any merge is a later, audited admin action (BL-23), never a migration step.

## 2. What the schema actually holds (verified 2026-09-24)
| Area | Current shape | Consequence for the migration |
|---|---|---|
| `AcademicSession` | Global; no `schoolId`; `label` not unique; activating one deactivates **all** | Must be mapped to a school through its dependents (§3) |
| Session dependents (F7) | `Class` and `Enrollment` (campus), `Application` (desired class → campus), `FeeVoucher` and `ReportCard` (student's enrolment **in that session**), `Term` (session only), `AssessmentCategory` (class + term) | These rows are re-pointed when a session is split |
| `Subject` | Global; `name` globally unique | Per-school uniqueness `(schoolId, name)` is automatically satisfied |
| Subject dependents (F7) | `Timetable` and `DiaryEntry` (section → class), `Assessment` (category → class) | These rows are re-pointed when a subject is cloned |
| `FeeStructure` | `name`, `amount`, `createdAt` only; **no table has a foreign key to it**. Issuing a voucher copies `name`/`amount` into `FeeItem.label`/`amount` (`fee-vouchers.service.ts:88-91`) | Attribution to a school is only an **inference** from `FeeItem.label = FeeStructure.name`; nothing needs re-pointing. *New finding (not in F1–F10).* |
| `StudentParent` | Already has `relationship` (free text, default `guardian`), `isPrimary`, `isEmergencyContact` (migration `20260919090000`) | M6 is smaller than planned: it maps `relationship` to the Q4 types and adds a primary slot. *New finding.* |
| Attendance audit | Code writes `attendance.mark` (`entityId` = Attendance id), `attendance.mark-bulk` (`metadata.date`, `metadata.studentIds`), `leave-request.approve` (LeaveRequest id; LEAVE rows in its date range). **No `attendance.update` action exists.** | The M1 actor backfill must read these three actions; the earlier plan text naming `attendance.update` was wrong and is corrected here and in BL-60. *New finding.* |
| `Circular` / `Holiday` | No school anchor (F3) | M2 derives one (§6) |
| `Student.status` | `LEFT` is still written by `TRANSFERRED_OUT` promotions | M7 rule (§5) |

## 3. Academic sessions (M3, BL-01)
| Rule | Case | Action | Review category |
|---|---|---|---|
| S1 | All dependents belong to **one** school | Set `schoolId` to that school | — |
| S2 | Dependents in **several** schools | The **anchor school** keeps the original row: the school with the most dependent rows (ties: the school created earliest, then lowest id). Every other school gets a clone with the same label, dates and `isActive`, and `legacySessionId` = original. That school's `Class`, `Enrollment`, `Application`, `FeeVoucher` and `ReportCard` rows are re-pointed to the clone. Its `Term`s are cloned under the clone session, and its `AssessmentCategory.termId` is re-pointed to the cloned term of the same label | `SESSION_SPLIT_REQUIRED` (informational) |
| S3 | A `FeeVoucher`/`ReportCard` whose student has **no enrolment in that session** | Not re-pointed; stays on the original session and is listed. Visibility of vouchers and report cards is decided by the student, not the session, so no other school gains access | `SESSION_DEPENDENT_UNRESOLVABLE` (non-blocking until contract) |
| S4 | Session used by **no** dependent | If the database holds exactly one `School`: assign it. Otherwise: listed; the owner assigns it or deletes it explicitly (a future session created early looks exactly like this, so it is never auto-deleted) | `SESSION_UNREFERENCED` (blocking for the contract step) |
| S5 | **More than one** session is active | **M3 refuses to run.** A school must end with at most one active session; an administrator deactivates the extra rows first (normal UI path) | `SESSION_MULTIPLE_ACTIVE` (**blocking before M3**) |
| S6 | After mapping, two sessions of one school share a label | Listed; the contract step's unique `(schoolId, label)` waits for a rename | M3 pre-check `SESSION_LABEL_COLLISION` (blocking for contract) |

## 4. Subjects (M4, BL-02) and fee structures (M5, BL-03)
| Rule | Case | Action | Review category |
|---|---|---|---|
| U1 | Subject used (Timetable/Assessment/DiaryEntry) in one school | Set `schoolId`; `isActive = true` | — |
| U2 | Used in several schools | Anchor school keeps the original (most references; same tie-break as S2); clones for the others with `legacySubjectId`; that school's `Timetable`, `Assessment` and `DiaryEntry` rows re-pointed. Marks and history are untouched because they hang off `Assessment` | `SUBJECT_CLONE_REQUIRED` (informational) |
| U3 | Unused subject | Single-school database: assign. Otherwise listed; owner assigns or deletes explicitly (nothing depends on it). **Not copied into every school** | `SUBJECT_UNREFERENCED` (blocking for contract) |
| F1 | Structure's name appears on vouchers of one school only | Set `schoolId`, lifecycle `LOCKED` (it has been invoiced). Because this is an inference from the label, it is listed for confirmation | `FEE_STRUCTURE_ATTRIBUTED_BY_LABEL` (non-blocking) |
| F2 | Name appears on vouchers of several schools | Anchor + clones as in S2, all `LOCKED`, `legacyFeeStructureId` set. No voucher changes, because vouchers hold copies | `FEE_STRUCTURE_CLONE_REQUIRED` (informational) |
| F3 | Never issued | Single-school database: assign as `DRAFT`. Otherwise listed; owner assigns or archives explicitly | `FEE_STRUCTURE_UNREFERENCED` (blocking for contract) |
| F4 | Two or more structures share a name | Label attribution is impossible, so the owner assigns each one | `FEE_STRUCTURE_NAME_COLLISION` (blocking for contract) |
| F5 | Future invoices | M5 adds a nullable `FeeItem.feeStructureId` written by new vouchers, so "locked once invoiced" (Q3) becomes a real reference. Legacy items are back-linked only where the label is unique within the school; otherwise they stay null | — |

## 5. Guardians (M6, BL-23/BL-04) and lifecycle (M7, BL-61)
| Rule | Case | Action | Review category |
|---|---|---|---|
| G1 | Every guardian | No `schoolId` on `User`, `ParentProfile` or the identity; no merge; access stays through `StudentParent` | — |
| G2 | Profiles sharing a phone or e-mail | **Report only.** CNIC and identifier are already unique, so exact duplicates cannot exist; a shared contact detail is a *candidate*, merged later only by an audited admin action (BL-23) | `GUARDIAN_DUPLICATE_CANDIDATE` (non-blocking) |
| G3 | Same name, different CNIC | Never linked, never flagged as a candidate; counted only to prove the rule (harness check) | — |
| G4 | `relationship` text | `mother`/`father`/`guardian` (case-insensitive, trimmed) → `MOTHER`/`FATHER`/`GUARDIAN`; anything else → `OTHER` with the original text kept in a note column. `guardian` was the column default, so it is reported as unconfirmed but is not blocking | counted in the dry-run summary |
| G5 | Primary guardians (Q4: at most **2** per student) | Existing `isPrimary` links → slots 1 and 2 in `createdAt`, `id` order. A student with exactly **one** link and no primary gets slot 1 (the only guardian is necessarily the primary contact). **More than 2** primaries → none assigned, listed. Several links but no primary → none assigned, listed as informational | `GUARDIAN_MULTIPLE_PRIMARY` (blocking for that student's slot), `GUARDIAN_PRIMARY_SLOT_REVIEW` (informational) |
| G6 | Parent with children in several schools | No data change; the fan-out and visibility code of BL-23 handles it; covered by cross-tenant e2e | counted |
| L1 | `LEFT` + latest promotion `TRANSFERRED_OUT` (by `decidedAt`, then id) | → `TRANSFERRED` | — |
| L2 | Any other `LEFT` | **Unchanged**; listed. `LEFT` leaves the enum only when zero rows remain | `LIFECYCLE_LEFT_MANUAL_REVIEW` (blocking for the contract step) |
| L3 | `EnrollmentStatus` | Untouched (`COMPLETED` is per-session closure); a harness check asserts it | — |

## 6. Circulars and holidays (M2, BL-20); attendance actor (M1, BL-60)
| Rule | Case | Action | Review category |
|---|---|---|---|
| C1 | Circular with a section | School via section → class → campus | — |
| C2 | No section; author has a `schoolId` | Author's school | — |
| C3 | No section; author has no school (SUPER_ADMIN) | `schoolId` stays null and the row is listed. New code shows a null-school circular only to SUPER_ADMIN and to parents who **already received it** (existing `CircularRecipient` rows are history); it is never re-sent | `CIRCULAR_SCHOOL_UNRESOLVABLE` (blocking for contract) |
| H1 | Holiday with a campus | School via campus | — |
| H2 | Holiday with no campus | Today it applies to **every** school. Single-school database: assign. Otherwise **one copy per school** (keeps today's calendar exactly, so no day silently becomes a school day), each listed so a school can delete a copy it does not observe. Owner ruling 2026-09-20: a null campus means school-wide within its own school | `HOLIDAY_NO_CAMPUS` (non-blocking) |
| A1 | Attendance row with an `attendance.mark` audit row whose `entityId` is the row | `markedByUserId` = that audit row's `userId` (latest audit row at or before the row's `updatedAt`) | — |
| A2 | Matching `attendance.mark-bulk` (same date, student in `studentIds`) or, for `LEAVE`, a `leave-request.approve` for that student covering the date | Same, taking the latest such audit row | — |
| A3 | No audit evidence | `markedByUserId` stays null; `markedById` (the Teacher FK) is kept. No teacher identity is invented | counted (`attendanceActorUnresolvable`) |

## 7. Manual-review queue
- **Form.** The first data migration (M2) adds a `MigrationReviewItem` table: `migration`, `category`, `entity`, `entityId`, `detail`, `blocking`, `status` (`OPEN`/`RESOLVED`/`WONTFIX`), `resolution`, `resolvedById`, `resolvedAt`, with a unique key on `(migration, category, entity, entityId)` so re-runs upsert. The dry-run CSV has the same columns before anything is written.
- **Who resolves.** SUPER_ADMIN. During the pilot this is done through a documented SQL runbook ([RUNBOOKS](../operations/RUNBOOKS.md)); a console screen is optional later. Every resolution writes an `AuditLog` row `migration.review.resolve`.
- **Gates.** "Blocking before" rows stop the migration from starting. "Blocking for contract" rows stop only the constraint-tightening release. Non-blocking rows are closed as `RESOLVED` or `WONTFIX` with a note.

## 8. Execution procedure (every migration M1–M7)
1. **Harness first.** Add a BL-65 scenario for the migration (`target.after`, `backfill`, `checks`). It must pass reconciliation and the second-run idempotency check (`npm run migration:harness -- <scenario>`).
2. **Dry-run on a fresh production copy.** Run `npm run migration:dry-run -- --url <copy>` (a read-only transaction). Archive the JSON and CSV with the release. All blocking rows must be resolved.
3. **Backup.** Take a fresh backup and verify that it restores ([BACKUP-RESTORE](../operations/BACKUP-RESTORE.md)).
4. **Expand, then backfill.** Deploy the migration, then run the backfill once. It records a summary `AuditLog` row `migration.<Mx>`.
5. **Reconcile.** Row counts per table must equal the pre-migration counts plus the expected clones. Violation queries must return 0: every re-pointed dependent references a session or subject of its own school, and no dependent of school B points at school A's row. Anything unmapped must appear in the review queue.
6. **Isolation check.** The cross-school e2e suite runs against the migrated copy.
7. **Contract.** One release later, apply `NOT NULL` and unique constraints once blocking-for-contract rows = 0.
- **Rollback** = restore the pre-migration backup and redeploy the previous build ([ROLLBACK](../release/ROLLBACK.md)). Because the expand steps are additive, the previous build also runs on a migrated database, so a failed backfill does not force a restore unless data is wrong.

## 9. Decisions requiring approval
| # | Decision | Recommended option | Alternative |
|---|---|---|---|
| D1 | Shared session/subject/fee structure | Anchor school keeps the original (most dependents); other schools get clones | Clone for every school and retire the original (more churn, more re-pointing) |
| D2 | Unreferenced sessions/subjects/fee structures in a multi-school database | Listed; owner assigns or deletes; never copied | Copy into every school as inactive (duplication, against RD-11) |
| D3 | Holiday with no campus | One copy per school, listed so schools can delete theirs | Manual assignment only (the holiday disappears from every school until someone acts) |
| D4 | Circular with no school | Null school, visible to SUPER_ADMIN and past recipients only; manual assignment | Assign to every school (would re-expose it more widely than today) |
| D5 | Fee-structure attribution | By `FeeItem` label, with a confirmation list | Manual assignment of every structure |
| D6 | Guardian relationship and primary slots | G4/G5 as written | Treat all existing links as `OTHER` with no primary (loses data entered since 2026-09-19) |
| D7 | More than one active session | Blocks M3 until an administrator fixes it | Keep the newest by start date active (a guess, against RD-11) |
| D8 | Review queue | `MigrationReviewItem` table + SQL runbook | CSV only (not auditable in the product) |

## 10. Evidence
**BL-65 harness, baseline scenario** (legacy fixture, 2 schools, `npm run migration:harness -- baseline`, 2026-09-24): all 26 reconciliation checks pass. The dry-run classified every ambiguous shape the fixture contains:
- a session shared by two schools, an unreferenced session, and a voucher with no enrolment;
- subjects shared only through `DiaryEntry` or `Assessment`;
- all four fee-structure cases;
- a duplicate-contact parent pair and a same-name/different-CNIC pair (never flagged);
- matched and unmatched `LEFT` students;
- circulars and holidays without an anchor;
- attendance actors recoverable through all three audit actions (4 of 6 rows; 2 stay null).

**Local development database** (`npm run migration:dry-run`, read-only, 2026-09-24). This is not production data: it contains e2e leftovers and seed data. It shows the real shapes:

| Measure | Value |
|---|---|
| Sessions | 68: 3 shared, 13 single-school, 52 unreferenced, **12 active** (blocks M3, rule S5) |
| Unresolvable session dependents | 8 |
| Subjects | 10: **9 shared**, 1 unreferenced |
| Fee structures | 3: 2 attributed by label, 1 unreferenced |
| Guardians | 3,203 profiles, 3,206 links; 1 duplicate-contact group; 2 students with more than 2 guardians; 1 guardian across schools; 0 students with more than 2 primaries |
| Holidays | 2 without a campus |
| Attendance | 3,321 rows; the actor is recoverable for **121** (seeded rows have no audit trail, so most stay null under A3) |
| `LEFT` students | 0 |

**Not yet evidenced.** No production copy has been examined, and no M1–M7 migration exists yet. Each will add its own harness scenario (step 1 of §8) before it runs.

## 11. Approval
| Role | Name | Decision | Date |
|---|---|---|---|
| Product Owner | — | pending | — |
| Engineering Lead | — | pending | — |
