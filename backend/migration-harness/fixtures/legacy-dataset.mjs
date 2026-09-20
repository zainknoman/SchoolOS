// Production-like LEGACY dataset (schema as of the 13 current migrations) used by every harness scenario.
// It deliberately contains the ambiguous shapes the planned migrations must handle (BL-62):
//  - two schools sharing ONE global academic session, plus a session used by a single school
//  - a global subject and a global fee structure referenced by both schools; an unreferenced subject
//  - a parent (P1) with children in BOTH schools, a duplicate-candidate parent pair (same phone, different
//    identifiers, no CNIC — CNIC and identifier are already UNIQUE so exact duplicates on them cannot exist),
//    a student with 3 guardian links, and two guardians with the same name but different CNICs (must
//    NEVER be merged on name)
//  - students with status LEFT: one with a matching TRANSFERRED_OUT promotion, two without (manual review)
//  - circulars/holidays without a school anchor (school-scope circular by an author with no school,
//    null-campus holiday), attendance marked by teachers and by an admin attributed to the class teacher,
//    a section without a class teacher, leave requests
// Returns a manifest of ids and the expected counts used by scenario checks.
export async function buildLegacyDataset(client, insert) {
  const m = { ids: {}, expect: {} };
  const now = new Date('2026-01-15T00:00:00Z');
  const d = (s) => new Date(s);

  // --- organisation
  const schoolA = await insert('School', { name: 'Demo School A' });
  const schoolB = await insert('School', { name: 'Demo School B' });
  const campusA = await insert('Campus', { schoolId: schoolA, name: 'A Main Campus' });
  const campusB = await insert('Campus', { schoolId: schoolB, name: 'B Main Campus' });
  const sessGlobal = await insert('AcademicSession', { label: '2025-2026', startDate: d('2025-08-01'), endDate: d('2026-06-30'), isActive: true });
  const sessAOnly = await insert('AcademicSession', { label: '2026-2027-A', startDate: d('2026-04-01'), endDate: d('2027-03-31'), isActive: false });
  Object.assign(m.ids, { schoolA, schoolB, campusA, campusB, sessGlobal, sessAOnly });

  // --- users
  const uid = async (identifier, role, extra = {}) => insert('User', { identifier, passwordHash: 'x', role, ...extra });
  const adminA = await uid('admin.a@demo-a.test', 'SCHOOL_ADMIN', { schoolId: schoolA });
  const adminB = await uid('admin.b@demo-b.test', 'SCHOOL_ADMIN', { schoolId: schoolB });
  const superAdmin = await uid('root@demo.test', 'SUPER_ADMIN');
  const teacherUserA = await uid('teacher.a@demo-a.test', 'TEACHER', { schoolId: schoolA, campusId: campusA });
  const teacherUserB = await uid('teacher.b@demo-b.test', 'TEACHER', { schoolId: schoolB, campusId: campusB });
  const teacherA = await insert('Teacher', { userId: teacherUserA, name: 'Teacher A', campusId: campusA });
  const teacherB = await insert('Teacher', { userId: teacherUserB, name: 'Teacher B', campusId: campusB });
  Object.assign(m.ids, { adminA, adminB, superAdmin, teacherA, teacherB });

  // --- classes / sections (one section without a class teacher)
  const classA = await insert('Class', { campusId: campusA, academicSessionId: sessGlobal, name: 'Class 3' });
  const classB = await insert('Class', { campusId: campusB, academicSessionId: sessGlobal, name: 'Class 3' });
  const classA2 = await insert('Class', { campusId: campusA, academicSessionId: sessAOnly, name: 'Class 4' });
  const secA = await insert('Section', { classId: classA, name: 'A', classTeacherId: teacherA });
  const secANoTeacher = await insert('Section', { classId: classA, name: 'B' });
  const secB = await insert('Section', { classId: classB, name: 'A', classTeacherId: teacherB });
  Object.assign(m.ids, { classA, classB, classA2, secA, secANoTeacher, secB });

  // --- subjects / fee structure / term shared globally
  const subjMath = await insert('Subject', { name: 'Mathematics' });
  const subjUnused = await insert('Subject', { name: 'Calligraphy' });
  const feeGlobal = await insert('FeeStructure', { name: 'Tuition', amount: 5000 });
  const termGlobal = await insert('Term', { academicSessionId: sessGlobal, label: 'Term 1', order: 1, startDate: d('2025-08-01'), endDate: d('2025-12-20') });
  await insert('Timetable', { sectionId: secA, subjectId: subjMath, dayOfWeek: 1, period: 1, startTime: '08:00', endTime: '08:40', teacherId: teacherA });
  await insert('Timetable', { sectionId: secB, subjectId: subjMath, dayOfWeek: 1, period: 1, startTime: '08:00', endTime: '08:40', teacherId: teacherB });
  Object.assign(m.ids, { subjMath, subjUnused, feeGlobal, termGlobal });

  // --- students (status coverage) and enrolments
  const mkStudent = async (gr, name, status = 'ACTIVE', sec = secA, campus = campusA, sess = sessGlobal) => {
    const id = await insert('Student', { grNumber: gr, name, status });
    const enrollment = await insert('Enrollment', { studentId: id, campusId: campus, sectionId: sec, academicSessionId: sess, startDate: d('2025-08-01'), status: status === 'ACTIVE' ? 'ACTIVE' : 'WITHDRAWN' });
    return { id, enrollment };
  };
  const stActiveA = await mkStudent('GR-A-001', 'Ayesha Khan');
  const stActiveB = await mkStudent('GR-B-001', 'Bilal Ahmed', 'ACTIVE', secB, campusB);
  const stSimilar1 = await mkStudent('GR-A-002', 'Sara Malik');
  const stSimilar2 = await mkStudent('GR-B-002', 'Sara Malik', 'ACTIVE', secB, campusB); // same name, different family
  const stLeftMatched = await mkStudent('GR-A-010', 'Leaver Matched', 'LEFT');
  const stLeftUnmatched1 = await mkStudent('GR-A-011', 'Leaver Unmatched One', 'LEFT');
  const stLeftUnmatched2 = await mkStudent('GR-B-011', 'Leaver Unmatched Two', 'LEFT', secB, campusB);
  const stGraduated = await mkStudent('GR-A-020', 'Graduate One', 'GRADUATED');
  const stWithdrawn = await mkStudent('GR-A-021', 'Withdrawn One', 'WITHDRAWN');
  const stNoTeacherSection = await mkStudent('GR-A-030', 'No Teacher Section', 'ACTIVE', secANoTeacher);
  Object.assign(m.ids, { stActiveA: stActiveA.id, stActiveB: stActiveB.id, stLeftMatched: stLeftMatched.id, stLeftUnmatched1: stLeftUnmatched1.id, stLeftUnmatched2: stLeftUnmatched2.id });

  // promotions: only stLeftMatched has a TRANSFERRED_OUT decision
  await insert('StudentPromotion', { studentId: stLeftMatched.id, fromEnrollmentId: stLeftMatched.enrollment, decision: 'TRANSFERRED_OUT', decidedById: adminA });
  await insert('StudentPromotion', { studentId: stGraduated.id, fromEnrollmentId: stGraduated.enrollment, decision: 'GRADUATED', decidedById: adminA });

  // --- parents / guardians
  const mkParent = async (identifier, name, cnic, phone) => {
    const userId = await uid(identifier, 'PARENT');
    const profile = await insert('ParentProfile', { userId, name, ...(cnic ? { cnic } : {}), ...(phone ? { phone } : {}) });
    return { userId, profile };
  };
  const link = (student, parent) => insert('StudentParent', { studentId: student.id, parentProfileId: parent.profile });
  const p1 = await mkParent('parent.one@demo.test', 'Parent One', '35202-1111111-1'); // children in BOTH schools
  const p2 = await mkParent('parent.two@demo.test', 'Parent Two', '35202-2222222-2', '0300-1111111');
  const p2dup = await mkParent('parent.two.alt@demo.test', 'Parent Two', null, '0300-1111111'); // duplicate candidate: same phone, no CNIC
  const p3 = await mkParent('parent.three@demo.test', 'Parent Three', '35202-3333333-3');
  const p4 = await mkParent('parent.four@demo.test', 'Parent Four', '35202-4444444-4');
  const p5 = await mkParent('parent.five@demo.test', 'Parent Five', '35202-5555555-5');
  const pSim1 = await mkParent('sara.mother@demo.test', 'Sara Family', '35202-6666666-6');
  const pSim2 = await mkParent('sara.mother2@demo.test', 'Sara Family', '35202-7777777-7'); // same name, different CNIC → never merge
  await link(stActiveA, p1);
  await link(stActiveB, p1);
  await link(stActiveA, p2);
  await link(stSimilar1, p2dup);
  await link(stNoTeacherSection, p3); // one student, three guardians
  await link(stNoTeacherSection, p4);
  await link(stNoTeacherSection, p5);
  await link(stSimilar1, pSim1);
  await link(stSimilar2, pSim2);
  Object.assign(m.ids, { p1: p1.profile, p2: p2.profile, p2dup: p2dup.profile, pSim1: pSim1.profile, pSim2: pSim2.profile });

  // --- attendance: teacher-marked, and an admin write attributed to the class teacher (the BL-60 shape)
  await insert('Attendance', { studentId: stActiveA.id, date: d('2026-01-12'), status: 'PRESENT', markedById: teacherA });
  await insert('Attendance', { studentId: stActiveA.id, date: d('2026-01-13'), status: 'ABSENT', markedById: teacherA });
  await insert('Attendance', { studentId: stActiveB.id, date: d('2026-01-12'), status: 'PRESENT', markedById: teacherB });
  await insert('Attendance', { studentId: stSimilar1.id, date: d('2026-01-14'), status: 'LEAVE', markedById: teacherA }); // admin-marked, attributed to class teacher
  await insert('AuditLog', { userId: adminA, action: 'attendance.update', entity: 'Attendance', entityId: stSimilar1.id, metadata: JSON.stringify({ studentId: stSimilar1.id, date: '2026-01-14', status: 'LEAVE' }) });

  // --- circulars / holidays without a reliable school anchor
  await insert('Circular', { title: 'School-wide notice', description: 'x', scope: 'school', authorId: superAdmin }); // author has no school → ambiguous
  await insert('Circular', { title: 'A school notice', description: 'x', scope: 'school', authorId: adminA }); // resolvable via author
  await insert('Circular', { title: 'Section notice', description: 'x', scope: 'section', sectionId: secB, authorId: teacherUserB }); // resolvable via section
  await insert('Holiday', { title: 'National holiday (no campus)', startDate: d('2026-03-23'), endDate: d('2026-03-23') }); // ambiguous: applies to all schools today
  await insert('Holiday', { title: 'Campus A holiday', startDate: d('2026-02-05'), endDate: d('2026-02-05'), campusId: campusA });

  // --- leave & complaints
  await insert('LeaveRequest', { studentId: stActiveA.id, startDate: d('2026-01-20'), endDate: d('2026-01-21'), reason: 'Family event', status: 'approved' });
  await insert('LeaveRequest', { studentId: stNoTeacherSection.id, startDate: d('2026-01-22'), endDate: d('2026-01-22'), reason: 'Fever' });
  await insert('Complaint', { studentId: stActiveA.id, raisedById: p1.userId, subject: 'Bus timing', description: 'x' });

  m.expect = {
    schools: 2, campuses: 2, sessions: 2,
    students: 10, guardianLinks: 9, parentProfiles: 8,
    leftStudents: 3, leftWithTransferredOut: 1, leftWithoutPromotion: 2,
    duplicateContactGroups: 1, sameNameDifferentCnicPairs: 1,
    sessionsSharedAcrossSchools: 1, subjectsSharedAcrossSchools: 1, subjectsUnreferenced: 1,
    circulars: 3, circularsAmbiguous: 1, holidays: 2, holidaysAmbiguous: 1,
    attendance: 4, sectionsWithoutClassTeacher: 1,
  };
  m.now = now;
  return m;
}
