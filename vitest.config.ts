import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * No React plugin here on purpose: vitest transforms TSX with esbuild, which
 * reads `jsx: react-jsx` from tsconfig and needs nothing else. Adding
 * @vitejs/plugin-react would only bring Fast Refresh, which tests never use,
 * and would pull in a second copy of Vite's plugin types.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/ai/**', 'src/i18n/**', 'src/themes/**'],
    },
  },
})
