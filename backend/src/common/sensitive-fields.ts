/**
 * BL-07 (RD-6, Q7): the one list of sensitive personal data columns — national identifiers and
 * health information. Code that copies personal data OUT of the system (exports, reports) must go
 * through `withoutSensitive()` unless the caller explicitly asked for and is allowed the sensitive
 * fields. Keeping them named in one place (and, for health data, in its own table
 * `StudentMedicalInfo`) is what lets encryption at rest or field-level encryption be added later
 * without redesigning the data model — see docs/security/SENSITIVE-DATA.md.
 */
export const SENSITIVE_FIELDS = {
  Student: ['bFormNumber', 'religion'],
  StudentMedicalInfo: [
    'bloodGroup',
    'allergies',
    'medicalConditions',
    'specialEducationalNeeds',
    'medicationNotes',
    'emergencyMedicalNotes',
  ],
  ParentProfile: ['cnic'],
  Staff: ['cnic'],
  HiringCandidate: ['cnic'],
} as const;

export type SensitiveModel = keyof typeof SENSITIVE_FIELDS;

export function isSensitive(model: SensitiveModel, field: string): boolean {
  return (SENSITIVE_FIELDS[model] as readonly string[]).includes(field);
}

/** A copy of `row` without the model's sensitive columns. */
export function withoutSensitive<T extends Record<string, unknown>>(
  model: SensitiveModel,
  row: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!isSensitive(model, k)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
