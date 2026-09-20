// backend/src/bulk-import/sample.ts
// One sample CSV per bulk-import entity: a header row matching that entity's service's expected
// columns (see students-bulk-import.service.ts/parents-.../teachers-.../staff-...), plus one
// example data row so a user can see the expected shape, not just the column names.
export const BULK_IMPORT_SAMPLES: Record<string, string> = {
  students:
    'grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\n' +
    'GR-00001,Ali Khan,<sectionId>,,father.ali,Muhammad Ali,0300-1234567\n',
  parents: 'identifier,name,phone\n' + 'father.ali,Muhammad Ali,0300-1234567\n',
  teachers:
    'identifier,name,campusId\n' + 'ayesha.khan,Ayesha Khan,<campusId>\n',
  staff:
    'name,employeeType,campusId,dateOfBirth,cnic,mobile,email,joiningDate,loginIdentifier\n' +
    'Nazir Ahmed,JANITORIAL,<campusId>,1990-05-01,42101-1234567-1,0300-1112233,nazir@example.com,2024-01-15,\n',
};
