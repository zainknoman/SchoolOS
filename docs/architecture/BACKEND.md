# Backend Architecture

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/**`, `backend/prisma/**`, `backend/package.json` · **Owner:** project owner

**Stack:** NestJS 11, Prisma 7.10 + `@prisma/adapter-pg` (PostgreSQL), Passport-JWT, argon2, class-validator/transformer, `@nestjs/throttler`, `@nestjs/schedule`, multer, pdfkit, nodemailer, firebase-admin, `@anthropic-ai/sdk`, csv-parse.

## Module map (`AppModule` imports)
| Group | Modules |
|---|---|
| Platform | `PrismaModule`, `ConfigModule` (global), `ScheduleModule`, `ThrottlerModule`, `OrgScopeModule` |
| Identity | `AuthModule` (login, refresh, reset, guards, JWT strategy), `MeModule` |
| Org | `SchoolModule`, `CampusModule`, `AcademicSessionModule`, `ClassModule`, `SectionsModule`, `SubjectsModule` |
| People | `StudentModule`, `ParentModule`, `TeacherModule`, `TeachersModule`, `StaffModule`, `HiringModule`, `AdmissionsModule`, `PromotionsModule`, `BulkImportModule` |
| Academics | `TimetableModule`, `AttendanceModule`, `AttendanceRiskModule`, `DiaryModule`, `GradebookModule`, `ReportCardsModule`, `HolidaysModule` |
| Communication | `CircularsModule`, `MessagesModule`, `NotificationsModule`, `ComplaintsModule`, `LeaveModule`, `AiDraftingModule` |
| Finance | `FeesModule` (+ gateways, webhook) |
| Files | `FilesModule`, `StorageModule` |
| Reporting | `DashboardModule` |

`enrollment/` is a service consumed by other modules rather than imported at the top level.

## Layering
Controller (routing, `@Roles`, DTO) → service (rules, scoping, transactions) → `PrismaService`. Shared cross-cutting services live in `src/common/`: `OrgScopeService` (caller → allowed campuses), `StudentAccessService` (student/section/class access and teacher assignment), `prisma-create-guard` / `prisma-delete-guard` (translate unique/FK errors to 4xx), `create-principal-user`, `normalize-identifier`.

## Adapters (interface + development fallback)
| Concern | Interface | Implementations | Selection |
|---|---|---|---|
| File storage | `StorageAdapter` (`storage/storage-adapter.ts`) | `LocalDiskStorageAdapter` only | fixed in `storage.module.ts`; directory `UPLOADS_DIR` or `./uploads` |
| Payments | gateway adapter factory (`fees/gateways/`) | JazzCash, EasyPaisa, stub | env presence (`gateway-config.ts`) |
| Push | `PushAdapter` | `FcmPushAdapter`, `LoggingPushAdapter` | `FIREBASE_*` presence |
| Mail | `MailAdapter` | `SmtpMailAdapter`, `LoggingMailAdapter` | `SMTP_*` presence |
| SMS / WhatsApp | `PushAdapter` shape via `channel-registry.ts` | `SmsAdapter` (**placeholder URL** `https://api.sms-gateway.example.pk/v1/send`, `sms-sender.ts:18`), `WhatsAppAdapter` (Meta Graph API, `whatsapp-sender.ts:17`) | env presence |
| AI drafting | `ai-drafting-provider.ts` | Anthropic, stub | `ANTHROPIC_API_KEY` |

Rule (`*-config.ts`): a provider with *some but not all* variables set is a startup error outside development/test; none set → fallback.

## Scheduled jobs (in-process)
| Job | Schedule | Purpose |
|---|---|---|
| `AttendanceRiskJob` | `0 3 * * *` | flag high-absence students |
| `DigestDispatchJob` | `*/15 * * * *` | send bundled digest notifications |

They run inside every backend instance; no distributed lock (single-instance assumption).

## Cross-cutting behaviour
Validation: global `ValidationPipe`. Errors: Nest defaults plus `prisma-*-guard`. Audit: many services write `AuditLog` rows (`userId`, `action`, `entity`, `entityId`). Notification delivery is best-effort: `notifications.service.ts:72` logs and swallows failures; no retry. PDFs (vouchers, receipts, report cards) via pdfkit.
