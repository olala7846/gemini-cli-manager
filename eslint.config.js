import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn'
    }
  },
  {
    files: ['src/protocol/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['../*'], message: 'Protocol layer is the absolute base. It MUST NOT import from any other project layers.' }]
      }]
    }
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['*gateway*', '*channels*', '*automation*'], message: 'Core layer MUST NOT import from gateway, automation, or channels.' }]
      }]
    }
  },
  {
    files: ['src/gateway/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['*core*', '*automation*', '*channels*'], message: 'Gateway layer MUST NOT import from core, automation, or channels.' }]
      }]
    }
  },
  {
    files: ['src/channels/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['*core*', '*automation*'], message: 'Channels layer MUST NOT bypass Gateway/Protocol to import from core or automation.' }]
      }]
    }
  },
  {
    files: ['src/automation/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['*channels*', '*core*'], message: 'Automation layer MUST NOT import from UI channels or Core. Use Gateway/Protocol instead.' }]
      }]
    }
  }
);
