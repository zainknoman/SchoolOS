import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiDraftingProvider } from './ai-drafting-provider';
import type { AnthropicConfig } from './anthropic-config';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 512;

@Injectable()
export class AnthropicDraftingProvider implements AiDraftingProvider {
  private readonly client: Anthropic;

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async suggestDraft(input: { context: string; targetType: 'circular' | 'diary' }): Promise<string> {
    const targetLabel = input.targetType === 'circular' ? 'school circular' : 'diary entry';
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system:
        `Draft a short, professional school ${targetLabel} in plain language, in English or Urdu ` +
        'matching the input language, based only on the provided context. Do not invent student ' +
        'names or personal details not present in the context.',
      messages: [{ role: 'user', content: input.context }],
    });
    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }
}
