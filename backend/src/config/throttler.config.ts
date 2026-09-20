export const THROTTLE_TTL_MS = 60_000;

export function getThrottlerLimits(nodeEnv = process.env.NODE_ENV) {
  const isTest = nodeEnv === 'test';

  return {
    authLogin: isTest ? 1000 : 5,
    general: isTest ? 1000 : 100,
  };
}

export const {
  authLogin: AUTH_LOGIN_THROTTLE_LIMIT,
  general: GENERAL_THROTTLE_LIMIT,
} = getThrottlerLimits();
