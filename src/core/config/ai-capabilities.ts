import { z } from 'zod';
export const AiCapability = z.enum(['tasks.breakdown', 'notes.refine', 'notes.suggest_tags']);
// `canConfigure` is whether this reader can turn the missing capability on, so the interface can
// offer the way to do it to the person who can and stay quiet for everyone else. It belongs here
// rather than on the account: ACCT-I02 keeps role out of every schema Account owns, and this is
// AI answering a question about AI.
export const AiAvailability = z.object({
  capabilities: z.array(AiCapability),
  // Whether this workspace means to use AI at all. It separates a fault, which is temporary and
  // worth telling everyone about, from a feature the office does not use, which is not.
  configured: z.boolean(),
  canConfigure: z.boolean(),
});
