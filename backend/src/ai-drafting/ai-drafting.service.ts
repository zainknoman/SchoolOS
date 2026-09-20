import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_DRAFTING_PROVIDER } from './ai-drafting-provider';
import type { AiDraftingProvider } from './ai-drafting-provider';

@Injectable()
export class AiDraftingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_DRAFTING_PROVIDER) private readonly provider: AiDraftingProvider,
  ) {}

  async suggestDraft(
    userId: string,
    targetType: 'circular' | 'diary',
    context: string,
  ): Promise<{ suggestion: string }> {
    const suggestion = await this.provider.suggestDraft({
      context,
      targetType,
    });
    await this.prisma.draftSuggestion.create({
      data: { userId, targetType, prompt: context, suggestion },
    });
    return { suggestion };
  }
}
