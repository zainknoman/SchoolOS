import { SetMetadata } from '@nestjs/common';

export const STAFF_GRANTS = ['ADMISSIONS', 'COMPLAINTS', 'MESSAGES'] as const;
export type StaffGrantName = (typeof STAFF_GRANTS)[number];

export const GRANT_KEY = 'staffGrant';

/**
 * BL-32 (Q18): an ACCOUNTS user reaches this route only with the named grant (`User.grants`).
 * Every other role is unaffected — its access is decided by @Roles and the services as before.
 */
export const RequiresGrant = (grant: StaffGrantName) =>
  SetMetadata(GRANT_KEY, grant);
