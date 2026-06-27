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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('react-dom') || id.includes('react-router')) return 'react'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@sentry')) return 'sentry'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('jspdf') || id.includes('pdf-lib') || id.includes('jspdf-autotable')) return 'pdf'
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('lucide-react')) return 'icons'
        },
      },
    },
  },
})
