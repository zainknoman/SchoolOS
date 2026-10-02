import { ConfigService } from '@nestjs/config';

/**
 * BL-49: AI drafting is off unless AI_DRAFTING=enabled (Q39). When on, each user may ask for at
 * most AI_DRAFTING_DAILY_LIMIT suggestions per day (default 20) and a context of at most
 * AI_DRAFTING_MAX_CONTEXT characters (default 2000). Without ANTHROPIC_API_KEY the stub provider
 * answers, so the flow can be tried without spending anything.
 */
export interface AiDraftingSettings {
  enabled: boolean;
  dailyLimit: number;
  maxContextChars: number;
}

function positiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${name} must be a positive whole number`);
  }
  return n;
}

export function resolveAiDraftingSettings(
  config: ConfigService,
): AiDraftingSettings {
  return {
    enabled: config.get<string>('AI_DRAFTING')?.trim() === 'enabled',
    dailyLimit: positiveInt(
      config.get<string>('AI_DRAFTING_DAILY_LIMIT'),
      20,
      'AI_DRAFTING_DAILY_LIMIT',
    ),
    maxContextChars: positiveInt(
      config.get<string>('AI_DRAFTING_MAX_CONTEXT'),
      2000,
      'AI_DRAFTING_MAX_CONTEXT',
    ),
  };
}

export const AI_DRAFTING_SETTINGS = 'AI_DRAFTING_SETTINGS';
