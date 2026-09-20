# SchoolOS — Product Overview

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/**`, `backend/prisma/schema.prisma`, `staff-console/src/router/index.ts`, `parent-app/lib/src/**` · **Owner:** Product Owner

## What SchoolOS is

A school management system (student information system plus fees, communication and academics) for **multiple schools, each with one or more campuses**, in a Pakistan-first context (English and Urdu/RTL, PKR-style fee amounts stored as integers, JazzCash/EasyPaisa payment adapters). One API serves two clients:

| Surface | Users | Purpose |
|---|---|---|
| Staff console (Vue web) | Super Admin, School Admin (incl. Principal view), Accounts, Teacher | Run the school: people, structure, timetable, attendance, diary, gradebook, admissions, hiring, fees, leave, complaints, circulars, messages, promotion, bulk import |
| Parent app (Flutter) | Parent | See each child's attendance, diary, timetable, circulars, fees; pay vouchers; message the school; apply for leave; raise complaints; see report cards |

## Scope boundaries (verified)

| Not in SchoolOS today | Evidence |
|---|---|
| Student logins | `Role` has no STUDENT; `User` links to `Teacher`/`ParentProfile` only |
| Parent web portal | No code in repo (planned per archived status log) |
| Payroll / HR beyond staff records and hiring pipeline | No payroll models in `schema.prisma` |
| Object storage (S3) | Only `LocalDiskStorageAdapter` |
| Automated report-card generation from marks | `POST /report-cards` records a card; gradebook computes weighted grades separately (see BR-RC-01) |
| Multi-tenant SaaS self-service | Provisioning is SUPER_ADMIN-only; some structures are platform-global (see BR-ORG-01) |

## Tenancy model

`School → Campus → Class (per academic session) → Section`. Users carry `schoolId` and optionally `campusId`. A SCHOOL_ADMIN with `campusId = null` is school-wide; with a `campusId` they are confined to that campus (`OrgScopeService`). SUPER_ADMIN is unrestricted. `AcademicSession`, `Subject`, `FeeStructure` and `Term` sit outside this hierarchy (no `schoolId`) — see [BUSINESS-RULES.md](BUSINESS-RULES.md) Q1–Q3.

## Maturity

Pre-production. See [`../../PROJECT-STATUS.md`](../../PROJECT-STATUS.md) for subsystem status and known gaps. Related: [personas & roles](PERSONAS-AND-ROLES.md) · [feature catalog](FEATURE-CATALOG.md) · [business rules](BUSINESS-RULES.md) · [glossary](GLOSSARY.md) · [journey](../workflows/PRODUCT-JOURNEY.md).
