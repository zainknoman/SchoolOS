import Anthropic from '@anthropic-ai/sdk';
import { AiDraftingProvider, DraftResult } from './ai-drafting-provider';
import type { AnthropicConfig } from './anthropic-config';

export const DRAFTING_MODEL = 'claude-opus-5-5';
/** Thinking is always on for this model and counts toward max_tokens; a draft is short. */
const MAX_TOKENS = 4000;
/** A drafting request must not hold a staff member's click for long (BL-49 cost/latency bound). */
const TIMEOUT_MS = 30_000;

export class AnthropicDraftingProvider implements AiDraftingProvider {
  private readonly client: Anthropic;

  constructor(config: AnthropicConfig, client?: Anthropic) {
    this.client =
      client ??
      new Anthropic({
        apiKey: config.apiKey,
        timeout: TIMEOUT_MS,
        maxRetries: 1,
      });
  }

  async suggestDraft(input: {
    context: string;
    targetType: 'circular' | 'diary';
  }): Promise<DraftResult> {
    const targetLabel =
      input.targetType === 'circular' ? 'school circular' : 'diary entry';
    const response = await this.client.beta.messages.create({
      model: DRAFTING_MODEL,
      max_tokens: MAX_TOKENS,
      // A short draft does not need deep reasoning; effort is the cost lever on this model.
      output_config: { effort: 'low' },
      // On a policy decline the API retries on a suitable fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system:
        `Draft a short, professional school ${targetLabel} in plain language, in English or Urdu ` +
        'matching the input language, based only on the provided context. Do not invent student ' +
        'names or personal details not present in the context. Placeholders such as [PHONE] or ' +
        '[CNIC] stand for removed details; keep them as they are.',
      messages: [{ role: 'user', content: input.context }],
    });
    const usage = {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    if (response.stop_reason === 'refusal') return { text: '', ...usage };
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    return { text, ...usage };
  }
}
