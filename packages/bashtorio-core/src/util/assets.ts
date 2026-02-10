/** Unified asset URL resolution — module-level singleton. */

export interface AssetOverrides {
  soundsUrl?: string
  spritesUrl?: string
  rootfsBaseUrl?: string
}

// ── Module-level state ────────────────────────────────────────────

let _vmBase = ''
let _soundsBase = ''
let _spritesBase = ''
let _rootfsBase = ''

// ── Init ──────────────────────────────────────────────────────────

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function initAssets(vmAssetsUrl: string, overrides?: AssetOverrides): void {
  _vmBase = stripTrailingSlash(vmAssetsUrl)
  _soundsBase = stripTrailingSlash(overrides?.soundsUrl ?? `${_vmBase}/sounds`)
  _spritesBase = stripTrailingSlash(overrides?.spritesUrl ?? `${_vmBase}/sprites`)
  _rootfsBase = stripTrailingSlash(overrides?.rootfsBaseUrl ?? `${_vmBase}/alpine-rootfs-flat`)
}

// ── Base getters ──────────────────────────────────────────────────

export function vmBase(): string { return _vmBase }
export function soundsBase(): string { return _soundsBase }
export function spritesBase(): string { return _spritesBase }
export function rootfsBase(): string { return _rootfsBase }

// ── Convenience resolvers ─────────────────────────────────────────

export function vmAsset(filename: string): string {
  return `${_vmBase}/${filename}`
}

export function soundAsset(filename: string): string {
  return `${_soundsBase}/${filename}`
}

export function spriteAsset(filename: string): string {
  return `${_spritesBase}/${filename}`
}

export function rootfsAsset(chunkPath: string): string {
  return `${_rootfsBase}/${chunkPath}`
}

/** Absolute URLs pass through unchanged; relative filenames resolve against vmBase. */
export function resolveUrl(urlOrFilename: string): string {
  if (urlOrFilename.startsWith('http://') || urlOrFilename.startsWith('https://') || urlOrFilename.startsWith('/')) {
    return urlOrFilename
  }
  return `${_vmBase}/${urlOrFilename}`
}
