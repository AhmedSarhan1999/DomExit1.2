import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// Native Node.js Gzip & Brotli Compression Plugin (Criterion 9)
function nativeCompressionPlugin(): Plugin {
  return {
    name: 'native-brotli-gzip-compression',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist')
      if (!fs.existsSync(distDir)) return

      function compressDirectory(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            compressDirectory(fullPath)
          } else if (entry.isFile() && /\.(js|css|html|svg|json)$/i.test(entry.name)) {
            try {
              const content = fs.readFileSync(fullPath)
              if (content.length > 512) {
                // Generate .gz
                const gz = zlib.gzipSync(content, { level: 9 })
                fs.writeFileSync(`${fullPath}.gz`, gz)

                // Generate .br
                const br = zlib.brotliCompressSync(content, {
                  params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                  },
                })
                fs.writeFileSync(`${fullPath}.br`, br)
              }
            } catch (err) {
              console.warn(`[compression] Failed to compress ${entry.name}:`, err)
            }
          }
        }
      }

      compressDirectory(distDir)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nativeCompressionPlugin(),
  ],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('leaflet')) {
              return 'vendor-leaflet'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase'
            }
            return 'vendor-lib'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/ydb-proxy': {
        target: 'https://docapi.serverless.yandexcloud.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ydb-proxy/, ''),
      },
      '/yandex-passport-proxy': {
        target: 'https://login.yandex.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yandex-passport-proxy/, ''),
      },
    },
  },
})
