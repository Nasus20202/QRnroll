//  @ts-check

import tseslint from '@typescript-eslint/eslint-plugin'
import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
]
