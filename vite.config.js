import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/bob-todo/',
  plugins: [
    react(),
    VitePWA({
      // Our own service worker (src/sw.js) so we can add push notifications in step 6
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Everything Bob needs to open without a connection, fonts included (Vietnamese letters left out)
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        globIgnores: ['**/*vietnamese*'],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bob',
        short_name: 'Bob',
        description: 'Your day, one small win at a time.',
        lang: 'en',
        start_url: '/bob-todo/',
        scope: '/bob-todo/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#2B2D31',
        theme_color: '#2B2D31',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
})
