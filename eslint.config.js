import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'supabase/functions', 'stats']),

  // Regras base para todo o projeto
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-debugger': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Regras estritas para código novo (lib, tipos, testes, componentes novos)
  {
    files: [
      'src/lib/**/*.{ts,tsx}',
      'src/types/**/*.{ts,tsx}',
      'src/__tests__/**/*.{ts,tsx}',
      'src/hooks/useOnlineStatus.ts',
      'src/components/ErrorBoundary.tsx',
      'src/components/OfflineBanner.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
])
