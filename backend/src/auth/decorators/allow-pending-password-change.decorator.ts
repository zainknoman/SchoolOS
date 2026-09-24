import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange';

/**
 * Marks a route an account with `mustChangePassword` may still call (BL-21). Everything else
 * answers 403 PASSWORD_CHANGE_REQUIRED until the password is changed. Keep this list minimal:
 * change-password itself, logout-all, and the caller's own identity.
 */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
