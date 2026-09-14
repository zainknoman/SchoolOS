// staff-console/src/lib/student-profile.constants.ts
// Mirrors backend/prisma/schema.prisma's Gender/BloodGroup/StudentStatus/DocumentType enums.
// No backend "list enum values" endpoint exists — these are small, stable, code-level constants.

export interface SelectOption {
  value: string;
  label: string;
}

export const GENDER_OPTIONS: SelectOption[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export const BLOOD_GROUP_OPTIONS: SelectOption[] = [
  { value: 'A_POS', label: 'A+' },
  { value: 'A_NEG', label: 'A-' },
  { value: 'B_POS', label: 'B+' },
  { value: 'B_NEG', label: 'B-' },
  { value: 'AB_POS', label: 'AB+' },
  { value: 'AB_NEG', label: 'AB-' },
  { value: 'O_POS', label: 'O+' },
  { value: 'O_NEG', label: 'O-' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

export const STUDENT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'LEFT', label: 'Left' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

export const DOCUMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { value: 'B_FORM', label: 'B-Form' },
  { value: 'LEAVING_CERTIFICATE', label: 'Leaving Certificate' },
  { value: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate' },
  { value: 'PREVIOUS_REPORT_CARD', label: 'Previous Report Card' },
  { value: 'PHOTOGRAPH', label: 'Photograph' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
  { value: 'CNIC', label: 'CNIC' },
  { value: 'DEGREE_CERTIFICATE', label: 'Degree Certificate' },
  { value: 'CV', label: 'CV' },
  { value: 'OTHER', label: 'Other' },
];