// Local dev seed — creates one school, two campuses, one class/section, one teacher, one student
// with two linked parent accounts. Run with: npx tsx prisma/seed.ts (or wire into package.json).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as argon2 from 'argon2';

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' });
  const prisma = new PrismaClient({ adapter });

  const school = await prisma.school.create({ data: { name: 'The Seeds School' } });

  const [gulistan, gulshan] = await Promise.all([
    prisma.campus.create({ data: { schoolId: school.id, name: 'Gulistan-e-Jauhar' } }),
    prisma.campus.create({ data: { schoolId: school.id, name: 'Gulshan-e-Iqbal' } }),
  ]);

  const session = await prisma.academicSession.create({
    data: { label: '2026-2027', startDate: new Date('2026-08-01'), endDate: new Date('2027-06-30'), isActive: true },
  });

  const grade3 = await prisma.class.create({
    data: { campusId: gulistan.id, academicSessionId: session.id, name: 'Grade 3' },
  });
  const section3A = await prisma.section.create({ data: { classId: grade3.id, name: '3A' } });

  const teacherUser = await prisma.user.create({
    data: {
      identifier: 'teacher@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'TEACHER',
    },
  });
  const teacher = await prisma.teacher.create({ data: { userId: teacherUser.id, name: 'Ms. Sample Teacher' } });
  await prisma.section.update({
    where: { id: section3A.id },
    data: { classTeacherId: teacher.id },
  });

  // Admin has no domain profile row (no Teacher/ParentProfile) — the role on User is enough for the
  // staff console's RBAC-gated nav.
  const adminUser = await prisma.user.create({
    data: {
      identifier: 'admin@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'SCHOOL_ADMIN',
      isPrincipal: true,
    },
  });

  const accountsUser = await prisma.user.create({
    data: {
      identifier: 'accounts@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'ACCOUNTS',
    },
  });

  const student = await prisma.student.create({
    data: { grNumber: 'GR-1001', name: 'Eshaal Sample' },
  });
  await prisma.enrollment.create({
    data: {
      studentId: student.id,
      campusId: gulistan.id,
      sectionId: section3A.id,
      academicSessionId: session.id,
      startDate: session.startDate,
      status: 'ACTIVE',
    },
  });

  // A second, unused campus row (Gulshan) demonstrates the schema handles multi-campus without a
  // second student attached — proves campus is data, not an assumption baked into one row.
  void gulshan;

  const parentPassword = await argon2.hash('ChangeMe123!');
  const [parentAUser, parentBUser] = await Promise.all([
    prisma.user.create({ data: { identifier: 'parent-a@seeds.edu.pk', passwordHash: parentPassword, role: 'PARENT' } }),
    prisma.user.create({ data: { identifier: 'parent-b@seeds.edu.pk', passwordHash: parentPassword, role: 'PARENT' } }),
  ]);

  const [parentAProfile, parentBProfile] = await Promise.all([
    prisma.parentProfile.create({ data: { userId: parentAUser.id, name: 'Parent A' } }),
    prisma.parentProfile.create({ data: { userId: parentBUser.id, name: 'Parent B' } }),
  ]);

  await Promise.all([
    prisma.studentParent.create({ data: { studentId: student.id, parentProfileId: parentAProfile.id, relationship: 'mother' } }),
    prisma.studentParent.create({ data: { studentId: student.id, parentProfileId: parentBProfile.id, relationship: 'father' } }),
  ]);

  // --- Timetable: a Mon-Fri, 6-period week for section 3A, all taught by the one seeded teacher ---
  const subjectNames = ['Mathematics', 'English', 'Urdu', 'Science', 'Social Studies', 'Art'];
  const subjects = await Promise.all(
    subjectNames.map((name) => prisma.subject.create({ data: { name } })),
  );

  const periodTimes: Array<[string, string]> = [
    ['08:00', '08:40'],
    ['08:40', '09:20'],
    ['09:20', '10:00'],
    ['10:20', '11:00'], // after a 20-minute break
    ['11:00', '11:40'],
    ['11:40', '12:20'],
  ];

  const timetableRows: Array<{
    sectionId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: number;
    period: number;
    startTime: string;
    endTime: string;
    room: string;
  }> = [];
  for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
    // Monday=1 .. Friday=5
    periodTimes.forEach(([startTime, endTime], i) => {
      const period = i + 1;
      const subject = subjects[(dayOfWeek + period) % subjects.length];
      timetableRows.push({
        sectionId: section3A.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        dayOfWeek,
        period,
        startTime,
        endTime,
        room: '3A',
      });
    });
  }
  await prisma.timetable.createMany({ data: timetableRows });

  // --- Attendance: the last 10 weekdays for the seeded student, mostly present ---
  const attendanceStatuses: Array<'PRESENT' | 'ABSENT' | 'LATE'> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendanceDates: Date[] = [];
  for (const cursor = new Date(today); attendanceDates.length < 10; cursor.setDate(cursor.getDate() - 1)) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) continue; // skip weekends
    attendanceDates.push(new Date(cursor));
  }
  attendanceDates.forEach((_, i) => {
    // one LATE and one ABSENT sprinkled in, the rest PRESENT
    if (i === 2) attendanceStatuses.push('LATE');
    else if (i === 5) attendanceStatuses.push('ABSENT');
    else attendanceStatuses.push('PRESENT');
  });

  await prisma.attendance.createMany({
    data: attendanceDates.map((date, i) => ({
      studentId: student.id,
      date,
      status: attendanceStatuses[i],
      markedById: teacher.id,
    })),
  });

  // --- Diary: one sample homework entry for section 3A ---
  const diaryEntry = await prisma.diaryEntry.create({
    data: {
      sectionId: section3A.id,
      subjectId: subjects[0].id,
      authorId: teacherUser.id,
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

  // --- Messages: parent A asks the class teacher a question; the teacher replies ---
  const conversation = await prisma.conversation.create({
    data: {
      parentUserId: parentAUser.id,
      staffUserId: teacherUser.id,
      recipientType: 'CLASS_TEACHER',
      studentId: student.id,
      parentReadAt: new Date(),
      messages: {
        create: [{ senderId: parentAUser.id, body: 'Hi, can Eshaal get extra homework in Urdu?' }],
      },
    },
  });
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: teacherUser.id,
      body: 'Sure, I will send some extra worksheets this week.',
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), staffReadAt: new Date() },
  });

  // --- Notifications: one sample per seeded role, so a fresh dev.db never looks blank ---
  await prisma.notification.createMany({
    data: [
      {
        userId: parentAUser.id,
        type: 'message',
        title: 'New reply from Ms. Sample Teacher',
        body: 'Sure, I will send some extra worksheets this week.',
        entityRef: conversation.id,
      },
      {
        userId: teacherUser.id,
        type: 'message',
        title: 'New message from Parent A',
        body: 'Hi, can Eshaal get extra homework in Urdu?',
        entityRef: conversation.id,
      },
      {
        userId: adminUser.id,
        type: 'circular',
        title: 'Circular published',
        body: 'Parent-Teacher Meeting — September',
        entityRef: circular.id,
      },
    ],
  });

  console.log(
    'Seeded: 1 school, 2 campuses, 1 class/section, 1 teacher, 1 admin (principal), 1 accounts, ' +
      `1 student, 2 linked parents, ${timetableRows.length} timetable periods, ` +
      `${attendanceDates.length} attendance records, 1 diary entry, 1 circular, 1 conversation ` +
      '(with a reply), 3 notifications.',
  );
  console.log(
    'Login as parent-a@seeds.edu.pk / ChangeMe123! (or parent-b@... / teacher@... / admin@...) — dev only.',
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
