import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [
    {
      name: 'patched-monaco-sanitizer',
      enforce: 'pre',
      resolveId(source, importer) {
        if (
          source === './dompurify/dompurify.js' &&
          importer
            ?.replaceAll('\\', '/')
            .endsWith('/monaco-editor/esm/vs/base/browser/domSanitize.js')
        ) {
          return fileURLToPath(import.meta.resolve('dompurify'));
        }
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      'monaco-editor/codicon.css': fileURLToPath(
        new URL(
          './base/browser/ui/codicons/codicon/codicon.css',
          import.meta.resolve('monaco-editor'),
        ),
      ),
    },
  },
  base: './',
  worker: { format: 'es' },
  build: {
    outDir: 'dist/client',
    manifest: true,
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        reader: 'src/client.tsx',
        'oauth-callback': 'src/oauth-callback.ts',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
