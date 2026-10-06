// Configuration ESLint "flat" commune à tout le monorepo.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/src/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/dev-dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['packages/server/**/*.ts', 'packages/shared/**/*.ts', '*.js', '*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // La simulation doit rester du TypeScript pur, exécutable sans navigateur (Web Worker,
    // `pnpm balance`, rejeu côté serveur) : aucun accès au rendu, à React ni au DOM.
    files: ['packages/client/src/{simulation,events}/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'La simulation ne dépend pas du rendu.' },
            {
              group: ['react', 'react-dom', 'zustand'],
              message: 'La simulation ne dépend pas de l’UI.',
            },
            {
              group: ['**/render/**', '**/ui/**', '**/audio/**'],
              message: 'Sens de dépendance interdit.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage'],
      // Déterminisme : le hasard passe par le RNG seedable, le temps par l'horloge simulée.
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Utiliser le RNG seedable.' },
        { object: 'Date', property: 'now', message: 'Utiliser l’horloge de la simulation.' },
      ],
    },
  },
  prettier,
);
