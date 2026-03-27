import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Vercel Preview mit Deployment Protection: manifest.json liefert 401 → Link weglassen. */
const isVercelPreview = process.env.VERCEL_ENV === 'preview'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'habeat-conditional-pwa-tags',
      transformIndexHtml(html) {
        if (!isVercelPreview) return html
        return html
          .replace(/\s*<link rel="manifest"[^>]*>\s*/i, '\n')
          .replace(/\s*<link rel="apple-touch-icon"[^>]*>\s*/i, '\n')
          .replace(/<script>[\s\S]*?sw\.js[\s\S]*?<\/script>\s*/i, '')
      },
    },
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
