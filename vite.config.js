import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // This forces Vite to expose itself to the Docker network
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true, // Fixes hot-reloading issues in Docker
    }
  }
})