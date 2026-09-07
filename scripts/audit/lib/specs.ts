import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { read } from './files';
export type Spec = {
  file: string;
  status: string;
  headers: Record<string, string>;
  sections: string[];
  ids: Set<string>;
  owners: string[];
  text: string;
};
export const idPattern = /\b[A-Z]{2,}-[ABI]\d{2}\b/gu;
export function parseSpec(file: string, text: string): Spec {
  const headers: Record<string, string> = {};
  for (const match of text.matchAll(/^\*\*([^*]+):\*\*\s*(.*)$/gmu))
    headers[match[1] ?? ''] = (match[2] ?? '').trim();
  const sections = [...text.matchAll(/^## (.+)$/gmu)].map((m) => (m[1] ?? '').trim());
  const owners = [
    ...(headers['Owner module'] ?? headers['Owner modules'] ?? '').matchAll(/`([^`]+)`/gu),
  ]
    .map((m) => m[1] ?? '')
    .filter(Boolean);
  return {
    file,
    status: (headers.Status ?? '').split(/\s/u)[0] ?? '',
    headers,
    sections,
    ids: new Set([...text.matchAll(idPattern)].map((m) => m[0])),
    owners,
    text,
  };
}
export async function loadSpecs(root: string) {
  const dir = join(root, 'docs/features');
  const specs: Spec[] = [];
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.md')).sort())
    specs.push(parseSpec(`docs/features/${name}`, await read(join(dir, name))));
  return specs;
}
export function specForModule(specs: Spec[], module: string) {
  return specs.find(
    (spec) =>
      spec.file === `docs/features/${module}.md` ||
      spec.owners.some((owner) => owner.includes(`src/modules/${module}`)),
  );
}
