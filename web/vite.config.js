import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const removeCrossOrigin = () => ({
  name: 'remove-crossorigin',
  transformIndexHtml(html) {
    return html.replace(/\s*crossorigin(=["']?[^"']*["']?)?/g, '')
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), removeCrossOrigin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

