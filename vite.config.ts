import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/ydb-proxy': {
        target: 'https://docapi.serverless.yandexcloud.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ydb-proxy/, ''),
      },
    },
  },
})
