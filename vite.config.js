import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        prototype: fileURLToPath(new URL('./prototype.html', import.meta.url)),
        market: fileURLToPath(new URL('./market.html', import.meta.url)),
      },
    },
  },
})
