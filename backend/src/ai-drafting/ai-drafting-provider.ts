export interface AiDraftingProvider {
  suggestDraft(input: {
    context: string;
    targetType: 'circular' | 'diary';
  }): Promise<string>;
}

export const AI_DRAFTING_PROVIDER = 'AI_DRAFTING_PROVIDER';
