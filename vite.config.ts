import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    // Gera stats/bundle.html após `npm run build` — abre no browser para inspecionar tamanho de deps
    visualizer({
      filename: 'stats/bundle.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          sentry:   ['@sentry/react'],
        },
      },
    },
  },
})
