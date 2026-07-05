// Lints the TypeScript that exists today (tests, vite config) and any future
// src/ modules from the Phase-2 extraction. The legacy inline script in
// index.html is intentionally out of scope until it is modularized.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // service-worker.js is the legacy hand-written worker (replaced by the generated
  // one in dist builds); the root .mjs files are one-off migration tooling.
  { ignores: ['node_modules/**', 'dist/**', 'test-results/**', '*.mjs', 'service-worker.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts', 'vite.config.ts', 'src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
