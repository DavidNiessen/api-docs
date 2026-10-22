import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/client',
    manifest: true,
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: 'src/client.tsx',
      output: {
        entryFileNames: 'assets/reader.js',
        assetFileNames: 'assets/reader.[ext]',
      },
    },
  },
});
