import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = název repozitáře na GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '/testikyFree/',
})
