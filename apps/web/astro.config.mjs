import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bashtorio.xyz',
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: () => 'app',
        },
      },
    },
  },
});
