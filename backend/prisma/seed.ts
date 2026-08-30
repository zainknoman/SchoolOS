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

  // --- Two more class/section/class-teacher trios, one per campus, so Parent B's three children
  // (below) each have a different class teacher to message — exercises resolveStaffUserId's
  // per-section classTeacherId lookup across more than one section/teacher.
  const grade4 = await prisma.class.create({
    data: { campusId: gulistan.id, academicSessionId: session.id, name: 'Grade 4' },
  });
  const section4B = await prisma.section.create({ data: { classId: grade4.id, name: '4B' } });
  const teacher2User = await prisma.user.create({
    data: {
      identifier: 'teacher2@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'TEACHER',
    },
  });
  const teacher2 = await prisma.teacher.create({ data: { userId: teacher2User.id, name: 'Mr. Second Teacher' } });
  await prisma.section.update({ where: { id: section4B.id }, data: { classTeacherId: teacher2.id } });

  const grade5 = await prisma.class.create({
    data: { campusId: gulshan.id, academicSessionId: session.id, name: 'Grade 5' },
  });
  const section5C = await prisma.section.create({ data: { classId: grade5.id, name: '5C' } });
  const teacher3User = await prisma.user.create({
    data: {
      identifier: 'teacher3@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'TEACHER',
    },
  });
  const teacher3 = await prisma.teacher.create({ data: { userId: teacher3User.id, name: 'Ms. Third Teacher' } });
  await prisma.section.update({ where: { id: section5C.id }, data: { classTeacherId: teacher3.id } });

  // Admin has no domain profile row (no Teacher/ParentProfile) — the role on User is enough for the
  // staff console's RBAC-gated nav. isPrincipal lives on a separate dedicated account (below), not
  // on admin, so Admin and Principal are independently testable identities.
  const adminUser = await prisma.user.create({
    data: {
      identifier: 'admin@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'SCHOOL_ADMIN',
    },
  });

  const accountsUser = await prisma.user.create({
    data: {
      identifier: 'accounts@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'ACCOUNTS',
    },
  });

  // Principal isn't its own Role (see the PRINCIPAL branch of resolveStaffUserId, which resolves
  // via `isPrincipal: true` rather than a role) — it needs a real console role to log into the
  // staff console at all, so this is a SCHOOL_ADMIN account distinct from the admin@ one above.
  const principalUser = await prisma.user.create({
    data: {
      identifier: 'principal@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'SCHOOL_ADMIN',
      isPrincipal: true,
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

  // --- Two more children for Parent B only (not shared with Parent A), each in a different
  // class/section (and campus) with their own class teacher — multi-child switcher and per-child
  // Messages/conversation testing needs more than one child, and more than one class teacher, on
  // at least one parent.
  const [studentIbrahim, studentHania] = await Promise.all([
    prisma.student.create({ data: { grNumber: 'GR-1002', name: 'Ibrahim Sample' } }),
    prisma.student.create({ data: { grNumber: 'GR-1003', name: 'Hania Sample' } }),
  ]);
  await Promise.all([
    prisma.enrollment.create({
      data: {
        studentId: studentIbrahim.id,
        campusId: gulistan.id,
        sectionId: section4B.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    }),
    prisma.enrollment.create({
      data: {
        studentId: studentHania.id,
        campusId: gulshan.id,
        sectionId: section5C.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    }),
  ]);
  await Promise.all([
    prisma.studentParent.create({ data: { studentId: studentIbrahim.id, parentProfileId: parentBProfile.id, relationship: 'father' } }),
    prisma.studentParent.create({ data: { studentId: studentHania.id, parentProfileId: parentBProfile.id, relationship: 'father' } }),
  ]);

  // --- Timetable/Attendance/Diary: a Mon-Fri 6-period week, 10 weekdays of attendance, and one
  // diary entry — generated per section so every seeded child (not just Eshaal in 3A) has a
  // non-blank Home/Calendar screen, each taught/marked/authored by that section's own class
  // teacher.
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  async function seedSectionSchedule(
    section: { id: string; name: string },
    sectionTeacher: { id: string },
    sectionTeacherUserId: string,
    students: Array<{ id: string }>,
    diaryText: string,
  ): Promise<{ timetableCount: number; attendanceCount: number }> {
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
          sectionId: section.id,
          subjectId: subject.id,
          teacherId: sectionTeacher.id,
          dayOfWeek,
          period,
          startTime,
          endTime,
          room: section.name,
        });
      });
    }
    await prisma.timetable.createMany({ data: timetableRows });

    // The last 10 weekdays, mostly present with one LATE and one ABSENT sprinkled in.
    const attendanceDates: Date[] = [];
    for (const cursor = new Date(today); attendanceDates.length < 10; cursor.setDate(cursor.getDate() - 1)) {
      const day = cursor.getDay();
      if (day === 0 || day === 6) continue; // skip weekends
      attendanceDates.push(new Date(cursor));
    }
    const attendanceStatuses: Array<'PRESENT' | 'ABSENT' | 'LATE'> = attendanceDates.map((_, i) => {
      if (i === 2) return 'LATE';
      if (i === 5) return 'ABSENT';
      return 'PRESENT';
    });

    let attendanceCount = 0;
    for (const s of students) {
      await prisma.attendance.createMany({
        data: attendanceDates.map((date, i) => ({
          studentId: s.id,
          date,
          status: attendanceStatuses[i],
          markedById: sectionTeacher.id,
        })),
      });
      attendanceCount += attendanceDates.length;
    }

    await prisma.diaryEntry.create({
      data: {
        sectionId: section.id,
        subjectId: subjects[0].id,
        authorId: sectionTeacherUserId,
        date: today,
        text: diaryText,
        dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
    });

    return { timetableCount: timetableRows.length, attendanceCount };
  }

  const [schedule3A, schedule4B, schedule5C] = [
    await seedSectionSchedule(
      section3A,
      teacher,
      teacherUser.id,
      [student],
      'کتاب صفحہ 12 مکمل کریں۔ کل اپنی ورک بک لائیں۔',
    ),
    await seedSectionSchedule(
      section4B,
      teacher2,
      teacher2User.id,
      [studentIbrahim],
      'Complete worksheet 5, pages 10-12.',
    ),
    await seedSectionSchedule(
      section5C,
      teacher3,
      teacher3User.id,
      [studentHania],
      'Read chapter 3 and prepare a one-paragraph summary.',
    ),
  ];
  const timetableRowCount = schedule3A.timetableCount + schedule4B.timetableCount + schedule5C.timetableCount;
  const attendanceRowCount = schedule3A.attendanceCount + schedule4B.attendanceCount + schedule5C.attendanceCount;

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
    'Seeded: 1 school, 2 campuses, 3 classes/sections (3A/4B/5C, each with its own class ' +
      'teacher), 1 admin, 1 accounts, ' +
      `1 principal (${principalUser.identifier}), ` +
      '3 students (1 shared by both parents in 3A, 2 more linked only to Parent B — one per new ' +
      'section/campus/class teacher), 2 linked parents, ' +
      `${timetableRowCount} timetable periods across all 3 sections, ` +
      `${attendanceRowCount} attendance records across all 3 sections, ` +
      '3 diary entries (one per section), 1 circular, 1 conversation (with a reply), 3 notifications.',
  );
  console.log(
    'Login as parent-a@seeds.edu.pk / ChangeMe123! (or parent-b@... / teacher@... / teacher2@... / ' +
      'teacher3@... / admin@... / accounts@... / principal@...) — dev only.',
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
