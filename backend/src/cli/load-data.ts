import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * BL-15: reproducible load-test data — one school, two campuses, 2,000 students with guardians and
 * a month of activity — for the load test in `load-test/`. Development/test only and only against
 * a database whose name marks it as scratch (see checkLoadDataTarget); never a real system.
 *
 * Every id is derived from a fixed key (loadId), every date is fixed, and every insert is a
 * `createMany({ skipDuplicates: true })`, so a second run inserts nothing and the data is the same
 * on every machine. The plan is built in memory first (buildLoadDataPlan) so its shape is unit
 * tested without a database.
 */

export const LOAD_SCHOOL_CODE = 'LTS';
export const LOAD_DOMAIN = 'lts.load.schoolos.local';
export const LOAD_PARENT_DOMAIN = 'parent.load.schoolos.local';
/** Month of attendance/diary/notifications; the load test marks attendance on its weekdays. */
export const LOAD_MONTH = '2026-09';
export const MIN_LOAD_PASSWORD_LENGTH = 12;

export interface LoadDataOptions {
  students: number;
  campuses: number;
  classesPerCampus: number;
  sectionsPerClass: number;
}

export const DEFAULT_LOAD_OPTIONS: LoadDataOptions = {
  students: 2000,
  campuses: 2,
  classesPerCampus: 10,
  sectionsPerClass: 3,
};

/** Database names the generator accepts: a `load`, `scratch` or `e2e` word in the name. */
const SCRATCH_DB_NAME = /(^|_)(load|scratch|e2e)(_|$)/i;

export type LoadTargetCheck =
  | { ok: true; database: string; password: string }
  | { ok: false; reason: string };

/** Refuses anything but NODE_ENV=development|test against a scratch database, with a password. */
export function checkLoadDataTarget(env: NodeJS.ProcessEnv): LoadTargetCheck {
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    return {
      ok: false,
      reason: `NODE_ENV=${nodeEnv ?? '(unset)'} — load data is generated only with NODE_ENV=development or test.`,
    };
  }
  const url = env.DATABASE_URL ?? '';
  let database = '';
  try {
    database = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return { ok: false, reason: 'DATABASE_URL is not set or not a URL.' };
  }
  if (!SCRATCH_DB_NAME.test(database)) {
    return {
      ok: false,
      reason: `Database "${database}" is not a scratch database — its name must contain a "load", "scratch" or "e2e" word (e.g. schoolos_load).`,
    };
  }
  const password = env.LOAD_PASSWORD ?? '';
  if (password.length < MIN_LOAD_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `LOAD_PASSWORD must be set (at least ${MIN_LOAD_PASSWORD_LENGTH} characters); every generated account uses it.`,
    };
  }
  return { ok: true, database, password };
}

/** A stable UUID (v5 layout) for a key, so reruns address the same rows. */
export function loadId(key: string): string {
  const h = createHash('sha1').update(`schoolos-load:${key}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Deterministic 0..99 for a key — stands in for randomness. */
const bucket = (key: string) =>
  createHash('sha1').update(key).digest().readUInt16BE(0) % 100;

export const parentIdentifier = (
  relation: 'father' | 'mother',
  studentNo: number,
) => `${relation}.${pad(studentNo, 5)}@${LOAD_PARENT_DOMAIN}`;
export const teacherIdentifier = (teacherNo: number) =>
  `teacher.${pad(teacherNo, 3)}@${LOAD_DOMAIN}`;

/** Weekdays (Mon–Fri) of a YYYY-MM month, as UTC midnights. */
export function schoolDays(month: string): Date[] {
  const days: Date[] = [];
  const d = utc(`${month}-01`);
  while (d.toISOString().startsWith(month)) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

const SUBJECTS = [
  'Mathematics',
  'English',
  'Urdu',
  'Science',
  'Social Studies',
  'Computer',
  'Islamiyat',
  'Art',
];
const PERIODS: [string, string][] = [
  ['08:00', '08:40'],
  ['08:40', '09:20'],
  ['09:20', '10:00'],
  ['10:20', '11:00'],
  ['11:00', '11:40'],
  ['11:40', '12:20'],
];
const BANDS = [
  { minPercent: 80, letter: 'A', remark: 'Excellent', gradePoint: 4 },
  { minPercent: 70, letter: 'B', remark: 'Very good', gradePoint: 3 },
  { minPercent: 60, letter: 'C', remark: 'Good', gradePoint: 2 },
  { minPercent: 50, letter: 'D', remark: 'Satisfactory', gradePoint: 1 },
  { minPercent: 0, letter: 'F', remark: 'Needs improvement', gradePoint: 0 },
];
const letterFor = (percent: number) =>
  BANDS.find((b) => percent >= b.minPercent) ?? BANDS[BANDS.length - 1];

/** Every row, in insert order (parents before children). */
export interface LoadDataPlan {
  school: Prisma.SchoolCreateManyInput[];
  campus: Prisma.CampusCreateManyInput[];
  academicSession: Prisma.AcademicSessionCreateManyInput[];
  term: Prisma.TermCreateManyInput[];
  subject: Prisma.SubjectCreateManyInput[];
  staffUser: Prisma.UserCreateManyInput[];
  teacher: Prisma.TeacherCreateManyInput[];
  class: Prisma.ClassCreateManyInput[];
  section: Prisma.SectionCreateManyInput[];
  staff: Prisma.StaffCreateManyInput[];
  student: Prisma.StudentCreateManyInput[];
  enrollment: Prisma.EnrollmentCreateManyInput[];
  parentUser: Prisma.UserCreateManyInput[];
  parentProfile: Prisma.ParentProfileCreateManyInput[];
  studentParent: Prisma.StudentParentCreateManyInput[];
  timetable: Prisma.TimetableCreateManyInput[];
  attendance: Prisma.AttendanceCreateManyInput[];
  diaryEntry: Prisma.DiaryEntryCreateManyInput[];
  feeStructure: Prisma.FeeStructureCreateManyInput[];
  feeVoucher: Prisma.FeeVoucherCreateManyInput[];
  feeItem: Prisma.FeeItemCreateManyInput[];
  feePayment: Prisma.FeePaymentCreateManyInput[];
  feePaymentAllocation: Prisma.FeePaymentAllocationCreateManyInput[];
  receipt: Prisma.ReceiptCreateManyInput[];
  circular: Prisma.CircularCreateManyInput[];
  circularRecipient: Prisma.CircularRecipientCreateManyInput[];
  notification: Prisma.NotificationCreateManyInput[];
  conversation: Prisma.ConversationCreateManyInput[];
  message: Prisma.MessageCreateManyInput[];
  gradingScale: Prisma.GradingScaleCreateManyInput[];
  gradeBand: Prisma.GradeBandCreateManyInput[];
  resultPublication: Prisma.ResultPublicationCreateManyInput[];
  generatedReportCard: Prisma.GeneratedReportCardCreateManyInput[];
  leaveRequest: Prisma.LeaveRequestCreateManyInput[];
}

export function buildLoadDataPlan(
  passwordHash: string,
  opts: LoadDataOptions = DEFAULT_LOAD_OPTIONS,
): LoadDataPlan {
  const schoolId = loadId('school');
  const sessionId = loadId('session:2026-2027');
  const term1Id = loadId('term:1');
  const adminId = loadId('user:admin');
  const accountsId = loadId('user:accounts');
  const days = schoolDays(LOAD_MONTH);

  const plan: LoadDataPlan = {
    school: [
      {
        id: schoolId,
        name: 'Load Test School',
        code: LOAD_SCHOOL_CODE,
        email: `info@${LOAD_DOMAIN}`,
      },
    ],
    campus: [],
    academicSession: [
      {
        id: sessionId,
        schoolId,
        label: '2026-2027',
        startDate: utc('2026-08-01'),
        endDate: utc('2027-06-30'),
        isActive: true,
      },
    ],
    term: [
      {
        id: term1Id,
        academicSessionId: sessionId,
        label: 'Term 1',
        order: 1,
        startDate: utc('2026-08-01'),
        endDate: utc('2026-12-31'),
      },
      {
        id: loadId('term:2'),
        academicSessionId: sessionId,
        label: 'Term 2',
        order: 2,
        startDate: utc('2027-01-01'),
        endDate: utc('2027-06-30'),
      },
    ],
    subject: SUBJECTS.map((name) => ({
      id: loadId(`subject:${name}`),
      schoolId,
      name,
    })),
    staffUser: [
      {
        id: adminId,
        identifier: `admin@${LOAD_DOMAIN}`,
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId,
      },
      {
        id: loadId('user:principal'),
        identifier: `principal@${LOAD_DOMAIN}`,
        passwordHash,
        role: 'SCHOOL_ADMIN',
        isPrincipal: true,
        schoolId,
      },
      {
        id: accountsId,
        identifier: `accounts@${LOAD_DOMAIN}`,
        passwordHash,
        role: 'ACCOUNTS',
        schoolId,
      },
    ],
    teacher: [],
    class: [],
    section: [],
    staff: [],
    student: [],
    enrollment: [],
    parentUser: [],
    parentProfile: [],
    studentParent: [],
    timetable: [],
    attendance: [],
    diaryEntry: [],
    feeStructure: [],
    feeVoucher: [],
    feeItem: [],
    feePayment: [],
    feePaymentAllocation: [],
    receipt: [],
    circular: [],
    circularRecipient: [],
    notification: [],
    conversation: [],
    message: [],
    gradingScale: [
      {
        id: loadId('scale'),
        schoolId,
        name: 'Standard',
        isDefault: true,
      },
    ],
    gradeBand: BANDS.map((b) => ({
      id: loadId(`band:${b.letter}`),
      gradingScaleId: loadId('scale'),
      ...b,
    })),
    resultPublication: [],
    generatedReportCard: [],
    leaveRequest: [],
  };

  // Campuses, classes, sections — one class teacher per section.
  const sectionsPerCampus = opts.classesPerCampus * opts.sectionsPerClass;
  const sections: {
    id: string;
    classId: string;
    className: string;
    name: string;
    campus: number;
    teacherId: string;
    teacherUserId: string;
  }[] = [];
  for (let c = 0; c < opts.campuses; c++) {
    const campusId = loadId(`campus:${c}`);
    plan.campus.push({
      id: campusId,
      schoolId,
      name: `Load Test School - Campus ${c + 1}`,
      code: `${LOAD_SCHOOL_CODE}-${c + 1}`,
      campusType: c === 0 ? 'MAIN' : 'BRANCH',
    });
    for (let g = 0; g < opts.classesPerCampus; g++) {
      const classId = loadId(`class:${c}:${g}`);
      const className = `Class ${g + 1}`;
      plan.class.push({
        id: classId,
        campusId,
        academicSessionId: sessionId,
        name: className,
      });
      plan.resultPublication.push({
        id: loadId(`publication:${c}:${g}`),
        classId,
        termId: term1Id,
        gradingScaleId: loadId('scale'),
        scaleName: 'Standard',
        bands: BANDS,
        publishedById: adminId,
      });
      for (let l = 0; l < opts.sectionsPerClass; l++) {
        const teacherNo = sections.length + 1;
        const teacherId = loadId(`teacher:${teacherNo}`);
        const teacherUserId = loadId(`user:teacher:${teacherNo}`);
        const name = `Teacher ${pad(teacherNo, 3)}`;
        plan.staffUser.push({
          id: teacherUserId,
          identifier: teacherIdentifier(teacherNo),
          passwordHash,
          role: 'TEACHER',
          schoolId,
          campusId,
        });
        plan.teacher.push({
          id: teacherId,
          userId: teacherUserId,
          name,
          campusId,
        });
        plan.staff.push({
          id: loadId(`staff:${teacherNo}`),
          userId: teacherUserId,
          teacherId,
          name,
          firstName: 'Teacher',
          lastName: pad(teacherNo, 3),
          employeeType: 'TEACHER',
          campusId,
          joiningDate: utc('2024-08-01'),
        });
        const section = {
          id: loadId(`section:${c}:${g}:${l}`),
          classId,
          className,
          name: `${g + 1}${'ABCDEFGH'[l]}`,
          campus: c,
          teacherId,
          teacherUserId,
        };
        sections.push(section);
        plan.section.push({
          id: section.id,
          classId,
          name: section.name,
          classTeacherId: teacherId,
        });
      }
    }
  }

  // Timetable: Mon–Fri × 6 periods. Within a campus, period p of section k is taught by the class
  // teacher of section (k + p) — a bijection per period, so no teacher is double-booked.
  const subjectIds = plan.subject.map((s) => s.id!);
  sections.forEach((section, k) => {
    const local = k % sectionsPerCampus;
    const base = section.campus * sectionsPerCampus;
    for (let dow = 1; dow <= 5; dow++) {
      PERIODS.forEach(([startTime, endTime], p) => {
        plan.timetable.push({
          id: loadId(`tt:${k}:${dow}:${p}`),
          sectionId: section.id,
          subjectId: subjectIds[(dow + p) % subjectIds.length],
          teacherId:
            sections[base + ((local + p) % sectionsPerCampus)].teacherId,
          dayOfWeek: dow,
          period: p + 1,
          startTime,
          endTime,
          room: section.name,
        });
      });
    }
    days.forEach((date, d) => {
      const due = new Date(date);
      due.setUTCDate(due.getUTCDate() + 1);
      for (const offset of [0, 3]) {
        plan.diaryEntry.push({
          id: loadId(`diary:${k}:${d}:${offset}`),
          sectionId: section.id,
          subjectId: subjectIds[(d + offset) % subjectIds.length],
          authorId: section.teacherUserId,
          date,
          text: `Homework ${d + 1} for ${section.name}: exercise set ${offset + 1}.`,
          dueDate: due,
        });
      }
    });
    plan.circular.push({
      id: loadId(`circular:section:${k}`),
      title: `Class update for ${section.name}`,
      description: `Reminders for section ${section.name} this month.`,
      scope: 'section',
      schoolId,
      sectionId: section.id,
      authorId: adminId,
      publishedAt: utc(`${LOAD_MONTH}-15`),
    });
  });

  // Fee structures: monthly tuition per class level (paisa).
  for (let g = 0; g < opts.classesPerCampus; g++) {
    plan.feeStructure.push({
      id: loadId(`fee:${g}`),
      schoolId,
      name: `Tuition - Class ${g + 1}`,
      amount: (3000 + 500 * g) * 100,
    });
  }

  const schoolCirculars = Array.from({ length: 12 }, (_, n) => ({
    id: loadId(`circular:school:${n}`),
    publishedAt: new Date(Date.UTC(2026, 7, 5 + n * 4)),
  }));
  for (const [n, c] of schoolCirculars.entries()) {
    plan.circular.push({
      id: c.id,
      title: `School notice ${n + 1}`,
      description: `School-wide notice number ${n + 1}.`,
      scope: 'school',
      schoolId,
      authorId: adminId,
      publishedAt: c.publishedAt,
    });
  }

  // Students, guardians and their month of activity.
  const statusFor = (b: number) =>
    b < 88 ? 'PRESENT' : b < 94 ? 'ABSENT' : b < 99 ? 'LATE' : 'LEAVE';
  let paymentNo = 0;
  for (let i = 0; i < opts.students; i++) {
    const no = i + 1;
    const k = i % sections.length;
    const section = sections[k];
    const g = Math.floor((k % sectionsPerCampus) / opts.sectionsPerClass);
    const studentId = loadId(`student:${no}`);
    const gr = `LT-${pad(no, 5)}`;
    const name = `Load Student ${pad(no, 5)}`;
    plan.student.push({
      id: studentId,
      grNumber: gr,
      name,
      firstName: 'Load',
      lastName: `Student ${pad(no, 5)}`,
      gender: no % 2 ? 'MALE' : 'FEMALE',
      dateOfBirth: utc(`${2012 + (no % 8)}-0${1 + (no % 9)}-15`),
      admissionDate: utc('2024-08-01'),
    });
    plan.enrollment.push({
      id: loadId(`enrollment:${no}`),
      studentId,
      campusId: plan.campus[section.campus].id!,
      sectionId: section.id,
      academicSessionId: sessionId,
      startDate: utc('2026-08-01'),
      rollNumber: pad(Math.floor(i / sections.length) + 1, 2),
    });

    const parentUserIds: string[] = [];
    (['father', 'mother'] as const).forEach((relation, slot) => {
      const userId = loadId(`user:${relation}:${no}`);
      const profileId = loadId(`parent:${relation}:${no}`);
      parentUserIds.push(userId);
      plan.parentUser.push({
        id: userId,
        identifier: parentIdentifier(relation, no),
        passwordHash,
        role: 'PARENT',
        schoolId,
      });
      plan.parentProfile.push({
        id: profileId,
        userId,
        name: `${relation === 'father' ? 'Father' : 'Mother'} of ${name}`,
        phone: `03${relation === 'father' ? '00' : '01'}-${pad(1000000 + no, 7)}`,
        gender: relation === 'father' ? 'MALE' : 'FEMALE',
      });
      plan.studentParent.push({
        id: loadId(`sp:${relation}:${no}`),
        studentId,
        parentProfileId: profileId,
        relationship: relation,
        relationshipType: relation === 'father' ? 'FATHER' : 'MOTHER',
        isPrimary: true,
        primarySlot: slot + 1,
        isEmergencyContact: true,
      });
      for (let n = 0; n < 10; n++) {
        plan.notification.push({
          id: loadId(`notification:${relation}:${no}:${n}`),
          userId,
          type: n % 2 ? 'circular' : 'attendance',
          title: `Update ${n + 1}`,
          body: `Notification ${n + 1} about ${name}.`,
          readAt: n < 5 ? utc(`${LOAD_MONTH}-20`) : null,
          createdAt: new Date(Date.UTC(2026, 8, 1 + n * 2)),
        });
      }
      for (const [n, c] of schoolCirculars.entries()) {
        plan.circularRecipient.push({
          id: loadId(`cr:school:${n}:${relation}:${no}`),
          circularId: c.id,
          userId,
          readAt:
            bucket(`read:${n}:${relation}:${no}`) < 40 ? c.publishedAt : null,
        });
      }
      plan.circularRecipient.push({
        id: loadId(`cr:section:${relation}:${no}`),
        circularId: loadId(`circular:section:${k}`),
        userId,
      });
    });

    days.forEach((date, d) => {
      plan.attendance.push({
        id: loadId(`att:${no}:${d}`),
        studentId,
        date,
        status: statusFor(bucket(`att:${no}:${d}`)),
        markedById: section.teacherId,
        markedByUserId: section.teacherUserId,
      });
    });

    // Vouchers for August (70 % paid) and September (unpaid).
    const amount = plan.feeStructure[g].amount;
    for (const month of ['2026-08', '2026-09']) {
      const voucherId = loadId(`voucher:${no}:${month}`);
      plan.feeVoucher.push({
        id: voucherId,
        studentId,
        academicSessionId: sessionId,
        month,
        issueDate: utc(`${month}-01`),
        dueDate: utc(`${month}-10`),
      });
      plan.feeItem.push({
        id: loadId(`fee-item:${no}:${month}`),
        feeVoucherId: voucherId,
        feeStructureId: plan.feeStructure[g].id,
        label: plan.feeStructure[g].name,
        amount,
        createdById: accountsId,
      });
      if (month === '2026-08' && bucket(`paid:${no}`) < 70) {
        paymentNo++;
        const paymentId = loadId(`payment:${no}:${month}`);
        plan.feePayment.push({
          id: paymentId,
          amount,
          method: 'manual',
          status: 'completed',
          reference: `LT-PAY-${pad(paymentNo, 6)}`,
          recordedById: accountsId,
          createdAt: utc(`${month}-08`),
        });
        plan.feePaymentAllocation.push({
          id: loadId(`allocation:${no}:${month}`),
          feePaymentId: paymentId,
          feeVoucherId: voucherId,
          amount,
        });
        plan.receipt.push({
          id: loadId(`receipt:${no}:${month}`),
          feePaymentId: paymentId,
          receiptNumber: `LT-RCPT-${pad(paymentNo, 6)}`,
        });
      }
    }

    // A published Term 1 report card per student.
    const percent = 45 + (bucket(`result:${no}`) % 55);
    const band = letterFor(percent);
    plan.generatedReportCard.push({
      id: loadId(`report-card:${no}`),
      studentId,
      classId: section.classId,
      termId: term1Id,
      version: 1,
      overallPercent: percent,
      overallLetter: band.letter,
      issuedById: adminId,
      issuedAt: utc('2026-09-25'),
      snapshot: {
        school: 'Load Test School',
        campus: plan.campus[section.campus].name,
        session: '2026-2027',
        term: 'Term 1',
        className: section.className,
        section: section.name,
        student: { name, grNumber: gr },
        scaleName: 'Standard',
        subjects: SUBJECTS.map((subjectName) => ({
          subjectName,
          obtainedMarks: percent,
          maxMarks: 100,
          finalPercent: percent,
          letter: band.letter,
          remark: band.remark,
          gradePoint: band.gradePoint,
          categories: [],
        })),
        overall: {
          percent,
          letter: band.letter,
          remark: band.remark,
          gpa: band.gradePoint,
        },
        remark: null,
      },
    });

    // Some families message the class teacher; a few request leave.
    if (i % 7 === 0) {
      const conversationId = loadId(`conversation:${no}`);
      const last = new Date(Date.UTC(2026, 8, 1 + (i % 25), 9));
      plan.conversation.push({
        id: conversationId,
        parentUserId: parentUserIds[0],
        staffUserId: section.teacherUserId,
        recipientType: 'CLASS_TEACHER',
        studentId,
        lastMessageAt: last,
        createdAt: last,
      });
      for (let m = 0; m < 6; m++) {
        plan.message.push({
          id: loadId(`message:${no}:${m}`),
          conversationId,
          senderId: m % 2 ? section.teacherUserId : parentUserIds[0],
          body: `Message ${m + 1} about ${name}.`,
          createdAt: new Date(last.getTime() - (6 - m) * 60_000),
        });
      }
    }
    if (i % 13 === 0) {
      plan.leaveRequest.push({
        id: loadId(`leave:${no}`),
        studentId,
        startDate: utc(`${LOAD_MONTH}-28`),
        endDate: utc(`${LOAD_MONTH}-29`),
        reason: 'Family event',
      });
    }
  }
  return plan;
}

/** Minimal delegate shape: every model in the plan supports createMany. */
type CreateMany = (args: {
  data: unknown[];
  skipDuplicates: boolean;
}) => Promise<{ count: number }>;

const DELEGATE: Record<keyof LoadDataPlan, string> = {
  school: 'school',
  campus: 'campus',
  academicSession: 'academicSession',
  term: 'term',
  subject: 'subject',
  staffUser: 'user',
  teacher: 'teacher',
  class: 'class',
  section: 'section',
  staff: 'staff',
  student: 'student',
  enrollment: 'enrollment',
  parentUser: 'user',
  parentProfile: 'parentProfile',
  studentParent: 'studentParent',
  timetable: 'timetable',
  attendance: 'attendance',
  diaryEntry: 'diaryEntry',
  feeStructure: 'feeStructure',
  feeVoucher: 'feeVoucher',
  feeItem: 'feeItem',
  feePayment: 'feePayment',
  feePaymentAllocation: 'feePaymentAllocation',
  receipt: 'receipt',
  circular: 'circular',
  circularRecipient: 'circularRecipient',
  notification: 'notification',
  conversation: 'conversation',
  message: 'message',
  gradingScale: 'gradingScale',
  gradeBand: 'gradeBand',
  resultPublication: 'resultPublication',
  generatedReportCard: 'generatedReportCard',
  leaveRequest: 'leaveRequest',
};

const CHUNK = 2000;

/** Inserts the plan in order; returns rows inserted per table (0 everywhere on a rerun). */
export async function writeLoadData(
  prisma: PrismaClient,
  plan: LoadDataPlan,
  log: (line: string) => void = () => {},
): Promise<Record<string, number>> {
  const inserted: Record<string, number> = {};
  for (const key of Object.keys(DELEGATE) as (keyof LoadDataPlan)[]) {
    const rows: unknown[] = plan[key];
    const delegate = (
      prisma as unknown as Record<string, { createMany: CreateMany }>
    )[DELEGATE[key]];
    let count = 0;
    for (let at = 0; at < rows.length; at += CHUNK) {
      const result = await delegate.createMany({
        data: rows.slice(at, at + CHUNK),
        skipDuplicates: true,
      });
      count += result.count;
    }
    inserted[key] = count;
    log(`${key}: ${count} inserted of ${rows.length}`);
  }
  return inserted;
}
