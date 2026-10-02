import type Anthropic from '@anthropic-ai/sdk';
import {
  AnthropicDraftingProvider,
  DRAFTING_MODEL,
} from './anthropic-drafting.provider';

describe('AnthropicDraftingProvider (BL-49)', () => {
  const create = jest.fn();
  const client = { beta: { messages: { create } } } as unknown as Anthropic;
  const provider = new AnthropicDraftingProvider({ apiKey: 'unused' }, client);

  beforeEach(() => create.mockReset());

  it('asks the current model at low effort with refusal fallback, and reports usage', async () => {
    create.mockResolvedValue({
      model: DRAFTING_MODEL,
      stop_reason: 'end_turn',
      usage: { input_tokens: 90, output_tokens: 60 },
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: 'Dear parents, ...' },
      ],
    });
    await expect(
      provider.suggestDraft({ context: 'PTM', targetType: 'circular' }),
    ).resolves.toEqual({
      text: 'Dear parents, ...',
      model: DRAFTING_MODEL,
      inputTokens: 90,
      outputTokens: 60,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-5-5',
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content: 'PTM' }],
      }),
    );
  });

  it('returns an empty draft (with usage) when the request is declined', async () => {
    create.mockResolvedValue({
      model: DRAFTING_MODEL,
      stop_reason: 'refusal',
      usage: { input_tokens: 10, output_tokens: 0 },
      content: [],
    });
    await expect(
      provider.suggestDraft({ context: 'x', targetType: 'diary' }),
    ).resolves.toMatchObject({ text: '', inputTokens: 10 });
  });
});
