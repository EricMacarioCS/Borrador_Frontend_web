/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" usa el backend simulado del navegador; "http" usa la API real. */
  readonly VITE_API_MODE?: 'mock' | 'http'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_HUB_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Versión de la compilación, inyectada por Vite. */
declare const __APP_VERSION__: string
