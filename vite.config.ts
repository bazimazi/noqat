import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/ws/],
      },
      manifest: {
        id: '/',
        name: 'Noqat — Dots & Boxes',
        short_name: 'Noqat',
        description:
          'A world-class, culturally themed Dots & Boxes game. Play offline, against AI, or online.',
        lang: 'en',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['games', 'entertainment', 'puzzle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Quick match vs AI', short_name: 'vs AI', url: '/?shortcut=ai' },
          { name: 'Pass & Play', short_name: 'Local', url: '/?shortcut=local' },
          { name: 'Daily Challenge', short_name: 'Daily', url: '/?shortcut=daily' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion')) return 'motion'
            if (id.includes('react')) return 'react'
            return 'vendor'
          }
          // Theme packs are eagerly registered, so grouping them is a win.
          // Locale catalogues are NOT grouped: each is a separate dynamic
          // import, and bundling them together would make picking any one
          // language download all ten.
          if (id.includes('/src/themes/packs/')) return 'themes'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
