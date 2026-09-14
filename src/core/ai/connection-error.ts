import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
export function connectionError(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return 'invalid_key';
  if (error instanceof Anthropic.RateLimitError) return 'rate_limit';
  if (error instanceof Anthropic.APIConnectionError) return 'network';
  if (error instanceof Anthropic.APIError && error.status === 402) return 'billing';
  return 'provider';
}
