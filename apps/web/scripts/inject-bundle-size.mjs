import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(import.meta.dirname, '../dist');
const astroDir = join(distDir, '_astro');

const manifest = [];
for (const f of readdirSync(astroDir)) {
  if (f.endsWith('.js') || f.endsWith('.css')) {
    manifest.push({ url: `/_astro/${f}`, size: statSync(join(astroDir, f)).size });
  }
}

// v86 assets preloaded for cache warming + progress tracking
const v86Files = ['v86/v86.wasm', 'v86/buildroot-state.bin'];
for (const f of v86Files) {
  try { manifest.push({ url: `/${f}`, size: statSync(join(distDir, f)).size }); } catch {}
}

const htmlPath = join(distDir, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
const json = JSON.stringify(manifest).replace(/"/g, '&quot;');
html = html.replace('data-manifest="[]"', `data-manifest="${json}"`);
writeFileSync(htmlPath, html);

const total = manifest.reduce((s, f) => s + f.size, 0);
console.log(`Injected ${manifest.length} files, ${(total / 1024).toFixed(1)} KB`);
