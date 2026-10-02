export interface DraftResult {
  /** The suggested text ('' when the model declined). */
  text: string;
  /** Model that produced it, and token usage for cost accounting (BL-49); null for the stub. */
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiDraftingProvider {
  suggestDraft(input: {
    context: string;
    targetType: 'circular' | 'diary';
  }): Promise<DraftResult>;
}

export const AI_DRAFTING_PROVIDER = 'AI_DRAFTING_PROVIDER';
