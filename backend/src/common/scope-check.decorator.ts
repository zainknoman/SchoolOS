import { SetMetadata } from '@nestjs/common';

export const SCOPE_CHECK_KEY = 'scopeCheck';

/** Only the caller's own records are read or written (keyed on `req.user.id`). */
export const SELF = 'self';
/** Reads or writes nothing that belongs to a school (e.g. an AI draft, a CSV template). */
export const NO_SCHOOL_DATA = 'no-school-data';
/**
 * Guardian identities are global by design (BL-23/BL-04): a parent is found by exact identifier and
 * linked to a child; the link itself is scope-checked (`assertStudentInScope`).
 */
export const SHARED_IDENTITY = 'shared-identity';

/**
 * KG-16: declares how a route that takes caller input (`@Param`, `@Body`, `@Query`, a file) is
 * confined to the caller's school/campus when `RecordScopeGuard` (`@ScopedRecord`) does not cover
 * it. Each entry names the function that performs the check — `route-scope.spec.ts` fails when the
 * name does not exist — or is `SELF` / `NO_SCHOOL_DATA` / `SHARED_IDENTITY`. Every such route must carry one or the
 * other, so a new route cannot ship without someone stating where its scope is enforced.
 */
export const ScopeCheck = (...checks: string[]) =>
  SetMetadata(SCOPE_CHECK_KEY, checks);
