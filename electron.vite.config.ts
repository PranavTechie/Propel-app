import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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

export default defineConfig({
  main: {
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
    plugins: [react()],
  },
})
