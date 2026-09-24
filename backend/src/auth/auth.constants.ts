import type { StringValue } from 'ms';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;
// JWT_ACCESS_TTL is developer-set config (.env), not user input — asserting the `ms`-compatible
// literal shape here is safe; an invalid value would fail fast at JwtModule.register() either way.
export const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_TTL ??
  '15m') as StringValue;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const GENERIC_AUTH_ERROR = 'Invalid credentials';
export const ACCOUNT_LOCKED_ERROR =
  'Account temporarily locked. Try again later.';
export const PASSWORD_RESET_TOKEN_TTL_HOURS = 1;
// Returned by both forgot-password branches (identifier found or not) — never reveal account
// existence.
export const FORGOT_PASSWORD_GENERIC_MESSAGE =
  'If an account exists for that identifier, a password reset link has been sent.';
// Returned for every reset-password failure branch (expired/used/unknown token) — never
// distinguish "expired" from "wrong" (same enumeration-defense reasoning as login).
export const RESET_PASSWORD_GENERIC_ERROR =
  'This reset link is invalid or has expired.';
// BL-21: a valid-looking access token whose user was disabled, deleted or had sessions revoked.
export const SESSION_ENDED_ERROR =
  'Your session has ended. Please sign in again.';
// BL-21: shown only AFTER a correct password, so it never reveals whether an account exists.
export const ACCOUNT_DISABLED_ERROR =
  'This account has been disabled. Contact your school administrator.';
// BL-21: error code the clients use to route a provisioned login to the change-password screen.
export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';
