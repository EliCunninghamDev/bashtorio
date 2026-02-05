import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
    {
      name: 'copy-css',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'src/styles.css'),
          resolve(__dirname, 'dist/style.css')
        );
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Bashtorio',
      formats: ['es', 'umd'],
      fileName: 'bashtorio-core',
    },
    rollupOptions: {
      external: ['v86'],
      output: {
        globals: {
          v86: 'V86',
        },
      },
    },
  },
});
