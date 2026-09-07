import { noColorLiterals, logicalProps, styling, noLiteralStrings } from './style-rules.mjs';
import {
  castComments,
  environment,
  sqlBoundary,
  servicesThrow,
  serverMarker,
} from './boundary-rules.mjs';
import { effects, componentSafety, componentLimits } from './react-rules.mjs';
import unknownBoundary from './unknown-boundary.mjs';

const plugin = {
  rules: {
    'no-color-literals': noColorLiterals,
    'logical-props': logicalProps,
    styling: styling,
    'no-literal-strings': noLiteralStrings,
    'cast-comments': castComments,
    environment: environment,
    'sql-boundary': sqlBoundary,
    'services-throw': servicesThrow,
    'server-marker': serverMarker,
    'effect-sync': effects,
    'component-safety': componentSafety,
    'component-limits': componentLimits,
    'unknown-boundary': unknownBoundary,
  },
};
export default plugin;
