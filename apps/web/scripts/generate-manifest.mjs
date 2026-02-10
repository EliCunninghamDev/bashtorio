#!/usr/bin/env node
// Pre-build: generates the preloader manifest from public/ and writes it as importable JSON.
import { readFileSync, statSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Load .env file (Astro env vars aren't available to plain Node scripts)
const envPath = join(import.meta.dirname, '../.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq)
    const val = trimmed.slice(eq + 1)
    if (!process.env[key]) process.env[key] = val
  }
}

const publicDir = join(import.meta.dirname, '../public')
const v86Dir = join(publicDir, 'v86')

const stateFilename = process.env.PUBLIC_STATE_FILENAME || 'alpine-state.bin'
const stateBasePath = process.env.PUBLIC_STATE_BASE_PATH || ''

const manifest = []

// v86 assets: engine + BIOS + rootfs manifest (preload so they're cached for v86)
const v86Assets = [
  { file: 'v86.wasm', label: 'VM Engine' },
  { file: 'seabios.bin', label: 'BIOS' },
  { file: 'vgabios.bin', label: 'VGA BIOS' },
  { file: 'alpine-fs.json', label: 'Filesystem' },
]
for (const asset of v86Assets) {
  const path = join(v86Dir, asset.file)
  if (existsSync(path)) {
    manifest.push({ url: `/v86/${asset.file}`, size: statSync(path).size, label: asset.label })
  }
}

// VM state file (prefer .gz, fallback to raw)
const gzPath = join(v86Dir, `${stateFilename}.gz`)
const rawPath = join(v86Dir, stateFilename)
const hasGz = existsSync(gzPath)
const hasRaw = existsSync(rawPath)

if (hasGz || hasRaw || stateBasePath) {
  const displaySize = hasGz ? statSync(gzPath).size : hasRaw ? statSync(rawPath).size : 0

  let downloadUrl, logicalUrl
  if (stateBasePath) {
    downloadUrl = `${stateBasePath}/${stateFilename}.gz`
    logicalUrl = `${stateBasePath}/${stateFilename}`
  } else {
    downloadUrl = hasGz ? `/v86/${stateFilename}.gz` : `/v86/${stateFilename}`
    logicalUrl = `/v86/${stateFilename}`
  }

  manifest.push({ url: downloadUrl, logicalUrl, size: displaySize, label: 'Linux VM' })
}

const outPath = join(import.meta.dirname, '../src/generated/manifest.json')
writeFileSync(outPath, JSON.stringify(manifest, null, 2))

console.log(`Manifest: ${manifest.length} entries → src/generated/manifest.json`)
for (const m of manifest) {
  const size = m.size >= 1048576 ? `${(m.size / 1048576).toFixed(1)} MB` : `${(m.size / 1024).toFixed(0)} KB`
  console.log(`  ${m.label || m.url} — ${size}`)
}
