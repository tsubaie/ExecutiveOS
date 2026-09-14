import 'server-only';
import { z } from 'zod';
// Delimiter characters are escaped inside the JSON data so supplied content cannot close its frame.
export function framedInput(input: z.infer<ReturnType<typeof z.json>>) {
  const data = JSON.stringify(input).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
  return `<data>${data}</data>`;
}
