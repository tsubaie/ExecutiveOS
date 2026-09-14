import { z } from 'zod';
import { jobs } from '@/core/db/system-schema';
import { type Database } from '@/core/db/client';
import { id } from '@/core/db/ids';
import { AiPayload } from '@/core/ai/job-schema';
export const fixtureModel = {
  id: 'vendor/fixture',
  name: 'Fixture',
  contextLength: 200000,
  maxOutputTokens: 16000,
  inputPrice: 0.000001,
  outputPrice: 0.000002,
};
export async function finishedJob(
  database: Database,
  actor: string,
  capability: AiPayload['capability'],
  entityId: string,
  revision: number,
  output: z.infer<ReturnType<typeof z.json>>,
  input: z.infer<ReturnType<typeof z.json>> = {},
) {
  const payload = AiPayload.parse({
    capability,
    entityId,
    revision,
    input,
    model: fixtureModel,
    locale: 'en',
    capabilityVersion: 1,
    promptVersion: 1,
    contentHash: 'fixture',
    maxOutputTokens: 4096,
    reservedTokens: 10000,
  });
  const [row] = await database
    .insert(jobs)
    .values({
      id: id(),
      kind: `ai.${capability}`,
      payload,
      entityId,
      createdBy: actor,
      status: 'succeeded',
      result: { output, warnings: [] },
    })
    .returning();
  if (!row) throw new Error('fixture insert failed');
  return row;
}
