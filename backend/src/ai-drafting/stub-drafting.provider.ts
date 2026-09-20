import { Injectable } from '@nestjs/common';
import { AiDraftingProvider } from './ai-drafting-provider';

export const STUB_SUGGESTION_MESSAGE =
  '[AI drafting is not configured in this environment. Set ANTHROPIC_API_KEY to enable real suggestions.]';

/**
 * Default provider — no real Anthropic API key exists in this environment. Makes no network
 * call, exercising the full endpoint code path (validation, audit row, response shape) with a
 * clearly-labeled placeholder instead of a fabricated "AI" suggestion.
 */
@Injectable()
export class StubAiDraftingProvider implements AiDraftingProvider {
  // eslint-disable-next-line @typescript-eslint/require-await -- the adapter interface is Promise-based
  async suggestDraft(): Promise<string> {
    return STUB_SUGGESTION_MESSAGE;
  }
}
