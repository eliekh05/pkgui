import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: process.env.BUNDLE_SINGLE === '1' ? 'dist-bundle' : 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
      ...(process.env.BUNDLE_SINGLE === '1' && {
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'pkgui.js',
          assetFileNames: 'pkgui.[ext]',
        },
      }),
    },
  },
  define: {
    __VERSION__:    JSON.stringify(process.env.VITE_VERSION || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
}))
