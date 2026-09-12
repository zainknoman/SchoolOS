# Sprint L — Cross-Tenant/Cross-Campus Access Control (Security)

Status: approved (design), ready for implementation planning.
Spec source: `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`'s Implementation Checklist,
Sprint L; confirmed finding recorded in `build/MASTER-PROMPT-TRACKER.md`.

## Problem (confirmed via direct code inspection, 2026-09-12)

`StudentAccessService.assertCanAccessStudent()` (`backend/src/common/student-access.service.ts:24-26`)
is the one shared chokepoint most student-scoped routes call to decide "can this caller see/act on
this student." Today it does this:

```ts
const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];
// ...
if (STAFF_ROLES.includes(user.role)) {
  return; // no further check at all
}
```

Any staff role bypasses every check unconditionally. Auditing every `TEACHER`-accessible controller
surfaced a second, worse gap: several routes never call this chokepoint at all —

| Route | Current guard | Gap |
|---|---|---|
| `GET sections/:id/attendance` | `@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')` only | any teacher reads any section's attendance, any campus |
| `POST attendance` | `@Roles(...)` only | any teacher marks attendance for any student |
| `POST attendance/bulk` | `@Roles(...)` only | same, batched |
| `POST /diary` | `@Roles(...)` only | any teacher writes a diary entry against any section |
| `GET sections/:id/diary` | `@Roles(...)` only | any teacher reads any section's diary |
| `POST /complaints` | `@Roles(...)` only | any teacher raises a complaint against any student |
| `POST /report-cards` | `@Roles(...)` only | any teacher uploads a report card for any student |
| `GET sections/:id/students` | `@Roles(...)` only | any teacher reads any section's roster |

Routes that *do* call `assertCanAccessStudent` (student timetable/attendance/diary/complaints/report-card
reads, attendance-risk) are fixed the moment that one method is fixed.

## Scope decision (confirmed with user, 2026-09-12)

The product will be operated as multi-tenant SaaS in the future (a `School` per tenant), not
single-school forever, despite `README.md:176`'s current "single-school platform" framing. Rather than
building a campus-only fix now and a tenant-scoping fix later, tenant scoping is folded into this
sprint:

- `SUPER_ADMIN` — unrestricted (cross-tenant platform operator role).
- `SCHOOL_ADMIN` / `ACCOUNTS` — scoped to their own tenant (`School`), not campus — an admin
  legitimately manages every campus within their own school, per the earlier "admin/accounts
  school-wide, teacher per-campus" decision, but must **not** reach a different school's data once
  more than one `School` row exists.
- `TEACHER` — scoped to their own campus (`Campus`), the tightest boundary, since a teacher's job is
  one campus's classes.
- `PARENT` — unchanged; the existing `StudentParent` link check is already tenant-safe (a link either
  exists or it doesn't — no role-wide bypass to close).

No new "admin creation" endpoint is built here — `SCHOOL_ADMIN`/`ACCOUNTS` accounts are only ever
created via `prisma/seed.ts` today (confirmed: no runtime creation code path exists for these two
roles). `schoolId` gets backfilled there; a future admin-creation endpoint will need to collect it,
noted as a follow-up, not built now.

## Data model changes

```prisma
model Teacher {
  // ...existing fields...
  campusId String
  campus   Campus @relation(fields: [campusId], references: [id], onDelete: Restrict)

  @@index([campusId])
}

model User {
  // ...existing fields...
  schoolId String?
  school   School? @relation(fields: [schoolId], references: [id], onDelete: Restrict)

  @@index([schoolId])
}
```

- `Teacher.campusId` is **required** (`NOT NULL`) — every teacher has exactly one home campus.
  `onDelete: Restrict` (matches the existing convention on `Enrollment.campus`/`Enrollment.section`)
  so a campus can't be deleted out from under an assigned teacher.
- `User.schoolId` is **nullable** at the DB level (`SUPER_ADMIN`, `TEACHER`, and `PARENT` rows leave
  it `null` — a teacher's tenant is derived via `Teacher.campusId → Campus.schoolId`, never
  duplicated onto `User`) but is an **application-level invariant** that every `SCHOOL_ADMIN`/
  `ACCOUNTS` row has one. `assertCanAccessStudent`/`assertCanAccessSection` fail closed (deny, not
  throw-away-allow) if a `SCHOOL_ADMIN`/`ACCOUNTS` user is ever found with `schoolId: null` — this
  should never happen post-migration, but the check exists so a future bug can't silently grant
  cross-tenant access.

## Enforcement design

`backend/src/common/student-access.service.ts` is rewritten with one branch per role instead of the
current blanket bypass:

```ts
export interface RequestUser {
  id: string;
  role: string;
}

@Injectable()
export class StudentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async assertCanAccessStudent(user: RequestUser, studentId: string): Promise<void> {
    const scope = await this.resolveStudentScope(studentId);
    await this.assertCanAccessScope(user, scope);
  }

  async assertCanAccessSection(user: RequestUser, sectionId: string): Promise<void> {
    const scope = await this.resolveSectionScope(sectionId);
    await this.assertCanAccessScope(user, scope);
  }

  private async assertCanAccessScope(
    user: RequestUser,
    scope: { campusId: string; schoolId: string } | null,
  ): Promise<void> {
    if (user.role === 'SUPER_ADMIN') {
      return;
    }
    if (!scope) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    if (user.role === 'SCHOOL_ADMIN' || user.role === 'ACCOUNTS') {
      const admin = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!admin?.schoolId || admin.schoolId !== scope.schoolId) {
        throw new ForbiddenException('You do not have access to this resource');
      }
      return;
    }
    if (user.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher || teacher.campusId !== scope.campusId) {
        throw new ForbiddenException('You do not have access to this resource');
      }
      return;
    }
    // PARENT (or any other role): must have a StudentParent link — only meaningful for the
    // per-student path; assertCanAccessSection has no PARENT-accessible caller.
    const link = await this.prisma.studentParent.findFirst({
      where: { student: { id: scope.studentId }, parentProfile: { userId: user.id } },
    });
    if (!link) {
      throw new ForbiddenException('You do not have access to this student');
    }
  }

  private async resolveStudentScope(studentId: string) {
    // Reuses EnrollmentService rather than re-querying Enrollment directly — it's already the
    // one place every module resolves "current enrollment," documented there for exactly this
    // reason (avoids re-diverging the definition of "current" the way pre-Enrollment code did).
    let enrollment;
    try {
      enrollment = await this.enrollmentService.getCurrentEnrollment(studentId);
    } catch {
      return null; // NotFoundException ("no active enrollment") -> no scope -> deny below
    }
    const campus = await this.prisma.campus.findUniqueOrThrow({
      where: { id: enrollment.campusId },
      select: { schoolId: true },
    });
    return { campusId: enrollment.campusId, schoolId: campus.schoolId, studentId };
  }

  private async resolveSectionScope(sectionId: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: { include: { campus: { select: { schoolId: true } } } } },
    });
    return section
      ? { campusId: section.class.campusId, schoolId: section.class.campus.schoolId }
      : null;
  }
}
```

Notes on this shape:
- The `PARENT` branch needs `studentId`, which `resolveSectionScope` never has — reflected in the
  `scope` type carrying an optional `studentId` only `resolveStudentScope` populates. Kept inline
  above for readability; the actual task will type this precisely (e.g. a discriminated union) rather
  than a loosely-optional field, per the "no placeholders" rule in `writing-plans`.
- A student with no `ACTIVE` enrollment (e.g. withdrawn) resolves to `null` scope → denied for every
  role except `SUPER_ADMIN`. This is a deliberate fail-closed default, not an oversight — matches the
  existing codebase's fail-closed convention (the old parent check already threw on no-link).
- No JWT/`RequestUser` shape change. `{ id, role }` stays exactly as-is; every fresh check re-reads
  `Teacher.campusId`/`User.schoolId` from the DB, mirroring the existing parent-link check's pattern
  (always current, no stale-JWT-claim problem if an admin's school assignment or a teacher's campus
  ever changes mid-session).

## Module wiring (confirmed by reading every affected module)

`StudentAccessService` gaining a constructor dependency on `EnrollmentService` isn't free — NestJS
requires it in the same module's `providers`. Checked every module that currently provides
`StudentAccessService`:

- Already provide both (no change needed): `attendance`, `diary`, `leave`, `messages`, `timetable`.
- Provide `StudentAccessService` but **not** `EnrollmentService` (must add it or the app fails to
  boot with a DI resolution error): `attendance-risk`, `complaints`, `fees`, `report-cards`.
- Provide **neither** today (must add both, since this spec adds its first `StudentAccessService`
  call to this module's controller): `sections`.

## Routes to update (adds the missing call; no route's existing behavior otherwise changes)

| File | Route | Call to add |
|---|---|---|
| `backend/src/attendance/attendance.controller.ts` | `GET sections/:id/attendance` | `assertCanAccessSection` |
| `backend/src/attendance/attendance.controller.ts` | `POST attendance` | `assertCanAccessStudent` (dto.studentId) |
| `backend/src/attendance/attendance.controller.ts` | `POST attendance/bulk` | `assertCanAccessStudent` per `marks[].studentId` (dto has no shared sectionId) |
| `backend/src/diary/diary.controller.ts` | `POST /diary` | `assertCanAccessSection` (dto.sectionId) |
| `backend/src/diary/diary.controller.ts` | `GET sections/:id/diary` | `assertCanAccessSection` |
| `backend/src/complaints/complaints.controller.ts` | `POST /complaints` | `assertCanAccessStudent` (dto.studentId) |
| `backend/src/report-cards/report-cards.controller.ts` | `POST /report-cards` | `assertCanAccessStudent` (`req.body.studentId`, already extracted before the service call) |
| `backend/src/sections/sections.controller.ts` | `GET :id/students` | `assertCanAccessSection` |

## Migration & backfill

1. Prisma migration adds `Teacher.campusId` (`NOT NULL`) and `User.schoolId` (nullable).
2. `prisma/seed.ts`: assign each seeded teacher the `campusId` of the section they already teach in
   seed data; assign the seeded `SCHOOL_ADMIN`/`ACCOUNTS` users the seeded `School`'s id.
3. `CreateTeacherDto` gains a required `campusId: string`; `TeacherService.create()` passes it through
   to `tx.teacher.create()`.
4. `staff-console/src/views/TeacherManagementView.vue` gets a campus picker (reusing whatever
   campus-select pattern `ClassManagementView.vue`/`HolidaysView.vue` already use, per
   `[[project-dev-workflow]]`'s "follow existing patterns" convention) so creating a teacher through
   the UI can't skip campus assignment.

## Testing plan

Follows the existing e2e convention already used in the P0 test-coverage backfill (ad-hoc
`School`/`Campus` fixtures per test file, e.g. `holidays-complaints-report-cards.e2e-spec.ts`'s
`'PC E2E School'` fixture):

- **Unit** (`student-access.service.spec.ts`): one case per role branch × per outcome — `SUPER_ADMIN`
  always allowed; `SCHOOL_ADMIN`/`ACCOUNTS` allowed same-school, denied cross-school (including the
  `schoolId: null` fail-closed case); `TEACHER` allowed same-campus, denied cross-campus-same-school,
  denied cross-school; `PARENT` unchanged (existing cases stay green).
- **E2E** (new `cross-tenant-access.e2e-spec.ts` or extending an existing file): seed a second
  `School` + `Campus` + `Teacher`/`SCHOOL_ADMIN` pair alongside the primary fixture, then assert 403s
  across every route in the table above when the cross-tenant/cross-campus actor calls it, and 200s
  for the legitimate same-scope actor — mirroring the existing parent-isolation e2e pattern.
- Full backend suite (currently 360 unit / 97 e2e) must stay green; this sprint's new tests add to it,
  not replace anything.

## Non-goals (explicit, not silently dropped)

- `GET /sections` (list-all, used for admin dropdowns) stays unfiltered by campus/tenant — section
  names alone aren't sensitive data, and filtering it is a UI nicety, not a security requirement.
  Follow-up, not blocking.
- No runtime `SCHOOL_ADMIN`/`ACCOUNTS` creation endpoint is built — out of scope, none exists today.
- No JWT payload change, no new NestJS guard/decorator infrastructure, no Prisma-level row-filter
  middleware — per the earlier approach decision, this sprint uses the existing explicit-service-call
  convention only.
- Full multi-tenant SaaS (tenant provisioning, billing, per-tenant subdomain/branding, tenant-aware
  rate limiting, etc.) is not this sprint's scope — only the access-control boundary is made
  tenant-aware, matching what's needed to close the confirmed security gap without overbuilding
  infrastructure nothing yet uses.
