// prettier.config.ts

import type { Config } from 'prettier';

const config: Config = {
  printWidth: 150,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  arrowParens: 'always',
  jsxSingleQuote: false,
  quoteProps: 'as-needed',
  htmlWhitespaceSensitivity: 'css',
  proseWrap: 'preserve',
  endOfLine: 'lf',
};

export default config;
