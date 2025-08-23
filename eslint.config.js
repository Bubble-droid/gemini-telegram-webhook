// eslint.config.js

import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(pluginJs.configs.recommended, ...tseslint.configs.recommended, {
  files: ['src/**/*.ts', 'src/**/*.d.ts'],
  ignores: ['dist/**/*.js', 'node_modules/*'],
  languageOptions: {
    globals: {
      ...globals.node,
    },
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      project: './tsconfig.json',
    },
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    prettier: prettierPlugin,
  },

  rules: {
    '@typescript-eslint/require-await': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    ...prettierConfig.rules,
    'prettier/prettier': 'error',
  },
});
