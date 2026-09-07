export const meta = (message) => ({
  type: 'problem',
  schema: [],
  messages: { violation: message },
});

export function report(context, node) {
  context.report({ node, messageId: 'violation' });
}

export function testFile(filename) {
  return /(?:\.test\.[cm]?[jt]sx?$|\.spec\.[jt]sx?$|\/tests\/|\/e2e\/)/u.test(filename);
}

export function sameLineComment(context, node, marker) {
  return context.sourceCode
    .getAllComments()
    .some(
      (comment) =>
        comment.loc.start.line === node.loc.end.line && comment.value.trim().startsWith(marker),
    );
}

export function precedingComment(context, node, marker) {
  const line = node.loc.start.line;
  return context.sourceCode
    .getAllComments()
    .some(
      (comment) =>
        comment.loc.end.line >= line - 1 &&
        comment.loc.end.line <= line &&
        comment.value.trim().startsWith(marker),
    );
}

export function literalVisitors(check) {
  return {
    Literal(node) {
      if (typeof node.value === 'string') check(node, node.value);
    },
    TemplateElement(node) {
      check(node, node.value.raw);
    },
  };
}
