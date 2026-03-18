//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/routeTree.gen.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message:
                'Relative imports are not allowed. Please use @/ path alias instead.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
]
