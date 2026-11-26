import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base = název repozitáře na GitHub Pages
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/testikyFree/',
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
