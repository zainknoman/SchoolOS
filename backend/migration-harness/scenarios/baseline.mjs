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
      expectEq('subjects shared across schools', summary.subjectsSharedAcrossSchools, e.subjectsSharedAcrossSchools),
      expectEq('subjects unreferenced', summary.subjectsUnreferenced, e.subjectsUnreferenced),
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
      expectEq('attendance actor backfillable from AuditLog', summary.attendanceActorBackfillable, 1),
      expectEq('sections without class teacher', summary.sectionsWithoutClassTeacher, e.sectionsWithoutClassTeacher),
    ];
  },
  async review(client) {
    return (await dryRun(client)).review;
  },
};
