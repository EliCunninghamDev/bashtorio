#!/usr/bin/env bash
# Build v86 (libv86.mjs + v86.wasm) from the .v86-tools source checkout.
#
# Requirements (only needed to run this script, not for normal dev):
#   - Rust with wasm32-unknown-unknown target
#   - Clang
#   - Java (for closure-compiler, auto-downloaded by v86 Makefile)
#
# The built artifacts are committed to the repo so most developers never
# need to run this script.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V86_DIR="$REPO_ROOT/.v86-tools"
PINNED_COMMIT="62fd36e"

VENDOR_DIR="$REPO_ROOT/packages/bashtorio-core/vendor/v86"
PUBLIC_DIR="$REPO_ROOT/apps/web/public/v86"

# ── Preflight checks ────────────────────────────────────────────────

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: $1 is required but not found." >&2
    exit 1
  fi
}

check_cmd rustc
check_cmd clang
check_cmd java

if ! rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown; then
  echo "ERROR: Rust target wasm32-unknown-unknown not installed." >&2
  echo "  Run: rustup target add wasm32-unknown-unknown" >&2
  exit 1
fi

# ── Ensure .v86-tools exists at pinned commit ────────────────────────

if [ ! -d "$V86_DIR" ]; then
  echo "Cloning v86 to $V86_DIR..."
  git clone https://github.com/copy/v86.git "$V86_DIR"
fi

cd "$V86_DIR"

CURRENT_COMMIT="$(git rev-parse --short=7 HEAD)"
if [ "$CURRENT_COMMIT" != "$PINNED_COMMIT" ]; then
  echo "Checking out pinned commit $PINNED_COMMIT (currently at $CURRENT_COMMIT)..."
  git fetch origin
  git checkout "$PINNED_COMMIT"
fi

# ── Build ────────────────────────────────────────────────────────────

echo "Building v86 (this may take a few minutes)..."
make build/libv86.mjs build/v86.wasm

# ── Copy artifacts ───────────────────────────────────────────────────

mkdir -p "$VENDOR_DIR" "$PUBLIC_DIR"

cp build/libv86.mjs "$VENDOR_DIR/libv86.mjs"
cp build/v86.wasm   "$PUBLIC_DIR/v86.wasm"

# Patch out Node.js dynamic imports (dead code behind typeof process guards)
# so Vite doesn't warn about node:crypto / node:fs/promises
sed -i 's/import("node:crypto")/Promise.reject()/g; s/import("node:fs\/promises")/Promise.reject()/g' \
  "$VENDOR_DIR/libv86.mjs"

echo ""
echo "Done! Artifacts:"
echo "  $VENDOR_DIR/libv86.mjs ($(du -h "$VENDOR_DIR/libv86.mjs" | cut -f1))"
echo "  $PUBLIC_DIR/v86.wasm   ($(du -h "$PUBLIC_DIR/v86.wasm" | cut -f1))"
