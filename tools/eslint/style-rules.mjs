import { literalVisitors, meta, report, sameLineComment } from './helpers.mjs';

const palette =
  /(?:^|[\s:'"`])(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:\d{2,3})(?:\b)/u;
const colors = /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\s*\(/iu;
const physical = /(?:^|[\s:'"`])(?:-?(?:ml|mr|pl|pr|left|right)-|text-(?:left|right)\b)/u;

export const noColorLiterals = {
  meta: meta('Use semantic theme tokens, not color literals or palette classes.'),
  create(context) {
    return literalVisitors((node, text) => {
      if (colors.test(text) || palette.test(text)) report(context, node);
    });
  },
};

export const logicalProps = {
  meta: meta('Use logical direction utilities (start/end, ms/me, ps/pe, text-start/end).'),
  create(context) {
    return literalVisitors((node, text) => {
      if (physical.test(text)) report(context, node);
    });
  },
};

export const styling = {
  meta: meta(
    'Forbidden styling: annotate runtime styles; no transition-all, !important, CSS modules, or CSS-in-JS.',
  ),
  create(context) {
    return {
      ...literalVisitors((node, text) => {
        if (/\btransition-all\b|!important/u.test(text)) report(context, node);
      }),
      JSXAttribute(node) {
        if (node.name.name === 'style' && !sameLineComment(context, node, 'runtime-style:'))
          report(context, node);
      },
      ImportDeclaration(node) {
        if (/\.module\.(?:css|scss)$|^(?:styled-components|@emotion\/)/u.test(node.source.value))
          report(context, node);
      },
    };
  },
};

export const noLiteralStrings = {
  meta: meta('Translate user-visible text through the message catalog.'),
  create(context) {
    const readable = (text) => /\p{L}/u.test(text);
    return {
      JSXText(node) {
        if (readable(node.value)) report(context, node);
      },
      JSXAttribute(node) {
        const name = node.name.name;
        if (typeof name !== 'string' || !/^(?:aria-|title$|placeholder$|alt$)/u.test(name)) return;
        if (
          node.value?.type === 'Literal' &&
          typeof node.value.value === 'string' &&
          readable(node.value.value)
        )
          report(context, node);
        if (
          node.value?.type === 'JSXExpressionContainer' &&
          node.value.expression.type === 'Literal' &&
          typeof node.value.expression.value === 'string' &&
          readable(node.value.expression.value)
        )
          report(context, node);
      },
      JSXExpressionContainer(node) {
        if (node.parent.type !== 'JSXElement') return;
        if (
          node.expression.type === 'Literal' &&
          typeof node.expression.value === 'string' &&
          readable(node.expression.value)
        )
          report(context, node);
      },
    };
  },
};
