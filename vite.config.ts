import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Para integrar con el backend local: VITE_PROXY_TARGET=http://localhost:5080 (mismo origen, sin CORS).
  const target = env.VITE_PROXY_TARGET

  return {
    plugins: [vue()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: target
        ? {
          '/api': { target, changeOrigin: true },
          '/hubs': { target, changeOrigin: true, ws: true }
        }
        : undefined
    },
    build: {
      target: 'es2022',
      // Mapas para el servicio de errores; no se referencian desde los archivos publicados.
      sourcemap: 'hidden'
    },
    test: {
      environment: 'happy-dom',
      environmentOptions: { happyDOM: { url: 'http://localhost:5173/' } },
      include: ['src/**/*.test.ts'],
      restoreMocks: true
    }
  }
})
