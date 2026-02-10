#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
V86_DIR="$ROOT_DIR/apps/web/public/v86"
V86_REPO="$ROOT_DIR/.v86-tools"

DISTRO="buildroot"
FS_JSON="$V86_DIR/${DISTRO}-fs.json"
FS_FLAT="$V86_DIR/${DISTRO}-rootfs-flat"
STATE_FILE="$V86_DIR/${DISTRO}-state.bin"

if command -v podman &>/dev/null; then
	CTR=podman
elif command -v docker &>/dev/null; then
	CTR=docker
elif command -v nerdctl &>/dev/null; then
	CTR=nerdctl
else
	echo "Error: no container runtime found (docker, podman, or nerdctl)" >&2
	exit 1
fi

echo "=== Buildroot minimal i686 build (using $CTR) ==="
echo ""

# 1. Build in container (this takes a while — compiles kernel + packages from source)
echo ">> Building Buildroot image (this may take 20-40 minutes on first run)..."
$CTR build --platform linux/amd64 -t bashtorio-buildroot "$SCRIPT_DIR"

# 2. Extract rootfs.tar + bzImage from the build
echo ">> Extracting rootfs.tar and bzImage..."
CONTAINER_ID=$($CTR create bashtorio-buildroot /bin/true 2>/dev/null || $CTR create bashtorio-buildroot true)
$CTR cp "$CONTAINER_ID:/rootfs.tar" "$SCRIPT_DIR/buildroot-rootfs.tar"
$CTR cp "$CONTAINER_ID:/bzImage" "$SCRIPT_DIR/buildroot-bzImage"
$CTR rm "$CONTAINER_ID" > /dev/null

# 3. Post-process the rootfs: add autologin + shell config + kernel
echo ">> Post-processing rootfs..."
ROOTFS_DIR=$(mktemp -d)
tar xf "$SCRIPT_DIR/buildroot-rootfs.tar" -C "$ROOTFS_DIR"

# Configure autologin on serial
mkdir -p "$ROOTFS_DIR/etc"
cat > "$ROOTFS_DIR/etc/inittab" <<'INITTAB'
::sysinit:/bin/mount -t proc proc /proc
::sysinit:/bin/mount -t sysfs sysfs /sys
::sysinit:/bin/mount -t devtmpfs devtmpfs /dev
::sysinit:/bin/mount -t tmpfs tmpfs /tmp
::sysinit:/bin/mkdir -p /dev/pts
::sysinit:/bin/mount -t devpts devpts /dev/pts
::sysinit:/bin/hostname localhost
ttyS0::respawn:/sbin/getty -n -l /bin/sh 115200 ttyS0 vt100
::shutdown:/bin/sync
INITTAB

# Set root shell to bash if available
if [ -f "$ROOTFS_DIR/bin/bash" ]; then
	sed -i 's|root:/bin/sh|root:/bin/bash|' "$ROOTFS_DIR/etc/passwd" 2>/dev/null || true
	echo 'export PS1="localhost:~# "' > "$ROOTFS_DIR/root/.bashrc"
	echo 'cd ~' >> "$ROOTFS_DIR/root/.bashrc"
fi

mkdir -p "$ROOTFS_DIR/tmp"

# Inject kernel into rootfs (v86 discovers it via bzimage_initrd_from_filesystem)
echo ">> Injecting bzImage into /boot/..."
mkdir -p "$ROOTFS_DIR/boot"
cp "$SCRIPT_DIR/buildroot-bzImage" "$ROOTFS_DIR/boot/bzImage"

# v86 requires an initramfs file even if the kernel has everything built-in
echo ">> Creating minimal initramfs stub..."
(cd "$ROOTFS_DIR" && echo . | cpio -o -H newc 2>/dev/null | gzip > "$ROOTFS_DIR/boot/initramfs")

# 4. Clone v86 repo for tools (if not already present)
if [ ! -d "$V86_REPO" ]; then
	echo ">> Cloning v86 repo for fs2json/copy-to-sha256 tools..."
	git clone --depth 1 https://github.com/copy/v86.git "$V86_REPO"
else
	echo ">> v86 tools repo already present"
fi

# 5. Generate 9p manifest + flat directory from the directory (not tar)
#    Using the directory avoids the ./prefix issue that tar introduces.
#    See: https://github.com/copy/v86/blob/master/docs/archlinux.md
rm -rf "$FS_FLAT"
mkdir -p "$FS_FLAT"

echo ">> Generating ${DISTRO}-fs.json..."
python3 "$V86_REPO/tools/fs2json.py" \
	--zstd \
	--out "$FS_JSON" \
	"$ROOTFS_DIR"

echo ">> Creating content-addressed flat directory..."
python3 "$V86_REPO/tools/copy-to-sha256.py" \
	--zstd \
	"$ROOTFS_DIR" \
	"$FS_FLAT"

# 6. Clean up
echo ">> Cleaning up..."
rm -rf "$ROOTFS_DIR"
rm -f "$SCRIPT_DIR/buildroot-rootfs.tar" "$SCRIPT_DIR/buildroot-bzImage"

echo ""
echo "=== Build complete! ==="
echo "  JSON manifest: $FS_JSON"
echo "  Flat rootfs:   $FS_FLAT/"
echo "  Files:         $(ls "$FS_FLAT" | wc -l)"
echo "  Manifest size: $(du -h "$FS_JSON" | cut -f1)"
echo "  Flat dir size: $(du -sh "$FS_FLAT" | cut -f1)"
echo ""
echo "Next: run 'node scripts/buildroot/build-state.js' to generate the pre-booted state file."
echo "Then update game.ts to use rootfsManifest: '${DISTRO}-fs.json'"
