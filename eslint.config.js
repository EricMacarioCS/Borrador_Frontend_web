import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommendedTypeChecked,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      // El formato lo define el equipo (por ejemplo con Prettier); aquí solo se revisa calidad.
      'vue/html-indent': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/no-v-html': 'error',
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/mocks/*', '**/mocks/*'],
          message: 'Solo src/app/services.ts puede importar el backend simulado.'
        }]
      }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  },
  {
    files: ['src/app/services.ts', 'src/mocks/**', 'src/**/*.test.ts'],
    rules: { 'no-restricted-imports': 'off' }
  },
  {
    files: ['eslint.config.js', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } }
  }
)
