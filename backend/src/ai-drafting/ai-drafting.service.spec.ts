import { Test } from '@nestjs/testing';
import { AiDraftingService } from './ai-drafting.service';
import { PrismaService } from '../prisma/prisma.service';
import { AI_DRAFTING_PROVIDER } from './ai-drafting-provider';

describe('AiDraftingService', () => {
  let service: AiDraftingService;
  let prisma: { draftSuggestion: { create: jest.Mock } };
  let provider: { suggestDraft: jest.Mock };

  beforeEach(async () => {
    prisma = { draftSuggestion: { create: jest.fn() } };
    provider = { suggestDraft: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiDraftingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AI_DRAFTING_PROVIDER, useValue: provider },
      ],
    }).compile();
    service = moduleRef.get(AiDraftingService);
  });

  it('asks the injected provider for a suggestion, persists it, and returns it', async () => {
    provider.suggestDraft.mockResolvedValue(
      'Dear parents, the PTM is on Sept 20th.',
    );
    prisma.draftSuggestion.create.mockResolvedValue({});

    const result = await service.suggestDraft(
      'user-1',
      'circular',
      'PTM on Sept 20th',
    );

    expect(provider.suggestDraft).toHaveBeenCalledWith({
      context: 'PTM on Sept 20th',
      targetType: 'circular',
    });
    expect(prisma.draftSuggestion.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        targetType: 'circular',
        prompt: 'PTM on Sept 20th',
        suggestion: 'Dear parents, the PTM is on Sept 20th.',
      },
    });
    expect(result).toEqual({
      suggestion: 'Dear parents, the PTM is on Sept 20th.',
    });
  });

  it('works for the "diary" targetType the same way', async () => {
    provider.suggestDraft.mockResolvedValue('Homework: read chapter 3.');
    prisma.draftSuggestion.create.mockResolvedValue({});

    const result = await service.suggestDraft(
      'user-2',
      'diary',
      'chapter 3 reading',
    );

    expect(provider.suggestDraft).toHaveBeenCalledWith({
      context: 'chapter 3 reading',
      targetType: 'diary',
    });
    expect(result.suggestion).toBe('Homework: read chapter 3.');
  });
});
