import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiDraftingService } from './ai-drafting.service';
import { PrismaService } from '../prisma/prisma.service';
import { AI_DRAFTING_PROVIDER } from './ai-drafting-provider';
import { AI_DRAFTING_SETTINGS } from './ai-drafting-config';

describe('AiDraftingService (BL-49)', () => {
  let prisma: { draftSuggestion: { create: jest.Mock; count: jest.Mock } };
  let provider: { suggestDraft: jest.Mock };

  async function make(
    settings = { enabled: true, dailyLimit: 2, maxContextChars: 200 },
  ) {
    prisma = {
      draftSuggestion: {
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    provider = {
      suggestDraft: jest.fn().mockResolvedValue({
        text: 'Dear parents, the PTM is on Sept 20th.',
        model: 'claude-opus-5-5',
        inputTokens: 120,
        outputTokens: 80,
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiDraftingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AI_DRAFTING_PROVIDER, useValue: provider },
        { provide: AI_DRAFTING_SETTINGS, useValue: settings },
      ],
    }).compile();
    return moduleRef.get(AiDraftingService);
  }

  it('is refused while the feature is off (the default)', async () => {
    const service = await make({
      enabled: false,
      dailyLimit: 2,
      maxContextChars: 200,
    });
    await expect(service.suggestDraft('u1', 'circular', 'PTM')).rejects.toThrow(
      'turned off',
    );
    expect(provider.suggestDraft).not.toHaveBeenCalled();
  });

  it('redacts personal identifiers before the provider sees them, and stores usage', async () => {
    const service = await make();
    const result = await service.suggestDraft(
      'u1',
      'circular',
      'PTM Sept 20; call Mr Ali 0300-1234567, CNIC 35202-1234567-1',
    );
    const sent = provider.suggestDraft.mock.calls[0][0].context as string;
    expect(sent).toBe('PTM Sept 20; call Mr Ali [PHONE], CNIC [CNIC]');
    expect(prisma.draftSuggestion.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        targetType: 'circular',
        prompt: sent,
        suggestion: 'Dear parents, the PTM is on Sept 20th.',
        model: 'claude-opus-5-5',
        inputTokens: 120,
        outputTokens: 80,
      },
    });
    expect(result).toEqual({
      suggestion: 'Dear parents, the PTM is on Sept 20th.',
    });
  });

  it('enforces the per-user daily limit with 429', async () => {
    const service = await make();
    prisma.draftSuggestion.count.mockResolvedValue(2);
    const err = await service
      .suggestDraft('u1', 'diary', 'homework')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(provider.suggestDraft).not.toHaveBeenCalled();
  });

  it('refuses an over-long context', async () => {
    const service = await make();
    await expect(
      service.suggestDraft('u1', 'diary', 'x'.repeat(201)),
    ).rejects.toThrow('200 characters');
  });
});
