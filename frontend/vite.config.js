  import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/-decision-intelligence-dashboard-/',  // ⚠️ EXACT repo name with hyphens
  build: {
    outDir: '../docs',                           // already fine
  },
})
