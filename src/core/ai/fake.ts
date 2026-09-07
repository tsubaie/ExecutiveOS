import 'server-only';
import { z } from 'zod';
import type { AiProvider } from './provider';
export class FakeProvider implements AiProvider {
  constructor(private value: z.infer<ReturnType<typeof z.json>>) {}
  async complete<T extends z.ZodType>(
    request: { schema: T },
    signal: AbortSignal,
  ): Promise<z.output<T>> {
    signal.throwIfAborted();
    return request.schema.parse(this.value);
  }
}
