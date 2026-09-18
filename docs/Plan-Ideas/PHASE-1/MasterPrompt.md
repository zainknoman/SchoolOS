Absolutely. The cleanest way is to turn the large master prompt into **5 independent research/implementation prompts**, while preserving the original section numbering so they can still be run together or sequentially.

Below is the split exactly around your requested section groups.

---

# 1. Repo Audit + Feature Verification

**Covers original sections: 2–5, 8, 11, 22–24**

This prompt should answer one fundamental question:

> **What actually exists in the SchoolOS repository today, what works, what is partial, and what was only planned?**

# SchoolOS — Repo Audit & Feature Verification

## Objective

Perform a complete technical and functional audit of the SchoolOS GitHub repository:

[https://github.com/zainknoman/SchoolOS](https://github.com/zainknoman/SchoolOS)

This is an existing MVP. The basic functionality is already implemented and working.

The objective of this phase is **NOT to redesign the product or propose new features yet**.

The objective is to establish an accurate baseline of what currently exists in the repository.

---

## 1. Repository Inspection

Inspect the repository thoroughly before making conclusions.

Analyze:

* Repository structure
* Frontend applications
* Backend/API
* Database
* Prisma schema/models
* Migrations
* Controllers
* Services
* Routes
* Middleware
* Authentication
* Authorization/RBAC
* Stores/state management
* Vue components/pages
* Flutter/mobile application
* Parent application
* School/staff application
* Notifications
* Messaging
* Fees/payments
* PDF generation
* File/attachment handling
* Offline functionality
* Sync mechanisms
* Integrations
* Configuration
* Environment handling
* Tests
* Documentation
* Seed data
* TODO/FIXME comments
* Feature flags
* Stubs/placeholders
* Unused models
* Unused APIs
* Dead code
* Incomplete screens
* Mock/demo implementations

Do not rely only on README files.

Inspect actual source code.

---

# 2. Previous Research as the MVP Baseline

The attached previous research document represents research that was already used to define the MVP scope.

Treat it as:

> **Previously researched MVP baseline — not a new wishlist.**

Use it to determine which functionality was expected to exist.

For every significant capability identified in the previous research:

1. Search the repository.
2. Find the implementation.
3. Verify whether it is actually functional.
4. Record the evidence.
5. Classify its current state.

Do not assume that because the previous research says a feature exists, it actually exists in code.

---

# 3. Feature Verification Classification

Every feature should be classified as one of:

### A. Confirmed Implemented

Feature is clearly implemented in the repository and appears functional.

### B. Implemented but Partial

Feature exists but important functionality is missing or incomplete.

### C. Implemented but Weak

Feature technically works but requires substantial improvement.

### D. Stubbed / Placeholder

UI, API, model, or service exists but does not provide complete functionality.

### E. Planned Only

Mentioned in documentation, TODOs, roadmap, comments, or schemas but not implemented.

### F. Not Found

No meaningful implementation exists.

### G. Unclear

Evidence is insufficient to determine the status.

Do not classify a feature as implemented merely because a database model or UI screen exists.

---

# 4. Functional Areas to Audit

Audit at minimum:

## Authentication & Identity

* Login
* Password handling
* Session/token handling
* Role-based access
* User profiles
* Parent accounts
* Student accounts
* Staff accounts

## School Structure

* Organization
* Campus
* Branch
* Academic year
* Classes
* Sections
* Subjects
* Teachers
* Students

## Student Information

* Student profiles
* Guardian/parent relationships
* Multiple children per parent
* Student status
* Enrollment information

## Attendance

* Daily attendance
* Student attendance
* Staff attendance if available
* Attendance history
* Monthly summaries
* Holiday handling
* Leave interaction
* Attendance reporting

## Timetable

* Class timetable
* Teacher timetable
* Subject scheduling
* Period management
* Conflict handling

## Academics

* Class diary
* Homework
* Assignments
* Assessments
* Exams
* Grades
* Results
* Report cards

## Parent Experience

* Child selection
* Dashboard
* Attendance
* Timetable
* Diary
* Homework
* Results
* Fees
* Notifications
* Circulars
* Messaging

## Communication

* Announcements
* Circulars
* Notifications
* Read/unread tracking
* Two-way messaging
* Delivery status

## Fees

* Fee structures
* Student fees
* Vouchers
* Receipts
* Payment tracking
* Outstanding balances
* PDF generation
* Discounts
* Late fees

## Leave

* Leave application
* Approval/rejection
* Leave history
* Parent/student workflow

## Administration

* Users
* Roles
* Permissions
* Staff
* Students
* Parents
* Classes
* Sections
* Subjects

## Technical Infrastructure

* API architecture
* Database architecture
* File storage
* Offline support
* Caching
* Sync
* Logging
* Audit trail
* Error handling
* Security

---

# 5. Evidence Requirements

For every important finding provide repository evidence.

Prefer:

* File path
* Module
* Model
* API endpoint
* Component
* Service
* Migration
* Relevant function/class

Example:

| Feature      | Status    | Evidence                            | Confidence |
| ------------ | --------- | ----------------------------------- | ---------- |
| Attendance   | Confirmed | `backend/.../attendance.service.ts` | High       |
| Report Cards | Not Found | No model/API/UI found               | High       |
| Circulars    | Partial   | UI + API but no delivery tracking   | Medium     |

Do not fabricate file paths.

---

# 6. Architecture Assessment

Evaluate whether the current architecture is appropriate for scaling the MVP.

Assess:

* Backend modularity
* API consistency
* Database normalization
* Prisma design
* Authorization architecture
* Multi-campus support
* Parent-child relationships
* Auditability
* File storage
* Notification architecture
* Background jobs
* Caching
* Offline synchronization
* Error handling
* Validation
* Security
* Observability
* Testing

Identify technical debt that will make future features expensive.

---

# 7. Security Audit

Look for:

* Broken access control
* Missing RBAC checks
* Parent accessing another student's data
* IDOR vulnerabilities
* Sensitive data exposure
* Weak validation
* Unsafe file uploads
* Authentication weaknesses
* Authorization gaps
* API security problems
* Secrets/configuration issues
* Excessive permissions

Do not exploit vulnerabilities.

Identify them and explain their impact.

---

# 8. Final Repo Audit Output

Produce:

### Executive Summary

### Repository Architecture

### Application Inventory

### Feature Verification Matrix

### MVP Features Confirmed

### MVP Features Partially Implemented

### MVP Features Missing

### Technical Debt

### Security Findings

### Data Model Findings

### API Findings

### Parent App Findings

### Staff/Admin App Findings

### Highest-Risk Technical Issues

### Recommended Stabilization Work

### Questions/Unknowns Requiring Manual Verification

Finally answer:

> **What is the true functional maturity of this MVP today?**

Give it an overall maturity score from 0–100 with a clear explanation.

Do not propose the full post-MVP roadmap yet. That will be handled separately.

---

# 2. Competitor Research

**Covers original sections: 6–7 + Evidence/Confidence**

This should be completely independent from the repo audit.

Its job is:

> **What do the best global school platforms actually offer today?**

# SchoolOS — Global Competitor Research

## Objective

Conduct a current global competitive analysis of School Management Systems, SIS platforms, parent engagement platforms, and School Operating Systems.

The purpose is to understand what the strongest products currently offer and identify the capabilities that should become the benchmark for SchoolOS.

Do not assume that every feature of a competitor is relevant to SchoolOS.

---

# 1. Select the Top 10 Competitors

Start with a broad market scan.

Evaluate products such as:

* ClassDojo
* Seesaw
* Remind
* TalkingPoints
* ParentSquare
* Brightwheel
* Schoology
* PowerSchool
* Toddle
* Alma

You may replace these with better/current competitors if evidence suggests other products are more appropriate.

Explain why the final 10 were selected.

Consider:

* Global adoption
* Product maturity
* Parent experience
* School management capabilities
* Academic capabilities
* Communication
* Payments
* Mobile experience
* UX quality
* Market positioning
* Relevance to SchoolOS

---

# 2. Research Each Competitor

For each competitor document:

### Company/Product

### Target Market

### Target School Type

### Core Product

### Signature Features

### Parent Experience

### Teacher Experience

### Administrator Experience

### Student Experience

### Communication

### Academics

### Attendance

### Assessments

### Fees/Payments

### Admissions

### Events

### Parent-Teacher Meetings

### Reporting/Analytics

### Mobile Applications

### Web Applications

### Integrations

### Automation

### AI Features

### Notifications

### Offline Capabilities

### Multilingual Capabilities

### Key Strengths

### Key Weaknesses

### UX Strengths

### Product Philosophy

### Pricing/Business Model where publicly available

---

# 3. Build a Standardized Feature Taxonomy

Compare competitors using common categories:

1. School administration
2. Student information system
3. Parent management
4. Attendance
5. Timetable
6. Academics
7. Homework
8. Assessments
9. Gradebook
10. Report cards
11. Communication
12. Messaging
13. Notifications
14. Events
15. PTM
16. Fees
17. Payments
18. Admissions
19. Leave
20. Transport
21. Library
22. Canteen
23. Inventory
24. HR
25. Payroll
26. Analytics
27. Parent portal
28. Parent mobile app
29. Teacher mobile experience
30. Integrations
31. AI
32. Automation
33. Offline support
34. Security
35. Accessibility
36. Localization

---

# 4. Competitive Feature Matrix

Create a matrix:

| Feature | Competitor 1 | Competitor 2 | ... | Competitor 10 |
| ------- | ------------ | ------------ | --- | ------------- |

Use:

* Full
* Partial
* Limited
* Not available
* Unknown

Do not infer functionality without evidence.

---

# 5. Identify Signature Capabilities

For every competitor identify:

> What is this product particularly good at?

Examples could include:

* Parent engagement
* Communication
* Early-childhood management
* LMS
* SIS
* Academic planning
* Payments
* Admissions
* School operations
* Portfolio-based learning
* Analytics

Then determine which capabilities are worth learning from.

---

# 6. Evidence Hierarchy

Use sources in this order:

### Highest confidence

* Official product website
* Official documentation
* Official help center
* Official product pages
* Official release notes

### Medium confidence

* App Store / Google Play
* Reputable product reviews
* Independent technology publications

### Supporting evidence

* Reddit
* User forums
* Customer discussions
* Community reviews

Clearly distinguish confirmed capabilities from claims based on secondary evidence.

---

# 7. Evidence & Confidence

Every significant competitor feature should have:

* Source
* Date/access context
* Evidence type
* Confidence

Use:

### High confidence

Confirmed by official documentation/product material.

### Medium confidence

Supported by reputable secondary evidence.

### Low confidence

Only supported by user/community reports.

If something cannot be verified:

> Mark it as Unknown.

Never convert "not found" into "not supported."

---

# 8. Competitive Conclusions

Determine:

### Global baseline

What functionality is now table-stakes?

### Competitive differentiators

What separates strong products from average ones?

### Premium capabilities

What features appear primarily in mature/enterprise products?

### Parent expectations

What experiences are parents increasingly likely to expect?

### School administrator expectations

What capabilities reduce operational workload?

### Teacher expectations

What capabilities improve teacher productivity?

---

# 9. Strategic Output

Produce:

1. Top 10 competitor profiles
2. Feature comparison matrix
3. Competitor strengths
4. Competitor weaknesses
5. Feature maturity map
6. Parent experience comparison
7. School admin experience comparison
8. Mobile experience comparison
9. Communication comparison
10. Payments comparison
11. Academic comparison
12. AI/automation comparison
13. Competitive trends
14. Emerging features
15. Global table-stakes
16. Global differentiators
17. Features that SchoolOS should avoid copying

Finally answer:

> **What would a modern school expect from a credible global school platform in 2026?**

---

# 3. Gap Analysis + Prioritization

**Covers original sections: 9–13, 27**

This is where the **Repo Audit + Competitor Research** are combined.

The key principle:

> **Do not recommend something as a gap if the repository already implements it.**

# SchoolOS — Gap Analysis & Feature Prioritization

## Objective

Using:

1. The verified SchoolOS repository audit
2. The previous MVP research
3. The global competitor research

determine exactly what SchoolOS should build after MVP.

The goal is not to maximize the number of features.

The goal is to determine:

> **Which improvements provide the highest product value relative to engineering effort?**

---

# 1. Establish the True Baseline

Merge the repo audit and previous MVP research.

For every capability classify:

* Already implemented
* Partial
* Weak implementation
* Missing
* Planned
* Not relevant

Do not create duplicate recommendations.

---

# 2. False Gap Analysis

Create a dedicated section:

## "Features We Do NOT Need to Build"

List functionality that competitors offer but SchoolOS already implements adequately.

This section is mandatory.

Its purpose is to prevent unnecessary redevelopment.

---

# 3. Gap Categories

Identify gaps across:

### Product

### Academic

### Parent experience

### Teacher experience

### Administration

### Communication

### Finance

### Admissions

### Events

### Analytics

### Integrations

### Mobile

### Web

### AI

### Automation

### Security

### Performance

### Scalability

### UX/UI

---

# 4. Gap Severity

Classify every gap:

### Critical

Prevents SchoolOS from being commercially credible.

### High

Major competitive disadvantage.

### Medium

Important but not immediately required.

### Low

Nice-to-have.

### Strategic

Potential differentiator/moat.

---

# 5. Feature Prioritization

Create a Top 20–30 opportunity list.

For every opportunity calculate:

* Business value
* User value
* Competitive importance
* Strategic fit
* Engineering effort
* Technical risk
* Dependency complexity

Use a transparent scoring model.

Example:

Priority Score =
Business Value

* User Value
* Competitive Importance
* Strategic Fit
  − Engineering Effort
  − Technical Risk

Clearly explain the scoring methodology.

---

# 6. Build Priority Tiers

## Tier 0 — Stabilization

Existing MVP issues that must be fixed before expansion.

## Tier 1 — Commercial Readiness

Capabilities required for a credible commercial product.

## Tier 2 — Growth

Features that improve adoption, retention, and school value.

## Tier 3 — Differentiation

Capabilities that can make SchoolOS meaningfully better than competitors.

## Tier 4 — Defer

Features that should explicitly NOT be built yet.

Explain why every Tier 4 item is deferred.

---

# 7. Pakistan-Specific Gap Analysis

Evaluate:

* Urdu
* RTL
* English/Urdu bilingual UX
* WhatsApp
* SMS
* JazzCash
* Easypaisa
* 1LINK
* Local banking
* Cash fee workflows
* Low bandwidth
* Android-heavy usage
* Offline operation
* Multi-campus private schools
* Parent expectations
* School accounting workflows
* Local reporting requirements

Separate:

### Global requirement

from

### Pakistan-specific opportunity

---

# 8. Strategic Positioning

Evaluate possible positions:

* School Management System
* SIS
* Parent Engagement Platform
* School ERP
* School Operating System
* SIS + Parent Super App
* Pakistan-first School OS

Recommend the strongest positioning.

Explain:

* Target customer
* Core problem
* Differentiation
* Competitive advantage
* Product moat

---

# 9. Final Gap Analysis

Produce:

### Current Product Strengths

### Existing Competitive Advantages

### Critical Gaps

### Major Gaps

### Minor Gaps

### False Gaps

### Technical Gaps

### UX Gaps

### Pakistan-Specific Opportunities

### Strategic Opportunities

### Features to Avoid

### Top 20 Post-MVP Features

### Recommended Priority

Finally answer:

> **If SchoolOS shipped nothing except the top 10 recommended improvements, which 10 would create the largest increase in product maturity and commercial value?**

---

# 4. UI/UX Audit + Modernization Roadmap

**Covers original sections 14–19**

This is intentionally separate because the user has **already applied ui-ux-pro-max**.

So the prompt should not simply say "redesign the UI."

It should perform a **second-stage professional product UX audit**.

# SchoolOS — UI/UX Audit & Modernization Roadmap

## Objective

Perform a professional UI/UX audit of the current SchoolOS application.

The application has already undergone an initial UI/UX improvement using the `ui-ux-pro-max` approach.

Therefore:

> Do NOT treat the application as having an unstyled or unfinished MVP interface.

Instead, evaluate the current implementation and determine what is required to move it from:

**Good MVP UI → polished commercial SaaS / premium school platform UI**

Audit both:

1. Staff/Admin Web Application
2. Parent Mobile Application

---

# 1. Current UI Audit

Inspect the actual implementation.

Evaluate:

* Layout
* Navigation
* Information architecture
* Typography
* Spacing
* Components
* Forms
* Tables
* Cards
* Dashboards
* Filters
* Search
* Modals
* Drawers
* Notifications
* Empty states
* Loading states
* Error states
* Success states
* Confirmation flows
* Mobile responsiveness
* Accessibility
* RTL
* Urdu
* Dark/light themes if applicable

Do not recommend redesigning something that is already strong.

---

# 2. Staff/Admin Experience

Audit:

* Dashboard
* Navigation
* Sidebar
* Breadcrumbs
* Search
* Command palette if present
* Student management
* Parent management
* Staff management
* Classes
* Sections
* Attendance
* Timetable
* Diary
* Homework
* Exams
* Results
* Fees
* Circulars
* Messaging
* Reports
* Settings

Evaluate workflow efficiency rather than visual appearance alone.

---

# 3. Parent Mobile Experience

Audit:

* Login
* Onboarding
* Child switching
* Home dashboard
* Attendance
* Timetable
* Diary
* Homework
* Results
* Fees
* Notifications
* Circulars
* Messaging
* Leave
* Profile
* Settings

Evaluate:

* Number of taps
* Discoverability
* Information density
* Navigation
* Notification visibility
* Trust
* Clarity
* Accessibility
* Performance perception

---

# 4. Design System Audit

Determine whether the current product has a coherent design system.

Assess:

* Colors
* Typography
* Spacing
* Border radius
* Shadows
* Icons
* Buttons
* Inputs
* Selects
* Tables
* Cards
* Badges
* Alerts
* Toasts
* Dialogs
* Navigation
* Charts
* Avatars
* Status indicators

Identify inconsistent components.

---

# 5. Premium Product Benchmark

Compare the UI/UX philosophy with modern products such as:

* Linear
* Notion
* Stripe
* Slack
* Apple
* Google
* Leading education platforms

Do not copy their visual styles blindly.

Extract principles such as:

* Clarity
* Hierarchy
* Consistency
* Progressive disclosure
* Fast workflows
* Strong feedback
* Calm interfaces
* Accessibility
* Responsive behavior

---

# 6. UX Friction Analysis

Identify:

### High-friction workflows

### Excessive-click workflows

### Confusing navigation

### Information overload

### Missing feedback

### Weak empty states

### Poor error handling

### Poor mobile interactions

### Accessibility issues

### Inconsistent components

For each issue explain:

* Current behavior
* Problem
* User impact
* Recommended improvement
* Engineering complexity

---

# 7. Modernization Roadmap

Create UI/UX sprints:

### UI Sprint 1 — Design System Hardening

### UI Sprint 2 — Staff Console

### UI Sprint 3 — Parent App

### UI Sprint 4 — Forms/Data-heavy Workflows

### UI Sprint 5 — States & Feedback

### UI Sprint 6 — Accessibility & Localization

### UI Sprint 7 — Premium Polish

Adapt the sprint structure based on actual findings.

---

# 8. UI Quality Score

Score current UI from 0–100 across:

* Visual quality
* Consistency
* Usability
* Accessibility
* Mobile UX
* Information architecture
* Workflow efficiency
* Responsiveness
* Localization
* Perceived product maturity

Provide:

### Current Score

### Target Score

### Gap

---

# 9. Final UI/UX Deliverables

Produce:

1. Current UI assessment
2. Staff UX audit
3. Parent UX audit
4. Design system audit
5. Workflow friction map
6. Accessibility audit
7. Responsive/mobile audit
8. Localization/RTL audit
9. UI modernization priorities
10. UI sprint roadmap
11. Current vs target score

Finally answer:

> **What would make SchoolOS look and feel like a premium commercial product rather than an upgraded MVP?**

---

# 5. Roadmap + Sprints + Dependencies + Final Recommendation

**Covers original sections 18–39**

This should be the **master synthesis prompt**.

It consumes the outputs of the previous four prompts and produces the actual implementation plan.

# SchoolOS — Post-MVP Roadmap, Sprints & Implementation Plan

## Objective

Using the outputs from:

1. Repo Audit & Feature Verification
2. Global Competitor Research
3. Gap Analysis & Prioritization
4. UI/UX Audit & Modernization

create the final implementation roadmap for SchoolOS.

The roadmap must be realistic for an existing MVP codebase.

Do not create a generic SaaS roadmap.

---

# 1. Product Strategy

Define:

### Product Vision

### Target Customers

### Primary Users

### Core Problem

### Product Positioning

### Competitive Advantage

### Differentiation Strategy

### Long-term Product Direction

---

# 2. Product Maturity Roadmap

Define:

### Current MVP

### Commercially Credible Version

### Growth Version

### Differentiated Version

### Long-term Platform

Explain what capabilities unlock each stage.

---

# 3. Roadmap Phases

Create phases such as:

### Phase 0 — MVP Stabilization

### Phase 1 — Commercial Readiness

### Phase 2 — Academic Platform

### Phase 3 — Parent Engagement

### Phase 4 — Finance & Automation

### Phase 5 — Communication

### Phase 6 — Admissions

### Phase 7 — Analytics

### Phase 8 — Differentiation

Modify these based on actual findings.

---

# 4. Sprint Planning

For every sprint provide:

### Sprint Name

### Duration

### Goal

### User Outcome

### Business Outcome

### Features

### Backend

### Database

### API

### Staff Web

### Parent Mobile

### UI/UX

### Integrations

### Testing

### Security

### Performance

### Dependencies

### Definition of Done

### Deliverables

---

# 5. Technical Implementation Detail

For every major feature identify required:

* Database models
* Prisma changes
* Migrations
* API endpoints
* Services
* Controllers
* Validation
* Permissions
* Background jobs
* Notifications
* Vue pages/components
* Flutter screens
* State management
* Offline behavior
* Tests

Do not invent exact implementation details if the repository architecture does not support them.

Clearly mark proposed architecture changes.

---

# 6. Dependency Graph

Create a dependency graph showing which initiatives must happen before others.

Example:

```text
Authentication/RBAC
        ↓
Student/Parent Foundation
        ↓
Academic Structure
        ↓
Attendance
        ↓
Assessments
        ↓
Report Cards
```

Also identify parallelizable work.

---

# 7. Critical Path

Identify:

### Critical path

### Parallel workstreams

### Blocking dependencies

### High-risk technical areas

### Long-lead integrations

### Features requiring architectural changes

---

# 8. 6-Month Roadmap

Create a month-by-month plan.

For each month show:

* Engineering work
* UI/UX work
* Product features
* Infrastructure
* Testing
* Release milestone

---

# 9. 12-Month Roadmap

Create a longer-term roadmap covering:

* Commercialization
* Growth
* Integrations
* Advanced analytics
* AI
* Automation
* Differentiation

Clearly separate committed priorities from exploratory ideas.

---

# 10. Release Strategy

Define:

### Release 1 — Stabilized MVP

### Release 2 — Commercial School Platform

### Release 3 — Parent Engagement Platform

### Release 4 — School Operating System

### Release 5 — Differentiated Platform

For each release define:

* Features
* Target users
* Business value
* Product maturity

---

# 11. Success Metrics

Recommend measurable KPIs such as:

### School onboarding time

### Parent activation rate

### Weekly active parents

### Teacher adoption

### Attendance completion rate

### Fee collection rate

### Notification engagement

### Homework engagement

### Support tickets

### Feature adoption

### System performance

### Crash/error rate

Do not invent baseline values.

Recommend target values only where clearly labelled as proposed targets.

---

# 12. Risk Management

Identify:

* Technical risks
* Product risks
* UX risks
* Security risks
* Scaling risks
* Integration risks
* Adoption risks
* Scope risks

For each:

* Probability
* Impact
* Mitigation

---

# 13. Build vs Defer

Create two explicit lists.

## Build

Capabilities that should be implemented.

## Defer

Capabilities that should not be implemented yet.

Explain why each deferred capability is lower priority.

---

# 14. Final Recommendation

Answer these questions directly:

### Question 1

What prevents SchoolOS from being considered a credible commercial school-management platform today?

List the exact **5–10 most important problems**.

### Question 2

What exact features should be implemented next?

### Question 3

What should be fixed before adding new functionality?

### Question 4

What should NOT be built yet?

### Question 5

What can make SchoolOS meaningfully better than global competitors rather than merely equivalent?

### Question 6

What should become the product's strongest differentiator?

### Question 7

What should the team build over the next 6 months?

### Question 8

What should the team build over the next 12 months?

---

# 15. Final Executive Summary

End with a concise:

## "If I Were the Product & Engineering Lead"

Provide:

### Top 10 priorities

### Recommended sprint order

### Major architectural decisions

### Major UI decisions

### Features to defer

### Competitive strategy

### Product positioning

### 6-month outcome

### 12-month outcome

The final recommendation should be decisive.

Do not provide a list of every possible feature.

Recommend the smallest set of initiatives capable of turning the current MVP into a strong commercial product.

---

## Recommended execution order

These five prompts should **not** all be run independently with no dependency. The best sequence is:

```text
                    ┌─────────────────────┐
                    │  PREVIOUS RESEARCH  │
                    │   = MVP BASELINE    │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ↓                           ↓
       ┌──────────────────┐        ┌──────────────────┐
       │ 1. REPO AUDIT    │        │ 2. COMPETITOR    │
       │                  │        │    RESEARCH      │
       │ What exists?     │        │ What exists      │
       │ What works?      │        │ globally?        │
       └────────┬─────────┘        └────────┬─────────┘
                │                           │
                └─────────────┬─────────────┘
                              ↓
                  ┌──────────────────────┐
                  │ 3. GAP ANALYSIS      │
                  │                      │
                  │ What is missing?     │
                  │ What matters most?   │
                  └──────────┬───────────┘
                             │
                ┌────────────┴────────────┐
                ↓                         ↓
      ┌──────────────────┐      ┌──────────────────┐
      │ 4. UI/UX AUDIT   │      │ Feature/Tech     │
      │                  │      │ Priorities       │
      │ What needs       │      │                  │
      │ modernization?   │      │                  │
      └────────┬─────────┘      └────────┬─────────┘
               │                         │
               └────────────┬────────────┘
                            ↓
                ┌────────────────────────┐
                │ 5. FINAL ROADMAP       │
                │                        │
                │ Sprints                │
                │ Dependencies           │
                │ Architecture           │
                │ UI modernization       │
                │ 6/12 month roadmap     │
                │ Final recommendation   │
                └────────────────────────┘
```