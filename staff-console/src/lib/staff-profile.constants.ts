// staff-console/src/lib/staff-profile.constants.ts
// Mirrors backend/prisma/schema.prisma's EmployeeType/EmploymentStatus enums. Gender and
// DocumentType are already covered by student-profile.constants.ts (Staff reuses the exact
// same backend enums Student does for both) — re-exported here so every Staff view only ever
// imports option lists from this one file.
import type { SelectOption } from './student-profile.constants';
export type { SelectOption };
export { GENDER_OPTIONS, DOCUMENT_TYPE_OPTIONS } from './student-profile.constants';

export const EMPLOYEE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'OFFICE_STAFF', label: 'Office Staff' },
  { value: 'JANITORIAL', label: 'Janitorial' },
  { value: 'HELPER', label: 'Helper' },
  { value: 'GUARD', label: 'Guard' },
  { value: 'OTHER', label: 'Other' },
];

export const EMPLOYMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RESIGNED', label: 'Resigned' },
];