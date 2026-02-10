#!/usr/bin/env node
// Upload brotli-compressed VM state to R2 bucket before Pages deploy.
// Falls back to uncompressed if .br doesn't exist.
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '../public/v86')
const bucket = 'bigassets'

const stateFile = process.env.PUBLIC_STATE_FILE || 'alpine-state.bin'
const brPath = join(publicDir, `${stateFile}.br`)
const rawPath = join(publicDir, stateFile)

if (existsSync(brPath)) {
  console.log(`Uploading ${stateFile}.br to R2 bucket "${bucket}"...`)
  execSync(`wrangler r2 object put "${bucket}/${stateFile}.br" --file "${brPath}" --content-type application/octet-stream`, { stdio: 'inherit' })
  console.log('Done.')
} else if (existsSync(rawPath)) {
  console.log(`No .br found, uploading ${stateFile} to R2 bucket "${bucket}"...`)
  execSync(`wrangler r2 object put "${bucket}/${stateFile}" --file "${rawPath}" --content-type application/octet-stream`, { stdio: 'inherit' })
  console.log('Done.')
} else {
  console.log(`No state file found at ${rawPath}, skipping R2 upload.`)
}
