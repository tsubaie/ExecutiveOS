import { REFINE_PROMPT as V1 } from './refine.v1';
import { REFINE_PROMPT as V2 } from './refine.v2';
import { REFINE_PROMPT as V3 } from './refine.v3';
// A queued job runs with the prompt version it was admitted with, so every version stays
// executable after a newer one ships (NOTES-B18, B26).
export function refinePrompt(version: 1 | 2 | 3): string {
  if (version === 3) return V3;
  return version === 2 ? V2 : V1;
}
