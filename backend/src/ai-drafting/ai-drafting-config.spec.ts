import { ConfigService } from '@nestjs/config';
import { resolveAiDraftingSettings } from './ai-drafting-config';

const cfg = (v: Record<string, string>) =>
  ({ get: (k: string) => v[k] }) as unknown as ConfigService;

describe('resolveAiDraftingSettings (BL-49)', () => {
  it('is off by default with conservative limits', () => {
    expect(resolveAiDraftingSettings(cfg({}))).toEqual({
      enabled: false,
      dailyLimit: 20,
      maxContextChars: 2000,
    });
  });

  it('turns on only for AI_DRAFTING=enabled and reads the limits', () => {
    expect(
      resolveAiDraftingSettings(
        cfg({
          AI_DRAFTING: 'enabled',
          AI_DRAFTING_DAILY_LIMIT: '5',
          AI_DRAFTING_MAX_CONTEXT: '800',
        }),
      ),
    ).toEqual({ enabled: true, dailyLimit: 5, maxContextChars: 800 });
    expect(resolveAiDraftingSettings(cfg({ AI_DRAFTING: 'yes' })).enabled).toBe(
      false,
    );
  });

  it('refuses a nonsensical limit at boot', () => {
    expect(() =>
      resolveAiDraftingSettings(cfg({ AI_DRAFTING_DAILY_LIMIT: '0' })),
    ).toThrow('AI_DRAFTING_DAILY_LIMIT');
  });
});
