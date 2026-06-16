import { defineConfig } from 'vite'
import { resolve } from 'path'

const isBundle = process.env.BUNDLE_SINGLE === '1'

export default defineConfig({
  root: '.',
  build: {
    outDir: isBundle ? 'dist-bundle' : 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
      ...(isBundle && {
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'pkgui.js',
          assetFileNames: 'pkgui.[ext]',
        },
      }),
    },
  },
  define: {
    __VERSION__: JSON.stringify(process.env.VITE_VERSION || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
