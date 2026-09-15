import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      // Arabic and Bengali strings live in content files and message catalogues,
      // never inline in components — enforced by review, not by a rule, for now.
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@vercel/functions',
              message:
                'Keep business logic portable: the app must also run as a container on Railway/Render.',
            },
          ],
        },
      ],
    },
  },
  { ignores: ['.next/**', 'drizzle/**', 'node_modules/**', 'public/sw.js'] },
];
