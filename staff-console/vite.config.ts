import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { cspMeta } from './csp.config'

/** BL-36 follow-up: production builds carry the console's Content-Security-Policy (csp.config.ts). */
function contentSecurityPolicy(): Plugin {
  let apiBaseUrl = 'http://localhost:3000'
  return {
    name: 'schoolos-csp',
    apply: 'build',
    configResolved(config) {
      // Same default as src/lib/api.ts, so the policy allows the API the bundle will call.
      apiBaseUrl = (config.env.VITE_API_BASE_URL as string | undefined) ?? apiBaseUrl
    },
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: cspMeta(apiBaseUrl) },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), contentSecurityPolicy()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
