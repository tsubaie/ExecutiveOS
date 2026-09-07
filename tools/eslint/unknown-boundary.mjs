import { meta, report } from './helpers.mjs';

function someNode(node, predicate) {
  if (!node || typeof node !== 'object') return false;
  if (predicate(node)) return true;
  for (const [key, value] of Object.entries(node)) {
    if (['parent', 'loc', 'range', 'tokens', 'comments'].includes(key)) continue;
    if (Array.isArray(value) && value.some((item) => someNode(item, predicate))) return true;
    if (!Array.isArray(value) && someNode(value, predicate)) return true;
  }
  return false;
}

const unknownBoundary = {
  meta: meta(
    'An explicit unknown must be a local parse-boundary value narrowed by Zod or instanceof in the same function.',
  ),
  create(context) {
    return {
      TSUnknownKeyword(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const id = ancestors.findLast((a) => a.type === 'Identifier');
        const fn = ancestors.findLast((a) =>
          ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(a.type),
        );
        if (!id || !fn) {
          report(context, node);
          return;
        }
        const narrowed = someNode(
          fn.body,
          (part) =>
            (part.type === 'BinaryExpression' &&
              part.operator === 'instanceof' &&
              part.left.name === id.name) ||
            (part.type === 'CallExpression' &&
              ['parse', 'safeParse', 'parseAsync', 'safeParseAsync'].includes(
                part.callee.property?.name,
              ) &&
              part.arguments.some((arg) => arg.name === id.name)),
        );
        if (!narrowed) report(context, node);
      },
    };
  },
};
export default unknownBoundary;
