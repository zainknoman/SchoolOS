# SchoolPortal — Gap Analysis & Feature Prioritization

**Compiled 2026-09-08.** Synthesizes three prior documents — this is the decision layer, not new
research:

1. `SchoolPortal-Repo-Audit-2026-09-08.md` — verified state of the actual codebase (36/100 maturity,
   26/78 capabilities confirmed).
2. `docs/Seedsapk/MVP-Plan-V3.md` — the validated MVP scope SchoolPortal was built against (six
   two-sprint plan, explicit inclusions/exclusions).
3. `SchoolPortal-Global-Competitor-Research-2026-09-08.md` — ten global school-platform leaders,
   36-category feature taxonomy, evidence-graded.

Published version (interactive): *(added after publish — see bottom of file)*

---

## 0. How to read this document

Every classification below is a judgment call built on the three source documents' verified evidence
— not new research, not speculation. Where the audit found a stub or mock, that is treated as
functionally **Missing** for prioritization purposes (a convincing UI over fake data does not reduce
engineering effort — the backend still has to be built), with a note that UI scaffolding exists and
can likely be reused.

---

## 1. The True Baseline

Merging the repo audit against the MVP plan's own scope. Six-value classification as requested:
**Already implemented** · **Partial** · **Weak implementation** · **Missing** · **Planned** ·
**Not relevant** (out of MVP/near-term scope entirely, e.g. items MVP-Plan-V3 explicitly excluded).

### Authentication & Identity

| Capability | Classification | Note |
|---|---|---|
| Login (email/GR-number + password) | Already implemented | |
| Password hashing, account lockout | Already implemented | |
| Deny-by-default RBAC | Already implemented | Genuine strength — server-enforced, not UI-hidden |
| JWT access tokens | Already implemented | 15-min TTL |
| Refresh-token rotation | Weak implementation | Token minted and stored; no `/auth/refresh` route redeems it — dead code, not a partial feature |
| Session persistence across restarts | Partial | Restores token, never checks/handles expiry |
| Forgot password | Missing | No route, no screen |
| General API rate limiting | Missing | Only per-account lockout exists |
| Parent profile/settings screen | Missing | |
| Staff/parent/student account creation (admin) | Missing | Only a seed script creates accounts today |

### School Structure & Admin CRUD

| Capability | Classification | Note |
|---|---|---|
| Multi-campus data model (Enrollment-based) | Already implemented | Load-bearing, not decorative — a real strength |
| Sections/Subjects (read API) | Already implemented | |
| Academic year/session | Weak implementation | Model + seed row only, no admin CRUD |
| School entity management | Weak implementation | Same pattern |
| Students/Parents/Teachers/Classes/Sections/Subjects admin CRUD | Missing | Dead nav anchors on every one |
| Campus management UI (switch/create) | Not relevant | Deliberately deferred per MVP-Plan-V3 |

### Attendance

| Capability | Classification | Note |
|---|---|---|
| Attendance marking (Teacher role) | Already implemented | e2e-tested, audit-logged |
| Attendance marking (Admin/Super Admin) | Weak implementation | Authorized by role but a lookup bug 404s in practice — a bug fix, not new scope |
| Attendance history/monthly summary | Already implemented | |
| Holiday handling | Weak implementation | Per-student-per-day only; no calendar-wide `Holiday` model |
| Staff (teacher) attendance | Missing | |
| Admin-side attendance reporting/export | Missing | |

### Timetable

| Capability | Classification | Note |
|---|---|---|
| Timetable read (parent) | Already implemented | |
| Timetable data model | Already implemented | |
| Timetable management (admin UI) | Weak implementation | API exists, no screen |
| Teacher's own timetable view | Missing | Dead nav anchor |
| Scheduling conflict detection | Missing | Named in-scope by the plan, not built |

### Academics

| Capability | Classification | Note |
|---|---|---|
| Class diary/homework | Already implemented | Full stack, correct Urdu RTL, e2e-tested |
| Formal assignments (submission/grading) | Not relevant | Not in MVP-Plan-V3 scope (static report-card PDF was the deliberate substitute) |
| Gradebook / live grading | Not relevant | Explicitly excluded from MVP by name |
| Report cards (static PDF upload/view) | Missing | In MVP-Plan-V3 scope, not built |

### Parent Experience

| Capability | Classification | Note |
|---|---|---|
| Multi-child switcher | Already implemented | |
| Home ("Today") dashboard | Already implemented | |
| Calendar (Timetable/Attendance/Diary) | Already implemented | |
| Circulars (read/unread, attachments) | Already implemented | Mislabeled "Notifications" in nav — a copy fix, not a feature gap |
| Fees (parent view) | Missing | Placeholder text only |
| Messaging (parent view) | Missing | Same placeholder |
| Push notifications | Missing | No FCM anywhere in either client |
| Offline tolerance | Missing | No caching layer at all |

### Communication

| Capability | Classification | Note |
|---|---|---|
| Announcements/circulars, delivery/read tracking | Already implemented | |
| Two-way messaging | Missing | Modeled, zero backend logic |
| WhatsApp channel | Not relevant (MVP) / Pakistan-specific opportunity | Explicitly deferred to Phase 2 by MVP-Plan-V3 — see §7 |

### Fees

| Capability | Classification | Note |
|---|---|---|
| Fee schema (structure/voucher/item/payment/allocation) | Planned | Genuinely thorough model, zero backend logic — schema is ahead of code |
| Fee computation (server-side) | Missing | |
| PDF voucher generation | Missing | No PDF library present |
| JazzCash/EasyPaisa payment | Missing | No gateway of any kind |
| Staff reconciliation UI | Weak implementation | Fully built UI, wired to mock data only — real head start on UX, zero backend behind it |

### Leave

| Capability | Classification | Note |
|---|---|---|
| Leave application (submit/approve/reflect on calendar) | Planned | Modeled with real FK constraints, zero module |

### Administration

| Capability | Classification | Note |
|---|---|---|
| Admin dashboard | Weak implementation | Real, well-built UI, 100% mock data |
| Users/roles management UI | Missing | RBAC is real server-side; no screen to administer it |
| Complaint/concern tracking | Missing | Not even in the schema, despite being named in MVP-Plan-V3 |

### Technical Infrastructure

| Capability | Classification | Note |
|---|---|---|
| Versioned REST API, DTO validation | Already implemented | |
| Database design | Already implemented | Normalized, iterated on for correctness |
| Postgres migration | Planned | Schema still targets SQLite |
| File storage abstraction | Already implemented | Swappable adapter, real strength |
| File-upload safety (size/MIME) | Missing | |
| Automated testing (3 apps) | Already implemented | 45+ real test files |
| CI/CD | Missing | Zero CI config anywhere |
| Audit logging (writes) | Partial | Real for 4 write actions; login isn't logged |
| Audit log viewer UI | Planned | Writes ship, no UI |

### Explicitly out of MVP scope (Not relevant — do not re-litigate)

Payroll, full accounting ERP, library, transport GPS/tracking, RFID/biometric attendance, canteen
cashless payments, AI tutor / AI-generated progress summaries, complex LMS/e-content, online
examinations, inventory/procurement/HR, custom drag-and-drop report builder, live gradebook, separate
parent web portal, separate Teacher/Admin portal apps, campus-switching UI. These were deliberately
cut from MVP-Plan-V3 and — per the competitor research (§7 of that document) — **none of the ten
global leaders reviewed build most of these either**, so this exclusion list is market-validated, not
just internally decided.

---

## 2. Features We Do NOT Need to Build

*(Mandatory section — prevents unnecessary redevelopment.)*

Functionality competitors offer where SchoolPortal's existing implementation is already adequate for
its target market. The gap here is **wiring/polish**, not architecture or rebuild:

| Competitor capability | Why SchoolPortal already has it adequately | What's actually left |
|---|---|---|
| Broadcast announcements (ClassDojo, ParentSquare, Alma) | Circulars is full-stack: scope, attachments, expiry, read/unread tracking, admin delivery stats | Rename the mislabeled "Notifications" nav slot; nothing structural |
| Attendance visibility for parents (ParentSquare's Attendance Plus, Brightwheel) | History/monthly summary API + parent calendar view already work end-to-end | Fix the Admin/Super-Admin marking bug (Tier 0); add calendar-wide Holiday model |
| Multi-child switching (table-stakes per competitor research §11) | Real, keyed re-fetch, works today | None |
| Role-based access architecture (vs. Schoology's thin admin surface, Remind's near-none) | Deny-by-default, server-enforced, genuinely tested | Just needs a management UI (Tier 1), not new architecture |
| Multi-campus / enrollment-history modeling | **Ahead of most competitors reviewed** — few of the ten model point-in-time campus/section transfer correctly; SchoolPortal fixed this bug in Sprint 6.5 | None — this is closer to a strength than a gap, see §9 |
| Homework/diary distribution (vs. Seesaw, Toddle's homework layer) | Full authoring + viewing loop with genuinely correct Urdu RTL, not a translated shell | None for MVP scope; grading/rubrics is Tier 3+, not a gap against MVP |
| File attachment infrastructure | Swappable `StorageAdapter`, tested | Add limits/MIME allowlist (Tier 0 hardening) — not a rebuild |
| One unified backend/client architecture (vs. PowerSchool/Schoology's post-acquisition stitching, which the market is now paying to *undo* via MyPowerHub) | Already the "one backend, two clients" shape the competitor research (§9) shows the market converging toward | None — this is a structural advantage to protect, not a gap to close |

**Net effect:** roughly a third of the 36-category competitor taxonomy is either already met or requires
wiring work already scoped elsewhere in this document (Tier 0/1), not new product design. The real gap
is concentrated in Fees, Messaging, Admin CRUD, and Notifications — confirmed independently by both the
audit and the competitor research's own "global table-stakes" list (§9 there).

---

## 3–4. Gap Register — Category × Severity

Combined per-gap table (severity: **Critical** — blocks commercial credibility · **High** — major
competitive disadvantage · **Medium** — important, not urgent · **Low** — nice-to-have ·
**Strategic** — potential differentiator/moat). Categories not listed below (Admissions, Analytics,
Integrations, Security, Performance, Scalability, UX/UI) are covered where a gap exists; empty
categories mean no material gap was found beyond what's already listed elsewhere.

| # | Gap | Category | Severity | Baseline status |
|---|---|---|---|---|
| 1 | No CI/CD — regressions merge undetected | Product / Engineering | Critical | Missing |
| 2 | Refresh-token loop incomplete — sessions silently 401 after 15 min | Product / Auth | Critical | Weak implementation |
| 3 | SQLite in production-bound codebase | Administration / Scalability | Critical | Planned |
| 4 | Admin/Super Admin cannot mark attendance (role bug) | Academic | Critical | Weak implementation |
| 5 | Every admin CRUD screen is a dead nav link | Administration | Critical | Missing |
| 6 | Fees: zero backend behind a fully-built UI | Finance | Critical | Missing/Planned |
| 7 | Messaging: zero backend, placeholder UI | Communication | Critical | Missing |
| 8 | Admin dashboard is 100% mock data | Administration / Analytics | Critical | Weak implementation |
| 9 | No push notifications in either client | Parent experience / Mobile | High | Missing |
| 10 | Unbounded file uploads (no size/MIME limit) | Security | High | Missing |
| 11 | Hardcoded JWT-secret fallback, no fail-fast | Security | High | Missing |
| 12 | Wide-open CORS | Security | High | Missing |
| 13 | No general rate limiting | Security | High | Missing |
| 14 | Teacher has no timetable or messaging surface (dead nav links) | Teacher experience | High | Missing |
| 15 | Leave application workflow entirely unbuilt | Academic / Product | High | Planned |
| 16 | No offline tolerance in parent app | Mobile / Performance | High | Missing |
| 17 | No forgot-password flow | Product / Security | High | Missing |
| 18 | Users/roles admin UI missing | Administration | Medium | Missing |
| 19 | Holiday handling is per-student, not calendar-wide | Academic | Medium | Weak implementation |
| 20 | Complaint/concern tracking not even modeled | Parent experience | Medium | Missing |
| 21 | Report cards (static PDF, MVP scope) not built | Academic | Medium | Missing |
| 22 | Audit log viewer UI missing (writes exist) | Administration | Medium | Planned |
| 23 | Login not audit-logged | Security | Medium | Partial |
| 24 | Cross-campus staff access has no scoping | Security | Medium | Missing |
| 25 | `onDelete` policy disagreement (`FeePaymentAllocation` vs `Receipt`) | Product / Technical debt | Medium | Missing |
| 26 | No scheduling-conflict detection in timetable | Academic | Low | Missing |
| 27 | No JazzCash/EasyPaisa/local-rail payment gateway | Finance / Pakistan | High | Missing |
| 28 | No WhatsApp channel | Communication / Pakistan | High | Not relevant to MVP / Pakistan-specific |
| 29 | No SMS fallback channel | Communication / Pakistan | Medium | Missing |
| 30 | No cash/manual-payment reconciliation workflow | Finance / Pakistan | High | Missing |
| 31 | No digest-style notification bundling | Communication / UX | Low | Missing |
| 32 | No AI-assisted drafting anywhere (circulars, diary, reports) | AI | Strategic | Missing |
| 33 | No predictive/early-warning analytics | Analytics / AI | Strategic | Missing |
| 34 | No admissions/lottery module | Admissions | Strategic | Missing |
| 35 | No EMI-style/installment fee collection | Finance | Strategic | Missing |
| 36 | No standards-based/mastery gradebook | Academic | Strategic (deliberately deferred, see Tier 4) | Not relevant (MVP) |

---

## 5. Feature Prioritization — Top 26 Opportunities

### Scoring methodology

Seven factors, each scored **1 (lowest) – 5 (highest)** against SchoolPortal's actual target market
(single-campus to small multi-campus Pakistani private schools), not a generic SIS market:

- **Business Value (BV)** — revenue/commercial-credibility impact.
- **User Value (UV)** — direct benefit to parents/teachers/admins.
- **Competitive Importance (CI)** — how much this closes a table-stakes gap or protects against being
  read as "behind" (per competitor research §9, §11).
- **Strategic Fit (SF)** — alignment with the recommended positioning (§8).
- **Engineering Effort (EE)** — 1 = trivial, 5 = very large; subtracted.
- **Technical Risk (TR)** — integration/uncertainty risk (external gateways, offline sync); subtracted.
- **Dependency Complexity (DC)** — how much other unbuilt work this needs first; subtracted at half
  weight since it's a sequencing modifier, not a primary value driver.

```
Priority Score = BV + UV + CI + SF − EE − TR − (DC × 0.5)
```

Range: −7 (worst) to +18 (best). **This model scores feature opportunities, not pure infrastructure
hardening.** Security/CI/DB-migration items (rate limiting, CORS, JWT fail-fast, CI/CD, Postgres
cutover) are excluded from this ranked list on purpose — they are non-negotiable Tier 0 prerequisites
regardless of score, not opportunities to be traded against feature value. They're listed in full in
§6 Tier 0.

### Ranked opportunities

| Rank | Opportunity | BV | UV | CI | SF | EE | TR | DC | **Score** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Admin CRUD: Students | 5 | 4 | 5 | 5 | 3 | 2 | 2 | **13.0** |
| 1 | Push notifications (FCM, both clients) | 4 | 5 | 5 | 4 | 2 | 2 | 2 | **13.0** |
| 3 | Fees module — backend (structure/voucher/compute) | 5 | 5 | 5 | 5 | 4 | 2 | 3 | **12.5** |
| 4 | Messaging module (two-way, server-scoped) | 4 | 5 | 5 | 4 | 3 | 2 | 2 | **12.0** |
| 5 | Admin CRUD: Parents | 4 | 3 | 4 | 4 | 2 | 1 | 2 | **11.0** |
| 5 | Admin CRUD: Teachers | 4 | 3 | 4 | 4 | 2 | 1 | 2 | **11.0** |
| 5 | Admin CRUD: Classes/Sections/Subjects | 4 | 3 | 4 | 4 | 2 | 1 | 2 | **11.0** |
| 5 | Real admin dashboard (wire to live data) | 4 | 3 | 4 | 4 | 2 | 1 | 2 | **11.0** |
| 5 | Fees staff-reconciliation UI → real backend | 4 | 3 | 3 | 4 | 1 | 1 | 2 | **11.0** |
| 10 | Fix Admin/Super-Admin attendance-marking bug | 3 | 4 | 3 | 3 | 1 | 1 | 1 | **10.5** |
| 10 | Report cards — static PDF upload/view (MVP scope) | 3 | 4 | 3 | 3 | 1 | 1 | 1 | **10.5** |
| 10 | SMS fallback channel | 3 | 4 | 3 | 5 | 2 | 2 | 1 | **10.5** |
| 13 | JazzCash/EasyPaisa payment gateway | 5 | 5 | 5 | 5 | 4 | 4 | 4 | **10.0** |
| 14 | Refresh-token flow + client-side 401 handling | 3 | 5 | 3 | 3 | 2 | 2 | 1 | **9.5** |
| 14 | Timetable management UI (admin) | 3 | 3 | 3 | 3 | 1 | 1 | 1 | **9.5** |
| 14 | Teacher's own timetable view | 2 | 4 | 3 | 3 | 1 | 1 | 1 | **9.5** |
| 17 | Fees PDF voucher generation | 3 | 3 | 3 | 4 | 2 | 1 | 2 | **9.0** |
| 17 | Leave application workflow (submit/approve/reflect) | 3 | 4 | 3 | 3 | 2 | 1 | 2 | **9.0** |
| 17 | WhatsApp integration | 4 | 4 | 3 | 5 | 3 | 3 | 2 | **9.0** |
| 20 | Offline caching (parent app) | 3 | 4 | 3 | 4 | 3 | 2 | 2 | **8.0** |
| 21 | Complaint/concern tracking | 2 | 3 | 2 | 3 | 1 | 1 | 1 | **7.5** |
| 21 | Forgot-password flow | 2 | 3 | 3 | 2 | 1 | 1 | 1 | **7.5** |
| 21 | Digest-style notification bundling | 2 | 3 | 3 | 3 | 2 | 1 | 1 | **7.5** |
| 21 | AI-assisted drafting (circulars/diary/report comments) | 3 | 2 | 3 | 4 | 2 | 2 | 1 | **7.5** |
| 25 | Predictive/early-warning analytics (attendance risk) | 3 | 2 | 3 | 4 | 3 | 3 | 2 | **5.0** |
| 26 | Admissions/lottery module with audit trail | 3 | 2 | 2 | 3 | 4 | 2 | 2 | **3.0** |

Read the score as sequencing guidance, not gospel — a handful of items cluster at 11.0 by design
(they're the same "admin CRUD" shape repeated across five entities and genuinely tie). Build order
within a tie should follow whichever entity the other four CRUD screens depend on for testing data
(Students and Classes/Sections first, in practice, since Parents/Teachers reference them).

---

## 6. Build Priority Tiers

### Tier 0 — Stabilization

Not opportunities — prerequisites. Ungated by the scoring model above; sequence first regardless.

- Stand up CI running all three test suites + lint + typecheck on every PR.
- Wire `POST /auth/refresh` with rotation-on-use + client-side 401→refresh-retry (or stop
  minting/storing tokens nothing redeems).
- Execute SQLite → PostgreSQL migration and a first staging deploy.
- Add file-upload MIME allowlist + size cap.
- Fail fast at boot if JWT secrets are unset outside `NODE_ENV=development`.
- Scope `?access_token=` query-param auth to the files route only.
- Add IP/route-level rate limiting.
- Fix the `markAttendance` Teacher-row lookup bug (Admin/Super Admin currently can't mark attendance).
- Fix the Accounts-role Circulars nav dead-end.
- Resolve the `FeePaymentAllocation` vs `Receipt` `onDelete` policy disagreement — **before** any Fees
  backend work begins on top of it.
- Add an `AuditLog` write on login (success and lockout).
- Fix `MeService.getChildrenForUser`'s unhandled crash path on zero-ACTIVE-enrollment students.
- Make the Diary attachment replace-on-edit path transactional.

### Tier 1 — Commercial Readiness

Required before any credible commercial pilot — closes the gaps that currently make SchoolPortal read
as "a foundation," not a product.

- Admin CRUD: Students, Parents, Teachers, Classes/Sections/Subjects.
- Timetable management UI (admin) + teacher's own timetable view.
- Real admin dashboard (replace `mockDashboard.ts` with live queries).
- Fees module: backend (structure/voucher/server-computed totals/PDF), wire the existing
  reconciliation UI to it.
- Messaging module: scoped two-way messaging, server-enforced recipient rules.
- Push notifications (FCM) with deep links, both clients.
- Leave application workflow (submit/approve/reflect on attendance calendar).
- Users/roles management UI.
- Forgot-password flow.
- Complaint/concern tracking (cheap, named explicitly in MVP-Plan-V3, currently not even modeled).

### Tier 2 — Growth

Improves adoption, retention, and per-school value once the Tier 1 baseline is credible.

- JazzCash/EasyPaisa payment gateway (Fees module's highest-leverage extension).
- Cash/manual-payment reconciliation workflow (most Pakistani private schools still take cash/bank
  deposit slips — a hybrid flow, not gateway-only).
- SMS fallback channel.
- WhatsApp integration.
- Offline caching (parent app) — cache last-loaded timetable/attendance/diary/circulars with a
  `Last updated:` timestamp.
- Report cards — static PDF upload/view (the MVP's deliberate, cheap substitute for a live gradebook).
- Calendar-wide Holiday model.
- Digest-style notification bundling (ParentSquare-pattern anti-fatigue).

### Tier 3 — Differentiation

Capabilities that can make SchoolPortal meaningfully better than competitors, not just at parity.

- AI-assisted drafting for circulars/diary/report-card comments — the Seesaw/Toddle pattern (AI cuts
  staff admin time), explicitly **not** shipped gated behind hardware the way Teachmint's EduAI is.
- Predictive/early-warning analytics on attendance and engagement — the Alma BeaconAI pattern, built
  on data SchoolPortal's schema already captures.
- EMI-style/installment fee collection — the single most directly transferable idea from the
  competitor research (Teachmint's TeachPay), adapted to JazzCash/EasyPaisa rails instead of UPI/eNACH.
- Admissions/lottery module with an audit trail — PowerSchool Enrollment's pattern, at a scope that
  fits a single school or small network rather than district-scale.
- Deepen the multi-campus enrollment model into a visible admin feature (reporting, cross-campus
  comparisons) — SchoolPortal's schema is already ahead here; this converts a backend strength into a
  user-facing one.

### Tier 4 — Defer

Explicitly not built yet, with reasons:

| Item | Why deferred |
|---|---|
| Full standards-based/mastery gradebook, formal exams/assessments | MVP-Plan-V3 deliberately substituted a static report-card PDF; a live gradebook is a Schoology/Toddle-scale investment with no evidence SchoolPortal's target segment (small private schools) needs it before Fees/Messaging/CRUD exist |
| Transport, Library, Canteen, Inventory, HR, Payroll | Excluded by MVP-Plan-V3 **and** independently market-validated: none of the ten global leaders researched build these as core product (competitor research §4, the "near-empty Campus operations band") |
| AI tutor / generative content for students | Explicitly excluded by MVP-Plan-V3; also the clearest "AI as press release, not product" trap the competitor research warns against (Teachmint's EduAI hardware-gating) |
| Campus-switching admin UI | Deliberately deferred by MVP-Plan-V3 — multi-campus already works as a schema property |
| Separate Teacher Portal / Admin Portal apps, separate parent web portal | The exact fragmentation the market (PowerSchool, Schoology, Remind/ParentSquare) is now paying multi-year integration cost to undo. Do not re-introduce it. |
| District-scale compliance reporting (Ed-Fi/SIF), 75+-integration marketplace | PowerSchool/Alma-tier enterprise capability; SchoolPortal's target customer (single school to small network) has no regulatory or procurement need for it yet |
| Custom drag-and-drop report builder | Named by Alma reviewers as a pain point even at enterprise scale (rigid, CSV-dependent complaints) — high effort, unproven demand at SchoolPortal's scale |
| RFID/biometric attendance, cashless canteen wallet | Excluded by MVP-Plan-V3; hardware-dependent, no evidence of demand ahead of the software layer being credible |

---

## 7. Pakistan-Specific Gap Analysis

| Item | Global requirement or Pakistan-specific? | Current status | Note |
|---|---|---|---|
| Urdu content support | Global requirement (localization is 2026 table-stakes per competitor research §11) | Already implemented | Diary entries render Urdu correctly |
| RTL rendering | Pakistan-specific opportunity (most global competitors only translate UI chrome, not content) | Already implemented, correctly | A real differentiator, not just parity — see §9 |
| English/Urdu bilingual UX | Pakistan-specific opportunity | Partial | Diary proven; not verified across every other screen |
| WhatsApp | Pakistan-specific opportunity | Missing (deliberately deferred to Phase 2) | No global leader in the research uses WhatsApp as a channel; Pakistani parent behavior strongly favors it over email/app-only |
| SMS | Global requirement (Remind proves SMS-first adoption at massive scale) + Pakistan-specific (uneven smartphone/data access) | Missing | Tier 2 |
| JazzCash | Pakistan-specific opportunity | Missing | No gateway of any kind exists today |
| Easypaisa | Pakistan-specific opportunity | Missing | Same |
| 1LINK | Pakistan-specific opportunity | Missing | Needed for bank-transfer/interbank reconciliation, not just wallet payment |
| Local banking / bank-deposit-slip fee payment | Pakistan-specific opportunity | Missing | No competitor in the research documents this pattern — global players assume card/ACH, Teachmint assumes UPI/digital-first |
| Cash fee workflows | Pakistan-specific opportunity | Weak implementation | `FeesView.vue`'s reconciliation-queue UI is a real head start, currently mock-only |
| Low bandwidth tolerance | Global requirement (reinforced Pakistan-specific) | Missing | No caching layer in either client |
| Android-heavy usage | Pakistan-specific (already accounted for) | Already implemented | Flutter, Android-first per MVP-Plan-V3, matches actual usage |
| Offline operation | Global requirement (table-stakes per competitor research §11) | Missing | Zero caching/sync layer |
| Multi-campus private schools | Pakistan-specific opportunity, and a strength | Already implemented | Genuinely ahead of most competitors reviewed — see §9 |
| Parent expectations (bilingual + WhatsApp-reachable + wallet-payable + cash-tolerant, simultaneously) | Pakistan-specific opportunity | Not met as a combination today | No single competitor profile in the research matches this combination — closest is Teachmint, and it's thin on analytics with AI gated behind hardware |
| School accounting workflows (manual ledgers alongside digital) | Pakistan-specific opportunity | Missing | Same reconciliation-UI head start as cash fees |
| Local reporting requirements | Not relevant at current target scale | Not relevant | Enterprise-style state/regulatory compliance reporting (PowerSchool's Ed-Fi/SIF) has no Pakistani-private-school-scale equivalent that SchoolPortal's target customer needs yet |

---

## 8. Strategic Positioning

### Recommendation: **Pakistan-first School Operating System, built around a Parent Super App core**

A hybrid of two of the candidate positions — **SIS + Parent Super App**, localized as **Pakistan-first
School OS** — rather than any single option on its own.

**Why not the others:**
- **Pure SIS / School ERP** (PowerSchool/Alma shape) — wrong market. That's an enterprise-district
  sales motion; SchoolPortal's target customer is a single school or small private network, the exact
  segment the competitor research flags as underserved by district-scale players.
- **Pure Parent Engagement Platform** (ClassDojo/Remind shape) — leaves the highest-scored
  opportunities (Fees, Admin CRUD, Messaging) stranded; those competitors deliberately don't build SIS
  depth, and SchoolPortal already has SIS-shaped foundations (Enrollment, RBAC, Prisma schema) that
  would go to waste.
- **Generic "School Operating System"** (Teachmint shape) without the Pakistan-first qualifier — loses
  the one clear, evidenced differentiation lever: correct bilingual content handling and local payment
  rails, which no competitor in the research — including Teachmint — has fully solved.

**Target customer:** single-campus to small multi-campus private K-12 schools in Pakistan — the same
profile MVP-Plan-V3 was written against (currently on a fragmented two-vendor setup, WhatsApp groups,
and manual/cash fee collection).

**Core problem:** fragmented parent-school communication and opaque, manual fee collection, with no
single source of truth for attendance, academics, or campus-level student history.

**Differentiation:**
- Genuinely correct bilingual (Urdu/English) content, not a translated UI shell.
- Local payment rails (JazzCash, EasyPaisa, 1LINK) plus a first-class cash/manual-reconciliation
  workflow — not a digital-only assumption.
- WhatsApp/SMS fallback channels for uneven connectivity.
- Real multi-campus enrollment-history modeling, already ahead of most reviewed competitors.
- Transparent, small-school-appropriate pricing against an enterprise market that defaults to opaque
  custom quotes (PowerSchool, Toddle, Alma).

**Competitive advantage:** SchoolPortal enters already unified — one backend, two clients — while the
market's biggest names (PowerSchool/Schoology, Remind/ParentSquare) are mid-multi-year efforts to undo
the fragmentation their own acquisitions created. Protecting that architectural choice is itself a
competitive advantage; see Tier 4.

**Product moat:** the combination is what's defensible, not any single feature — deep local
payment/reconciliation integration + correct bilingual UX + multi-campus enrollment correctness +
(longer-term) predictive analytics and AI drafting built on real usage data from schools no global
competitor is optimized to serve.

---

## 9. Final Gap Analysis

### Current Product Strengths
- Genuine, server-enforced RBAC and parent/student data isolation.
- Multi-campus, point-in-time `Enrollment` model — deliberately fixed in Sprint 6.5 after a real bug,
  not a hypothetical design.
- Full-stack diary/homework with correct Urdu RTL rendering (no auto-translation shell).
- Full-stack circulars with delivery/read tracking.
- 45+ real, DB-backed test files across all three codebases — unusual discipline this early.
- Swappable file-storage abstraction, already tested.
- One backend / two clients architecture, matching where the global market is now converging.

### Existing Competitive Advantages
- Multi-campus enrollment-history correctness — ahead of most of the ten competitors reviewed, several
  of which don't model campus/section transfer at all.
- Correct RTL/bilingual content handling — most global players (including PowerSchool's portal) only
  translate UI chrome, not content.
- Single unified architecture from day one, avoiding the "too many logins" problem competitors are
  paying years to undo.

### Critical Gaps
Fees (full stack), Messaging (full stack), every admin CRUD screen, real admin dashboard data, CI/CD,
refresh-token loop, Postgres migration, the Admin/Super-Admin attendance-marking bug.

### Major Gaps
Push notifications, file-upload/CORS/rate-limit hardening, teacher timetable/messaging surfaces, leave
applications, offline tolerance, forgot-password, local payment rails, cash-reconciliation workflow.

### Minor Gaps
Users/roles admin UI, holiday calendar model, complaint tracking, report-card PDF, audit-log viewer,
login audit logging, scheduling-conflict detection.

### False Gaps
Broadcast communication, parent-visible attendance, multi-child switching, RBAC architecture,
multi-campus modeling, homework distribution, file-attachment infrastructure, unified-backend
architecture — all already adequate; see §2 in full.

### Technical Gaps
No CI/CD, SQLite in a data-bearing codebase, unbounded uploads, hardcoded JWT fallback, wide-open CORS,
no rate limiting, `onDelete` policy disagreement, unhandled crash path in `MeService`, non-transactional
diary-attachment replace.

### UX Gaps
Dead nav anchors on every admin CRUD item and two teacher-side items; Accounts role bounced silently
off Circulars; Circulars mislabeled "Notifications," inviting confusion with the (unbuilt) push feature.

### Pakistan-Specific Opportunities
JazzCash/EasyPaisa/1LINK payment rails, cash/manual-reconciliation workflow, WhatsApp channel, SMS
fallback, and the combination of all of the above with bilingual correctness — a combination no
researched competitor, including the closest regional analog (Teachmint), currently matches.

### Strategic Opportunities
AI-assisted staff drafting (time-saving, not generative-for-its-own-sake), predictive/early-warning
analytics on attendance data already being captured, EMI-style fee installments, an audit-logged
admissions module scoped to single-school/small-network size.

### Features to Avoid
Gamified public behavior-points (privacy concerns even in source reviews), AI headline features gated
behind hardware, land-and-expand product fragmentation (separate portals/apps), opaque custom-quote
pricing, web-only with no native mobile app, and — the clearest cautionary tale in the research —
shipping without basic account-security hygiene (no-MFA support access, thin log retention) the way
PowerSchool's 2025 breach did, which SchoolPortal's own audit already flags analogous versions of
(hardcoded JWT fallback, wide-open CORS).

### Top 20 Post-MVP Features
In priority order (full scoring in §5): Admin CRUD (Students/Parents/Teachers/Classes), Push
notifications, Fees backend, Messaging module, real admin dashboard, Fees reconciliation UI wired live,
fix Admin attendance-marking bug, report-card PDF, SMS fallback, JazzCash/EasyPaisa gateway,
refresh-token loop, timetable management UI, teacher timetable view, Fees PDF voucher, leave
application workflow, WhatsApp integration, offline caching, complaint tracking, forgot-password,
digest notification bundling.

### Recommended Priority
Tier 0 stabilization first — full stop. Nothing in Tier 1 is trustworthy to build on top of a session
layer that silently breaks every 15 minutes or a database that isn't the one it'll actually ship on.
Then Tier 1 in the order §5 ranks it, with the five admin-CRUD screens built as one connected batch
since they share scaffolding. Fees and Messaging are the two highest-value items with no existing
backend at all — sequence them right after CRUD, since CRUD data (students, sections) is what Fees
vouchers and Messaging recipients are scoped against.

---

## If SchoolPortal shipped nothing except the top 10, which 10 create the largest jump in maturity and commercial value?

1. **CI/CD pipeline** — not a feature, but everything after it is untrustworthy without it.
2. **Refresh-token flow + 401 handling** — the single highest-impact fix to make "the app randomly
   breaks" stop being true.
3. **Fix the Admin/Super-Admin attendance-marking bug** — one line of real damage to the product's
   credibility relative to almost no effort to fix.
4. **Admin CRUD: Students, Parents, Teachers, Classes/Sections/Subjects** — the single largest gap
   between "a well-built foundation" and "a usable product"; nothing else in Administration works
   without it.
5. **Real admin dashboard (wire to live data)** — replaces the single most reputationally risky item in
   the whole audit: a convincing UI lying about real numbers.
6. **Fees module — backend + wire the existing reconciliation UI** — the schema and UI are already
   built; this is the highest business-value gap with the least design risk, since the shape is already
   proven by Teachmint/Brightwheel in the competitor research.
7. **Messaging module (two-way, server-scoped)** — competitor research's global table-stakes list
   names two-way messaging explicitly; SchoolPortal is currently a placeholder string away from it.
8. **Push notifications (FCM)** — named table-stakes by every competitor reviewed; currently absent
   from both clients entirely.
9. **JazzCash/EasyPaisa payment gateway** — the single most Pakistan-specific, most directly
   competitor-validated (Teachmint's TeachPay) high-leverage feature available.
10. **Postgres migration + first staging deploy** — the last blocker between "a repository" and
    "something a pilot school can actually be put on."

These ten close every Critical gap identified in §3–4, convert every "well-built shell over fake data"
finding in the repo audit into a real feature, and are the ten items every ranking method in this
document — baseline classification, false-gap exclusion, severity, and the numeric priority score —
converges on independently.

---

*Compiled 2026-09-08. Synthesizes `SchoolPortal-Repo-Audit-2026-09-08.md`,
`docs/Seedsapk/MVP-Plan-V3.md`, and `SchoolPortal-Global-Competitor-Research-2026-09-08.md`. No new
research performed — all classifications, scores, and tiers are judgment calls built transparently on
those three sources' already-verified evidence.*
