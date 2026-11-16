import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { DEFAULT_API_BASE, normalizeApiBase } from './electron/config/api'

const CSP_API_ORIGIN_PLACEHOLDER = '__PROPEL_API_ORIGIN__'

/** Writes the backend origin into the index.html CSP connect-src (build and dev). */
function cspApiOriginPlugin(apiOrigin: string): Plugin {
  return {
    name: 'propel-csp-api-origin',
    transformIndexHtml(html) {
      if (!html.includes(CSP_API_ORIGIN_PLACEHOLDER)) {
        throw new Error(`index.html is missing ${CSP_API_ORIGIN_PLACEHOLDER} in the CSP connect-src`)
      }
      return html.split(CSP_API_ORIGIN_PLACEHOLDER).join(apiOrigin)
    },
  }
}

/**
 * Source map strategy:
 *
 * We use 'hidden' source maps for all three targets in PRODUCTION builds.
 * 'hidden' = .map files ARE generated alongside the bundle, but the bundle
 * does NOT include a `//# sourceMappingURL=` comment pointing to them.
 *
 * This means:
 *  - Users cannot access source maps from within the packaged EXE
 *  - GlitchTip can resolve crashes to original TS files (via upload script)
 *  - Stack traces in GlitchTip show: src/services/license/verifyService.ts:184
 *    instead of: main.8a73f.js:1:28473
 *
 * In DEV mode, electron-vite uses eval-based source maps by default
 * (handled automatically) — no changes needed for dev.
 *
 * Source maps are uploaded by:  npm run sourcemaps:upload
 * (see scripts/upload-sourcemaps.mjs and SOURCEMAP_UPLOAD.md)
 */

export default defineConfig(({ mode }) => {
  // Backend URL is resolved once, at build time (see electron/config/api.ts).
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBase = normalizeApiBase(process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || DEFAULT_API_BASE)
  const apiOrigin = new URL(apiBase).origin
  const define = { __PROPEL_API_BASE__: JSON.stringify(apiBase) }

  return {
  main: {
    define,
    plugins: [externalizeDepsPlugin({ exclude: ['systeminformation'] })],
    build: {
      outDir: 'out/main',
      // 'hidden' = generates .map but NO sourceMappingURL comment in bundle
      sourcemap: 'hidden',
      lib: {
        entry: path.resolve(__dirname, 'electron/main/index.ts'),
      },
    },
    resolve: {
      alias: {
        '@main':   path.resolve(__dirname, 'electron/main'),
        '@ipc':    path.resolve(__dirname, 'electron/ipc'),
        '@native': path.resolve(__dirname, 'electron/native'),
      },
    },
  },

  preload: {
    define,
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      sourcemap: 'hidden',
      lib: {
        entry: path.resolve(__dirname, 'electron/preload/index.ts'),
      },
    },
  },

  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      sourcemap: 'hidden',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@':          path.resolve(__dirname, 'src'),
        '@renderer':  path.resolve(__dirname, 'src'),
      },
    },
    plugins: [react(), cspApiOriginPlugin(apiOrigin)],
  },
  }
})
