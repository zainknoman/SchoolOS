# SchoolPortal — Global Competitor Research

**Compiled 2026-09-08.** Companion document to `SchoolPortal-Repo-Audit-2026-09-08.md`.
Published version (interactive, with collapsible profiles and a scrollable matrix):
https://claude.ai/code/artifact/513ff059-2d0b-49c0-ace6-710627dfeb1a

Scope: ten global school-management / SIS / parent-engagement platforms, researched against a
standardized 36-category feature taxonomy, with every claim graded on an evidence-confidence ladder
(official source → app store/press → community). Unverifiable claims are marked **Unknown**, never
silently converted to "not supported."

---

## 1. Why these ten

The brief's seed list is a good starting basket. One swap was made — **TalkingPoints out, Teachmint
in** — because the market moved and because SchoolPortal's own geography changes what "relevant" means.

| Product | Why selected |
|---|---|
| **ClassDojo** | Largest install base in US elementary education; the benchmark for free, mass-scale, auto-translated broadcast communication. |
| **Seesaw** | Category-defining K-6 portfolio platform, and the clearest current example of AI cutting teacher admin time rather than replacing pedagogy. |
| **Remind** | Proof that a communication tool can win on zero-friction SMS-first adoption alone — relevant where smartphone/data access is uneven. |
| **ParentSquare** | Now owns Remind; the benchmark for unifying every family-facing channel into one system with digest-style anti-fatigue design. |
| **Brightwheel** | The billing/payments UX and daily-activity-feed benchmark, even though its early-childhood scope sits outside SchoolPortal's K-12 range. |
| **Toddle** | The strongest current example of a portfolio-to-report-card pipeline — exactly the gradebook/report-card layer SchoolPortal has not built. |
| **PowerSchool SIS** | The enterprise ceiling: compliance reporting, admissions/lottery workflows, and — after its 2025 breach — a live cautionary tale on security posture. |
| **Schoology** | PowerSchool's LMS pillar; the clearest reference for what a real standards-based gradebook looks like at scale. |
| **Alma** | A modern, well-reviewed SIS core with genuinely predictive analytics (BeaconAI) — and a public lesson in what happens when a strong web product ships no native app. |
| **Teachmint** | The closest regional and product analog to SchoolPortal itself: South Asian, mobile-first, parent app plus ERP, with a fee-collection fintech layer built for markets like Pakistan's. |

**Swap note:** No TalkingPoints/ParentSquare merger was found. ParentSquare *acquired Remind* in
November 2023; TalkingPoints remains a smaller, separately-run product outside this top-10 cut.
Teachmint fills the slot instead — a closer match on global-adoption-in-context, parent experience,
payments, and direct relevance to SchoolPortal's Pakistan market and mobile-first architecture.

---

## 2. Competitor profiles

Confidence tags: untagged = official-source/high confidence · `(med)` = app store/press/medium ·
`(low)` = community/secondary · `(unk)` = unverified, not found either way.

### ClassDojo — Parent engagement · Broadcast comms

- **Target market:** Primarily US K-8; 2026 roadmap explicitly extends into middle/high school.
- **Target school type:** Public/private K-12, plus a separate Pre-K–9 tutoring product (DojoTutor).
- **Core product:** Free whole-school communication + classroom-culture app — teacher↔parent
  messaging, class photo/video feed, behavior points, portfolios, school newsletters.
- **Signature features:** Real-time class photo/video feed; behavior points; newsletter builder with
  Canva embed; 190+ language auto-translation; new **ClassDojo Payments** (2026).
- **Parent experience:** Free app — photo/video updates, direct teacher messaging, event reminders,
  child portfolios. Consumer-facing only, no admin controls.
- **Teacher experience:** Post to class feed, 1:1 or broadcast message, schedule sends, set quiet
  hours, see read receipts, award points.
- **Admin experience:** School-wide broadcast across app/email/SMS/voice, newsletter tool, engagement
  analytics. District-level dashboards are a stated 2026 direction, not yet detailed `(med)`.
- **Student experience:** Portfolios, own behavior-point view; DojoTutor for supplemental tutoring.
- **Communication:** Core strength — 1:1/broadcast messaging, 190+ language auto-translation,
  scheduled sends, read receipts, quiet hours.
- **Academics:** Not found — no gradebook or grading system.
- **Attendance:** Marketing claim of "better attendance" tied to engagement; no dedicated module `(med)`.
- **Assessments:** Not found.
- **Fees/Payments:** New 2026 **ClassDojo Payments** embedded processor; scope undisclosed `(med)`.
- **Admissions:** Not found.
- **Events:** Calendar with automatic reminders in the parent feed.
- **PTM:** Unknown `(unk)`.
- **Reporting/Analytics:** Admin engagement analytics (family/teacher activity), not academic analytics.
- **Mobile apps:** iOS + Android, core to the product.
- **Web app:** Full teacher/parent dashboards at classdojo.com.
- **Integrations:** No SIS/LMS integration list found `(unk)`.
- **Automation:** Scheduled messages, auto-translation, AI-assisted newsletter design.
- **AI features:** Auto-translation is the primary AI-adjacent feature; no generative content tools found.
- **Notifications:** Push for messages, announcements, calendar reminders.
- **Offline:** Not found `(unk)`.
- **Multilingual:** Strong — automatic translation across 190+ languages.
- **Key strengths:** Ubiquity in US elementary schools, free core product, best-in-class translation
  reach, strong admin broadcast tooling.
- **Key weaknesses:** Reported crashes/delivery lag, time-consuming roster setup, some paywalled
  parent-facing upgrades, privacy concerns around public behavior callouts `(low)`.
- **UX strengths:** Simple, visual, positive-reinforcement-driven; low parent-side friction `(med)`.
- **Product philosophy:** "Trust first" — design for whole districts, equity by default, support every role.
- **Pricing:** Free core platform; optional paid family subscriptions; paid DojoTutor; new Payments
  product (take-rate undisclosed).

> **Worth learning:** mass-scale, multilingual, multi-channel broadcast with delivery confirmation —
> directly transferable to SchoolPortal's unbuilt Messaging module, minus the behavior-points
> gamification.

**Sources:** [classdojo.com/school-leaders](https://www.classdojo.com/school-leaders/) (official) ·
[2026 roadmap](https://essential.classdojo.com/whats-next-for-k-12-communication-a-first-look-at-classdojo-for-districts-2026-features/)
(official) · [Capterra reviews](https://www.capterra.com/p/124446/ClassDojo/reviews/) (community)

---

### Seesaw — Portfolio · AI teacher assist

- **Target market:** Primarily US elementary (K-6); 100+ language family communication suggests
  linguistically diverse districts as core buyer.
- **Target school type:** Elementary specifically — "purpose-built for K-6."
- **Core product:** Digital portfolio + multimodal assignment platform (draw/record/photo/video/text)
  plus two-way parent-teacher messaging.
- **Signature features:** Multimodal portfolios; AI "Smarter Activity Assistant" (lesson generation
  from files); "Show What You Know" AI-graded open response and reading-fluency assessment; "Mission
  Control" teacher dashboard.
- **Parent experience:** Two-way messaging in 100+ languages, real-time visibility into child's
  work/portfolio, progress reports.
- **Teacher experience:** Content authoring, AI lesson generation (up to 5 source files), auto-grading
  for formative work, AI newsletter generator, "Mission Control" homepage.
- **Admin experience:** Roster management, engagement analytics, class/school/district dashboards,
  access controls.
- **Student experience:** Multimodal work creation, portfolio built over time, simplified toolbar for
  younger students.
- **Communication:** Two-way parent-teacher messaging (100+ languages), AI-drafted newsletters.
- **Academics:** Assignment/lesson delivery with auto-graded formative work — not a full summative
  gradebook/report-card system `(med)`.
- **Attendance:** Not found — not positioned as an SIS.
- **Assessments:** "Show What You Know" (AI-graded, rubric-based) and AI-scored Reading Fluency
  Assessment; both consume metered "AI credits."
- **Fees/Payments:** Not found.
- **Admissions:** Not found.
- **Events:** Not explicitly documented beyond newsletter reminders `(unk)`.
- **PTM:** No dedicated scheduling tool found `(med)`.
- **Reporting/Analytics:** Class/school/district dashboards, admin engagement analytics, parent
  progress reports.
- **Mobile apps:** iOS + Android — separate "Seesaw Class" and "Seesaw Family" apps.
- **Web app:** Chrome, Firefox, Edge supported.
- **Integrations:** Schoology, Canvas, Google Classroom, Microsoft SSO.
- **Automation:** AI lesson/activity generation, auto-grading, auto-captioning, AI newsletter drafting.
- **AI features:** Current market differentiator — Smarter Activity Assistant, Generative Voice, free
  auto-captioning, AI auto-grading, AI newsletters.
- **Notifications:** Standard push/in-app for messages and portfolio activity `(med)`.
- **Offline:** Not found `(unk)`.
- **Multilingual:** 100+ languages for family communication; some lesson content in five languages.
- **Key strengths:** Deep multimodal-portfolio paradigm for early learners; aggressive AI
  teacher-time-saving tools; strong LMS integrations.
- **Key weaknesses:** Reported bugginess, admin UX not fully user-friendly, folder/organization pain
  points, premium tier seen as pricey, free tier limited `(low)`.
- **UX strengths:** Purpose-built simplicity for young children; "Mission Control" reduces teacher
  cognitive load `(med)`.
- **Product philosophy:** Portfolio-first, multimodal expression over text, increasingly AI-augmented
  to cut teacher workload.
- **Pricing:** Schoolwide subscription, roughly $2–5/student/year `(med)`; Starter free tier being
  scaled back; individual "Seesaw Plus" at $120/year.

> **Worth learning:** AI used to cut teacher administrative burden rather than the full
> multimodal-portfolio paradigm, which fits early-childhood better than SchoolPortal's broader K-12 scope.

**Sources:** [seesaw.com/whats-new](https://seesaw.com/whats-new/) (official) ·
[seesaw.com all-in-one-platform](https://seesaw.com/products/all-in-one-platform/) (official) ·
[Common Sense Education](https://www.commonsense.org/education/articles/teachers-essential-guide-to-seesaw) (secondary)

---

### Remind — SMS-first · Owned by ParentSquare

> **Ownership note:** Wholly owned by ParentSquare since November 2023 — not merged with TalkingPoints.
> Its free Chat product runs standalone; the paid "Remind Hub" tier is being discontinued after the
> 2026-27 school year, with customers migrated to ParentSquare.

- **Target market:** Individual teachers/classrooms on the free tier (no district procurement needed);
  a legacy paid district tier (Remind Hub) is sunsetting.
- **Target school type:** K-12, any type — used in over 80% of US public schools, 60% of US teachers
  (as of the 2023 acquisition).
- **Core product:** Remind Chat — free, two-way SMS/app messaging without exposing phone numbers.
- **Signature features:** Number-masked two-way texting; join-by-code class groups; automatic
  translation; scheduled messages; message-history export.
- **Parent experience:** Receive/reply by text or app without sharing a personal number; join a class
  group via code; no login required for SMS-only use.
- **Teacher experience:** Up to 10 free classes, unlimited recipients per group, scheduled messages,
  availability-boundary signaling, co-teacher groups.
- **Admin experience:** Minimal on free Chat; the paid Hub tier added an admin role and district
  broadcast — now folding into ParentSquare.
- **Student experience:** Can be included as direct message recipients, not just parents `(med)`.
- **Communication:** Two-way texting, app push, in-app chat; voice clips (rolling into ParentSquare).
- **Academics:** None — communication-only.
- **Attendance:** Not part of free Chat; existed only in the paid Hub `(med)`.
- **Assessments:** Not found.
- **Fees/Payments:** Basic fund collection for supplies/events, small per-transaction fee `(med)`.
- **Admissions:** Not found.
- **Events:** Not documented for the free tier `(unk)`.
- **PTM:** Meeting scheduling existed in the paid Hub tier `(med)`.
- **Reporting/Analytics:** Read receipts on the free tier; deeper analytics were Hub-only.
- **Mobile apps:** iOS + Android, well-established, high install base.
- **Web app:** Browser access confirmed.
- **Integrations:** Not documented `(unk)`.
- **Automation:** Scheduled messages only.
- **AI features:** None found — AI investment sits on the ParentSquare side.
- **Notifications:** SMS + push, real-time.
- **Offline:** Works over plain SMS regardless of app/data connectivity — an offline-tolerant design choice.
- **Multilingual:** Automatic translation into the recipient's preferred language.
- **Key strengths:** Frictionless adoption, huge installed base, privacy-preserving number masking,
  free forever for individual teachers.
- **Key weaknesses:** Character-limited messages, unclear recipient visibility per some reviews, no
  academic/attendance/fee depth, Hub discontinuation causing district migration disruption `(low)`.
- **UX strengths:** Extremely low-friction onboarding, works over plain SMS.
- **Product philosophy:** Communication only, radically simple, bottom-up adoption `(med)`.
- **Pricing:** Chat free/unlimited; Hub paid, being wound down in favor of ParentSquare.

> **Worth learning:** join-by-code onboarding and a genuine SMS fallback — not just an app — for a
> market where not every parent has reliable smartphone data.

**Sources:** [remind.com/teachers](https://www.remind.com/teachers) (official) ·
[Businesswire acquisition release](https://www.businesswire.com/news/home/20231201458293/en/Serent-Backed-ParentSquare-Acquires-Remind-to-Increase-Student-Success-Through-Expanded-Communications-Platform) ·
[District Hub-sunset notice](https://zacharyschools.org/2026/07/16/parentsquare-replaces-remind-for-the-2026-2027-school-year/) (secondary)

---

### ParentSquare — Unified district engagement

- **Target market:** District/school paid procurement — 42,000+ schools across all 50 US states,
  ~40% of US families; scales from 400-student schools to 100,000+-student districts.
- **Target school type:** K-12 public districts primarily, also private/charter.
- **Core product:** Unified school-home engagement — messaging + forms + attendance outreach +
  payments + websites + analytics in one system.
- **Signature features:** 190+ language two-way translation; multi-channel "100% contactability"
  messaging (SMS/app/email/voice fallback); ParentSquare Intelligence (AI layer, March 2026);
  Attendance Plus; Virtual Phone; ADA-compliant district websites.
- **Parent experience:** App/web/SMS/email with daily-digest bundling to cut alert fatigue;
  StudentSquare companion app; forms/e-signatures, event RSVPs, volunteer sign-ups.
- **Teacher experience:** Classroom/group messaging, conference scheduling, direct messaging;
  Remind-derived features (voice clips, unlimited-recipient groups) merging in.
- **Admin experience:** District-wide mass alerts, contactability/reach dashboards, engagement
  analytics, Virtual Phone staff-number management.
- **Student experience:** Dedicated StudentSquare app `(med)`.
- **Communication:** Two-way messaging across SMS/app/email, mass alerts, secure document delivery,
  community groups.
- **Academics:** Not present — engagement layer only.
- **Attendance:** Attendance Plus — absence reporting, multilingual absence workflows,
  early-intervention alerts, attendance analytics.
- **Assessments:** Not found.
- **Fees/Payments:** Integrated fee/fundraising/event payment collection.
- **Admissions:** Not found `(unk)`.
- **Events:** RSVPs and volunteer-management workflows.
- **PTM:** Conference/PTC scheduling built into the digital forms/workflow suite.
- **Reporting/Analytics:** Communication-reach metrics, engagement analytics, attendance dashboards,
  plus AI-surfaced recommended actions via ParentSquare Intelligence.
- **Mobile apps:** iOS/Android, self-reported 4.5+ stars; separate StudentSquare app `(med)`.
- **Web app:** Full web app plus a separate ADA-compliant district/school website product.
- **Integrations:** Not detailed beyond a "contact data accuracy" AI feature `(unk)`.
- **Automation:** Announced but not fully shipped (March 2026): automated attendance workflows,
  account-security monitoring `(med)`.
- **AI features:** **ParentSquare Intelligence** — analyzes messaging, engagement, attendance,
  payments, and contact-data health to surface recommended actions; AI Assistant for district
  websites; AI "Conversation Starters"; roadmap includes chronic-absenteeism early-warning.
- **Notifications:** SMS/app/email/voice cascade with daily-digest bundling.
- **Offline:** Not found `(unk)`.
- **Multilingual:** Automatic two-way translation across 190+ languages — the platform's most heavily
  marketed differentiator.
- **Key strengths:** Broad "one platform" district positioning; very large installed base (amplified
  by the Remind acquisition); heavy translation investment; actively shipping AI.
- **Key weaknesses:** No visible academic/LMS depth (by design); custom-quote pricing opacity; AI
  layer is very new, maturity unproven.
- **UX strengths:** Daily-digest notification bundling against alert-firehose fatigue.
- **Product philosophy:** Unify every family-facing channel into one district system, with AI
  increasingly automating contactability, attendance risk, and translation `(med)`.
- **Pricing:** Per-student annual licensing from roughly $3,000/year for up to 600 students, plus a
  one-time onboarding fee scaled to enrollment; parent company PSQ Holdings is public (SEC filer).

> **Worth learning:** digest-style notification bundling and treating two-way translation as core
> infrastructure — not a future nice-to-have.

**Sources:** [ParentSquare acquisition announcement](https://www.parentsquare.com/blog/parentsquare-acquires-remind-expanding-options-for-school-home-engagement/) (official) ·
[ParentSquare Intelligence launch](https://www.prnewswire.com/news-releases/parentsquare-launches-parentsquare-intelligence-embedding-ai-and-data-intelligence-layer-across-the-school-home-engagement-platform-302703701.html) (press) ·
[PSQ Holdings SEC filing](https://www.sec.gov/Archives/edgar/data/1847064/000121390024022353/ea020160001ex99-1_psqhold.htm)

---

### Brightwheel — Early childhood · Billing UX

- **Target market:** US-centric (Canadian PAD support noted); "most-used childcare software in the
  US," 150,000+ programs, millions of parents.
- **Target school type:** Early childhood / daycare / preschool / in-home childcare / camps &
  after-school — not K-12.
- **Core product:** All-in-one childcare management — attendance/check-in, billing, daily activity
  reporting, family messaging, light curriculum tools.
- **Signature features:** Real-time daily activity feed (meals, naps, diapers, photos/video);
  integrated billing/autopay; QR/PIN/e-signature check-in.
- **Parent experience:** Free for all parent-facing features regardless of the school's plan tier `(med)`.
- **Teacher experience:** Daily-sheet/activity logging praised; reviewers report limited
  lesson-planning depth and friction moving students between rooms `(med)`.
- **Admin experience:** Enrollment forms with e-signature + fees, staff timecards synced to payroll,
  staff scheduling, multi-location role-based permissions, subsidy-fund tracking, customizable reports.
- **Student experience:** No dedicated student-facing surface `(unk)`.
- **Communication:** In-app family/staff messaging, SMS/mobile emergency alerts, event scheduling.
- **Academics:** Custom lesson planning, or a paid "Experience Curriculum" upsell with
  state/DRDP learning standards.
- **Attendance:** QR/e-signature/PIN check-in, health screening, real-time room ratios,
  authorized-pickup lists, licensing-ready reports.
- **Assessments:** Not exam-based; closest equivalent is developmental progress reporting `(med)`.
- **Fees/Payments:** ACH/card/check/Canadian PAD, autopay, recurring/multi-payer invoicing,
  subsidy-agency tracking, self-serve tax statements, QuickBooks export. Reviewers report a disliked
  card fee and difficult cancellation flow `(low)`.
- **Admissions:** Enrollment forms with e-signature, document requests, application fees, waitlist mgmt.
- **Events:** Event scheduling with sign-up forms.
- **PTM:** No dedicated feature found `(unk)`.
- **Reporting/Analytics:** Customizable attendance/billing reports, CACFP meal-reimbursement
  reporting, expense tracking, real-time cash-flow dashboards.
- **Mobile apps:** iOS + Android — the primary interface.
- **Web app:** Admin/staff dashboard for billing and reports `(med)`.
- **Integrations:** QuickBooks Online confirmed; no broader marketplace found `(med)`.
- **Automation:** Automated recurring invoicing/reminders, self-serve tax statements, payroll-synced
  timecards.
- **AI features:** None found.
- **Notifications:** Real-time dashboard updates, SMS/mobile emergency alerts.
- **Offline:** Not documented `(unk)`.
- **Multilingual:** English/Spanish UI toggle for guardians (web + mobile) and staff (mobile only);
  in-app Messaging text is **not** translated even when the UI is set to Spanish.
- **Key strengths:** Category-defining daily-activity-log UX; low-friction billing/autopay; strong
  admissions/enrollment workflow.
- **Key weaknesses:** Disliked cancellation flow, card-fee friction, limited lesson-planning depth,
  opaque quote-only pricing `(low)`.
- **UX strengths:** Real-time photo/video-rich daily feed is the most consistently praised element.
- **Product philosophy:** Consolidate early-childhood operational/emotional needs into one app, free
  for parents, paid by the childcare business.
- **Pricing:** Freemium; paid Premium is quote-only. Estimates: ~$15–25/month base + ~$2–3/child/month,
  plus 2.9%+$0.30 processing `(med)`.

> **Worth learning:** multi-payer invoice splitting, autopay, self-serve receipts, and a real-time
> balance dashboard — the transferable shapes for SchoolPortal's fees module, with local payment
> rails substituted for Brightwheel's ACH/card.

**Sources:** [mybrightwheel.com/features](https://mybrightwheel.com/features/) (official) ·
[mybrightwheel.com billing](https://mybrightwheel.com/features/billing/) (official) ·
[Brightwheel help center — language](https://help.mybrightwheel.com/en/articles/11409039-change-your-language) (official)

---

### Toddle — AI-first LMS · IB/international

- **Target market:** International/independent schools with strong IB (PYP/MYP/DP) specialization;
  claims 30,000+ educators across 1,000+ schools.
- **Target school type:** K-12 independent/international schools, with dedicated IB MYP/PYP tracks.
- **Core product:** Unified LMS — curriculum planning, portfolios, assessment, gradebook, report
  cards, family communication, pastoral care in one platform.
- **Signature features:** AI-assisted curriculum planning (50+ templates, 200+ standards libraries);
  portfolio-to-report-card pipeline; accreditation-mapping (IB, NEASC, NAEYC, KHDA).
- **Parent experience:** Toddle Family app — learning-evidence view, announcements/notifications/
  messages, school calendar/policies, 1:1 teacher messaging.
- **Teacher experience:** AI-assisted lesson planning, assessment generation, and report-writing
  (claimed to cut report time "to minutes"); integrated attendance/gradebook/portfolio. Mobile app
  reported less robust than Google Classroom `(low)`.
- **Admin experience:** Communications-hub monitoring dashboard, accreditation-checklist management,
  behavior/incident pattern analytics.
- **Student experience:** Dedicated Toddle Student app for assessment submission and portfolio
  contribution; one reviewer flagged assessment-security concerns `(low)`.
- **Communication:** 1:1 messaging, channels, announcements; AI-generated conversation summaries and
  smart-reply suggestions; admin oversight dashboard.
- **Academics:** Core strength — curriculum mapping, yearly plans, unit design, standards libraries,
  integrated timetable/calendar.
- **Attendance:** Flexible daily, per-period, and rotation-cycle tracking, integrated with timetable.
- **Assessments:** Standards-based or score-based grading, AI-generated differentiated assessments,
  rubrics/checklists, multi-format submissions.
- **Fees/Payments:** Not found — no billing module anywhere; a genuine scope gap `(unk)`.
- **Admissions:** Not found `(unk)`.
- **Events:** No dedicated feature beyond the shared school calendar `(unk)`.
- **PTM:** No dedicated workflow; video-call integrations (Zoom, Meet, Teams) exist at class-ops level `(med)`.
- **Reporting/Analytics:** Behavior/incident pattern analytics, accreditation alignment monitoring,
  customizable report-card templates with embedded portfolio evidence.
- **Mobile apps:** Three apps — Family, Educator, Student — iOS + Android. Reviewers report
  offline-detection bugs and a weaker mobile experience than web `(low)`.
- **Web app:** Primary surface for educators/admins.
- **Integrations:** Zoom, Google Meet, Microsoft Teams; Google Drive/OneDrive for submissions.
- **Automation:** AI-drafted progress reports, worksheets/assessments, lesson ideas, incident reports,
  comment/announcement generation.
- **AI features:** "Toddle AI" general teaching assistant across planning/assessment/reporting/
  communication; "AI Tutors" for personalized student learning.
- **Notifications:** Announcements surfaced in the Family app; no push-technology detail found `(med)`.
- **Offline:** Not a documented feature; reviewers report offline-detection bugs `(low)`.
- **Multilingual:** No official documentation found `(unk)`.
- **Key strengths:** Deep IB/international-curriculum alignment; genuinely integrated
  portfolio-to-report-card pipeline; broad AI coverage; accreditation-mapping reduces compliance work.
- **Key weaknesses:** No fees/billing, admissions, or PTM-scheduling modules; mobile-app quality
  complaints; opaque custom-quote pricing.
- **UX strengths:** Reviewers cite ease of navigation and a friendly AI-assistant experience `(med)`.
- **Product philosophy:** Replace a fragmented curriculum/gradebook/portfolio/communication stack
  with one AI-native platform built around IB and inquiry-based pedagogy.
- **Pricing:** Three custom-quoted tiers (Planning Pro, Essentials, Ultimate) `(med)`.

> **Worth learning:** the portfolio-to-report-card pipeline is the strongest reference for the
> report-card/grading layer SchoolPortal doesn't have at all. Its scope gap (no fees, no admissions,
> no PTM) is a useful negative signal too — those are where a full SIS must differentiate.

**Sources:** [toddleapp.com product overview](https://www.toddleapp.com/product/product-overview/) (official) ·
[toddleapp.com curriculum planning](https://www.toddleapp.com/product/curriculum-planning/) (official) ·
[G2 reviews](https://www.g2.com/products/toddle/reviews) (community)

---

### PowerSchool SIS — Enterprise SIS · District compliance

- **Target market:** K-12 districts, primarily US/Canada — 5,300+ districts, 17M+ students,
  compliance reporting across 56 states/provinces.
- **Target school type:** Large public districts and multi-school systems needing state/provincial
  compliance reporting — not sized for small independent or single-campus schools.
- **Core product:** Centralized SIS — enrollment, scheduling, attendance, grading data-of-record,
  state reporting, family portal.
- **Signature features:** PowerTeacher Pro gradebook (standards-based + traditional); deep
  state/provincial compliance reporting (Ed-Fi, SIF); MyPowerHub unified family communications hub (2024).
- **Parent experience:** Parent/Student Portal — real-time attendance, grades, assignment detail,
  bulletins, teacher messages, consolidating into MyPowerHub. Spanish/Vietnamese toggle is UI-chrome
  only, not full data translation.
- **Teacher experience:** PowerTeacher Pro for grades/attendance/assignments.
- **Admin experience:** Ad hoc reporting on attendance, behavior, health, graduation progress,
  demographics; custom fields. Reviewers describe it as powerful but complex — "onerous," dated UI,
  slow support turnaround `(med)`.
- **Student experience:** Same portal as parents, student-scoped.
- **Communication:** SchoolMessenger integration for broadcast/bulletins, folding into MyPowerHub.
- **Academics:** Standards-based and traditional grading via PowerTeacher Pro; deeper curriculum/LMS
  depth lives in the separate Schoology product.
- **Attendance:** Core module, feeds the family portal and admin reporting.
- **Assessments:** Not native to SIS; depth comes via companion Performance Matters.
- **Fees/Payments:** Fee/meal-fund collection in the mobile app; registration fees via Vanco
  integration in the separate Enrollment product.
- **Admissions:** Separate **PowerSchool Enrollment** product — SIS-agnostic lottery/school-choice
  management, customizable application forms, audit-logged tamper-proof lottery fairness, Vanco
  registration payments.
- **Events:** Not found `(unk)`.
- **PTM:** Not found `(unk)`.
- **Reporting/Analytics:** Ad hoc customizable reporting; separate Analytics & Insights / Connected
  Intelligence products in the broader portfolio.
- **Mobile apps:** PowerSchool Mobile, 20M+ active users, ~4.6/5 rating; recurring complaints of
  double sign-in, slow refresh, post-reinstall crashes `(med)`.
- **Web app:** Full web portal — the primary interface.
- **Integrations:** 75+ certified integrations; Ed-Fi and 1EdTech (OneRoster) standards.
- **Automation:** Compliance-reporting automation; lottery/enrollment workflow automation `(med)`.
- **AI features:** **PowerBuddy** family — for Assessment (AI item generation, rubric auto-scoring),
  for Engagement (conversational family assistant in MyPowerHub), for Learning (in Schoology). Live
  in 3,000+ schools, 80,000+ teachers; content filtering built on AWS SageMaker.
- **Notifications:** Real-time via SchoolMessenger/MyPowerHub.
- **Offline:** Not found `(unk)`.
- **Multilingual:** Portal: Spanish/Vietnamese UI chrome only. Mobile app: English/French/Spanish.
  "Fully translated" Spanish experience announced for late-2024 rollout `(med)`.
- **Key strengths:** Compliance-reporting depth at multi-district scale; extensive integration
  ecosystem; mature gradebook; proven at 17M+ student volume.
- **Key weaknesses:** Dated/complex UI, slow vendor responsiveness. **Material finding:** a 2025
  breach — compromised support-portal credentials (no MFA, an always-on remote-maintenance tool, weak
  log retention) — exposed data on approximately 62M students; PowerSchool paid a $2.85M ransom,
  followed by ongoing extortion attempts against individual districts into May 2025.
- **UX strengths:** MyPowerHub is an explicit consolidation attempt against "too many separate logins."
- **Product philosophy:** Enterprise "Unified Classroom"/"Product Cloud" — SIS as system-of-record hub
  with specialized products plugged in, unified by cross-product AI. Land-and-expand enterprise sales.
- **Pricing:** Custom per-district quotes; unconfirmed analyst estimates ~$3–8/student/year core SIS,
  total contracts $20K–$300K+ plus 15–25% first-year implementation `(low)`.

> **Cautionary benchmark:** the PowerSchool breach failure class — support-portal credential without
> MFA, always-on remote-access tool, thin log retention — is precisely the shape of gap SchoolPortal's
> own audit already flags (hardcoded JWT fallback, wide-open CORS, no rate limiting). At enterprise
> scale, exactly this pattern became a 62M-record breach.
>
> **Worth learning (positive):** PowerSchool Enrollment's lottery/audit-log workflow is the clearest
> "what a mature admissions module looks like" reference — SchoolPortal has zero admissions today.

**Sources:** [powerschool.com SIS](https://www.powerschool.com/products/student-information/sis/) (official) ·
[powerschool.com Enrollment](https://www.powerschool.com/products/student-information/enrollment/) (official) ·
[Security.org breach analysis](https://www.security.org/identity-theft/breach/powerschool/) ·
[TechTarget breach explainer](https://www.techtarget.com/whatis/feature/PowerSchool-data-breach-Explaining-how-it-happened)

---

### Schoology — PowerSchool Learning Management

> **Relationship note:** Acquired by PowerSchool in 2019, now sold as "PowerSchool Schoology
> Learning" — the LMS pillar of PowerSchool's Unified Classroom, sharing PowerBuddy AI and MyPowerHub
> with the SIS product above. Not an independent competitor today, but distinct enough in scope and
> reviewer sentiment to profile separately.

- **Target market:** K-12 districts, US-centric with international presence — 4,000+ organizations,
  7M+ students supported.
- **Target school type:** Same large-district profile as PowerSchool SIS; spans elementary through
  graduation, with a simplified "Elementary Experience" mode.
- **Core product:** Cloud LMS — course content, assignments, assessments, discussions, grading,
  standards-mastery tracking, in one hub.
- **Signature features:** Standards-based mastery gradebook with dashboard tracking; conditional
  assignment release by performance grouping; course templates + lesson planner; deep LTI/OneRoster
  interoperability (works atop any SIS).
- **Parent experience:** Family accounts give real-time assignment/progress visibility and can join
  course groups; no distinct parent mobile app detail found separate from PowerSchool Mobile `(med)`.
- **Teacher experience:** Single hub reducing duplicate data entry — 186M assignments delivered
  platform-wide; PowerBuddy AI assists content ideation; lesson planner and reusable templates.
- **Admin experience:** Standards passback to PowerSchool SIS and Performance Matters for unified
  reporting; no dedicated admin-dashboard detail found beyond this `(unk)`.
- **Student experience:** Assignment/discussion participation (4M discussions facilitated); PowerBuddy
  AI conversational tutor personalized to the student.
- **Communication:** Course discussions and groups; broader messaging routed through SchoolMessenger
  at the ecosystem level.
- **Academics:** Core strength — full content delivery, standards-based grading, mastery dashboards,
  tech-enhanced assessment items via PowerBuddy for Assessment.
- **Attendance:** Not native — lives in PowerSchool SIS, with data passback.
- **Assessments:** Robust tech-enhanced item tools; deeper assessment strategy via Performance
  Matters; PowerBuddy adds AI item generation and rubric-based auto-scoring.
- **Fees/Payments:** Not found — out of scope for an LMS.
- **Admissions:** Not applicable.
- **Events:** Not found `(unk)`.
- **PTM:** Not found `(unk)`.
- **Reporting/Analytics:** Standards-mastery dashboards, feeding PowerSchool's Analytics & Insights /
  Connected Intelligence at the portfolio level.
- **Mobile apps:** A Schoology mobile app exists; reviewers report occasional crashes and unclear
  in-app alerts `(low)`.
- **Web app:** Primary interface; reviewers repeatedly call the UI "completely out of date," with
  nested folders making things hard to find `(med)`.
- **Integrations:** LTI integration with edtech assessment tools; OneRoster 1.2 (works with
  non-PowerSchool SIS too); deep tie-in across the PowerSchool product family.
- **Automation:** Conditional/adaptive assignment release by performance grouping `(med)`.
- **AI features:** PowerBuddy for Learning — teacher-side content generation, student-side
  conversational AI tutor.
- **Notifications:** Built-in calendar/notification system for deadlines; reviewers note alert-clarity
  issues `(med)`.
- **Offline:** Not found `(unk)`.
- **Multilingual:** Not found for Schoology specifically, distinct from the SIS portal's documented
  Spanish/Vietnamese/French support `(unk)`.
- **Key strengths:** Deep standards-based mastery tracking; strong LTI/OneRoster interoperability;
  heavy real-world usage scale.
- **Key weaknesses:** Consistently criticized UI ("completely out of date," "not intuitive");
  reliability complaints; community concern that Schoology may be under-maintained now that
  PowerSchool has its own competing branding and Product Cloud direction `(med)`.
- **UX strengths:** LockDown Browser integration for secure testing; strong Google Classroom-style
  integration reduces teacher multi-tool friction.
- **Product philosophy:** LMS-of-record for the "learning" layer, decoupled from any single SIS via
  OneRoster — though PowerSchool's roadmap increasingly pairs it with PowerSchool SIS/PowerBuddy.
- **Pricing:** Not publicly listed; unconfirmed analyst estimate ~$2–5/student/year as an SIS
  add-on `(low)`.

> **Worth learning:** the mastery-based gradebook and standards-passback design is the strongest
> reference for a real gradebook/report-card system, which SchoolPortal currently has none of. The
> SIS-agnostic LTI/OneRoster architecture is far beyond SchoolPortal's current single-backend scope.

**Sources:** [powerschool.com Schoology Learning](https://www.powerschool.com/products/classroom/learning-management/) (official) ·
[Capterra reviews](https://www.capterra.com/p/128481/Schoology/reviews/) (community)

---

### Alma — Modern SIS · Predictive analytics

- **Target market:** US-centric — public districts (large 25K+, midsize 3–25K, small <3K),
  charter/independent schools, school networks, state education agencies; claims 6M+ students across
  44 US states and 61 countries (vendor claim, unverified independently) `(med)`.
- **Target school type:** K-12, district and multi-campus/network scale, general-purpose.
- **Core product:** SIS-first platform (attendance, grading, report cards, scheduling, records,
  family messaging) with LMS integration layered on top rather than built in.
- **Signature features:** **BeaconAI** — predictive analytics across attendance, enrollment, grading,
  engagement, behavior; a "Spreadsheet Data Editor" for bulk admin ops, user-praised; 125+ prebuilt
  integrations.
- **Parent experience:** Family portal with electronic report cards, engagement dashboard, real-time
  progress, fee-management access, messaging. **No native mobile app** — web/responsive only `(med)`.
- **Teacher experience:** Human-readable + competency-based gradebook, custom rubrics, calculated
  roll-up grades, missing-assignment tracking, seating charts, teacher-to-student messaging.
- **Admin experience:** District/school and state compliance reporting, scheduling/enrollment
  oversight, incident tracking with heat maps, bulk data editing, cross-district validation.
- **Student experience:** Student portal implied by product copy; no distinct feature detail found `(low)`.
- **Communication:** Student/staff/household messaging, group messaging, text alerts, parent &
  student portals.
- **Academics:** Traditional and proficiency/competency-based grading, customizable report cards,
  transcripts, multi-year academic history.
- **Attendance:** Positive/negative and hours-based attendance, reporting/notifications, truancy
  reports, pattern detection via BeaconAI.
- **Assessments:** Assignment management and by-class/subject performance analytics; no dedicated
  exam/test-authoring module confirmed `(med)`.
- **Fees/Payments:** "Fee management" named as a parent-portal capability; no gateway names or
  payment-flow detail found `(low)`.
- **Admissions:** General "enrollment management and admissions" referenced; no dedicated admissions
  workflow page found `(low)`.
- **Events:** Not found `(unk)`.
- **PTM:** Not found `(unk)`.
- **Reporting/Analytics:** Custom/build-your-own reporting, embedded visualizations, state-reporting
  compliance, incident heat maps, BeaconAI predictive views. Users report reporting as rigid and
  CSV-export-dependent `(med)`.
- **Mobile apps:** **No native mobile app** — a top, repeated complaint in G2/Capterra/GetApp
  reviews `(med)`.
- **Web app:** Full web-based platform, primary access for every role.
- **Integrations:** 125+ "push-button" integrations — Google Classroom, Microsoft Teams, Canvas,
  Schoology named; public APIs; OneRoster (API & SFTP).
- **Automation:** Bulk/spreadsheet data operations, automated roll-up grade calculations `(med)`.
- **AI features:** BeaconAI — predictive analytics/early-warning views, not generative AI.
- **Notifications:** Text alerts, attendance notifications, BeaconAI pattern alerts.
- **Offline:** Not found `(unk)`.
- **Multilingual:** Not found — no language-list page located despite the "61 countries" claim `(unk)`.
- **Key strengths:** Deep, mature SIS core; strong integration ecosystem; genuinely predictive
  analytics rather than static dashboards; consistently praised ease-of-use `(med)`.
- **Key weaknesses:** No native mobile app (major, repeated complaint); reporting described as
  rigid/CSV-dependent; some scalability concerns for very large districts `(med)`.
- **UX strengths:** Reviewers repeatedly describe it as intuitive and modern `(med)`.
- **Product philosophy:** "Built for educators, by educators" — unify scattered school data into one
  consistent, customizable system.
- **Pricing:** Subscription SaaS, quoted per-school/district; no public price list found `(med)`.

> **Worth learning:** BeaconAI's framing — SIS data continuously turned into early-warning views
> rather than a static dashboard — is the lesson, not "add AI" for its own sake. Its own
> reporting-rigidity complaints are a useful contrast for SchoolPortal's currently 100%-mock admin
> dashboard: even a real, data-backed dashboard gets criticized when it isn't actionable enough.

**Sources:** [getalma.com](https://www.getalma.com/) (official) ·
[G2 reviews](https://www.g2.com/products/alma-sis/reviews) (community)

---

### Teachmint — South Asia · Mobile-first ERP + fintech

> **Sourcing note:** Teachmint's official site conflates two lines — the original classroom/ERP
> software + parent app, and "Teachmint X," a newer AI smart-classroom *hardware* line. Fields below
> distinguish which line a claim belongs to.

- **Target market:** South Asia primary (India named explicitly in most sourcing) with a stated
  US-market push; serves K-12 schools, colleges, and coaching/tuition centers `(med)`.
- **Target school type:** Broad — schools, colleges, coaching institutes; a free-forever tier targets
  budget-constrained/low-connectivity institutions.
- **Core product:** Combined LMS + school ERP + parent/communication app — closer to a full "school
  operating system" than a pure SIS.
- **Signature features:** **TeachPay** (fintech fee-collection layer, see below); **EduAI** (AI
  lesson/quiz/homework generator, tied mainly to Teachmint X hardware); real-time chat **and voice
  call** between parents and teachers — unusual in this set `(med)`.
- **Parent experience:** Full student-info visibility (enrollment, payments, attendance, performance,
  schedule); instant chat and voice call with teachers; dedicated iOS + Android app `(med)`.
- **Teacher experience:** Live-class delivery, lesson planning, attendance marking, gradebook/results
  entry, parent messaging — all from one mobile app `(med)`.
- **Admin experience:** Dashboard covering admissions, fee collection, attendance, exam/results,
  ID-card generation, hostel management; can monitor teacher activity/engagement `(med)`.
- **Student experience:** Access to lesson content, live classes, homework/results; not separately
  documented from teacher/parent flows `(low)`.
- **Communication:** Real-time chat, push notifications, and voice calls — reviewers call this out as
  a differentiator against email-based competitors `(low)`.
- **Academics:** Lesson planning, interactive/online-class tools, homework, results/report summaries;
  exam planning referenced at ERP level `(med)`.
- **Attendance:** Integrated into the core Student Information System, feeding the parent-visible
  student profile `(med)`.
- **Assessments:** "Exam planning, tests" listed as an ERP module; no rubric/marking-scheme depth
  found `(low)`.
- **Fees/Payments:** Most substantiated area — dynamic fee structures with discounts, automated
  reminders/invoices, intelligent financial reporting. **TeachPay** offers TeachPay Credit
  (zero-cost EMI-style installments for parents, school paid upfront) and TeachPay Auto (automated
  recurring collection), 100% digital collection with multi-bank auto-split settlement, UPI/QR
  payment modes, eNACH auto-debit, POS services.
- **Admissions:** Centralized module — application through enrollment, automated to reduce delay,
  with separate flows for admins/counselors/students/parents `(med)`.
- **Events:** Not found `(unk)`.
- **PTM:** No dedicated module found; chat/voice-call may substitute informally `(unk)`.
- **Reporting/Analytics:** Intelligent financial reports for fees; general reporting at
  admissions/admin level. No dedicated academic-analytics or predictive-analytics feature found
  (contrast with Alma's BeaconAI) `(low)`.
- **Mobile apps:** Dedicated iOS + Android apps confirmed; user-friendly per reviews, with some
  complaints of video-zoom bugs in live classes `(med)`.
- **Web app:** Web dashboard alongside the mobile apps for admin/ERP functions `(med)`.
- **Integrations:** Not found — no integration/API partner list located `(unk)`.
- **Automation:** Automated fee reminders/invoices, automated admissions workflow, automated
  recurring payment collection (TeachPay Auto) `(med)`.
- **AI features:** **EduAI** — auto-generates quizzes, homework, lecture summaries, math solutions,
  voice-activated explanations, AI whiteboard. Marketed specifically under Teachmint X (hardware,
  on-device NPU, "zero cloud dependency") — **not confirmed available in the standalone software**
  most schools would deploy `(low)`.
- **Notifications:** Push notifications, fee-payment reminders `(med)`.
- **Offline:** No offline-mode claim found for the core mobile/ERP app; the only offline-adjacent
  claim is Teachmint X hardware operating on local Wi-Fi/LAN — a hardware capability, not evidence
  the standalone app works offline `(low)`.
- **Multilingual:** 17 languages supported; confirmed partial list includes Arabic, Bengali, English,
  French, Hindi, Malay, Tamil, Telugu `(med)`.
- **Key strengths:** Fee-collection depth (TeachPay's EMI-style parent payments, auto-debit,
  multi-rail digital collection) is unusually strong; distinctive voice-call parent-teacher channel;
  broad multilingual coverage; free-forever entry tier.
- **Key weaknesses:** Reporting/analytics thin relative to Alma or enterprise SIS players; AI
  features appear gated behind a hardware purchase rather than broadly available in software; some
  live-class technical bugs reported; official documentation is thinner and more marketing-oriented,
  limiting verification confidence on several fields.
- **UX strengths:** Reviewers describe it as user-friendly and "all-in-one," with support specifically
  praised as prompt/attentive `(med)`.
- **Product philosophy:** Fee management framed explicitly as the parent/school pain point;
  consolidation philosophy — one app spanning classroom delivery, ERP, and parent communication for
  institutions that can't afford separate point solutions `(med)`.
- **Pricing:** Free-forever tier exists; a paid tier ("Teachmint X2 Pro") starts around ₹150,000
  (~$1,800 USD, unconverted source figure); premium/enterprise plans are quotation-based `(med)`.

> **Worth learning:** TeachPay's design — installment/EMI-style payment for parents while the school
> still gets paid in full upfront, plus multi-bank auto-split settlement and automated reminders — is
> the single most directly transferable idea in this research for SchoolPortal's unbuilt Fees module.
> The mechanism is worth copying; the specific rails (UPI, eNACH) are not — Pakistan needs
> JazzCash/EasyPaisa substitution.

**Sources:** [teachmint.com/isp](https://www.teachmint.com/isp) (official) ·
[EdTechReview on TeachPay](https://www.edtechreview.in/news/teachmint-launches-verticalized-fintech-solution-for-education-teachpay/) (press) ·
[SoftwareSuggest](https://www.softwaresuggest.com/teachmint/mobile-app) (secondary)

---

## 3. Standardized feature taxonomy

36 categories used consistently across the matrix below: **1** School administration · **2** Student
information system · **3** Parent management · **4** Attendance · **5** Timetable · **6** Academics ·
**7** Homework · **8** Assessments · **9** Gradebook · **10** Report cards · **11** Communication ·
**12** Messaging · **13** Notifications · **14** Events · **15** Parent-teacher meetings · **16** Fees
· **17** Payments · **18** Admissions · **19** Leave · **20** Transport · **21** Library · **22**
Canteen · **23** Inventory · **24** HR · **25** Payroll · **26** Analytics · **27** Parent portal ·
**28** Parent mobile app · **29** Teacher mobile experience · **30** Integrations · **31** AI · **32**
Automation · **33** Offline support · **34** Security · **35** Accessibility · **36** Localization.

---

## 4. Competitive feature matrix

Legend: **F** Full · **P** Partial · **L** Limited · **N** Not available · **U** Unknown.
Ratings are read from the sourced profiles above, not inferred — no cell was marked "Not available"
solely because evidence couldn't be found; those read "Unknown."

| Feature | ClassDojo | Seesaw | Remind | ParentSquare | Brightwheel | Toddle | PowerSchool | Schoology | Alma | Teachmint |
|---|---|---|---|---|---|---|---|---|---|---|
| **Core operations** | | | | | | | | | | |
| School administration | L | L | L | P | F | P | F | N | F | F |
| Student information system | N | N | N | N | P | N | F | N | F | F |
| Parent management | F | F | P | F | F | F | F | P | F | F |
| Attendance | L | N | L | F | F | F | F | N | F | F |
| Timetable | N | N | N | N | N | P | F | N | F | U |
| **Academics** | | | | | | | | | | |
| Academics | N | P | N | N | L | F | F | F | F | P |
| Homework | N | F | N | N | N | F | N | F | P | P |
| Assessments | N | P | N | N | L | F | P | F | P | L |
| Gradebook | N | N | N | N | N | F | F | F | F | P |
| Report cards | N | N | N | N | N | F | F | P | F | L |
| **Communication** | | | | | | | | | | |
| Communication | F | F | F | F | F | F | F | P | F | F |
| Messaging | F | F | F | F | F | F | F | P | F | F |
| Notifications | F | P | F | F | F | P | F | P | F | F |
| Events | P | U | U | F | P | L | U | U | U | U |
| Parent-teacher meetings | U | U | L | F | U | L | U | U | U | U |
| **Money & enrollment** | | | | | | | | | | |
| Fees | L | N | L | P | F | N | P | N | L | F |
| Payments | L | N | L | F | F | N | P | N | L | F |
| Admissions | N | N | N | U | F | N | F | N | L | F |
| Leave | N | N | N | N | N | N | U | N | U | U |
| **Campus operations** | | | | | | | | | | |
| Transport | N | N | N | N | N | N | U | N | U | U |
| Library | N | N | N | N | N | N | U | N | U | U |
| Canteen | N | N | N | N | N | N | P | N | U | U |
| Inventory | N | N | N | N | N | N | U | N | U | U |
| HR | N | N | N | N | P | N | U | N | U | U |
| Payroll | N | N | N | N | P | N | U | N | U | U |
| **Platform** | | | | | | | | | | |
| Analytics | P | P | L | F | F | F | F | F | F | L |
| Parent portal | F | F | P | F | F | F | F | P | F | F |
| Parent mobile app | F | F | F | F | F | F | F | U | N | F |
| Teacher mobile experience | F | F | F | F | F | P | F | L | N | F |
| Integrations | U | F | U | U | L | P | F | F | F | U |
| AI | L | F | N | F | N | F | F | F | F | L |
| Automation | P | F | P | F | F | F | F | P | P | F |
| Offline support | U | U | P | U | U | L | U | U | U | L |
| Security | U | U | U | U | U | U | L | U | U | U |
| Accessibility | U | U | U | P | U | U | U | U | U | U |
| Localization | F | F | F | F | L | U | P | U | U | F |

**Note:** the near-empty "Campus operations" band is a market finding, not a research gap — none of
the ten global leaders reviewed build Transport, Library, Canteen, Inventory, HR, or Payroll as core
product. See Section 7.

---

## 5. Signature capabilities

| Product | Signature capability | Worth learning from? |
|---|---|---|
| ClassDojo | Mass-scale, multilingual, multi-channel broadcast communication with delivery confirmation | Yes — for the Messaging module's broadcast/translation layer, not the gamification. |
| Seesaw | AI cutting teacher administrative time while keeping young-learner interaction multimodal | Partially — the AI-for-teacher-time pattern, not the portfolio paradigm (age range mismatch). |
| Remind | Zero-friction, SMS-first adoption with no district procurement required | Yes — an SMS fallback channel is directly relevant to lower-connectivity households. |
| ParentSquare | Unified multi-channel engagement with anti-fatigue digest notifications and translation as core infrastructure | Yes — the digest-bundling and translation-as-infrastructure patterns. |
| Brightwheel | Parent-facing billing UX: multi-payer invoices, autopay, self-serve receipts, real-time balance dashboard | Yes — the fees-module shape, with local payment rails substituted. |
| Toddle | Portfolio-to-report-card pipeline with AI-assisted narrative drafting | Yes — the clearest reference for SchoolPortal's missing gradebook/report-card layer. |
| PowerSchool SIS | Enterprise compliance reporting and audit-logged admissions/lottery workflows | Yes for admissions design — and a cautionary case study on security posture. |
| Schoology | Standards-based mastery gradebook with SIS-agnostic LTI/OneRoster interoperability | Yes for the gradebook design; the interoperability architecture is out of scope. |
| Alma | Predictive, early-warning analytics (BeaconAI) built on data the SIS already has | Yes — proactive alerting is the pattern, not the "add AI" headline. |
| Teachmint | EMI-style fee collection (TeachPay) balancing parent affordability against school cash flow | Yes — the single most transferable idea in this research for the Fees module. |

---

## 6–7. Evidence hierarchy & confidence method

Every profile field above was sourced and graded on this ladder. No claim was upgraded past what its
source tier supports.

| Tier | Sources | Applied as |
|---|---|---|
| Highest | Official product site, documentation, help center, release notes | Untagged / High confidence |
| Medium | App Store / Google Play listings, reputable product reviews, independent tech press | `(med)` tag |
| Supporting | Reddit, user forums, customer discussions, community reviews | `(low)` tag |
| Unverifiable | No source located either confirming or denying | `(unk)` — never converted to "Not available" |

---

## 8. Competitive conclusions

**Global baseline — table-stakes in 2026.** Every competitor with any real installed base ships:
two-way (or at minimum broadcast-with-read-receipt) parent messaging; native iOS + Android apps for
parents and staff; real-time push notifications; attendance tracking visible to parents; a
multi-child/multi-class switcher; and at least a shallow UI-level translation toggle. A platform
missing any of these today reads as behind, not merely incomplete.

**Competitive differentiators — what separates strong from average.** Two-way, real-time messaging
beats one-way broadcast; AI that measurably cuts teacher drafting/grading time beats AI as a
marketing line; standards-based/mastery gradebooks beat flat percentage grading; predictive,
early-warning analytics beat static dashboards; a genuinely unified single login beats a "suite" of
separately-branded products bolted together after acquisition.

**Premium capabilities — mature/enterprise-only today.** State/regulatory compliance reporting
(Ed-Fi, SIF), audit-logged admissions lottery systems, 75+-integration marketplaces, dedicated
predictive-analytics engines, and public-company-grade security/compliance posture all appear only at
the PowerSchool/ParentSquare/Alma end of the market — none of it is expected of a young,
single-market platform, but each is a credible multi-year roadmap item.

**Parent expectations.** Real push notifications, not an app they have to remember to open; one place
for attendance, grades, fees, and messages instead of five separate logins; a working multi-child
switcher; fee payment through whatever rail they already use daily (mobile wallet, not just card);
communication in a language they actually read fluently, not just a translated UI shell; and an SMS
or voice fallback where data connectivity is unreliable.

**School administrator expectations.** A dashboard that shows real numbers, not a convincing shell
over mock data; bulk/spreadsheet-style data operations instead of one-record-at-a-time forms;
audit-logged admissions and enrollment workflows; engagement/reach analytics that answer "who isn't
getting our messages," not just "how many messages did we send."

**Teacher expectations.** One mobile app that covers attendance, diary/homework, and parent
messaging — not three nav links, two of which are dead; AI assist for repetitive drafting (report
comments, circular text) rather than none at all; a gradebook that supports the school's actual
grading model; onboarding that doesn't require a lengthy manual roster-import step before the first
class can be run.

---

## 9. Axis-by-axis comparisons

| Axis | Strongest | Weakest |
|---|---|---|
| Parent experience | ClassDojo & ParentSquare (broadcast reach + translation); Brightwheel & Teachmint (operational visibility + fee self-service) | Alma (no native app); Remind (SMS-only, no rich portal) |
| School admin experience | PowerSchool (compliance depth); Alma (BeaconAI + bulk editing); Teachmint (single ERP dashboard) | Remind & Schoology (thin/no native admin surface — by design, each defers to a companion product) |
| Mobile experience | ClassDojo, Seesaw, Brightwheel, Teachmint — mobile is the primary surface | Alma — no native app at all, its most-repeated complaint; Schoology & Toddle — mobile trails web |
| Communication | ParentSquare (unified multi-channel + digest anti-fatigue); Teachmint (voice-call channel) | Schoology (course discussions only, no broadcast layer) |
| Payments | Teachmint (TeachPay); Brightwheel (autopay + multi-payer invoicing); ParentSquare (integrated collection) | Seesaw & Toddle — no fee/payment module at all, by design |
| Academics | Toddle (portfolio-to-report-card pipeline); Schoology (mastery gradebook); PowerSchool/Alma (transcript-grade SIS records) | ClassDojo, Remind, ParentSquare — deliberately not academic products |
| AI / automation | Seesaw (auto-grading, auto-drafted content); PowerSchool (PowerBuddy, live at scale); ParentSquare Intelligence; Toddle AI | Brightwheel & Remind (none found); Teachmint's EduAI appears gated behind hardware |

**Competitive trends.** Point-solutions are consolidating into single-vendor suites (Remind folding
into ParentSquare, Schoology folding into PowerSchool's Product Cloud) — the market is converging on
exactly the "one backend, two clients" bet SchoolPortal has already made, not away from it. AI has
moved from marketing claim to shipped, metered product feature across the leaders in this set within
the last 12 months.

**Emerging features.** Conversational AI assistants answering parent questions from live school data
(PowerBuddy for Engagement); AI auto-scoring against rubrics; installment/EMI-style fee payment;
voice-call parent-teacher channels; digest-style notification bundling to fight alert fatigue; early
on-device/local AI aimed at low-connectivity classrooms (Teachmint X).

**Global table-stakes.** Attendance, two-way or read-receipted messaging, native mobile apps for
parent and staff, push notifications, multi-child switching, at least UI-level localization.
SchoolPortal already has three of six (attendance, timetable-read, diary/circulars) and is missing
the rest outright per its own audit.

**Global differentiators.** Two-way over one-way communication, standards-based over flat grading,
predictive over static analytics, single-login unification over stitched-together product families,
AI that provably saves staff time over AI as a press release.

---

## 10. Features SchoolPortal should avoid copying

| From | Don't copy |
|---|---|
| **ClassDojo** | Gamified behavior-points / public comparison — reviewers themselves flag privacy discomfort around public behavior callouts; fits elementary classroom culture, not an administrative K-12 SIS. |
| **Teachmint** | AI marketed as core, shipped only behind hardware — EduAI's headline features are tied to Teachmint X hardware, not confirmed in the software most schools deploy. A credibility risk not to repeat. |
| **PowerSchool** | Land-and-expand product fragmentation — SIS, Schoology, Naviance, Performance Matters, and Enrollment as separately-branded products created exactly the "too many logins" complaint MyPowerHub had to be built to fix. SchoolPortal's single-backend architecture is the better starting bet, already validated by the market consolidating toward it. |
| **PowerSchool / Toddle / Alma** | Custom-quote-only, opaque pricing — defensible for enterprise district sales; a poor fit for SchoolPortal's likely single-school-to-small-network customer, who needs pricing clarity to trust the product. |
| **Seesaw** | Multimodal-first UX for every age — draw/record-first interaction is right for early learners, wrong as a default for SchoolPortal's broader K-12 administrative surface. |
| **Alma** | Strong web product, no native mobile app — its single most-repeated user complaint. A cautionary example, not a shortcut, especially for a market where mobile is often the only device. |
| **PowerSchool** | Support-portal access without MFA, thin log retention — the exact failure class behind its 2025 breach of ~62M student records. SchoolPortal's own audit already flags analogous gaps (hardcoded JWT fallback, wide-open CORS) — the clearest evidence for why they're worth fixing before any real pilot. |

---

## 11. What would a modern school expect from a credible global school platform in 2026?

Table-stakes, first: real attendance and two-way (not one-way) messaging with delivery confirmation,
native mobile apps for both parents and staff that are the primary interface rather than an
afterthought, push notifications that actually push, a working multi-child switcher, and fee
visibility that doesn't require a phone call to the office. None of that is differentiation anymore —
it's the entry price, and the research above shows every competitor with meaningful adoption already
clears it.

Above that floor, a school in 2026 increasingly expects a platform that consolidates rather than
fragments — one login, not five apps stitched together after an acquisition — and that treats AI as a
quiet productivity layer (auto-drafted circular text, auto-scored formative work, early-warning
attendance alerts) rather than a headline feature bolted onto a demo. They expect fee collection
shaped around how families actually pay, not how the vendor's default gateway happens to work. They
expect translation and accessibility to be infrastructure, not an afterthought toggle. And
increasingly — after 2025's PowerSchool breach touched roughly 62 million student records — they
expect the vendor to have taken basic account-security hygiene seriously before the pitch deck ever
mentions AI.

None of this requires SchoolPortal to build everything in this report. It requires knowing, with
evidence rather than assumption, which gaps in its own audited feature set — Fees, Messaging, admin
CRUD, a real (not mock) admin dashboard, a working refresh-token loop — are gaps against genuine 2026
market expectations, and which competitor patterns (TeachPay's fee mechanics, ParentSquare's digest
notifications, Toddle's portfolio-to-report-card pipeline, PowerSchool's admissions audit trail) are
the most direct, sourced answers for closing them.

---

*Compiled 2026-09-08 · Sources: official product sites/documentation (highest confidence), app-store
listings and reputable press (medium), community/forum reports (supporting, tagged inline) ·
Baseline: `SchoolPortal-Repo-Audit-2026-09-08.md` · No feature was marked unavailable solely because
it could not be found — unverifiable claims are marked Unknown throughout.*
