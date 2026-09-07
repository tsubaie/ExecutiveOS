import 'server-only';
import type { z } from 'zod';
export interface AiProvider {
  complete<T extends z.ZodType>(
    request: { schema: T; model: string; system: string; content: string },
    signal: AbortSignal,
  ): Promise<z.output<T>>;
}
export const capabilities = [];
