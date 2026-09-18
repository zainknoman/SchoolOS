# Diary/Homework + Circulars (FEAT-008, FEAT-009) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship section-scoped diary/homework entries (with Urdu-aware attachments) and school/section-scoped circulars with read-tracking, across the NestJS backend, the Vue staff console, and the Flutter parent app.

**Architecture:** Two new backend feature modules (`diary`, `circulars`) plus two small shared modules (`storage` for local-disk file persistence, `files` for upload/download), all following the existing `attendance`/`timetable` module shape — controller + service + DTO, `@Roles()` guards, `StudentAccessService`/`FilesAccessService` for parent-isolation, audit-logged writes. Both clients get new screens wired into their existing role-gated navigation; Diary fills an already-scaffolded placeholder tab, Circulars fills the "Notifications" bottom-nav slot.

**Tech Stack:** NestJS + Prisma (SQLite dev) + class-validator + Jest/Supertest; Vue 3 + Pinia + Vitest/@vue/test-utils; Flutter + Provider + go_router + flutter_test, `google_fonts` for the Urdu font.

**Spec:** `docs/superpowers/specs/2026-08-27-diary-circulars-design.md`

## Global Constraints

- Every write endpoint creates an `AuditLog` row (`attendance.mark`/`circular.publish` precedent).
- Parent-isolation is enforced only through the shared `StudentAccessService` (student-scoped) and the new `FilesAccessService` (file-scoped) — never re-implemented ad hoc in a controller.
- All new DTOs use `class-validator` decorators; the app's global `ValidationPipe({ whitelist: true, transform: true })` enforces them, same as every existing DTO.
- RTL/Urdu handling is pure Unicode script detection (first strong-directionality character) — no language identification, no translation.
- File storage is local-disk only this sprint, behind the `STORAGE_ADAPTER` injection token — swapping to S3 later is a one-file change (Sprint 11-12), not part of this plan.
- A teacher token can act on any section (no per-teacher section-ownership check) — matches the existing Attendance/Timetable precedent, not a new gap.

---

## Task 1: Schema migration + seed data

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Modify: `build/.gitignore`

**Interfaces:**
- Produces: `DiaryEntry.sectionId`, `Circular.sectionId`, `CircularRecipient` model — every later backend task reads/writes these.

- [ ] **Step 1: Edit `schema.prisma`**

Replace the `DiaryEntry` model:

```prisma
model DiaryEntry {
  id          String            @id @default(uuid())
  sectionId   String
  section     Section           @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  subjectId   String
  subject     Subject           @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacherId   String
  teacher     Teacher           @relation(fields: [teacherId], references: [id])
  date        DateTime
  text        String
  dueDate     DateTime?
  attachments DiaryAttachment[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@unique([sectionId, subjectId, date])
  @@index([sectionId])
}
```

(this drops the `students Student[] @relation("DiaryEntryStudents")` field and adds `sectionId`/`section` + the unique constraint.)

Remove the now-unused back-relation from `Student`:

```prisma
  diaryReads      DiaryEntry[]     @relation("DiaryEntryStudents")
```

Add a back-relation on `Section` (next to the existing `timetables Timetable[]` line):

```prisma
  diaryEntries DiaryEntry[]
  circulars    Circular[]
```

Replace the `Circular` model:

```prisma
model Circular {
  id          String               @id @default(uuid())
  title       String
  description String
  scope       String               // "school" | "section"
  sectionId   String?
  section     Section?             @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  priority    String               @default("normal")
  authorId    String
  author      User                 @relation("CircularAuthor", fields: [authorId], references: [id])
  publishedAt DateTime             @default(now())
  expiresAt   DateTime?
  attachments CircularAttachment[]
  recipients  CircularRecipient[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([sectionId])
}
```

Add a new model, right after `Circular`:

```prisma
model CircularRecipient {
  id         String    @id @default(uuid())
  circularId String
  circular   Circular  @relation(fields: [circularId], references: [id], onDelete: Cascade)
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  readAt     DateTime?
  createdAt  DateTime  @default(now())

  @@unique([circularId, userId])
  @@index([userId])
}
```

Add the back-relation on `User` (next to `circularsCreated Circular[] @relation("CircularAuthor")`):

```prisma
  circularRecipients CircularRecipient[]
```

- [ ] **Step 2: Reset and re-migrate the dev database**

Both `DiaryEntry` and `Circular` are currently empty tables in `dev.db`, so this is safe — no data migration concern.

```bash
cd backend
rm -f prisma/dev.db
npx prisma migrate dev --name diary_circulars
```

Expected: a new migration folder under `prisma/migrations/`, `dev.db` recreated with the updated schema, "Your database is now in sync with your schema."

- [ ] **Step 3: Add diary/circular sample data to `seed.ts`**

First, capture the admin user's id (currently discarded) — change:

```ts
  // Admin has no domain profile row (no Teacher/ParentProfile) — the role on User is enough for the
  // staff console's RBAC-gated nav.
  await prisma.user.create({
    data: {
      identifier: 'admin@schoolos.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'SCHOOL_ADMIN',
    },
  });
```

to:

```ts
  // Admin has no domain profile row (no Teacher/ParentProfile) — the role on User is enough for the
  // staff console's RBAC-gated nav.
  const adminUser = await prisma.user.create({
    data: {
      identifier: 'admin@schoolos.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'SCHOOL_ADMIN',
    },
  });
```

Then, after the attendance block (after the `await prisma.attendance.createMany({...})` call, before the final `console.log` calls), add:

```ts
  // --- Diary: one sample homework entry for section 3A ---
  const diaryEntry = await prisma.diaryEntry.create({
    data: {
      sectionId: section3A.id,
      subjectId: subjects[0].id,
      teacherId: teacher.id,
      date: today,
      text: 'کتاب صفحہ 12 مکمل کریں۔ کل اپنی ورک بک لائیں۔',
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
    },
  });
  void diaryEntry;

  // --- Circular: one school-wide sample notice, delivered to both seeded parents ---
  const circular = await prisma.circular.create({
    data: {
      title: 'Parent-Teacher Meeting — September',
      description: 'PTMs for all grades will be held on the first Saturday of September, 9am-1pm.',
      scope: 'school',
      priority: 'normal',
      authorId: adminUser.id,
    },
  });
  await prisma.circularRecipient.createMany({
    data: [parentAUser.id, parentBUser.id].map((userId) => ({ circularId: circular.id, userId })),
  });
```

Update the final `console.log` to also report these:

```ts
  console.log(
    'Seeded: 1 school, 2 campuses, 1 class/section, 1 teacher, 1 admin, 1 student, 2 linked parents, ' +
      `${timetableRows.length} timetable periods, ${attendanceDates.length} attendance records, ` +
      '1 diary entry, 1 circular.',
  );
```

- [ ] **Step 4: Re-seed and verify**

```bash
npm run prisma:seed
```

Expected: seed script logs "...1 diary entry, 1 circular." with no errors.

- [ ] **Step 5: Ignore local upload storage**

Add to `build/.gitignore` (in the "monorepo build output / deps / local env" section):

```
backend/uploads/
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts ../.gitignore
git commit -m "Add sectionId to DiaryEntry, sectionId+CircularRecipient to Circular; seed sample rows"
```

---

## Task 2: Local-disk storage adapter

**Files:**
- Create: `backend/src/storage/storage-adapter.ts`
- Create: `backend/src/storage/local-disk-storage.adapter.ts`
- Create: `backend/src/storage/local-disk-storage.adapter.spec.ts`
- Create: `backend/src/storage/storage.module.ts`

**Interfaces:**
- Produces: `StorageAdapter` interface (`save(buffer, extension): Promise<string>`, `read(storageKey): Promise<Buffer>`, `delete(storageKey): Promise<void>`), `STORAGE_ADAPTER` injection token, `StorageModule` (exports `STORAGE_ADAPTER`) — consumed by Task 3's `FilesModule`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/storage/local-disk-storage.adapter.spec.ts`:

```ts
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';

describe('LocalDiskStorageAdapter', () => {
  let dir: string;
  let adapter: LocalDiskStorageAdapter;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'schoolos-storage-'));
    process.env.UPLOADS_DIR = dir;
    adapter = new LocalDiskStorageAdapter();
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves a buffer and returns a storage key ending in the given extension', async () => {
    const key = await adapter.save(Buffer.from('hello'), '.pdf');
    expect(key).toMatch(/\.pdf$/);
    expect(existsSync(join(dir, key))).toBe(true);
  });

  it('reads back exactly what was saved', async () => {
    const key = await adapter.save(Buffer.from('hello world'), '.txt');
    const readBack = await adapter.read(key);
    expect(readBack.toString()).toBe('hello world');
  });

  it('deletes a saved file', async () => {
    const key = await adapter.save(Buffer.from('bye'), '.txt');
    await adapter.delete(key);
    expect(existsSync(join(dir, key))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest local-disk-storage.adapter.spec.ts`
Expected: FAIL — `local-disk-storage.adapter.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `backend/src/storage/storage-adapter.ts`:

```ts
export interface StorageAdapter {
  save(buffer: Buffer, extension: string): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';
```

Create `backend/src/storage/local-disk-storage.adapter.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { StorageAdapter } from './storage-adapter';

@Injectable()
export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly rootDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(this.rootDir, { recursive: true });
    const storageKey = `${randomUUID()}${extension}`;
    await writeFile(join(this.rootDir, storageKey), buffer);
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(join(this.rootDir, storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(join(this.rootDir, storageKey), { force: true });
  }
}
```

Create `backend/src/storage/storage.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { STORAGE_ADAPTER } from './storage-adapter';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';

@Module({
  providers: [{ provide: STORAGE_ADAPTER, useClass: LocalDiskStorageAdapter }],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest local-disk-storage.adapter.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/storage
git commit -m "Add local-disk StorageAdapter behind a swappable injection token"
```

---

## Task 3: Files module (upload + access-controlled download)

**Files:**
- Modify: `backend/package.json` (add `multer` dependency, `@types/multer` devDependency)
- Modify: `backend/src/auth/strategies/jwt.strategy.ts`
- Create: `backend/src/files/files.service.ts`
- Create: `backend/src/files/files.service.spec.ts`
- Create: `backend/src/files/files-access.service.ts`
- Create: `backend/src/files/files-access.service.spec.ts`
- Create: `backend/src/files/files.controller.ts`
- Create: `backend/src/files/files.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `STORAGE_ADAPTER` / `StorageAdapter` (Task 2), `RequestUser` from `../common/student-access.service` (existing).
- Produces: `POST /api/v1/files`, `GET /api/v1/files/:id` — consumed by Diary/Circulars (Task 4/5) for `fileIds` and by both clients for attachment upload/download (Task 9-12).

- [ ] **Step 1: Add dependencies**

```bash
cd backend
npm install multer
npm install --save-dev @types/multer
```

- [ ] **Step 2: Write the failing tests**

Create `backend/src/files/files.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER } from '../storage/storage-adapter';

describe('FilesService', () => {
  let service: FilesService;
  let prisma: { file: { create: jest.Mock; findUnique: jest.Mock } };
  let storage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    prisma = { file: { create: jest.fn(), findUnique: jest.fn() } };
    storage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_ADAPTER, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(FilesService);
  });

  it('saves the buffer via the storage adapter and records a File row', async () => {
    storage.save.mockResolvedValue('abc123.pdf');
    prisma.file.create.mockResolvedValue({
      id: 'file-1',
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });

    const result = await service.upload({
      buffer: Buffer.from('hello'),
      originalname: 'sheet.pdf',
      mimetype: 'application/pdf',
      size: 10,
    } as Express.Multer.File);

    expect(storage.save).toHaveBeenCalledWith(Buffer.from('hello'), '.pdf');
    expect(prisma.file.create).toHaveBeenCalledWith({
      data: {
        storageKey: 'abc123.pdf',
        originalName: 'sheet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
      },
    });
    expect(result).toEqual({
      id: 'file-1',
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
  });

  it('reads a file back via the storage adapter', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'file-1',
      storageKey: 'abc123.pdf',
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
    });
    storage.read.mockResolvedValue(Buffer.from('hello'));

    const result = await service.read('file-1');

    expect(storage.read).toHaveBeenCalledWith('abc123.pdf');
    expect(result).toEqual({
      buffer: Buffer.from('hello'),
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('throws NotFoundException for an unknown file id', async () => {
    prisma.file.findUnique.mockResolvedValue(null);
    await expect(service.read('missing')).rejects.toThrow(NotFoundException);
  });
});
```

Create `backend/src/files/files-access.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { FilesAccessService } from './files-access.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FilesAccessService', () => {
  let service: FilesAccessService;
  let prisma: {
    diaryAttachment: { findFirst: jest.Mock };
    circularAttachment: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      diaryAttachment: { findFirst: jest.fn() },
      circularAttachment: { findFirst: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [FilesAccessService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(FilesAccessService);
  });

  it('allows any staff role without checking attachments', async () => {
    await service.assertCanAccessFile({ id: 'u1', role: 'TEACHER' }, 'file-1');
    expect(prisma.diaryAttachment.findFirst).not.toHaveBeenCalled();
  });

  it("allows a parent whose child's section has a diary entry with this attachment", async () => {
    prisma.diaryAttachment.findFirst.mockResolvedValue({ id: 'att-1' });
    await service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'file-1');
  });

  it('allows a parent who is a recipient of a circular with this attachment', async () => {
    prisma.diaryAttachment.findFirst.mockResolvedValue(null);
    prisma.circularAttachment.findFirst.mockResolvedValue({ id: 'att-1' });
    await service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'file-1');
  });

  it('rejects a parent with no diary or circular link to this file', async () => {
    prisma.diaryAttachment.findFirst.mockResolvedValue(null);
    prisma.circularAttachment.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'file-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/files`
Expected: FAIL — none of the implementation files exist yet.

- [ ] **Step 4: Implement**

Create `backend/src/files/files.service.ts`:

```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER, StorageAdapter } from '../storage/storage-adapter';

export interface FileMeta {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async upload(file: Express.Multer.File): Promise<FileMeta> {
    const storageKey = await this.storage.save(file.buffer, extname(file.originalname));
    const record = await this.prisma.file.create({
      data: {
        storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
    return {
      id: record.id,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }

  async read(fileId: string): Promise<{ buffer: Buffer; originalName: string; mimeType: string }> {
    const record = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!record) {
      throw new NotFoundException('File not found');
    }
    const buffer = await this.storage.read(record.storageKey);
    return { buffer, originalName: record.originalName, mimeType: record.mimeType };
  }
}
```

Create `backend/src/files/files-access.service.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/student-access.service';

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];

/**
 * File-scoped counterpart to StudentAccessService — a parent may only read a file that's
 * actually attached to a diary entry in their child's section, or a circular they're a
 * recipient of. Staff may read any file.
 */
@Injectable()
export class FilesAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessFile(user: RequestUser, fileId: string): Promise<void> {
    if (STAFF_ROLES.includes(user.role)) {
      return;
    }

    const viaDiary = await this.prisma.diaryAttachment.findFirst({
      where: {
        fileId,
        diaryEntry: {
          section: {
            students: { some: { parents: { some: { parentProfile: { userId: user.id } } } } },
          },
        },
      },
    });
    if (viaDiary) return;

    const viaCircular = await this.prisma.circularAttachment.findFirst({
      where: { fileId, circular: { recipients: { some: { userId: user.id } } } },
    });
    if (viaCircular) return;

    throw new ForbiddenException('You do not have access to this file');
  }
}
```

Create `backend/src/files/files.controller.ts`:

```ts
import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { FilesAccessService } from './files-access.service';
import { RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly filesAccess: FilesAccessService,
  ) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.filesService.upload(file);
  }

  @Get(':id')
  async download(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    await this.filesAccess.assertCanAccessFile(req.user, id);
    const { buffer, originalName, mimeType } = await this.filesService.read(id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${originalName}"`,
    });
    res.send(buffer);
  }
}
```

Create `backend/src/files/files.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesAccessService } from './files-access.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [FilesController],
  providers: [FilesService, FilesAccessService],
})
export class FilesModule {}
```

Modify `backend/src/auth/strategies/jwt.strategy.ts` — a plain download link (an `<a>`/`<img>` tag, or Flutter's `url_launcher`) can't set an `Authorization` header, so also accept the token as `?access_token=`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Header is tried first; ?access_token= is a fallback so a direct file-download link
      // (which can't set headers) still authenticates.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'dev-only-change-me-access',
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role };
  }
}
```

Modify `backend/src/app.module.ts` — add the import and register it:

```ts
import { FilesModule } from './files/files.module';
```

```ts
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MeModule,
    TimetableModule,
    AttendanceModule,
    SectionsModule,
    FilesModule,
  ],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/files`
Expected: PASS (7 tests)

- [ ] **Step 6: Run the full existing test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing suites still PASS (the JWT extractor change is additive — header auth still works for every other route).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/files src/auth/strategies/jwt.strategy.ts src/app.module.ts
git commit -m "Add Files module: upload (staff-only), access-controlled download, dual header/query JWT auth"
```

---

## Task 4: Subjects lookup + Diary backend module

**Files:**
- Create: `backend/src/subjects/subjects.service.ts`
- Create: `backend/src/subjects/subjects.service.spec.ts`
- Create: `backend/src/subjects/subjects.controller.ts`
- Create: `backend/src/subjects/subjects.module.ts`
- Create: `backend/src/diary/dto/create-diary-entry.dto.ts`
- Create: `backend/src/diary/diary.service.ts`
- Create: `backend/src/diary/diary.service.spec.ts`
- Create: `backend/src/diary/diary.controller.ts`
- Create: `backend/src/diary/diary.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `StudentAccessService` (existing, `../common/student-access.service`).
- Produces: `GET /api/v1/subjects`, `POST /api/v1/diary`, `GET /api/v1/students/:id/diary?month=`, `GET /api/v1/sections/:id/diary?month=`, and the `DiaryEntrySummary` shape `{ id, date, dueDate, subject, teacher, text, attachments: [{id, originalName, mimeType}] }` — consumed by both clients (Task 9, 11) and Task 6's e2e tests.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/subjects/subjects.service.spec.ts` (mirrors `sections.service.spec.ts`):

```ts
import { Test } from '@nestjs/testing';
import { SubjectsService } from './subjects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let prisma: { subject: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { subject: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [SubjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SubjectsService);
  });

  it('lists every subject ordered by name', async () => {
    prisma.subject.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);

    const result = await service.listAll();

    expect(prisma.subject.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    expect(result).toEqual([{ id: 'sub-1', name: 'Urdu' }]);
  });
});
```

Create `backend/src/diary/diary.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DiaryService', () => {
  let service: DiaryService;
  let prisma: {
    teacher: { findUnique: jest.Mock };
    diaryEntry: { upsert: jest.Mock; findMany: jest.Mock };
    diaryAttachment: { deleteMany: jest.Mock; createMany: jest.Mock };
    student: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      teacher: { findUnique: jest.fn() },
      diaryEntry: { upsert: jest.fn(), findMany: jest.fn() },
      diaryAttachment: { deleteMany: jest.fn(), createMany: jest.fn() },
      student: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DiaryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DiaryService);
  });

  it('creates a diary entry (upsert on sectionId+subjectId+date) and writes an audit log entry', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
    prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-1' });

    await service.createEntry(
      { sectionId: 'sec-1', subjectId: 'sub-1', date: '2026-08-27', text: 'Read chapter 3.' },
      'teacher-user-1',
    );

    expect(prisma.diaryEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sectionId_subjectId_date: {
            sectionId: 'sec-1',
            subjectId: 'sub-1',
            date: new Date('2026-08-27'),
          },
        },
        create: expect.objectContaining({ text: 'Read chapter 3.', teacherId: 'teacher-1' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'diary.create', entity: 'DiaryEntry' }),
      }),
    );
  });

  it('attaches the given files, replacing any previous attachments on the same entry', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
    prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-1' });

    await service.createEntry(
      {
        sectionId: 'sec-1',
        subjectId: 'sub-1',
        date: '2026-08-27',
        text: 'Read chapter 3.',
        fileIds: ['file-1', 'file-2'],
      },
      'teacher-user-1',
    );

    expect(prisma.diaryAttachment.deleteMany).toHaveBeenCalledWith({
      where: { diaryEntryId: 'entry-1' },
    });
    expect(prisma.diaryAttachment.createMany).toHaveBeenCalledWith({
      data: [
        { diaryEntryId: 'entry-1', fileId: 'file-1' },
        { diaryEntryId: 'entry-1', fileId: 'file-2' },
      ],
    });
  });

  it('throws NotFoundException if the posting user has no Teacher profile', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    await expect(
      service.createEntry(
        { sectionId: 'sec-1', subjectId: 'sub-1', date: '2026-08-27', text: 'x' },
        'not-a-teacher',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.diaryEntry.upsert).not.toHaveBeenCalled();
  });

  it("resolves a student's own section before listing that section's entries", async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 's1', sectionId: 'sec-1' });
    prisma.diaryEntry.findMany.mockResolvedValue([]);

    await service.getForStudent('s1', '2026-08');

    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sectionId: 'sec-1' }) }),
    );
  });

  it('throws NotFoundException for an unknown student', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    await expect(service.getForStudent('missing', '2026-08')).rejects.toThrow(NotFoundException);
  });

  it('maps entries to the summary shape the clients expect', async () => {
    prisma.diaryEntry.findMany.mockResolvedValue([
      {
        id: 'entry-1',
        date: new Date('2026-08-27'),
        dueDate: new Date('2026-08-29'),
        text: 'Read chapter 3.',
        subject: { name: 'Urdu' },
        teacher: { name: 'Ms. Sample Teacher' },
        attachments: [
          { file: { id: 'file-1', originalName: 'sheet.pdf', mimeType: 'application/pdf' } },
        ],
      },
    ]);

    const result = await service.getForSection('sec-1', '2026-08');

    expect(result).toEqual([
      {
        id: 'entry-1',
        date: '2026-08-27',
        dueDate: '2026-08-29',
        subject: 'Urdu',
        teacher: 'Ms. Sample Teacher',
        text: 'Read chapter 3.',
        attachments: [{ id: 'file-1', originalName: 'sheet.pdf', mimeType: 'application/pdf' }],
      },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/subjects src/diary`
Expected: FAIL — implementation files don't exist yet.

- [ ] **Step 3: Implement Subjects**

Create `backend/src/subjects/subjects.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SubjectSummary {
  id: string;
  name: string;
}

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<SubjectSummary[]> {
    const subjects = await this.prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return subjects.map((s) => ({ id: s.id, name: s.name }));
  }
}
```

Create `backend/src/subjects/subjects.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get()
  listAll() {
    return this.subjectsService.listAll();
  }
}
```

Create `backend/src/subjects/subjects.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService],
})
export class SubjectsModule {}
```

- [ ] **Step 4: Implement Diary**

Create `backend/src/diary/dto/create-diary-entry.dto.ts`:

```ts
import { IsArray, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDiaryEntryDto {
  @IsString()
  @MinLength(1)
  sectionId!: string;

  @IsString()
  @MinLength(1)
  subjectId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileIds?: string[];
}
```

Create `backend/src/diary/diary.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';

export interface DiaryEntrySummary {
  id: string;
  date: string;
  dueDate: string | null;
  subject: string;
  teacher: string;
  text: string;
  attachments: { id: string; originalName: string; mimeType: string }[];
}

@Injectable()
export class DiaryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert on sectionId+subjectId+date so re-posting the same section/subject/day is idempotent
   * (edits an existing entry) instead of creating duplicates — mirrors Attendance's upsert-on-
   * studentId+date pattern.
   */
  async createEntry(dto: CreateDiaryEntryDto, creatingUserId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: creatingUserId } });
    if (!teacher) {
      throw new NotFoundException('Only a teacher account can post a diary entry');
    }

    const date = new Date(dto.date);
    const entry = await this.prisma.diaryEntry.upsert({
      where: {
        sectionId_subjectId_date: { sectionId: dto.sectionId, subjectId: dto.subjectId, date },
      },
      create: {
        sectionId: dto.sectionId,
        subjectId: dto.subjectId,
        teacherId: teacher.id,
        date,
        text: dto.text,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      update: {
        teacherId: teacher.id,
        text: dto.text,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    if (dto.fileIds?.length) {
      // Clear any previous attachments, then attach the current set — keeps re-posting the same
      // section+subject+day idempotent instead of accumulating stale files.
      await this.prisma.diaryAttachment.deleteMany({ where: { diaryEntryId: entry.id } });
      await this.prisma.diaryAttachment.createMany({
        data: dto.fileIds.map((fileId) => ({ diaryEntryId: entry.id, fileId })),
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: creatingUserId,
        action: 'diary.create',
        entity: 'DiaryEntry',
        entityId: entry.id,
        metadata: JSON.stringify({
          sectionId: dto.sectionId,
          subjectId: dto.subjectId,
          date: dto.date,
        }),
      },
    });

    return entry;
  }

  async getForSection(sectionId: string, month: string): Promise<DiaryEntrySummary[]> {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const entries = await this.prisma.diaryEntry.findMany({
      where: { sectionId, date: { gte: start, lt: end } },
      orderBy: { date: 'desc' },
      include: { subject: true, teacher: true, attachments: { include: { file: true } } },
    });

    return entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      dueDate: e.dueDate ? e.dueDate.toISOString().slice(0, 10) : null,
      subject: e.subject.name,
      teacher: e.teacher.name,
      text: e.text,
      attachments: e.attachments.map((a) => ({
        id: a.file.id,
        originalName: a.file.originalName,
        mimeType: a.file.mimeType,
      })),
    }));
  }

  async getForStudent(studentId: string, month: string): Promise<DiaryEntrySummary[]> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return this.getForSection(student.sectionId, month);
  }
}
```

Create `backend/src/diary/diary.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DiaryService } from './diary.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';
import { StudentAccessService, RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
export class DiaryController {
  constructor(
    private readonly diaryService: DiaryService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('diary')
  createEntry(@Body() dto: CreateDiaryEntryDto, @Req() req: AuthenticatedRequest) {
    return this.diaryService.createEntry(dto, req.user.id);
  }

  @Get('students/:id/diary')
  async getForStudent(
    @Param('id') studentId: string,
    @Query('month') month: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    return this.diaryService.getForStudent(studentId, targetMonth);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get('sections/:id/diary')
  getForSection(@Param('id') sectionId: string, @Query('month') month: string) {
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    return this.diaryService.getForSection(sectionId, targetMonth);
  }
}
```

Create `backend/src/diary/diary.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { DiaryController } from './diary.controller';
import { StudentAccessService } from '../common/student-access.service';

@Module({
  providers: [DiaryService, StudentAccessService],
  controllers: [DiaryController],
})
export class DiaryModule {}
```

Modify `backend/src/app.module.ts`:

```ts
import { SubjectsModule } from './subjects/subjects.module';
import { DiaryModule } from './diary/diary.module';
```

```ts
    FilesModule,
    SubjectsModule,
    DiaryModule,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/subjects src/diary`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add src/subjects src/diary src/app.module.ts
git commit -m "Add Subjects lookup and Diary module (section-scoped homework entries)"
```

---

## Task 5: Circulars backend module

**Files:**
- Create: `backend/src/circulars/dto/create-circular.dto.ts`
- Create: `backend/src/circulars/circulars.service.ts`
- Create: `backend/src/circulars/circulars.service.spec.ts`
- Create: `backend/src/circulars/circulars.controller.ts`
- Create: `backend/src/circulars/circulars.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `POST /api/v1/circulars`, `GET /api/v1/circulars`, `POST /api/v1/circulars/:id/read`, `GET /api/v1/circulars/:id/stats`, and the `CircularSummary` shape `{ id, title, description, scope, priority, publishedAt, expiresAt, attachments: [{id, originalName, mimeType}], readAt }` — consumed by both clients (Task 10, 12) and Task 6's e2e tests.

- [ ] **Step 1: Write the failing test**

Create `backend/src/circulars/circulars.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CircularsService', () => {
  let service: CircularsService;
  let prisma: {
    circular: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    circularAttachment: { createMany: jest.Mock };
    circularRecipient: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    user: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      circular: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      circularAttachment: { createMany: jest.fn() },
      circularRecipient: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      user: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CircularsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CircularsService);
  });

  it('publishing a school-wide circular fans out a recipient row to every parent', async () => {
    prisma.circular.create.mockResolvedValue({ id: 'circ-1' });
    prisma.user.findMany.mockResolvedValue([{ id: 'parent-a' }, { id: 'parent-b' }]);

    await service.publish(
      { title: 'PTM', description: 'PTM in September.', scope: 'school' },
      'admin-1',
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'PARENT' } }),
    );
    expect(prisma.circularRecipient.createMany).toHaveBeenCalledWith({
      data: [
        { circularId: 'circ-1', userId: 'parent-a' },
        { circularId: 'circ-1', userId: 'parent-b' },
      ],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'circular.publish', entity: 'Circular' }),
      }),
    );
  });

  it("publishing a section-scoped circular only reaches that section's parents", async () => {
    prisma.circular.create.mockResolvedValue({ id: 'circ-2' });
    prisma.user.findMany.mockResolvedValue([{ id: 'parent-a' }]);

    await service.publish(
      { title: 'Trip', description: 'Field trip.', scope: 'section', sectionId: 'sec-1' },
      'admin-1',
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'PARENT',
          parentProfile: { children: { some: { student: { sectionId: 'sec-1' } } } },
        }),
      }),
    );
  });

  it("marking read updates the caller's recipient row and 404s if none exists", async () => {
    prisma.circularRecipient.updateMany.mockResolvedValue({ count: 1 });
    await service.markRead('circ-1', 'parent-a');
    expect(prisma.circularRecipient.updateMany).toHaveBeenCalledWith({
      where: { circularId: 'circ-1', userId: 'parent-a' },
      data: { readAt: expect.any(Date) },
    });

    prisma.circularRecipient.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markRead('circ-1', 'not-a-recipient')).rejects.toThrow(NotFoundException);
  });

  it('stats reports delivered and read counts, and 404s for an unknown circular', async () => {
    prisma.circular.findUnique.mockResolvedValue({ id: 'circ-1' });
    prisma.circularRecipient.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    const stats = await service.getStats('circ-1');
    expect(stats).toEqual({ delivered: 5, read: 2 });

    prisma.circular.findUnique.mockResolvedValue(null);
    await expect(service.getStats('missing')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/circulars`
Expected: FAIL — implementation files don't exist yet.

- [ ] **Step 3: Implement**

Create `backend/src/circulars/dto/create-circular.dto.ts`:

```ts
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const CIRCULAR_SCOPES = ['school', 'section'] as const;

export class CreateCircularDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsIn(CIRCULAR_SCOPES)
  scope!: (typeof CIRCULAR_SCOPES)[number];

  @ValidateIf((o: CreateCircularDto) => o.scope === 'section')
  @IsString()
  @MinLength(1)
  sectionId?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileIds?: string[];
}
```

Create `backend/src/circulars/circulars.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCircularDto } from './dto/create-circular.dto';
import { RequestUser } from '../common/student-access.service';

export interface CircularSummary {
  id: string;
  title: string;
  description: string;
  scope: string;
  priority: string;
  publishedAt: string;
  expiresAt: string | null;
  attachments: { id: string; originalName: string; mimeType: string }[];
  readAt: string | null;
}

interface CircularWithAttachments {
  id: string;
  title: string;
  description: string;
  scope: string;
  priority: string;
  publishedAt: Date;
  expiresAt: Date | null;
  attachments: { file: { id: string; originalName: string; mimeType: string } }[];
}

@Injectable()
export class CircularsService {
  constructor(private readonly prisma: PrismaService) {}

  async publish(dto: CreateCircularDto, authorId: string) {
    const circular = await this.prisma.circular.create({
      data: {
        title: dto.title,
        description: dto.description,
        scope: dto.scope,
        sectionId: dto.scope === 'section' ? dto.sectionId : null,
        priority: dto.priority ?? 'normal',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        authorId,
      },
    });

    if (dto.fileIds?.length) {
      await this.prisma.circularAttachment.createMany({
        data: dto.fileIds.map((fileId) => ({ circularId: circular.id, fileId })),
      });
    }

    const recipients =
      dto.scope === 'school'
        ? await this.prisma.user.findMany({ where: { role: 'PARENT' }, select: { id: true } })
        : await this.prisma.user.findMany({
            where: {
              role: 'PARENT',
              parentProfile: { children: { some: { student: { sectionId: dto.sectionId } } } },
            },
            select: { id: true },
          });

    if (recipients.length) {
      await this.prisma.circularRecipient.createMany({
        data: recipients.map((r) => ({ circularId: circular.id, userId: r.id })),
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: authorId,
        action: 'circular.publish',
        entity: 'Circular',
        entityId: circular.id,
        metadata: JSON.stringify({
          scope: dto.scope,
          sectionId: dto.sectionId,
          recipients: recipients.length,
        }),
      },
    });

    return circular;
  }

  async listForUser(user: RequestUser): Promise<CircularSummary[]> {
    if (user.role === 'PARENT') {
      const rows = await this.prisma.circularRecipient.findMany({
        where: { userId: user.id },
        include: { circular: { include: { attachments: { include: { file: true } } } } },
        orderBy: { circular: { publishedAt: 'desc' } },
      });
      return rows.map((r) => this.toSummary(r.circular, r.readAt));
    }

    const circulars = await this.prisma.circular.findMany({
      where: { authorId: user.id },
      include: { attachments: { include: { file: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    return circulars.map((c) => this.toSummary(c, null));
  }

  async markRead(circularId: string, userId: string): Promise<void> {
    const result = await this.prisma.circularRecipient.updateMany({
      where: { circularId, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Circular not found for this recipient');
    }

    await this.prisma.auditLog.create({
      data: { userId, action: 'circular.read', entity: 'Circular', entityId: circularId },
    });
  }

  async getStats(circularId: string): Promise<{ delivered: number; read: number }> {
    const circular = await this.prisma.circular.findUnique({ where: { id: circularId } });
    if (!circular) {
      throw new NotFoundException('Circular not found');
    }
    const delivered = await this.prisma.circularRecipient.count({ where: { circularId } });
    const read = await this.prisma.circularRecipient.count({
      where: { circularId, readAt: { not: null } },
    });
    return { delivered, read };
  }

  private toSummary(circular: CircularWithAttachments, readAt: Date | null): CircularSummary {
    return {
      id: circular.id,
      title: circular.title,
      description: circular.description,
      scope: circular.scope,
      priority: circular.priority,
      publishedAt: circular.publishedAt.toISOString(),
      expiresAt: circular.expiresAt ? circular.expiresAt.toISOString() : null,
      attachments: circular.attachments.map((a) => ({
        id: a.file.id,
        originalName: a.file.originalName,
        mimeType: a.file.mimeType,
      })),
      readAt: readAt ? readAt.toISOString() : null,
    };
  }
}
```

Create `backend/src/circulars/circulars.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CircularsService } from './circulars.service';
import { CreateCircularDto } from './dto/create-circular.dto';
import { RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/circulars')
export class CircularsController {
  constructor(private readonly circularsService: CircularsService) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  publish(@Body() dto: CreateCircularDto, @Req() req: AuthenticatedRequest) {
    return this.circularsService.publish(dto, req.user.id);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.circularsService.listForUser(req.user);
  }

  @Roles('PARENT')
  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.circularsService.markRead(id, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.circularsService.getStats(id);
  }
}
```

Create `backend/src/circulars/circulars.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { CircularsController } from './circulars.controller';

@Module({
  providers: [CircularsService],
  controllers: [CircularsController],
})
export class CircularsModule {}
```

Modify `backend/src/app.module.ts`:

```ts
import { CircularsModule } from './circulars/circulars.module';
```

```ts
    DiaryModule,
    CircularsModule,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/circulars`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/circulars src/app.module.ts
git commit -m "Add Circulars module: publish with recipient fan-out, inbox, read tracking, stats"
```

---

## Task 6: Backend e2e tests (Diary + Circulars + Files)

**Files:**
- Create: `backend/test/diary-circulars.e2e-spec.ts`

**Interfaces:**
- Consumes: every endpoint from Tasks 3-5.

- [ ] **Step 1: Write the e2e test**

Create `backend/test/diary-circulars.e2e-spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Diary + Circulars (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'CorrectHorseBattery9!';
  const ids: Record<string, string> = {};

  async function loginAs(identifier: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'dc-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({ where: { name: 'DC E2E School' } });
    for (const s of stale) {
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }

    const school = await prisma.school.create({ data: { name: 'DC E2E School' } });
    const campus = await prisma.campus.create({ data: { schoolId: school.id, name: 'Main' } });
    const session = await prisma.academicSession.create({
      data: { label: 'DC', startDate: new Date(), endDate: new Date(), isActive: true },
    });
    const klass = await prisma.class.create({
      data: { campusId: campus.id, academicSessionId: session.id, name: 'DC Grade' },
    });
    const sectionA = await prisma.section.create({ data: { classId: klass.id, name: 'DC-A' } });
    const sectionB = await prisma.section.create({ data: { classId: klass.id, name: 'DC-B' } });
    const subject = await prisma.subject.upsert({
      where: { name: 'DC Urdu' },
      update: {},
      create: { name: 'DC Urdu' },
    });
    ids.school = school.id;
    ids.sectionA = sectionA.id;
    ids.sectionB = sectionB.id;
    ids.subject = subject.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: { identifier: 'dc-teacher@schoolos.edu.pk', passwordHash, role: 'TEACHER' },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'DC Teacher' },
    });
    const adminUser = await prisma.user.create({
      data: { identifier: 'dc-admin@schoolos.edu.pk', passwordHash, role: 'SCHOOL_ADMIN' },
    });
    ids.adminUserId = adminUser.id;

    const parentAUser = await prisma.user.create({
      data: { identifier: 'dc-parent-a@schoolos.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentBUser = await prisma.user.create({
      data: { identifier: 'dc-parent-b@schoolos.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'DC Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'DC Parent B' },
    });

    const childA = await prisma.student.create({
      data: { campusId: campus.id, sectionId: sectionA.id, grNumber: 'DC-A1', name: 'DC Child A' },
    });
    const childB = await prisma.student.create({
      data: { campusId: campus.id, sectionId: sectionB.id, grNumber: 'DC-B1', name: 'DC Child B' },
    });
    await prisma.studentParent.create({
      data: { studentId: childA.id, parentProfileId: parentAProfile.id },
    });
    await prisma.studentParent.create({
      data: { studentId: childB.id, parentProfileId: parentBProfile.id },
    });

    Object.assign(ids, { teacher: teacher.id, childA: childA.id, childB: childB.id });
  });

  afterAll(async () => {
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'dc-teacher@schoolos.edu.pk',
              'dc-admin@schoolos.edu.pk',
              'dc-parent-a@schoolos.edu.pk',
              'dc-parent-b@schoolos.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  it("a teacher posts a diary entry, and it's visible to a parent whose child is in that section", async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    const post = await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sectionId: ids.sectionA,
        subjectId: ids.subject,
        date: today,
        text: 'کتاب صفحہ 12 مکمل کریں',
      })
      .expect(201);
    ids.diaryEntry = post.body.id;

    const parentToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const month = today.slice(0, 7);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/diary?month=${month}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: 'DC Urdu', text: 'کتاب صفحہ 12 مکمل کریں' }),
      ]),
    );
  });

  it("a parent in a different section does NOT see another section's diary entry", async () => {
    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    const month = new Date().toISOString().slice(0, 7);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/diary?month=${month}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('a PARENT cannot post a diary entry', async () => {
    const parentToken = await loginAs('dc-parent-a@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        sectionId: ids.sectionA,
        subjectId: ids.subject,
        date: new Date().toISOString().slice(0, 10),
        text: 'x',
      })
      .expect(403);
  });

  it('an admin publishes a school-wide circular; both parents get it, and stats show delivered/read counts', async () => {
    const adminToken = await loginAs('dc-admin@schoolos.edu.pk');

    const publish = await request(app.getHttpServer())
      .post('/api/v1/circulars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'PTM', description: 'PTM in September.', scope: 'school' })
      .expect(201);
    ids.schoolCircular = publish.body.id;

    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const inboxA = await request(app.getHttpServer())
      .get('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(inboxA.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.schoolCircular, readAt: null })]),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/circulars/${ids.schoolCircular}/read`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(201);

    const stats = await request(app.getHttpServer())
      .get(`/api/v1/circulars/${ids.schoolCircular}/stats`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(stats.body).toEqual({ delivered: 2, read: 1 });
  });

  it("a section-scoped circular only reaches that section's parent", async () => {
    const adminToken = await loginAs('dc-admin@schoolos.edu.pk');

    const publish = await request(app.getHttpServer())
      .post('/api/v1/circulars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Field trip',
        description: 'DC-A only.',
        scope: 'section',
        sectionId: ids.sectionA,
      })
      .expect(201);

    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const inboxA = await request(app.getHttpServer())
      .get('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(inboxA.body.map((c: { id: string }) => c.id)).toContain(publish.body.id);

    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    const inboxB = await request(app.getHttpServer())
      .get('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);
    expect(inboxB.body.map((c: { id: string }) => c.id)).not.toContain(publish.body.id);
  });

  it("a PARENT cannot publish a circular or read another circular's stats", async () => {
    const parentToken = await loginAs('dc-parent-a@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'x', description: 'x', scope: 'school' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/circulars/${ids.schoolCircular}/stats`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);
  });

  it('a file attached to a diary entry is downloadable by an entitled parent (header or query-token auth) and forbidden to an unentitled one', async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');

    const upload = await request(app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', Buffer.from('worksheet contents'), 'worksheet.txt')
      .expect(201);
    const fileId = upload.body.id as string;

    const today = new Date().toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sectionId: ids.sectionA,
        subjectId: ids.subject,
        date: today,
        text: 'See attached worksheet.',
        fileIds: [fileId],
      })
      .expect(201);

    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const download = await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(download.text).toBe('worksheet contents');

    // Same download, authenticated via ?access_token= instead of a header — proves a plain
    // download link (which can't set headers) still works.
    const viaQuery = await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}?access_token=${parentAToken}`)
      .expect(200);
    expect(viaQuery.text).toBe('worksheet contents');

    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(403);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e`
Expected: PASS (7 tests), and every pre-existing e2e suite still passes too.

- [ ] **Step 3: Commit**

```bash
git add test/diary-circulars.e2e-spec.ts
git commit -m "Add e2e coverage: diary section-scoping, circular fan-out/read/stats, file access control"
```

---

## Task 7: Urdu RTL/font helper — staff console (Vue)

**Files:**
- Create: `staff-console/src/lib/textDirection.ts`
- Create: `staff-console/src/lib/textDirection.spec.ts`
- Create: `staff-console/src/components/DirectionalText.vue`
- Modify: `staff-console/index.html`
- Modify: `staff-console/src/assets/base.css`

**Interfaces:**
- Produces: `detectDirection(text: string): 'ltr' | 'rtl'`, `<DirectionalText :text="..." />` — consumed by Task 9's `DiaryView.vue`.

- [ ] **Step 1: Write the failing test**

Create `staff-console/src/lib/textDirection.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectDirection } from './textDirection';

describe('detectDirection', () => {
  it('detects Urdu script as rtl', () => {
    expect(detectDirection('برائے مہربانی کتاب لائیں')).toBe('rtl');
  });

  it('detects English as ltr', () => {
    expect(detectDirection('Please bring your book.')).toBe('ltr');
  });

  it('uses the FIRST strong-directionality character when scripts are mixed', () => {
    expect(detectDirection('Homework: مکمل کریں')).toBe('ltr');
    expect(detectDirection('ہوم ورک: complete it')).toBe('rtl');
  });

  it('falls back to ltr for digits/punctuation-only text', () => {
    expect(detectDirection('12/08/2026')).toBe('ltr');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run textDirection.spec.ts`
Expected: FAIL — `textDirection.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `staff-console/src/lib/textDirection.ts`:

```ts
// Arabic, Arabic Supplement, Arabic Extended-A, Arabic Presentation Forms A/B — covers Urdu.
const RTL_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ]/;
const LATIN_RANGE = /[A-Za-z]/;

export type TextDirection = 'ltr' | 'rtl';

/**
 * First strong-directionality character decides the whole block's direction (Unicode bidi
 * paragraph-direction rule) — pure script detection, no language identification or translation.
 */
export function detectDirection(text: string): TextDirection {
  for (const char of text) {
    if (RTL_RANGE.test(char)) return 'rtl';
    if (LATIN_RANGE.test(char)) return 'ltr';
  }
  return 'ltr';
}
```

Create `staff-console/src/components/DirectionalText.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { detectDirection } from '../lib/textDirection';

const props = defineProps<{ text: string }>();
const direction = computed(() => detectDirection(props.text));
</script>

<template>
  <p :dir="direction" :class="{ urdu: direction === 'rtl' }">{{ text }}</p>
</template>

<style scoped>
p {
  margin: 0;
  white-space: pre-wrap;
}
.urdu {
  font-family: var(--font-family-urdu);
  font-size: 1.1em;
  line-height: 2;
}
</style>
```

Modify `staff-console/index.html` — add a second Google Fonts stylesheet link, right after the existing Plus Jakarta Sans one:

```html
    <link
      href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap"
      rel="stylesheet"
    />
```

Modify `staff-console/src/assets/base.css` — add next to `--font-family-base`:

```css
  --font-family-urdu: 'Noto Nastaliq Urdu', 'Plus Jakarta Sans', sans-serif;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run textDirection.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/textDirection.ts src/lib/textDirection.spec.ts src/components/DirectionalText.vue index.html src/assets/base.css
git commit -m "Add Urdu RTL/font auto-detection helper and DirectionalText component"
```

---

## Task 8: Urdu RTL/font helper — parent app (Flutter)

**Files:**
- Create: `parent-app/lib/src/theme/text_direction.dart`
- Create: `parent-app/test/theme/text_direction_test.dart`

**Interfaces:**
- Produces: `TextDirection detectDirection(String text)`, `class DirectionalText extends StatelessWidget` — consumed by Task 11 (`calendar_tab.dart`) and Task 12 (`circulars_tab.dart`).

- [ ] **Step 1: Write the failing test**

Create `parent-app/test/theme/text_direction_test.dart`:

```dart
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/theme/text_direction.dart';

void main() {
  test('detects Urdu script as rtl', () {
    expect(detectDirection('برائے مہربانی کتاب لائیں'), TextDirection.rtl);
  });

  test('detects English as ltr', () {
    expect(detectDirection('Please bring your book.'), TextDirection.ltr);
  });

  test('uses the FIRST strong-directionality character when scripts are mixed', () {
    expect(detectDirection('Homework: مکمل کریں'), TextDirection.ltr);
    expect(detectDirection('ہوم ورک: complete it'), TextDirection.rtl);
  });

  test('falls back to ltr for digits/punctuation-only text', () {
    expect(detectDirection('12/08/2026'), TextDirection.ltr);
  });

  testWidgets('DirectionalText renders Urdu text right-to-left', (tester) async {
    await tester.pumpWidget(
      const Directionality(textDirection: TextDirection.ltr, child: DirectionalText('برائے مہربانی')),
    );
    final directionality = tester
        .widgetList<Directionality>(find.byType(Directionality))
        .last;
    expect(directionality.textDirection, TextDirection.rtl);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/theme/text_direction_test.dart`
Expected: FAIL — `text_direction.dart` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `parent-app/lib/src/theme/text_direction.dart`:

```dart
import 'package:flutter/widgets.dart';
import 'package:google_fonts/google_fonts.dart';

// Arabic, Arabic Supplement, Arabic Extended-A, Arabic Presentation Forms A/B — covers Urdu.
final _rtlRange = RegExp(r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ]');
final _latinRange = RegExp(r'[A-Za-z]');

/// First strong-directionality character decides the block's direction — same rule as the
/// staff-console's detectDirection (src/lib/textDirection.ts), ported to Dart. No language
/// detection/translation, just script detection.
TextDirection detectDirection(String text) {
  for (final rune in text.runes) {
    final char = String.fromCharCode(rune);
    if (_rtlRange.hasMatch(char)) return TextDirection.rtl;
    if (_latinRange.hasMatch(char)) return TextDirection.ltr;
  }
  return TextDirection.ltr;
}

/// A Text widget that auto-switches direction and font per [detectDirection] — Urdu renders
/// right-to-left in Noto Nastaliq Urdu, everything else stays the app's default font/direction.
class DirectionalText extends StatelessWidget {
  const DirectionalText(this.text, {super.key, this.style});

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final direction = detectDirection(text);
    final effectiveStyle = direction == TextDirection.rtl
        ? GoogleFonts.notoNastaliqUrdu(textStyle: style, fontSize: (style?.fontSize ?? 14) * 1.15)
        : style;

    return Directionality(textDirection: direction, child: Text(text, style: effectiveStyle));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/theme/text_direction_test.dart`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/src/theme/text_direction.dart test/theme/text_direction_test.dart
git commit -m "Add Urdu RTL/font auto-detection helper and DirectionalText widget"
```

---

## Task 9: Staff console — Diary screen

**Files:**
- Modify: `staff-console/src/lib/api.ts`
- Create: `staff-console/src/views/DiaryView.vue`
- Create: `staff-console/src/views/DiaryView.spec.ts`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`

**Interfaces:**
- Consumes: `api.listSections` (existing), `detectDirection` + `DirectionalText` (Task 7), backend `GET /subjects`, `POST /diary`, `GET /sections/:id/diary`, `POST /files` (Tasks 3-4).
- Produces: `api.listSubjects`, `api.uploadFile`, `api.listSectionDiary`, `api.createDiaryEntry`, and the `SubjectSummary`/`DiaryEntrySummary` types — reused as-is by Task 10.

- [ ] **Step 1: Write the failing test**

Create `staff-console/src/views/DiaryView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DiaryView from './DiaryView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listSubjects: vi.fn(),
    listSectionDiary: vi.fn(),
    uploadFile: vi.fn(),
    createDiaryEntry: vi.fn(),
  },
}));

describe('DiaryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.listSubjects).mockReset();
    vi.mocked(api.listSectionDiary).mockReset();
    vi.mocked(api.uploadFile).mockReset();
    vi.mocked(api.createDiaryEntry).mockReset();
  });

  it('loads sections/subjects, posts an entry, and refreshes the list', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listSubjects).mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);
    vi.mocked(api.listSectionDiary).mockResolvedValue([]);
    vi.mocked(api.createDiaryEntry).mockResolvedValue(undefined);

    const wrapper = mount(DiaryView);
    await flushPromises();

    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('select[data-testid="subject-select"]').setValue('sub-1');
    await wrapper.find('textarea[data-testid="entry-text"]').setValue('Read chapter 3.');
    await wrapper.find('[data-testid="post-entry"]').trigger('click');
    await flushPromises();

    expect(api.createDiaryEntry).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ sectionId: 'sec-1', subjectId: 'sub-1', text: 'Read chapter 3.' }),
    );
    expect(wrapper.text()).toContain('posted');
  });

  it('shows an error message if posting fails', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listSubjects).mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);
    vi.mocked(api.listSectionDiary).mockResolvedValue([]);
    vi.mocked(api.createDiaryEntry).mockRejectedValue(
      new Error('Something went wrong. Please try again.'),
    );

    const wrapper = mount(DiaryView);
    await flushPromises();
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('select[data-testid="subject-select"]').setValue('sub-1');
    await wrapper.find('textarea[data-testid="entry-text"]').setValue('Read chapter 3.');
    await wrapper.find('[data-testid="post-entry"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run DiaryView.spec.ts`
Expected: FAIL — `DiaryView.vue` doesn't exist yet.

- [ ] **Step 3: Implement**

Modify `staff-console/src/lib/api.ts` — add these interfaces after `export type AttendanceStatus = ...`:

```ts
export interface SubjectSummary {
  id: string;
  name: string;
}

export interface DiaryAttachmentSummary {
  id: string;
  originalName: string;
  mimeType: string;
}

export interface DiaryEntrySummary {
  id: string;
  date: string;
  dueDate: string | null;
  subject: string;
  teacher: string;
  text: string;
  attachments: DiaryAttachmentSummary[];
}

export interface CircularSummary {
  id: string;
  title: string;
  description: string;
  scope: 'school' | 'section';
  priority: string;
  publishedAt: string;
  expiresAt: string | null;
  attachments: DiaryAttachmentSummary[];
  readAt: string | null;
}
```

Add these methods inside `export const api = { ... }`, after `markAttendance`:

```ts
  async listSubjects(accessToken: string): Promise<SubjectSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subjects`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async uploadFile(accessToken: string, file: File): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/api/v1/files`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: formData,
    });
    return asJson(res);
  },

  async listSectionDiary(
    accessToken: string,
    sectionId: string,
    month: string,
  ): Promise<DiaryEntrySummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${sectionId}/diary?month=${month}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async createDiaryEntry(
    accessToken: string,
    payload: {
      sectionId: string;
      subjectId: string;
      date: string;
      text: string;
      dueDate?: string;
      fileIds?: string[];
    },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/diary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },
```

Create `staff-console/src/views/DiaryView.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type SubjectSummary, type DiaryEntrySummary } from '../lib/api';
import { detectDirection } from '../lib/textDirection';
import DirectionalText from '../components/DirectionalText.vue';

const auth = useAuthStore();
const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);

const sections = ref<SectionSummary[]>([]);
const subjects = ref<SubjectSummary[]>([]);
const selectedSectionId = ref('');
const selectedSubjectId = ref('');
const dueDate = ref('');
const text = ref('');
const files = ref<File[]>([]);
const entries = ref<DiaryEntrySummary[]>([]);
const isSaving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

async function loadLookups() {
  if (!auth.accessToken) return;
  try {
    [sections.value, subjects.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listSubjects(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections/subjects.';
  }
}
loadLookups();

async function loadEntries() {
  if (!auth.accessToken || !selectedSectionId.value) {
    entries.value = [];
    return;
  }
  try {
    entries.value = await api.listSectionDiary(auth.accessToken, selectedSectionId.value, month);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load diary entries.';
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  files.value = input.files ? Array.from(input.files) : [];
}

async function onPost() {
  if (!auth.accessToken || !selectedSectionId.value || !selectedSubjectId.value || !text.value) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;

  try {
    const fileIds: string[] = [];
    for (const file of files.value) {
      const uploaded = await api.uploadFile(auth.accessToken, file);
      fileIds.push(uploaded.id);
    }

    await api.createDiaryEntry(auth.accessToken, {
      sectionId: selectedSectionId.value,
      subjectId: selectedSubjectId.value,
      date: today,
      text: text.value,
      dueDate: dueDate.value || undefined,
      fileIds: fileIds.length ? fileIds : undefined,
    });

    message.value = 'Diary entry posted.';
    text.value = '';
    dueDate.value = '';
    files.value = [];
    await loadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="diary">
    <h1>Diary</h1>
    <p class="subtitle">{{ today }}</p>

    <label class="field">
      <span>Section</span>
      <select data-testid="section-select" v-model="selectedSectionId" @change="loadEntries">
        <option value="" disabled>Choose a section</option>
        <option v-for="s in sections" :key="s.id" :value="s.id">
          {{ s.className }} {{ s.name }} — {{ s.campusName }}
        </option>
      </select>
    </label>

    <label class="field">
      <span>Subject</span>
      <select data-testid="subject-select" v-model="selectedSubjectId">
        <option value="" disabled>Choose a subject</option>
        <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </label>

    <label class="field">
      <span>Due date (optional)</span>
      <input data-testid="due-date" type="date" v-model="dueDate" />
    </label>

    <label class="field">
      <span>Entry</span>
      <textarea data-testid="entry-text" v-model="text" rows="4" :dir="detectDirection(text)"></textarea>
    </label>

    <label class="field">
      <span>Attachments (optional)</span>
      <input data-testid="file-input" type="file" multiple @change="onFileChange" />
    </label>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button
      data-testid="post-entry"
      :disabled="isSaving || !selectedSectionId || !selectedSubjectId || !text"
      @click="onPost"
    >
      {{ isSaving ? 'Posting…' : 'Post entry' }}
    </button>

    <template v-if="entries.length">
      <h2>This section's entries</h2>
      <ul class="entries">
        <li v-for="entry in entries" :key="entry.id">
          <strong>{{ entry.subject }}</strong> — {{ entry.date }}
          <span v-if="entry.dueDate"> (due {{ entry.dueDate }})</span>
          <DirectionalText :text="entry.text" />
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.diary {
  max-width: 640px;
}
.subtitle {
  color: var(--color-muted);
  margin-bottom: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
  max-width: 480px;
}
select,
input,
textarea {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.success {
  color: var(--color-accent);
}
.error {
  color: var(--color-destructive);
}
button {
  padding: 0.6rem 1.1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.entries {
  list-style: none;
  padding: 0;
  margin-top: var(--space-3);
}
.entries li {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
</style>
```

Modify `staff-console/src/router/index.ts` — add after the `/teacher` route:

```ts
    {
      path: '/teacher/diary',
      name: 'teacher-diary',
      component: () => import('../views/DiaryView.vue'),
      meta: { requiresRole: ['TEACHER'] },
    },
```

Modify `staff-console/src/components/AppShell.vue` — the sidenav currently uses placeholder `<a href="#">` tags. Import `RouterLink` (it's a Vue built-in, no import needed) and replace the Attendance and Diary lines:

```html
          <a data-testid="nav-attendance" href="#"><Icon name="calendar" />Attendance</a>
          <a data-testid="nav-diary" href="#"><Icon name="notebook" />Diary</a>
```

with:

```html
          <RouterLink data-testid="nav-attendance" to="/teacher"><Icon name="calendar" />Attendance</RouterLink>
          <RouterLink data-testid="nav-diary" to="/teacher/diary"><Icon name="notebook" />Diary</RouterLink>
```

(the `.sidenav a` CSS selector already covers `<RouterLink>`, since it renders as an `<a>` — no style changes needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run DiaryView.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full existing test suite**

Run: `npm test`
Expected: all existing suites (including `AttendanceView.spec.ts`) still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/views/DiaryView.vue src/views/DiaryView.spec.ts src/router/index.ts src/components/AppShell.vue
git commit -m "Add staff-console Diary screen: compose per-section homework entries with attachments"
```

---

## Task 10: Staff console — Circulars screen

**Files:**
- Modify: `staff-console/src/lib/api.ts`
- Create: `staff-console/src/views/CircularsView.vue`
- Create: `staff-console/src/views/CircularsView.spec.ts`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`

**Interfaces:**
- Consumes: `api.listSections`, `api.uploadFile`, `CircularSummary` type (Task 9), backend `POST /circulars`, `GET /circulars`, `GET /circulars/:id/stats` (Task 5).
- Produces: `api.listCirculars`, `api.publishCircular`, `api.circularStats`.

- [ ] **Step 1: Write the failing test**

Create `staff-console/src/views/CircularsView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CircularsView from './CircularsView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listCirculars: vi.fn(),
    circularStats: vi.fn(),
    uploadFile: vi.fn(),
    publishCircular: vi.fn(),
  },
}));

describe('CircularsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.listCirculars).mockReset();
    vi.mocked(api.circularStats).mockReset();
    vi.mocked(api.uploadFile).mockReset();
    vi.mocked(api.publishCircular).mockReset();
  });

  it('publishes a school-wide circular and shows delivered/read counts for existing ones', async () => {
    vi.mocked(api.listSections).mockResolvedValue([]);
    vi.mocked(api.listCirculars).mockResolvedValue([
      {
        id: 'circ-1',
        title: 'PTM',
        description: 'PTM in September.',
        scope: 'school',
        priority: 'normal',
        publishedAt: '2026-08-01T00:00:00.000Z',
        expiresAt: null,
        attachments: [],
        readAt: null,
      },
    ]);
    vi.mocked(api.circularStats).mockResolvedValue({ delivered: 2, read: 1 });
    vi.mocked(api.publishCircular).mockResolvedValue(undefined);

    const wrapper = mount(CircularsView);
    await flushPromises();

    expect(wrapper.text()).toContain('Delivered 2');
    expect(wrapper.text()).toContain('Read 1');

    await wrapper.find('input[data-testid="title-input"]').setValue('New notice');
    await wrapper.find('textarea[data-testid="description-input"]').setValue('Details here.');
    await wrapper.find('[data-testid="publish-circular"]').trigger('click');
    await flushPromises();

    expect(api.publishCircular).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ title: 'New notice', description: 'Details here.', scope: 'school' }),
    );
    expect(wrapper.text()).toContain('published');
  });

  it('shows an error message if publishing fails', async () => {
    vi.mocked(api.listSections).mockResolvedValue([]);
    vi.mocked(api.listCirculars).mockResolvedValue([]);
    vi.mocked(api.publishCircular).mockRejectedValue(
      new Error('Something went wrong. Please try again.'),
    );

    const wrapper = mount(CircularsView);
    await flushPromises();
    await wrapper.find('input[data-testid="title-input"]').setValue('New notice');
    await wrapper.find('textarea[data-testid="description-input"]').setValue('Details here.');
    await wrapper.find('[data-testid="publish-circular"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run CircularsView.spec.ts`
Expected: FAIL — `CircularsView.vue` doesn't exist yet.

- [ ] **Step 3: Implement**

Modify `staff-console/src/lib/api.ts` — add these methods after `createDiaryEntry`:

```ts
  async listCirculars(accessToken: string): Promise<CircularSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/circulars`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async publishCircular(
    accessToken: string,
    payload: {
      title: string;
      description: string;
      scope: 'school' | 'section';
      sectionId?: string;
      fileIds?: string[];
    },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/circulars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async circularStats(
    accessToken: string,
    circularId: string,
  ): Promise<{ delivered: number; read: number }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/circulars/${circularId}/stats`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },
```

Create `staff-console/src/views/CircularsView.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type CircularSummary } from '../lib/api';

const CIRCULAR_SCOPES = ['school', 'section'] as const;

const auth = useAuthStore();
const sections = ref<SectionSummary[]>([]);
const title = ref('');
const description = ref('');
const scope = ref<(typeof CIRCULAR_SCOPES)[number]>('school');
const sectionId = ref('');
const files = ref<File[]>([]);
const circulars = ref<(CircularSummary & { delivered?: number; read?: number })[]>([]);
const isSaving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

async function loadLookups() {
  if (!auth.accessToken) return;
  try {
    sections.value = await api.listSections(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
loadLookups();

async function loadCirculars() {
  if (!auth.accessToken) return;
  try {
    const list = await api.listCirculars(auth.accessToken);
    circulars.value = await Promise.all(
      list.map(async (c) => {
        const stats = await api.circularStats(auth.accessToken!, c.id);
        return { ...c, ...stats };
      }),
    );
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load circulars.';
  }
}
loadCirculars();

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  files.value = input.files ? Array.from(input.files) : [];
}

async function onPublish() {
  if (!auth.accessToken || !title.value || !description.value) return;
  if (scope.value === 'section' && !sectionId.value) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;

  try {
    const fileIds: string[] = [];
    for (const file of files.value) {
      const uploaded = await api.uploadFile(auth.accessToken, file);
      fileIds.push(uploaded.id);
    }

    await api.publishCircular(auth.accessToken, {
      title: title.value,
      description: description.value,
      scope: scope.value,
      sectionId: scope.value === 'section' ? sectionId.value : undefined,
      fileIds: fileIds.length ? fileIds : undefined,
    });

    message.value = 'Circular published.';
    title.value = '';
    description.value = '';
    files.value = [];
    await loadCirculars();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="circulars">
    <h1>Circulars</h1>

    <label class="field">
      <span>Title</span>
      <input data-testid="title-input" v-model="title" type="text" />
    </label>

    <label class="field">
      <span>Description</span>
      <textarea data-testid="description-input" v-model="description" rows="3"></textarea>
    </label>

    <label class="field">
      <span>Scope</span>
      <select data-testid="scope-select" v-model="scope">
        <option value="school">Whole school</option>
        <option value="section">One section</option>
      </select>
    </label>

    <label v-if="scope === 'section'" class="field">
      <span>Section</span>
      <select data-testid="section-select" v-model="sectionId">
        <option value="" disabled>Choose a section</option>
        <option v-for="s in sections" :key="s.id" :value="s.id">
          {{ s.className }} {{ s.name }} — {{ s.campusName }}
        </option>
      </select>
    </label>

    <label class="field">
      <span>Attachments (optional)</span>
      <input data-testid="file-input" type="file" multiple @change="onFileChange" />
    </label>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button
      data-testid="publish-circular"
      :disabled="isSaving || !title || !description || (scope === 'section' && !sectionId)"
      @click="onPublish"
    >
      {{ isSaving ? 'Publishing…' : 'Publish circular' }}
    </button>

    <template v-if="circulars.length">
      <h2>Published circulars</h2>
      <ul class="circulars-list">
        <li v-for="c in circulars" :key="c.id">
          <strong>{{ c.title }}</strong> — {{ c.scope }}
          <span data-testid="stats">Delivered {{ c.delivered }} · Read {{ c.read }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.circulars {
  max-width: 640px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
  max-width: 480px;
}
select,
input,
textarea {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.success {
  color: var(--color-accent);
}
.error {
  color: var(--color-destructive);
}
button {
  padding: 0.6rem 1.1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.circulars-list {
  list-style: none;
  padding: 0;
  margin-top: var(--space-3);
}
.circulars-list li {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.circulars-list span {
  display: block;
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
</style>
```

Modify `staff-console/src/router/index.ts` — add after the `/admin` route:

```ts
    {
      path: '/admin/circulars',
      name: 'admin-circulars',
      component: () => import('../views/CircularsView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] },
    },
```

Modify `staff-console/src/components/AppShell.vue` — replace:

```html
          <a data-testid="nav-circulars" href="#"><Icon name="megaphone" />Circulars</a>
```

with:

```html
          <RouterLink data-testid="nav-circulars" to="/admin/circulars"><Icon name="megaphone" />Circulars</RouterLink>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run CircularsView.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full existing test suite**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/views/CircularsView.vue src/views/CircularsView.spec.ts src/router/index.ts src/components/AppShell.vue
git commit -m "Add staff-console Circulars screen: publish school/section notices, view delivered/read stats"
```

---

## Task 11: Parent app — Diary sub-tab

**Files:**
- Modify: `parent-app/pubspec.yaml`
- Modify: `parent-app/lib/src/api/models.dart`
- Modify: `parent-app/lib/src/api/api_client.dart`
- Modify: `parent-app/lib/src/screens/calendar_tab.dart`
- Modify: `parent-app/test/screens/calendar_tab_test.dart`

**Interfaces:**
- Consumes: `DirectionalText`/`detectDirection` (Task 8), backend `GET /students/:id/diary` (Task 4), `GET /files/:id?access_token=` (Task 3).
- Produces: `DiaryAttachment`/`DiaryEntry`/`CircularSummary` models, `ApiClient.diary()`, `ApiClient.fileDownloadUrl()` — `CircularSummary` and `fileDownloadUrl` are also consumed by Task 12.

- [ ] **Step 1: Add the `url_launcher` dependency**

Modify `parent-app/pubspec.yaml` — add under `dependencies:`, next to `google_fonts`:

```yaml
  url_launcher: ^6.3.0
```

Run: `flutter pub get`

- [ ] **Step 2: Write the failing test**

Modify `parent-app/test/screens/calendar_tab_test.dart` — add a third `testWidgets` block at the end of `main()`, and extend the shared `makeClient()` so the existing two tests keep passing (they already tolerate any unhandled path with a 404):

```dart
  testWidgets('Diary tab shows the structured entry, direction-aware', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/students/s1/timetable') {
          return http.Response(jsonEncode([]), 200);
        }
        if (request.url.path == '/api/v1/students/s1/attendance') {
          return http.Response(
            jsonEncode({
              'days': [],
              'summary': {
                'present': 0,
                'absent': 0,
                'late': 0,
                'holiday': 0,
                'leave': 0,
                'attendancePercentage': 0,
              },
            }),
            200,
          );
        }
        if (request.url.path == '/api/v1/students/s1/diary') {
          return http.Response(
            jsonEncode([
              {
                'id': 'd1',
                'date': '2026-08-27',
                'dueDate': '2026-08-29',
                'subject': 'Urdu',
                'teacher': 'Ms. Sample',
                'text': 'کتاب لائیں',
                'attachments': [],
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: api))),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Diary'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Urdu'), findsOneWidget);
    expect(find.text('کتاب لائیں'), findsOneWidget);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `flutter test test/screens/calendar_tab_test.dart`
Expected: FAIL — `ApiClient` has no `diary()` method, and the Diary tab is still a placeholder.

- [ ] **Step 4: Implement**

Modify `parent-app/lib/src/api/models.dart` — add at the end of the file:

```dart
class DiaryAttachment {
  const DiaryAttachment({required this.id, required this.originalName, required this.mimeType});
  final String id;
  final String originalName;
  final String mimeType;

  factory DiaryAttachment.fromJson(Map<String, dynamic> json) => DiaryAttachment(
    id: json['id'] as String,
    originalName: json['originalName'] as String,
    mimeType: json['mimeType'] as String,
  );
}

class DiaryEntry {
  const DiaryEntry({
    required this.id,
    required this.date,
    required this.dueDate,
    required this.subject,
    required this.teacher,
    required this.text,
    required this.attachments,
  });

  final String id;
  final String date;
  final String? dueDate;
  final String subject;
  final String teacher;
  final String text;
  final List<DiaryAttachment> attachments;

  factory DiaryEntry.fromJson(Map<String, dynamic> json) => DiaryEntry(
    id: json['id'] as String,
    date: json['date'] as String,
    dueDate: json['dueDate'] as String?,
    subject: json['subject'] as String,
    teacher: json['teacher'] as String,
    text: json['text'] as String,
    attachments: (json['attachments'] as List<dynamic>)
        .map((e) => DiaryAttachment.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class CircularSummary {
  const CircularSummary({
    required this.id,
    required this.title,
    required this.description,
    required this.scope,
    required this.priority,
    required this.publishedAt,
    required this.expiresAt,
    required this.attachments,
    required this.readAt,
  });

  final String id;
  final String title;
  final String description;
  final String scope;
  final String priority;
  final String publishedAt;
  final String? expiresAt;
  final List<DiaryAttachment> attachments;
  final String? readAt;

  factory CircularSummary.fromJson(Map<String, dynamic> json) => CircularSummary(
    id: json['id'] as String,
    title: json['title'] as String,
    description: json['description'] as String,
    scope: json['scope'] as String,
    priority: json['priority'] as String,
    publishedAt: json['publishedAt'] as String,
    expiresAt: json['expiresAt'] as String?,
    attachments: (json['attachments'] as List<dynamic>)
        .map((e) => DiaryAttachment.fromJson(e as Map<String, dynamic>))
        .toList(),
    readAt: json['readAt'] as String?,
  );
}
```

Modify `parent-app/lib/src/api/api_client.dart` — add these methods at the end of the `ApiClient` class, before its closing brace:

```dart
  Future<List<DiaryEntry>> diary(String accessToken, String studentId, String month) async {
    final list =
        await _get('/api/v1/students/$studentId/diary?month=$month', accessToken) as List<dynamic>;
    return list.map((e) => DiaryEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<CircularSummary>> circulars(String accessToken) async {
    final list = await _get('/api/v1/circulars', accessToken) as List<dynamic>;
    return list.map((e) => CircularSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markCircularRead(String accessToken, String circularId) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/circulars/$circularId/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  /// A direct, headers-free download link — the backend's JwtStrategy accepts the token as
  /// ?access_token= specifically so links like this (opened via url_launcher) can authenticate.
  Uri fileDownloadUrl(String fileId, String accessToken) =>
      Uri.parse('$baseUrl/api/v1/files/$fileId').replace(queryParameters: {'access_token': accessToken});
```

Modify `parent-app/lib/src/screens/calendar_tab.dart`:

Update the imports at the top:

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/text_direction.dart';
```

Update the class doc-comment (it currently says Diary is a placeholder — that's no longer true):

```dart
/// Calendar → Timetable / Attendance / Diary tabs, per the MVP plan.
class CalendarTab extends StatelessWidget {
```

Replace the placeholder Diary tab:

```dart
                const Center(child: Text('Diary lands in the next sprint.')),
```

with:

```dart
                _DiaryTab(studentId: studentId, accessToken: accessToken, api: api),
```

Add the `_DiaryTab` widget at the end of the file, after `_AttendanceTabState` and before the `_FirstOrNull` extension:

```dart
class _DiaryTab extends StatefulWidget {
  const _DiaryTab({required this.studentId, required this.accessToken, required this.api});
  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<_DiaryTab> createState() => _DiaryTabState();
}

class _DiaryTabState extends State<_DiaryTab> {
  List<DiaryEntry>? _entries;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final month = DateTime.now().toIso8601String().substring(0, 7);
    try {
      final entries = await widget.api.diary(widget.accessToken, widget.studentId, month);
      if (mounted) setState(() => _entries = entries);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) return const Center(child: CircularProgressIndicator());
    if (_entries!.isEmpty) return const Center(child: Text('No diary entries yet.'));

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _entries!.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final e = _entries![i];
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${e.subject} · ${e.date}${e.dueDate != null ? ' (due ${e.dueDate})' : ''}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 4),
              DirectionalText(e.text),
              if (e.attachments.isNotEmpty)
                Wrap(
                  spacing: 8,
                  children: e.attachments
                      .map(
                        (a) => ActionChip(
                          label: Text(a.originalName),
                          onPressed: () => launchUrl(
                            widget.api.fileDownloadUrl(a.id, widget.accessToken),
                            mode: LaunchMode.externalApplication,
                          ),
                        ),
                      )
                      .toList(),
                ),
            ],
          ),
        );
      },
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `flutter test test/screens/calendar_tab_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full existing test suite**

Run: `flutter test`
Expected: all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add pubspec.yaml pubspec.lock lib/src/api/models.dart lib/src/api/api_client.dart lib/src/screens/calendar_tab.dart test/screens/calendar_tab_test.dart
git commit -m "Add parent-app Diary sub-tab: section homework entries, Urdu-aware, downloadable attachments"
```

---

## Task 12: Parent app — Circulars (Notifications tab)

**Files:**
- Create: `parent-app/lib/src/screens/circulars_tab.dart`
- Create: `parent-app/test/screens/circulars_tab_test.dart`
- Modify: `parent-app/lib/src/screens/home_shell.dart`
- Modify: `parent-app/test/screens/home_shell_test.dart`

**Interfaces:**
- Consumes: `ApiClient.circulars`/`markCircularRead`/`fileDownloadUrl`, `CircularSummary` (Task 11), `DirectionalText` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `parent-app/test/screens/circulars_tab_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/circulars_tab.dart';

void main() {
  testWidgets('lists circulars, marks one read on tap, and reports the new unread count', (
    tester,
  ) async {
    var readCalled = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/circulars') {
          return http.Response(
            jsonEncode([
              {
                'id': 'c1',
                'title': 'PTM',
                'description': 'PTM in September.',
                'scope': 'school',
                'priority': 'normal',
                'publishedAt': '2026-08-01T00:00:00.000Z',
                'expiresAt': null,
                'attachments': [],
                'readAt': readCalled ? '2026-08-27T00:00:00.000Z' : null,
              },
            ]),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/circulars/c1/read') {
          readCalled = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    int? lastUnreadCount;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CircularsTab(
            accessToken: 'tok',
            api: api,
            onUnreadChanged: (count) => lastUnreadCount = count,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PTM'), findsOneWidget);
    expect(lastUnreadCount, 1);

    await tester.tap(find.text('PTM'));
    await tester.pumpAndSettle();

    expect(readCalled, true);
    expect(lastUnreadCount, 0);
  });
}
```

Modify `parent-app/test/screens/home_shell_test.dart` — add a third test at the end of `main()`:

```dart
  testWidgets('the Notifications tab shows a badge for unread circulars', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/auth/login') {
          return http.Response(
            jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}),
            200,
          );
        }
        if (request.url.path == '/api/v1/me/children') {
          return http.Response(
            jsonEncode([
              {
                'id': 's1',
                'name': 'Eshaal',
                'grNumber': 'GR-1001',
                'campus': 'Gulistan-e-Jauhar',
                'class': 'Grade 3',
                'section': '3A',
              },
            ]),
            200,
          );
        }
        if (request.url.path == '/api/v1/circulars') {
          return http.Response(
            jsonEncode([
              {
                'id': 'c1',
                'title': 'PTM',
                'description': 'PTM in September.',
                'scope': 'school',
                'priority': 'normal',
                'publishedAt': '2026-08-01T00:00:00.000Z',
                'expiresAt': null,
                'attachments': [],
                'readAt': null,
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(buildTestApp(api: api));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@schoolos.edu.pk');
    await tester.enterText(find.byKey(const Key('passwordField')), 'ChangeMe123!');
    await tester.tap(find.byKey(const Key('submitButton')));
    await tester.pumpAndSettle();

    expect(find.text('1'), findsOneWidget);

    await tester.tap(find.text('Notifications'));
    await tester.pumpAndSettle();

    expect(find.text('PTM'), findsOneWidget);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `flutter test test/screens/circulars_tab_test.dart test/screens/home_shell_test.dart`
Expected: FAIL — `circulars_tab.dart` doesn't exist yet, and `home_shell.dart` still shows the generic placeholder.

- [ ] **Step 3: Implement**

Create `parent-app/lib/src/screens/circulars_tab.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/text_direction.dart';

/// Notifications tab content — school/section circulars for the signed-in parent (not per-child;
/// a parent sees every circular they're a recipient of, regardless of which child tab is active).
class CircularsTab extends StatefulWidget {
  const CircularsTab({
    super.key,
    required this.accessToken,
    required this.api,
    this.onUnreadChanged,
  });

  final String accessToken;
  final ApiClient api;
  final ValueChanged<int>? onUnreadChanged;

  @override
  State<CircularsTab> createState() => _CircularsTabState();
}

class _CircularsTabState extends State<CircularsTab> {
  List<CircularSummary>? _circulars;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final circulars = await widget.api.circulars(widget.accessToken);
      if (mounted) {
        setState(() => _circulars = circulars);
        widget.onUnreadChanged?.call(circulars.where((c) => c.readAt == null).length);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _onOpen(CircularSummary circular) async {
    if (circular.readAt != null) return;
    await widget.api.markCircularRead(widget.accessToken, circular.id);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final circulars = _circulars;
    if (circulars == null) return const Center(child: CircularProgressIndicator());
    if (circulars.isEmpty) return const Center(child: Text('No circulars yet.'));

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: circulars.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final c = circulars[i];
        final isUnread = c.readAt == null;
        return ListTile(
          onTap: () => _onOpen(c),
          leading: Icon(isUnread ? Icons.circle : Icons.circle_outlined, size: 12),
          title: Text(
            c.title,
            style: TextStyle(fontWeight: isUnread ? FontWeight.bold : FontWeight.normal),
          ),
          subtitle: DirectionalText(c.description),
          trailing: c.attachments.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.attachment),
                  onPressed: () => launchUrl(
                    widget.api.fileDownloadUrl(c.attachments.first.id, widget.accessToken),
                    mode: LaunchMode.externalApplication,
                  ),
                ),
        );
      },
    );
  }
}
```

Modify `parent-app/lib/src/screens/home_shell.dart`:

Update the imports:

```dart
import 'calendar_tab.dart';
import 'circulars_tab.dart';
```

Add a field and load call in `_HomeShellState`:

```dart
  late int _tabIndex = widget.initialTab;
  List<ChildSummary> _children = [];
  String? _activeChildId;
  bool _isLoading = true;
  String? _loadError;
  int _unreadCirculars = 0;

  @override
  void initState() {
    super.initState();
    _loadChildren();
    _loadUnreadCirculars();
  }

  Future<void> _loadUnreadCirculars() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;
    try {
      final circulars = await api.circulars(token);
      if (mounted) {
        setState(() => _unreadCirculars = circulars.where((c) => c.readAt == null).length);
      }
    } on ApiException {
      // Badge is a convenience, not the critical path — the Notifications tab itself will
      // surface the real error if the parent opens it.
    }
  }
```

Update the `NavigationDestination` for Notifications:

```dart
          NavigationDestination(
            icon: _unreadCirculars > 0
                ? Badge(label: Text('$_unreadCirculars'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            label: 'Notifications',
          ),
```

Update `_buildBody` — add a branch for tab index 2, right after the existing `if (_tabIndex == 1)` block:

```dart
    if (_tabIndex == 2) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return CircularsTab(
        accessToken: auth.accessToken!,
        api: api,
        onUnreadChanged: (count) => setState(() => _unreadCirculars = count),
      );
    }
```

Update the trailing placeholder text (it currently claims circulars land "in the next sprint" — no longer true):

```dart
          '${labels[_tabIndex]} for ${child.name}\n\n'
          'Messages/fees land here in future sprints — this screen confirms login, multi-child '
          'switching, and role-gated routing are wired end to end.',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `flutter test test/screens/circulars_tab_test.dart test/screens/home_shell_test.dart`
Expected: PASS (1 + 3 tests)

- [ ] **Step 5: Run the full existing test suite**

Run: `flutter test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/src/screens/circulars_tab.dart test/screens/circulars_tab_test.dart lib/src/screens/home_shell.dart test/screens/home_shell_test.dart
git commit -m "Add parent-app Circulars tab under Notifications, with unread badge and read tracking"
```

---

## Final check

After Task 12, update `build/PROJECT-STATUS.md`: move FEAT-008 and FEAT-009 from "Sprint 5-6 🔜 NEXT" to done, and update the "Next step" line to point at Sprint 7-8 (Messages + Notifications).
