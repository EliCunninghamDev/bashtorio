#!/usr/bin/env node
// Upload VM state files to R2 bucket and remove them from dist/ before Pages deploy.
import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '../dist/v86')
const bucket = 'bigassets'

const stateFile = process.env.PUBLIC_STATE_FILENAME || 'alpine-state.bin'
const variants = [
  { ext: '.gz', path: join(distDir, `${stateFile}.gz`) },
  { ext: '',    path: join(distDir, stateFile) },
]

// Upload every variant that exists
const uploadedKeys = []
for (const v of variants) {
  if (existsSync(v.path)) {
    const key = `${stateFile}${v.ext}`
    console.log(`Uploading ${key} to R2 bucket "${bucket}"...`)
    execSync(`wrangler r2 object put "${bucket}/${key}" --file "${v.path}" --content-type application/octet-stream --remote`, { stdio: 'inherit' })
    uploadedKeys.push(key)
  }
}

if (!uploadedKeys.length) {
  console.log(`No state file found in ${distDir}, skipping R2 upload.`)
}

// Purge Cloudflare CDN cache for uploaded files
const zoneId = process.env.CF_ZONE_ID
const apiToken = process.env.CF_PURGE_TOKEN
if (uploadedKeys.length && zoneId && apiToken) {
  const basePath = process.env.PUBLIC_STATE_BASE_PATH || ''
  if (basePath) {
    const purgeUrls = uploadedKeys.map(key => `${basePath}/${key}`)
    console.log(`Purging CDN cache for: ${purgeUrls.join(', ')}`)
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: purgeUrls }),
      })
      const data = await res.json()
      if (data.success) {
        console.log('CDN cache purged successfully')
      } else {
        console.warn('CDN cache purge failed:', data.errors)
      }
    } catch (e) {
      console.warn('CDN cache purge request failed:', e.message)
    }
  }
} else if (uploadedKeys.length && !zoneId) {
  console.log('Skipping CDN cache purge (set CF_ZONE_ID + CF_PURGE_TOKEN to enable)')
}

// Delete all state variants from dist so they don't get deployed to Pages
for (const v of variants) {
  if (existsSync(v.path)) {
    unlinkSync(v.path)
    console.log(`Deleted ${v.path} from dist`)
  }
}
