import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_DRAFTING_PROVIDER } from './ai-drafting-provider';
import type { AiDraftingProvider } from './ai-drafting-provider';
import { AI_DRAFTING_SETTINGS } from './ai-drafting-config';
import type { AiDraftingSettings } from './ai-drafting-config';
import { redactPersonalData } from './redact';

@Injectable()
export class AiDraftingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_DRAFTING_PROVIDER) private readonly provider: AiDraftingProvider,
    @Inject(AI_DRAFTING_SETTINGS) private readonly settings: AiDraftingSettings,
  ) {}

  /**
   * BL-49 (Q39): off unless enabled; bounded per user per day and by context length; personal
   * identifiers are redacted before the provider sees the text and before anything is stored;
   * every suggestion records its model and token usage for cost tracking.
   */
  async suggestDraft(
    userId: string,
    targetType: 'circular' | 'diary',
    context: string,
  ): Promise<{ suggestion: string }> {
    if (!this.settings.enabled) {
      throw new ForbiddenException(
        'AI drafting is turned off for this school.',
      );
    }
    if (context.length > this.settings.maxContextChars) {
      throw new BadRequestException(
        `Keep the notes under ${this.settings.maxContextChars} characters.`,
      );
    }
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const usedToday = await this.prisma.draftSuggestion.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (usedToday >= this.settings.dailyLimit) {
      throw new HttpException(
        `Daily limit of ${this.settings.dailyLimit} AI drafts reached — try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { text: prompt } = redactPersonalData(context);
    const result = await this.provider.suggestDraft({
      context: prompt,
      targetType,
    });
    await this.prisma.draftSuggestion.create({
      data: {
        userId,
        targetType,
        prompt,
        suggestion: result.text,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });
    return { suggestion: result.text };
  }
}
