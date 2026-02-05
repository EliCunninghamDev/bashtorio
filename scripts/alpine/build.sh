#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
V86_DIR="$ROOT_DIR/public/v86"
V86_REPO="$ROOT_DIR/.v86-tools"

echo "=== Alpine Linux 9p-root build ==="
echo ""

# 1. Docker build
echo ">> Building Alpine Docker image (i386)..."
docker build --platform linux/386 -t bashtorio-alpine "$SCRIPT_DIR"

# 2. Export to tar
echo ">> Exporting rootfs to tar..."
CONTAINER_ID=$(docker create --platform linux/386 bashtorio-alpine /bin/true)
docker export "$CONTAINER_ID" > "$SCRIPT_DIR/alpine-rootfs.tar"
docker rm "$CONTAINER_ID" > /dev/null

# Remove .dockerenv from tar (not needed in guest)
echo ">> Cleaning tar..."
# Create a cleaned tar without .dockerenv
TMPTAR=$(mktemp)
tar --delete -f "$SCRIPT_DIR/alpine-rootfs.tar" .dockerenv 2>/dev/null || true

# 3. Clone v86 repo for tools (if not already present)
if [ ! -d "$V86_REPO" ]; then
	echo ">> Cloning v86 repo for fs2json/copy-to-sha256 tools..."
	git clone --depth 1 https://github.com/copy/v86.git "$V86_REPO"
else
	echo ">> v86 tools repo already present"
fi

# 4. Ensure output directory exists
mkdir -p "$V86_DIR"
mkdir -p "$V86_DIR/alpine-rootfs-flat"

# 5. Run fs2json.py
echo ">> Generating alpine-fs.json..."
python3 "$V86_REPO/tools/fs2json.py" \
	--zstd \
	--out "$V86_DIR/alpine-fs.json" \
	"$SCRIPT_DIR/alpine-rootfs.tar"

# 6. Run copy-to-sha256.py
echo ">> Creating content-addressed flat directory..."
python3 "$V86_REPO/tools/copy-to-sha256.py" \
	--zstd \
	"$SCRIPT_DIR/alpine-rootfs.tar" \
	"$V86_DIR/alpine-rootfs-flat"

# 7. Clean up tar
echo ">> Cleaning up..."
rm -f "$SCRIPT_DIR/alpine-rootfs.tar" "$TMPTAR"

echo ""
echo "=== Build complete! ==="
echo "  JSON manifest: $V86_DIR/alpine-fs.json"
echo "  Flat rootfs:   $V86_DIR/alpine-rootfs-flat/"
echo ""
echo "Next: run 'node scripts/alpine/build-state.js' to generate the pre-booted state file."
