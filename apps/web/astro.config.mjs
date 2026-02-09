import { defineConfig } from 'astro/config';
import { resolve } from 'path';

const coreRoot = resolve(import.meta.dirname, '../../packages/bashtorio-core');

export default defineConfig({
  site: 'https://bashtorio.xyz',
  vite: {
    resolve: {
      alias: {
        'bashtorio-core/style.css': resolve(coreRoot, 'src/styles.css'),
        'bashtorio-core': resolve(coreRoot, 'src/index.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['bashtorio-core'],
    },
  },
});
