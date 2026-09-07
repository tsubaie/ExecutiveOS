import { meta, precedingComment, report } from './helpers.mjs';

export const effects = {
  meta: meta('Effects need a // sync: external system comment and must not fetch data.'),
  create(context) {
    const names = new Set(['useEffect']);
    return {
      ImportSpecifier(node) {
        if (node.imported?.name === 'useEffect') names.add(node.local.name);
      },
      CallExpression(node) {
        const name = node.callee.name ?? node.callee.property?.name;
        if (!names.has(name)) return;
        if (!precedingComment(context, node, 'sync:')) report(context, node);
        const source = context.sourceCode.getText(node.arguments[0] ?? node);
        if (/\b(?:fetch|axios)\s*(?:\(|\.)/u.test(source)) report(context, node);
      },
    };
  },
};

export const componentSafety = {
  meta: meta('Components must use query hooks and accessible, stable-key controls.'),
  create(context) {
    const isTsx = /\.tsx$/u.test(context.filename);
    return {
      CallExpression(node) {
        if (
          isTsx &&
          (['fetch', 'axios'].includes(node.callee.name) || node.callee.object?.name === 'axios')
        )
          report(context, node);
      },
      JSXAttribute(node) {
        if (node.name.name === 'dangerouslySetInnerHTML') report(context, node);
        if (node.name.name === 'key' && node.value?.expression?.type === 'Identifier') {
          const map = context.sourceCode
            .getAncestors(node)
            .findLast(
              (a) => a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression',
            );
          if (map?.params[1]?.name === node.value.expression.name) report(context, node);
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !/^[a-z]/u.test(node.name.name)) return;
        const interactive = node.attributes.some((a) =>
          ['onClick', 'onKeyDown', 'onPointerDown'].includes(a.name?.name),
        );
        if (
          interactive &&
          !['button', 'a', 'input', 'select', 'textarea', 'summary', 'form'].includes(
            node.name.name,
          )
        )
          report(context, node);
      },
    };
  },
};

export const componentLimits = {
  meta: meta('Components allow at most 12 props and 6 useState calls.'),
  create(context) {
    if (!/\.tsx$/u.test(context.filename)) return {};
    const stack = [];
    function enter(node) {
      stack.push({ states: 0, node });
      const param = node.params[0];
      const shape = param?.typeAnnotation?.typeAnnotation;
      if (param?.type === 'ObjectPattern' && param.properties.length > 12) report(context, param);
      if (shape?.type === 'TSTypeLiteral' && shape.members.length > 12) report(context, param);
    }
    function leave() {
      const current = stack.pop();
      if (current?.states > 6) report(context, current.node);
    }
    return {
      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': leave,
      FunctionExpression: enter,
      'FunctionExpression:exit': leave,
      ArrowFunctionExpression: enter,
      'ArrowFunctionExpression:exit': leave,
      CallExpression(node) {
        if ((node.callee.name ?? node.callee.property?.name) === 'useState' && stack.length)
          stack[stack.length - 1].states += 1;
      },
      TSInterfaceDeclaration(node) {
        if (/Props$/u.test(node.id.name) && node.body.body.length > 12) report(context, node);
      },
    };
  },
};
