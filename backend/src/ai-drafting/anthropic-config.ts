import { ConfigService } from '@nestjs/config';

export interface AnthropicConfig {
  apiKey: string;
}

/**
 * A single API key has no "partial config" state the way Firebase/SMTP's multi-field configs do
 * — unset entirely means "use the stub provider", set means "use the real one". No dev/test
 * carve-out branch applies here, unlike resolveFirebaseConfig/resolveSmtpConfig.
 */
export function resolveAnthropicConfig(config: ConfigService): AnthropicConfig | undefined {
  const apiKey = config.get<string>('ANTHROPIC_API_KEY');
  if (!apiKey) return undefined;
  return { apiKey };
}
