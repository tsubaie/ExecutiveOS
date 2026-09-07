import { meta, report, sameLineComment, testFile } from './helpers.mjs';

export const castComments = {
  meta: meta('Casts require an allowed boundary and a same-line // cast: reason.'),
  create(context) {
    if (testFile(context.filename)) return {};
    function check(node) {
      const inCatch = context.sourceCode.getAncestors(node).some((a) => a.type === 'CatchClause');
      const allowed = /(?:\/repo\.ts$|\/src\/core\/db\/)/u.test(context.filename) || inCatch;
      if (!allowed || !sameLineComment(context, node, 'cast:')) report(context, node);
    }
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
};

export const environment = {
  meta: meta('Environment access is restricted to src/core/config/env.ts.'),
  create(context) {
    if (/\/src\/core\/config\/env\.ts$/u.test(context.filename)) return {};
    return {
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'process' &&
          (node.property.name === 'env' || node.property.value === 'env')
        )
          report(context, node);
      },
      VariableDeclarator(node) {
        if (
          node.init?.name === 'process' &&
          node.id.type === 'ObjectPattern' &&
          node.id.properties.some((p) => p.key?.name === 'env')
        )
          report(context, node);
      },
      ImportDeclaration(node) {
        if (['process', 'node:process'].includes(node.source.value)) report(context, node);
      },
    };
  },
};

export const sqlBoundary = {
  meta: meta('SQL and database builders belong to the approved data access boundary.'),
  create(context) {
    if (
      testFile(context.filename) ||
      /(?:\/repo\.ts$|\/src\/core\/(?:db|links|search|backup)\/|\/schema\/db\.ts$|\/drizzle\/)/u.test(
        context.filename,
      )
    )
      return {};
    return {
      TaggedTemplateExpression(node) {
        if (node.tag.name === 'sql') report(context, node);
      },
      ImportDeclaration(node) {
        if (/^(?:pg|postgres|drizzle-orm)(?:\/|$)/u.test(node.source.value)) report(context, node);
      },
    };
  },
};

export const servicesThrow = {
  meta: meta('Services throw AppError; they must not return error objects.'),
  create(context) {
    if (!/\/service\.ts$/u.test(context.filename)) return {};
    return {
      ReturnStatement(node) {
        if (
          node.argument?.type === 'ObjectExpression' &&
          node.argument.properties.some((p) => p.key?.name === 'error' || p.key?.value === 'error')
        )
          report(context, node);
      },
    };
  },
};

export const serverMarker = {
  meta: meta('Server-only application modules must import server-only.'),
  create(context) {
    const path = context.filename;
    if (
      testFile(path) ||
      !/(?:\/src\/modules\/[^/]+\/(?:service|repo)\.ts$|\/schema\/db\.ts$|\/src\/core\/(?:db|auth|ai|jobs|files|backup)\/|\/src\/core\/config\/env\.ts$)/u.test(
        path,
      )
    )
      return {};
    return {
      Program(node) {
        if (
          !node.body.some((s) => s.type === 'ImportDeclaration' && s.source.value === 'server-only')
        )
          report(context, node);
      },
    };
  },
};
