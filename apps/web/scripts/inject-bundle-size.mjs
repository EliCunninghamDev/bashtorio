import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(import.meta.dirname, '../dist');
const astroDir = join(distDir, '_astro');

// Collect JS/CSS bundle sizes to add to the manifest
const bundles = [];
for (const f of readdirSync(astroDir)) {
  if (f.endsWith('.js') || f.endsWith('.css')) {
    bundles.push({ url: `/_astro/${f}`, size: statSync(join(astroDir, f)).size });
  }
}

// Astro frontmatter already embedded v86 assets — merge in JS/CSS bundles
const htmlPath = join(distDir, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
html = html.replace(/data-manifest="([^"]*)"/, (_match, existing) => {
  const prev = JSON.parse(existing.replace(/&quot;/g, '"'));
  const merged = [...prev, ...bundles];
  return `data-manifest="${JSON.stringify(merged).replace(/"/g, '&quot;')}"`;
});
writeFileSync(htmlPath, html);

const total = bundles.reduce((s, f) => s + f.size, 0);
console.log(`Injected ${bundles.length} bundles (${(total / 1024).toFixed(1)} KB) into manifest`);
