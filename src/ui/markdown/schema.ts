import { defaultSchema, type Options } from 'rehype-sanitize';
// ADR 0015: the library default minus images, with links limited to http(s) and mailto and no
// author-controlled ids, classes or styles. Code blocks keep their language class for styling.
const stripped = new Set(['id', 'className', 'style']);
const global = (defaultSchema.attributes?.['*'] ?? []).filter(
  (attribute) => !stripped.has(typeof attribute === 'string' ? attribute : attribute[0]),
);
export const schema: Options = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== 'img'),
  attributes: { ...defaultSchema.attributes, '*': global, a: ['href'] },
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto'] },
};
