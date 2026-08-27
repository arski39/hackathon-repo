import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The base path must match the GitHub Pages repo name, or every asset 404s.
// https://vite.dev/config/
export default defineConfig({
  base: '/backpay/',
  plugins: [react(), tailwindcss()],
})
