import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const PASSWORD: string = (() => {
  const value = process.env.SEED_PASSWORD;
  if (!value) throw new Error('SEED_PASSWORD is required when running the seed.');
  return value;
})();
const CURRENT_START = new Date('2026-08-01');
const CURRENT_END = new Date('2027-06-30');
const PREVIOUS_START = new Date('2025-08-01');
const PREVIOUS_END = new Date('2026-06-30');
const schoolsDef = [
  {
    name: 'Beacon House',
    code: 'BH',
    registrationNumber: 'REG-BH-2010-001',
    website: 'https://beaconhouse.example.edu.pk',
    principalName: 'Dr. Ayesha Rahman',
    principalPhone: '021-111-2222',
    principalEmail: 'principal@bh.schoolportal.local',
    establishedDate: new Date('1975-04-01'),
    schoolType: 'PRIVATE',
    educationBoard: 'Cambridge',
    timezone: 'Asia/Karachi',
    currency: 'PKR',
    alternatePhone: '021-111-2223',
    branches: ['Gulshan Campus', 'PECHS Campus', 'North Nazimabad Campus'],
  },
  {
    name: 'The City School',
    code: 'TCS',
    registrationNumber: 'REG-TCS-2010-001',
    website: 'https://thecityschool.example.edu.pk',
    principalName: 'Mr. Bilal Chaudhry',
    principalPhone: '021-333-4444',
    principalEmail: 'principal@tcs.schoolportal.local',
    establishedDate: new Date('1978-09-01'),
    schoolType: 'PRIVATE',
    educationBoard: 'Federal Board',
    timezone: 'Asia/Karachi',
    currency: 'PKR',
    alternatePhone: '021-333-4445',
    branches: ['PAF Chapter', 'Gulshan Campus'],
  },
];
const CAMPUS_DEPARTMENTS = ['Academics', 'Administration', 'Accounts'];
const grades = Array.from({ length: 8 }, (_, i) => `Grade ${i + 1}`);
const subjectsDef = ['Mathematics', 'English', 'Urdu', 'Science', 'Social Studies', 'Computer', 'Islamiyat', 'Art'];
const statuses = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY'] as const;
const periods = [['08:00', '08:40'], ['08:40', '09:20'], ['09:20', '10:00'], ['10:20', '11:00'], ['11:00', '11:40'], ['11:40', '12:20']];
const day = (offset: number) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + offset); return x; };
const schoolCode = (name: string) => name === 'Beacon House' ? 'bh' : 'tcs';

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);
  const schools: any[] = [], campuses: any[] = [], sessions: any[] = [];

  const campusIndex = new Map<string, number>();
  for (const def of schoolsDef) {
    const schoolAddress = {
      id: randomUUID(),
      line1: `${def.name} Head Office, Shahrah-e-Faisal`,
      area: 'Clifton',
      city: 'Karachi',
      district: 'Karachi',
      province: 'Sindh',
      postalCode: '75600',
      country: 'Pakistan',
    };
    await prisma.address.create({ data: schoolAddress });
    const schoolLogo = {
      id: randomUUID(),
      storageKey: `seed-logo-${def.code.toLowerCase()}.png`,
      originalName: `${def.code}-logo.png`,
      mimeType: 'image/png',
      sizeBytes: 4096,
    };
    await prisma.file.create({ data: schoolLogo });

    const school = {
      id: randomUUID(),
      name: def.name,
      code: def.code,
      registrationNumber: def.registrationNumber,
      website: def.website,
      logoFileId: schoolLogo.id,
      principalName: def.principalName,
      principalPhone: def.principalPhone,
      principalEmail: def.principalEmail,
      establishedDate: def.establishedDate,
      schoolType: def.schoolType,
      educationBoard: def.educationBoard,
      timezone: def.timezone,
      currency: def.currency,
      alternatePhone: def.alternatePhone,
      addressId: schoolAddress.id,
      address: schoolAddress.line1,
      phone: def.principalPhone,
      email: `info@${def.code.toLowerCase()}.schoolportal.local`,
    };
    schools.push(school);
    await prisma.school.create({ data: school });

    const campusAddresses = def.branches.map((name) => ({
      id: randomUUID(),
      line1: `${name} Building, Main Boulevard`,
      area: name.replace(' Campus', '').replace(' Chapter', ''),
      city: 'Karachi',
      district: 'Karachi',
      province: 'Sindh',
      postalCode: '75500',
      country: 'Pakistan',
    }));
    await prisma.address.createMany({ data: campusAddresses });
    const campusLogos = def.branches.map((_name, i) => ({
      id: randomUUID(),
      storageKey: `seed-logo-${def.code.toLowerCase()}-${i + 1}.png`,
      originalName: `${def.code}-${i + 1}-logo.png`,
      mimeType: 'image/png',
      sizeBytes: 4096,
    }));
    await prisma.file.createMany({ data: campusLogos });

    const branchRows = def.branches.map((name, i) => ({
      id: randomUUID(),
      schoolId: school.id,
      name: `${def.name} - ${name}`,
      code: `${def.code}-${i + 1}`,
      campusType: i === 0 ? 'MAIN' : 'BRANCH',
      logoFileId: campusLogos[i].id,
      principalName: `${name} Head of Campus`,
      principalPhone: `${def.principalPhone.slice(0, -1)}${(i + 1) % 10}`,
      principalEmail: `principal.${def.code.toLowerCase()}${i + 1}@schoolportal.local`,
      openingDate: new Date(`${1980 + i * 3}-01-15`),
      capacity: 800 + i * 100,
      latitude: 24.86 + i * 0.015,
      longitude: 67.0 + i * 0.015,
      departments: CAMPUS_DEPARTMENTS,
      alternatePhone: `${def.alternatePhone.slice(0, -1)}${(i + 2) % 10}`,
      addressId: campusAddresses[i].id,
      address: campusAddresses[i].line1,
      phone: `${def.principalPhone.slice(0, -1)}${(i + 1) % 10}`,
      email: `campus.${def.code.toLowerCase()}${i + 1}@schoolportal.local`,
    }));
    branchRows.forEach((row, i) => campusIndex.set(row.id, i + 1));
    campuses.push(...branchRows);
    await prisma.campus.createMany({ data: branchRows });
    const previous = { id: randomUUID(), label: '2025-2026', startDate: PREVIOUS_START, endDate: PREVIOUS_END, isActive: false };
    const current = { id: randomUUID(), label: '2026-2027', startDate: CURRENT_START, endDate: CURRENT_END, isActive: true };
    sessions.push({ ...previous, schoolId: school.id }, { ...current, schoolId: school.id });
    await prisma.academicSession.createMany({ data: [previous, current] });
  }

  await prisma.subject.createMany({ data: subjectsDef.map(name => ({ id: randomUUID(), name })) });
  const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
  const users: any[] = [{ id: randomUUID(), identifier: 'superadmin@schoolportal.local', passwordHash, role: 'SUPER_ADMIN' }];
  const classes: any[] = [], sections: any[] = [], teachers: any[] = [], staff: any[] = [];
  const teacherBySection = new Map<string, { teacherId: string; userId: string }>();

  for (const school of schools) {
    const c = schoolCode(school.name);
    users.push(
      { id: randomUUID(), identifier: `admin@${c}.schoolportal.local`, passwordHash, role: 'SCHOOL_ADMIN', schoolId: school.id },
      { id: randomUUID(), identifier: `principal@${c}.schoolportal.local`, passwordHash, role: 'SCHOOL_ADMIN', isPrincipal: true, schoolId: school.id },
      { id: randomUUID(), identifier: `accounts@${c}.schoolportal.local`, passwordHash, role: 'ACCOUNTS', schoolId: school.id },
    );
  }

  for (const campus of campuses) {
    const session = sessions.find(x => x.schoolId === campus.schoolId && x.label === '2026-2027');
    const school = schools.find(x => x.id === campus.schoolId)!;
    for (let g = 0; g < 8; g++) {
      const classId = randomUUID();
      classes.push({ id: classId, campusId: campus.id, academicSessionId: session.id, name: grades[g] });
      for (const letter of ['A', 'B']) {
        const sectionId = randomUUID(), teacherId = randomUUID(), userId = randomUUID();
        const name = `${letter === 'A' ? 'Ayesha' : 'Hamza'} ${g + 1} Teacher`;
        users.push({ id: userId, identifier: `${schoolCode(school.name)}.c${campusIndex.get(campus.id)}.g${g + 1}${letter.toLowerCase()}@schoolportal.local`, passwordHash, role: 'TEACHER', schoolId: school.id });
        teachers.push({ id: teacherId, userId, name, campusId: campus.id });
        staff.push({ id: randomUUID(), userId, name, firstName: name.split(' ')[0], lastName: 'Teacher', employeeType: 'TEACHER', campusId: campus.id, joiningDate: new Date('2022-08-01'), employmentStatus: 'ACTIVE', teacherId });
        sections.push({ id: sectionId, classId, name: `${g + 1}${letter}`, classTeacherId: teacherId });
        teacherBySection.set(sectionId, { teacherId, userId });
      }
    }
  }
  await prisma.user.createMany({ data: users });
  await prisma.class.createMany({ data: classes });
  await prisma.teacher.createMany({ data: teachers });
  await prisma.section.createMany({ data: sections });
  await prisma.staff.createMany({ data: staff });

  const supportStaff: any[] = campuses.flatMap((c, i) => [
    { id: randomUUID(), name: `Office Staff ${i + 1}`, employeeType: 'OFFICE_STAFF', campusId: c.id, mobile: `0300-${String(9000000 + i).slice(-7)}`, joiningDate: new Date('2023-01-15'), employmentStatus: 'ACTIVE' },
    { id: randomUUID(), name: `Security Guard ${i + 1}`, employeeType: 'GUARD', campusId: c.id, mobile: `0311-${String(8000000 + i).slice(-7)}`, joiningDate: new Date('2023-03-01'), employmentStatus: 'ACTIVE' },
  ]);
  await prisma.staff.createMany({ data: supportStaff });

  const students: any[] = [], enrollments: any[] = [], addresses: any[] = [], previousSchools: any[] = [], emergencies: any[] = [], medical: any[] = [];
  const parentUsers: any[] = [], parentProfiles: any[] = [], studentParents: any[] = [];
  let sequence = 0;
  for (const section of sections) {
    const cls = classes.find(x => x.id === section.classId)!;
    const campus = campuses.find(x => x.id === cls.campusId)!;
    const school = schools.find(x => x.id === campus.schoolId)!;
    const session = sessions.find(x => x.schoolId === school.id && x.label === '2026-2027')!;
    for (let roll = 1; roll <= 20; roll++) {
      sequence++;
      const studentId = randomUUID(), currentAddressId = randomUUID(), permanentAddressId = randomUUID(), previousAddressId = randomUUID();
      const gr = `GR-${String(sequence).padStart(5, '0')}`;
      const first = ['Ayaan', 'Eman', 'Hassan', 'Maham', 'Rayyan', 'Hiba', 'Zayan', 'Areeba'][sequence % 8];
      const last = ['Khan', 'Ahmed', 'Malik', 'Sheikh', 'Hussain', 'Raza'][sequence % 6];
      students.push({ id: studentId, grNumber: gr, name: `${first} ${last}`, firstName: first, lastName: last, preferredName: first, gender: sequence % 2 ? 'MALE' : 'FEMALE', dateOfBirth: new Date(`${2013 + sequence % 7}-${String(sequence % 9 + 1).padStart(2, '0')}-15`), placeOfBirth: 'Karachi', nationality: 'Pakistani', religion: 'Islam', bFormNumber: `BFORM-${String(sequence).padStart(8, '0')}`, status: 'ACTIVE', admissionDate: new Date('2022-08-01'), studentMobile: `0300-${String(1000000 + sequence).slice(-7)}`, studentEmail: `${gr.toLowerCase()}@student.schoolportal.local`, currentAddressId, permanentAddressId });
      addresses.push(
        { id: currentAddressId, line1: `House ${10 + sequence % 90}, Street ${1 + sequence % 8}`, area: campus.name.replace(`${school.name} - `, ''), city: 'Karachi', district: 'Karachi', province: 'Sindh', postalCode: '75000', country: 'Pakistan' },
        { id: permanentAddressId, line1: `House ${20 + sequence % 70}, Street ${2 + sequence % 7}`, area: 'Gulshan-e-Iqbal', city: 'Karachi', district: 'Karachi', province: 'Sindh', postalCode: '75300', country: 'Pakistan' },
        { id: previousAddressId, line1: 'Main Road, Previous School Campus', city: 'Karachi', province: 'Sindh', postalCode: '75000', country: 'Pakistan' },
      );
      previousSchools.push({ id: randomUUID(), studentId, schoolName: `${school.name} Junior School`, addressId: previousAddressId, contactNumber: `021-3456${String(1000 + sequence).slice(-4)}`, email: `admissions${sequence}@previous-school.local`, lastClassAttended: cls.name, admissionDate: new Date('2021-08-01'), leavingDate: new Date('2022-06-30'), leavingCertificateNumber: `LC-${gr}`, leavingCertificateDate: new Date('2022-07-15'), reasonForLeaving: 'Family relocation', academicRemarks: 'Good academic standing' });
      emergencies.push({ id: randomUUID(), studentId, name: `Emergency Contact ${sequence}`, relationship: 'Uncle', phone: `0321-${String(2000000 + sequence).slice(-7)}`, alternatePhone: `0333-${String(3000000 + sequence).slice(-7)}`, email: `emergency${sequence}@schoolportal.local`, priority: 1, isPrimary: true });
      medical.push({ id: randomUUID(), studentId, bloodGroup: ['A_POS', 'B_POS', 'O_POS', 'AB_POS'][sequence % 4], allergies: 'None known', emergencyMedicalNotes: 'Contact parent in case of emergency.' });
      enrollments.push({ id: randomUUID(), studentId, campusId: campus.id, sectionId: section.id, academicSessionId: session.id, startDate: CURRENT_START, status: 'ACTIVE', rollNumber: String(roll).padStart(2, '0'), remarks: 'Seeded demo enrollment' });
      for (const relationship of ['father', 'mother']) {
        const userId = randomUUID(), profileId = randomUUID();
        const prefix = relationship;
        parentUsers.push({ id: userId, identifier: `${prefix}.${gr.toLowerCase()}@parent.schoolportal.local`, passwordHash, role: 'PARENT', schoolId: school.id });
        parentProfiles.push({ id: profileId, userId, name: `${relationship === 'father' ? 'Father' : 'Mother'} of ${first} ${last}`, phone: `03${relationship === 'father' ? '00' : '01'}-${String((relationship === 'father' ? 4000000 : 5000000) + sequence).slice(-7)}` });
        studentParents.push({ id: randomUUID(), studentId, parentProfileId: profileId, relationship });
      }
    }
  }
  await prisma.address.createMany({ data: addresses });
  await prisma.student.createMany({ data: students });
  await prisma.enrollment.createMany({ data: enrollments });
  await prisma.studentPreviousSchool.createMany({ data: previousSchools });
  await prisma.studentEmergencyContact.createMany({ data: emergencies });
  await prisma.studentMedicalInfo.createMany({ data: medical });
  await prisma.user.createMany({ data: parentUsers });
  await prisma.parentProfile.createMany({ data: parentProfiles });
  await prisma.studentParent.createMany({ data: studentParents });

  const timetable: any[] = [];
  for (const section of sections) {
    const teacher = teacherBySection.get(section.id)!;
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) for (let p = 0; p < periods.length; p++) {
      timetable.push({ id: randomUUID(), sectionId: section.id, subjectId: subjects[(dayOfWeek + p) % subjects.length].id, teacherId: teacher.teacherId, dayOfWeek, period: p + 1, startTime: periods[p][0], endTime: periods[p][1], room: section.name });
    }
  }
  await prisma.timetable.createMany({ data: timetable });

  const attendance: any[] = [];
  for (let i = 0; i < students.length; i++) {
    const teacher = teacherBySection.get(enrollments[i].sectionId)!;
    attendance.push(
      { id: randomUUID(), studentId: students[i].id, date: day(-2), status: statuses[i % 5], markedById: teacher.teacherId },
      { id: randomUUID(), studentId: students[i].id, date: day(-1), status: statuses[(i + 2) % 5], markedById: teacher.teacherId },
    );
  }
  await prisma.attendance.createMany({ data: attendance });

  const diary: any[] = [];
  for (const section of sections) {
    const teacher = teacherBySection.get(section.id)!;
    diary.push(
      { id: randomUUID(), sectionId: section.id, subjectId: subjects[0].id, authorId: teacher.userId, date: day(0), text: `Homework for ${section.name}: complete Mathematics workbook pages 10-12.`, dueDate: day(2) },
      { id: randomUUID(), sectionId: section.id, subjectId: subjects[1].id, authorId: teacher.userId, date: day(-1), text: `English activity for ${section.name}: read one story and write five new vocabulary words.`, dueDate: day(1) },
    );
  }
  await prisma.diaryEntry.createMany({ data: diary });

  const applicants: any[] = [], applications: any[] = [];
  for (let i = 0; i < campuses.length; i++) {
    const campus = campuses[i], school = schools.find(x => x.id === campus.schoolId)!, session = sessions.find(x => x.schoolId === school.id && x.label === '2026-2027')!;
    const cls = classes.find(x => x.campusId === campus.id)!;
    const applicantId = randomUUID();
    applicants.push({ id: applicantId, name: `Admission Applicant ${i + 1}`, dateOfBirth: new Date('2017-05-20'), guardianName: `Guardian ${i + 1}`, guardianPhone: `0345-${String(6000000 + i).slice(-7)}` });
    applications.push({ id: randomUUID(), applicantId, desiredClassId: cls.id, academicSessionId: session.id, status: ['SUBMITTED', 'UNDER_REVIEW', 'REJECTED'][i % 3], decisionNotes: i % 3 === 2 ? 'Seeded rejected demo application.' : null });
  }
  await prisma.applicant.createMany({ data: applicants });
  await prisma.application.createMany({ data: applications });

  const candidates = campuses.map((_campus, i) => ({ id: randomUUID(), name: `Hiring Candidate ${i + 1}`, dateOfBirth: new Date('1990-04-10'), contactPhone: `0355-${String(7000000 + i).slice(-7)}`, contactEmail: `candidate${i + 1}@schoolportal.local` }));
  await prisma.hiringCandidate.createMany({ data: candidates });
  await prisma.hiringApplication.createMany({ data: candidates.map((c, i) => ({ id: randomUUID(), candidateId: c.id, employeeType: i % 2 ? 'GUARD' : 'OFFICE_STAFF', campusId: campuses[i].id, status: i % 2 ? 'SHORTLISTED' : 'SUBMITTED' })) });

  console.log('Seed complete.');
  console.log(`Schools=${schools.length}, Campuses=${campuses.length}, Sessions=${sessions.length}, Classes=${classes.length}, Sections=${sections.length}`);
  console.log(`Teachers=${teachers.length}, Students=${students.length}, Parents=${parentUsers.length}, Enrollments=${enrollments.length}`);
  console.log(`Attendance=${attendance.length}, Timetable=${timetable.length}, Diary=${diary.length}, Applicants=${applicants.length}, Applications=${applications.length}`);
}

main().catch(error => { console.error('Seed failed:', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
