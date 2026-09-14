// Comprehensive local development seed for School OS.
// Creates 2 school organizations (Beacon House + The City School), 5 branches/campuses,
// Grades 1-8, 2 sections per grade, 20 students per section, 2 parents per student,
// class teachers, admissions, enrollments, sessions, 2 days of attendance, timetables,
// daily diary, fees, holidays, circulars, messages, notifications and assessment samples.
// Run with: npx tsx prisma/seed.ts

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PASSWORD = 'ChangeMe123!';
const GRADES = Array.from({ length: 8 }, (_, i) => i + 1);
const SECTIONS = ['A', 'B'];
const SUBJECT_NAMES = [
  'English',
  'Mathematics',
  'Urdu',
  'Science',
  'Computer Studies',
  'Social Studies',
  'Islamiyat',
  'Art',
];
const PERIOD_TIMES: Array<[string, string]> = [
  ['08:00', '08:40'],
  ['08:40', '09:20'],
  ['09:20', '10:00'],
  ['10:20', '11:00'],
  ['11:00', '11:40'],
  ['11:40', '12:20'],
];
const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY'] as const;

function dateOnly(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function firstNames(index: number) {
  const names = ['Ayaan', 'Hassan', 'Hamza', 'Ahmed', 'Zayan', 'Huzaifa', 'Rayyan', 'Ibrahim', 'Daniyal', 'Saad', 'Arham', 'Mikael', 'Ali', 'Abdullah', 'Usman', 'Talha', 'Areeb', 'Yahya', 'Sameer', 'Owais'];
  return names[index % names.length];
}

function femaleNames(index: number) {
  const names = ['Ayesha', 'Eshal', 'Hania', 'Fatima', 'Zoya', 'Inaya', 'Maham', 'Areeba', 'Aiman', 'Anaya', 'Laiba', 'Mehwish', 'Maryam', 'Iqra', 'Aleena', 'Sana', 'Minal', 'Aiza', 'Rida', 'Noor'];
  return names[index % names.length];
}

function parentFirstName(index: number, gender: 'father' | 'mother') {
  const male = ['Muhammad', 'Imran', 'Bilal', 'Kamran', 'Faisal', 'Asad', 'Tariq', 'Noman', 'Salman', 'Adnan'];
  const female = ['Sadia', 'Nadia', 'Farah', 'Sana', 'Uzma', 'Hira', 'Rabia', 'Samina', 'Kiran', 'Amna'];
  return (gender === 'father' ? male : female)[index % 10];
}

async function main() {
  // Keep this seed deterministic and safe to rerun against a development database.
  await prisma.$transaction(
    async (tx) => {
    await tx.$executeRawUnsafe('TRUNCATE TABLE "Mark", "Assessment", "AssessmentCategory", "Term", "ReportCard", "FeePaymentAllocation", "Receipt", "FeePayment", "FeeItem", "FeeVoucher", "LeaveRequest", "DiaryAttachment", "DiaryEntry", "Timetable", "AttendanceRiskFlag", "Attendance", "CircularRecipient", "CircularAttachment", "Circular", "Message", "Conversation", "Notification", "Application", "Applicant", "StudentDocument", "StudentMedicalInfo", "StudentEmergencyContact", "StudentPreviousSchool", "StudentParent", "ParentProfile", "Enrollment", "Student", "Address", "Teacher", "RefreshToken", "DeviceToken", "AuditLog", "PasswordResetToken", "User", "Section", "Class", "Holiday", "Campus", "AcademicSession", "School", "Subject", "FeeStructure", "File", "DraftSuggestion" CASCADE');

    const passwordHash = await argon2.hash(PASSWORD);

    const subjects = new Map<string, { id: string }>();
    for (const name of SUBJECT_NAMES) {
      const subject = await tx.subject.create({ data: { name } });
      subjects.set(name, subject);
    }
    const subjectList = [...subjects.values()];

    const schoolDefinitions = [
      {
        name: 'Beacon House',
        code: 'BEACON',
        campuses: ['PECHS Campus', 'Gulshan Campus', 'North Nazimabad Campus'],
      },
      {
        name: 'The City School',
        code: 'CITY',
        campuses: ['PECHS Campus', 'Gulshan Campus'],
      },
    ];

    let schoolCount = 0;
    let campusCount = 0;
    let classCount = 0;
    let sectionCount = 0;
    let studentCount = 0;
    let parentCount = 0;
    let teacherCount = 0;
    let enrollmentCount = 0;
    let attendanceCount = 0;
    let timetableCount = 0;
    let diaryCount = 0;
    let applicationCount = 0;

    const allSchoolData: Array<{
      school: { id: string; name: string };
      campuses: Array<{ id: string; name: string }>;
      session: { id: string; label: string; startDate: Date; endDate: Date };
      sections: Array<{ id: string; className: string; sectionName: string; campusId: string; teacherId: string; teacherUserId: string; students: Array<{ id: string }> }>;
      adminUserId: string;
      accountsUserId: string;
      principalUserId: string;
      parentUserIds: string[];
    }> = [];

    const attendanceDay1 = dateOnly('2026-09-10');
    const attendanceDay2 = dateOnly('2026-09-11');

    for (const schoolDef of schoolDefinitions) {
      const school = await tx.school.create({ data: { name: schoolDef.name } });
      schoolCount++;

      const session = await tx.academicSession.create({
        data: {
          label: '2026-2027',
          startDate: dateOnly('2026-08-01'),
          endDate: dateOnly('2027-06-30'),
          isActive: true,
        },
      });

      // Previous session gives the school realistic academic history.
      await tx.academicSession.create({
        data: {
          label: '2025-2026',
          startDate: dateOnly('2025-08-01'),
          endDate: dateOnly('2026-06-30'),
          isActive: false,
        },
      });

      const campuses = [] as Array<{ id: string; name: string }>;
      for (const campusName of schoolDef.campuses) {
        const campus = await tx.campus.create({ data: { schoolId: school.id, name: campusName } });
        campuses.push(campus);
        campusCount++;
      }

      const adminUser = await tx.user.create({
        data: {
          identifier: `admin@${schoolDef.code.toLowerCase()}.edu.pk`,
          passwordHash,
          role: 'SCHOOL_ADMIN',
          schoolId: school.id,
        },
      });
      const accountsUser = await tx.user.create({
        data: {
          identifier: `accounts@${schoolDef.code.toLowerCase()}.edu.pk`,
          passwordHash,
          role: 'ACCOUNTS',
          schoolId: school.id,
        },
      });
      const principalUser = await tx.user.create({
        data: {
          identifier: `principal@${schoolDef.code.toLowerCase()}.edu.pk`,
          passwordHash,
          role: 'SCHOOL_ADMIN',
          isPrincipal: true,
          schoolId: school.id,
        },
      });

      const sections: Array<{ id: string; classId: string; className: string; sectionName: string; campusId: string; teacherId: string; teacherUserId: string; students: Array<{ id: string }> }> = [];
      const parentUserIds: string[] = [];

      // Every branch has Grades 1-8.
      const term = await tx.term.create({
        data: {
          academicSessionId: session.id,
          label: 'Term 1',
          order: 1,
          startDate: dateOnly('2026-08-01'),
          endDate: dateOnly('2026-12-20'),
        },
      });

      for (const campus of campuses) {
        for (let grade = 1; grade <= 8; grade++) {
        const classRecord = await tx.class.create({
          data: { campusId: campus.id, academicSessionId: session.id, name: `Grade ${grade}` },
        });
        classCount++;

        // Assessment structure for every class.
        const category = await tx.assessmentCategory.create({
          data: { classId: classRecord.id, termId: term.id, name: 'Monthly Test', weightPercent: 20 },
        });

        const assessment = await tx.assessment.create({
          data: {
            assessmentCategoryId: category.id,
            subjectId: subjectList[1].id,
            label: 'September Mathematics Test',
            maxMarks: 50,
          },
        });

        for (const sectionLetter of SECTIONS) {
          const section = await tx.section.create({ data: { classId: classRecord.id, name: `${grade}${sectionLetter}` } });
          sectionCount++;

          const teacherUser = await tx.user.create({
            data: {
              identifier: `teacher.${schoolDef.code.toLowerCase()}.c${campuses.indexOf(campus) + 1}.${grade}${sectionLetter}@school.edu.pk`,
              passwordHash,
              role: 'TEACHER',
              schoolId: school.id,
            },
          });
          const teacher = await tx.teacher.create({
            data: {
              userId: teacherUser.id,
              name: `Teacher ${schoolDef.name} ${grade}${sectionLetter}`,
              campusId: campus.id,
            },
          });
          teacherCount++;
          await tx.section.update({ where: { id: section.id }, data: { classTeacherId: teacher.id } });

          const students: Array<{ id: string }> = [];
          for (let studentIndex = 0; studentIndex < 20; studentIndex++) {
            const globalStudentNo = studentCount + 1;
            const isFemale = studentIndex % 2 === 1;
            const studentName = `${isFemale ? femaleNames(studentIndex) : firstNames(studentIndex)} ${schoolDef.name.split(' ')[0]} ${grade}${sectionLetter}-${studentIndex + 1}`;
            const student = await tx.student.create({
              data: {
                grNumber: `GR-${schoolDef.code}-${String(globalStudentNo).padStart(4, '0')}`,
                name: studentName,
              },
            });
            studentCount++;
            students.push(student);

            await tx.enrollment.create({
              data: {
                studentId: student.id,
                campusId: campus.id,
                sectionId: section.id,
                academicSessionId: session.id,
                startDate: session.startDate,
                status: 'ACTIVE',
              },
            });
            enrollmentCount++;

            // Two distinct parent accounts per student: Father + Mother.
            for (const relationship of ['father', 'mother'] as const) {
              const parentUser = await tx.user.create({
                data: {
                  identifier: `${schoolDef.code.toLowerCase()}.gr${globalStudentNo}.${relationship}@parents.school.pk`,
                  passwordHash,
                  role: 'PARENT',
                  schoolId: school.id,
                },
              });
              const parent = await tx.parentProfile.create({
                data: {
                  userId: parentUser.id,
                  name: `${parentFirstName(studentIndex, relationship)} ${relationship === 'father' ? 'Father' : 'Mother'} of ${studentName}`,
                  phone: relationship === 'father' ? `0300${String(globalStudentNo).padStart(7, '0')}` : `0311${String(globalStudentNo).padStart(7, '0')}`,
                },
              });
              await tx.studentParent.create({
                data: { studentId: student.id, parentProfileId: parent.id, relationship },
              });
              parentCount++;
              parentUserIds.push(parentUser.id);
            }

            const status1 = ATTENDANCE_STATUSES[studentIndex % ATTENDANCE_STATUSES.length];
            const status2 = ATTENDANCE_STATUSES[(studentIndex + 1) % ATTENDANCE_STATUSES.length];
            await tx.attendance.createMany({
              data: [
                { studentId: student.id, date: attendanceDay1, status: status1, markedById: teacher.id },
                { studentId: student.id, date: attendanceDay2, status: status2, markedById: teacher.id },
              ],
            });
            attendanceCount += 2;

            await tx.mark.create({
              data: {
                assessmentId: assessment.id,
                studentId: student.id,
                obtainedMarks: 25 + (studentIndex % 26),
                enteredById: teacherUser.id,
              },
            });
          }

          for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
            for (let period = 1; period <= PERIOD_TIMES.length; period++) {
              const [startTime, endTime] = PERIOD_TIMES[period - 1];
              const subject = subjectList[(grade + dayOfWeek + period) % subjectList.length];
              await tx.timetable.create({
                data: {
                  sectionId: section.id,
                  subjectId: subject.id,
                  teacherId: teacher.id,
                  dayOfWeek,
                  period,
                  startTime,
                  endTime,
                  room: `Room ${grade}${sectionLetter}`,
                },
              });
              timetableCount++;
            }
          }

          // Two sample daily diary dates per section; each has homework/activity content.
          for (const diaryDate of [attendanceDay1, attendanceDay2]) {
            const diarySubject = subjectList[grade % subjectList.length];
            await tx.diaryEntry.create({
              data: {
                sectionId: section.id,
                subjectId: diarySubject.id,
                authorId: teacherUser.id,
                date: diaryDate,
                text: `Homework: Complete ${diarySubject ? 'the assigned classwork' : 'today’s work'} for Grade ${grade}${sectionLetter}. Activity: revise today's lesson and prepare one question for tomorrow.`,
                dueDate: addDays(diaryDate, 1),
              },
            });
            diaryCount++;
          }

          sections.push({ id: section.id, classId: classRecord.id, className: `Grade ${grade}`, sectionName: `${grade}${sectionLetter}`, campusId: campus.id, teacherId: teacher.id, teacherUserId: teacherUser.id, students });
        }
        }
      }

      // A few admissions per branch, covering different application states.
      for (let campusIndex = 0; campusIndex < campuses.length; campusIndex++) {
        const campusSections = sections.filter((s) => s.campusId === campuses[campusIndex].id);
        for (let a = 0; a < 5; a++) {
          const desired = campusSections[a % campusSections.length];
          const applicant = await tx.applicant.create({
            data: {
              name: `Applicant ${schoolDef.code} ${campusIndex + 1}-${a + 1}`,
              dateOfBirth: new Date(2017, a % 6, 5 + a),
              guardianName: `Guardian ${schoolDef.code} ${a + 1}`,
              guardianPhone: `0321${String(campusIndex * 10 + a + 1).padStart(7, '0')}`,
            },
          });
          await tx.application.create({
            data: {
              applicantId: applicant.id,
              desiredClassId: desired.classId,
              academicSessionId: session.id,
              status: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUBMITTED'][a],
              decisionNotes: a === 2 ? 'Admission approved for current session.' : a === 3 ? 'Seat not available for requested class.' : null,
              reviewedById: a >= 2 ? adminUser.id : null,
            },
          });
          applicationCount++;
        }
      }

      // One school holiday and one campus holiday.
      await tx.holiday.create({
        data: {
          title: 'Independence Day Holiday',
          startDate: dateOnly('2026-08-14'),
          endDate: dateOnly('2026-08-14'),
          campusId: null,
        },
      });
      await tx.holiday.create({
        data: {
          title: 'Campus Staff Training Day',
          startDate: dateOnly('2026-09-18'),
          endDate: dateOnly('2026-09-18'),
          campusId: campuses[0].id,
        },
      });

      const circular = await tx.circular.create({
        data: {
          title: `${schoolDef.name} — Parent-Teacher Meeting`,
          description: 'Parent-Teacher Meeting will be held this month. Please check the school calendar for your section schedule.',
          scope: 'school',
          priority: 'normal',
          authorId: adminUser.id,
        },
      });

      // Notify the first few parents so the notification screen has realistic content.
      const notificationParents = parentUserIds.slice(0, 10);
      await tx.circularRecipient.createMany({
        data: notificationParents.map((userId) => ({ circularId: circular.id, userId })),
      });
      await tx.notification.createMany({
        data: notificationParents.map((userId) => ({
          userId,
          type: 'circular',
          title: 'New school circular',
          body: `${schoolDef.name} published a Parent-Teacher Meeting circular.`,
          entityRef: circular.id,
        })),
      });

      // One parent ↔ class teacher conversation per school.
      const firstSection = sections[0];
      const firstStudent = firstSection.students[0];
      const firstParent = parentUserIds[0];
      const conversation = await tx.conversation.create({
        data: {
          parentUserId: firstParent,
          staffUserId: firstSection.teacherUserId,
          recipientType: 'CLASS_TEACHER',
          studentId: firstStudent.id,
          parentReadAt: new Date(),
          messages: {
            create: [{ senderId: firstParent, body: `Hello Teacher, please share today's homework for ${firstStudent.id}.` }],
          },
        },
      });
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: firstSection.teacherUserId,
          body: 'Sure. The homework and activity have been added to the daily diary.',
        },
      });
      await tx.conversation.update({ where: { id: conversation.id }, data: { staffReadAt: new Date(), lastMessageAt: new Date() } });

      // Fee setup and a paid sample voucher for the first student.
      const tuitionFee = await tx.feeStructure.create({ data: { name: `${schoolDef.name} Monthly Tuition`, amount: 500000 } });
      const voucher = await tx.feeVoucher.create({
        data: {
          studentId: firstStudent.id,
          academicSessionId: session.id,
          month: '2026-09',
          issueDate: attendanceDay1,
          dueDate: addDays(attendanceDay1, 10),
          items: { create: [{ label: tuitionFee.name, amount: tuitionFee.amount }] },
        },
      });
      const payment = await tx.feePayment.create({
        data: {
          amount: tuitionFee.amount,
          method: 'jazzcash',
          status: 'completed',
          reference: `SEED-${schoolDef.code}-PAY-001`,
          allocations: { create: [{ feeVoucherId: voucher.id, amount: tuitionFee.amount }] },
        },
      });
      await tx.receipt.create({ data: { feePaymentId: payment.id, receiptNumber: `RCPT-${schoolDef.code}-000001` } });

      await tx.leaveRequest.create({
        data: {
          studentId: firstStudent.id,
          startDate: addDays(attendanceDay2, 3),
          endDate: addDays(attendanceDay2, 4),
          reason: 'Family event out of town.',
          status: 'pending',
        },
      });

      await tx.notification.create({
        data: {
          userId: firstSection.teacherUserId,
          type: 'message',
          title: 'New message from parent',
          body: 'A parent asked about today\'s homework.',
          entityRef: conversation.id,
        },
      });

      allSchoolData.push({
        school,
        campuses,
        session,
        sections,
        adminUserId: adminUser.id,
        accountsUserId: accountsUser.id,
        principalUserId: principalUser.id,
        parentUserIds,
      });
    }

    // Attendance risk examples for a small set of students.
    for (const schoolData of allSchoolData) {
      for (const section of schoolData.sections.slice(0, 2)) {
        const student = section.students[0];
        await tx.attendanceRiskFlag.create({
          data: {
            studentId: student.id,
            absenceRate: 0.25,
            flagged: true,
            windowStart: attendanceDay1,
            windowEnd: attendanceDay2,
          },
        });
      }
    }

    // Global super-admin used by organization-management screens.
    await tx.user.create({
      data: {
        identifier: 'superadmin@schoolos.local',
        passwordHash,
        role: 'SUPER_ADMIN',
      },
    });

    console.log('='.repeat(72));
    console.log('School OS seed completed successfully.');
    console.log(`Schools: ${schoolCount}`);
    console.log(`Branches/Campuses: ${campusCount}`);
    console.log(`Classes: ${classCount} (Grades 1-8 per branch allocation)`);
    console.log(`Sections: ${sectionCount} (2 per class)`);
    console.log(`Students: ${studentCount} (20 per section)`);
    console.log(`Parents: ${parentCount} (2 per student: father + mother)`);
    console.log(`Teachers/Class Teachers: ${teacherCount} (1 per section)`);
    console.log(`Enrollments: ${enrollmentCount}`);
    console.log(`Attendance: ${attendanceCount} (2 days per student; all 5 statuses represented)`);
    console.log(`Timetable rows: ${timetableCount} (Mon-Fri, 6 periods per section)`);
    console.log(`Diary entries: ${diaryCount} (2 sample days per section)`);
    console.log(`Admissions/Applications: ${applicationCount}`);
    console.log('Login password for all seeded accounts: ChangeMe123!');
    console.log('School admin: admin@beacon.edu.pk / admin@city.edu.pk');
    console.log('Parent example: beacon.gr1.father@parents.school.pk');
    console.log('Teacher example: teacher.beacon.1A@school.edu.pk');
    console.log('Super admin: superadmin@schoolos.local');
    console.log('='.repeat(72));
    },
    { maxWait: 10_000, timeout: 600_000 },
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
