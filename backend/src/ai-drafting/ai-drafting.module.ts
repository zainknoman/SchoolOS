import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiDraftingService } from './ai-drafting.service';
import { AI_DRAFTING_PROVIDER } from './ai-drafting-provider';
import { StubAiDraftingProvider } from './stub-drafting.provider';
import { AnthropicDraftingProvider } from './anthropic-drafting.provider';
import { resolveAnthropicConfig } from './anthropic-config';

@Module({
  providers: [
    AiDraftingService,
    {
      provide: AI_DRAFTING_PROVIDER,
      useFactory: (config: ConfigService) => {
        const anthropicConfig = resolveAnthropicConfig(config);
        if (!anthropicConfig) return new StubAiDraftingProvider();
        return new AnthropicDraftingProvider(anthropicConfig);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AiDraftingService],
})
export class AiDraftingModule {}
