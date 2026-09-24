// Baseline scenario: the legacy dataset on the CURRENT schema + the BL-62 read-only dry-run. It proves the
// fixture contains every ambiguous shape the planned migrations must handle, and gives the manual-review list.
import { buildLegacyDataset } from '../fixtures/legacy-dataset.mjs';
import { dryRun } from '../dry-run.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

export default {
  name: 'baseline',
  buildFixture: buildLegacyDataset,
  async checks(client, { manifest }) {
    const { summary } = await dryRun(client);
    const e = manifest.expect;
    return [
      expectEq('sessions', summary.sessions, e.sessions),
      expectEq('sessions shared across schools', summary.sessionsSharedAcrossSchools, e.sessionsSharedAcrossSchools),
      expectEq('sessions unreferenced', summary.sessionsUnreferenced, e.sessionsUnreferenced),
      expectEq('session dependents unresolvable', summary.sessionDependentsUnresolvable, e.sessionDependentsUnresolvable),
      expectEq('subjects shared across schools (Timetable/Assessment/DiaryEntry)', summary.subjectsSharedAcrossSchools, e.subjectsSharedAcrossSchools),
      expectEq('subjects single school', summary.subjectsSingleSchool, e.subjectsSingleSchool),
      expectEq('subjects unreferenced', summary.subjectsUnreferenced, e.subjectsUnreferenced),
      expectEq('fee structures', summary.feeStructures, e.feeStructures),
      expectEq('fee structures shared across schools (by label)', summary.feeStructuresSharedAcrossSchools, e.feeStructuresSharedAcrossSchools),
      expectEq('fee structures single school (by label)', summary.feeStructuresSingleSchool, e.feeStructuresSingleSchool),
      expectEq('fee structures unreferenced', summary.feeStructuresUnreferenced, e.feeStructuresUnreferenced),
      expectEq('fee structures with a name collision', summary.feeStructuresNameCollision, e.feeStructuresNameCollision),
      expectEq('parent profiles', summary.parentProfiles, e.parentProfiles),
      expectEq('guardian links', summary.guardianLinks, e.guardianLinks),
      expectEq('duplicate-contact candidate groups', summary.duplicateContactGroups, e.duplicateContactGroups),
      expectEq('same name, different CNIC (never merged)', summary.sameNameDifferentCnic, e.sameNameDifferentCnicPairs),
      expectEq('students with > 2 guardians', summary.studentsWithMoreThanTwoGuardians, 1),
      expectEq('guardians across schools', summary.guardiansAcrossSchools, 1),
      expectEq('LEFT students', summary.leftStudents, e.leftStudents),
      expectEq('LEFT with TRANSFERRED_OUT', summary.leftWithTransferredOut, e.leftWithTransferredOut),
      expectEq('LEFT without matching promotion', summary.leftWithoutMatchingPromotion, e.leftWithoutPromotion),
      expectEq('circulars ambiguous', summary.circularsAmbiguous, e.circularsAmbiguous),
      expectEq('holidays ambiguous', summary.holidaysAmbiguous, e.holidaysAmbiguous),
      expectEq('attendance rows', summary.attendance, e.attendance),
      expectEq('attendance actor backfillable from AuditLog', summary.attendanceActorBackfillable, e.attendanceActorBackfillable),
      expectEq('sections without class teacher', summary.sectionsWithoutClassTeacher, e.sectionsWithoutClassTeacher),
    ];
  },
  async review(client) {
    return (await dryRun(client)).review;
  },
};
