import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bashtorio.xyz',
  vite: {
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: () => 'app',
        },
      },
    },
  },
});
