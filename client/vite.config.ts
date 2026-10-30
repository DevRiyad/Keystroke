import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // In dev, /api goes to the local backend, so the client always uses same-origin URLs (like on Vercel).
  server: { proxy: { '/api': 'http://localhost:4000' } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
