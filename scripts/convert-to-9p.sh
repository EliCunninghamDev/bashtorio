#!/bin/bash
# Convert a raw disk image to v86 9p filesystem format
# Usage: ./convert-to-9p.sh <disk.img> <output_dir>
set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 <disk_image> <output_directory>"
    exit 1
fi

DISK_IMAGE="$1"
OUTPUT_DIR="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
V86_TOOLS_DIR="$SCRIPT_DIR/v86-tools"

echo "============================================"
echo "Converting disk image to 9p filesystem"
echo "============================================"
echo ""
echo "Input:  $DISK_IMAGE"
echo "Output: $OUTPUT_DIR"
echo ""

# Check if running as root (needed for mounting)
if [ "$EUID" -ne 0 ]; then
    echo "This script needs root privileges to mount the disk image."
    echo "Re-running with sudo..."
    exec sudo "$0" "$@"
fi

# Clone v86 tools if not present
if [ ! -d "$V86_TOOLS_DIR" ]; then
    echo "Downloading v86 filesystem tools..."
    git clone --depth=1 https://github.com/nicholasRenworthy/nicholasRenworthy.github.io.git "$V86_TOOLS_DIR" 2>/dev/null || \
    git clone --depth=1 https://github.com/nicholasRenworthy/v86-images.git "$V86_TOOLS_DIR" 2>/dev/null || {
        echo "Cloning v86 tools from official repo..."
        git clone --depth=1 --filter=blob:none --sparse https://github.com/copy/v86.git "$V86_TOOLS_DIR"
        cd "$V86_TOOLS_DIR"
        git sparse-checkout set tools
        cd -
    }
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create a temporary mount point
MOUNT_POINT=$(mktemp -d)
trap "umount '$MOUNT_POINT' 2>/dev/null; rmdir '$MOUNT_POINT' 2>/dev/null; losetup -D 2>/dev/null" EXIT

# Set up loop device and mount
echo "Mounting disk image..."
LOOP_DEV=$(losetup --find --show --partscan "$DISK_IMAGE")
sleep 1  # Wait for partition scan

# Find the partition (usually p1 for first partition)
if [ -b "${LOOP_DEV}p1" ]; then
    PARTITION="${LOOP_DEV}p1"
else
    # Try kpartx if partitions don't show up
    kpartx -av "$LOOP_DEV"
    sleep 1
    PARTITION="/dev/mapper/$(basename $LOOP_DEV)p1"
fi

mount "$PARTITION" "$MOUNT_POINT"

echo "Filesystem mounted at $MOUNT_POINT"
echo ""

# Create fs2json.py if it doesn't exist
FS2JSON="$SCRIPT_DIR/fs2json.py"
cat > "$FS2JSON" << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
"""
Convert a mounted filesystem to v86 9p JSON format.
This creates a JSON file describing all files and their SHA256 hashes.
Files are copied with SHA256 names for deduplication.
"""
import os
import sys
import json
import hashlib
import shutil
from pathlib import Path

def sha256_file(filepath):
    """Calculate SHA256 hash of a file."""
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            hasher.update(chunk)
    return hasher.hexdigest()

def scan_directory(root_path, output_dir):
    """Scan directory and create filesystem JSON."""
    fs_data = {
        "fsroot": [],
        "version": 3,
        "size": 0
    }

    file_hashes = {}  # hash -> relative path in output

    root = Path(root_path)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    def process_path(path, name):
        """Process a single path and return its fs entry."""
        rel_path = path.relative_to(root)
        stat = path.lstat()

        entry = {
            "name": name,
            "size": stat.st_size,
            "mtime": int(stat.st_mtime),
            "mode": stat.st_mode,
            "uid": stat.st_uid,
            "gid": stat.st_gid,
        }

        if path.is_symlink():
            entry["target"] = os.readlink(path)
            entry["sha256"] = None
        elif path.is_file():
            # Calculate hash and copy file
            if stat.st_size > 0:
                file_hash = sha256_file(path)
                entry["sha256"] = file_hash

                # Copy file if not already copied
                if file_hash not in file_hashes:
                    dest = output / file_hash
                    shutil.copy2(path, dest)
                    file_hashes[file_hash] = file_hash
                    fs_data["size"] += stat.st_size
            else:
                entry["sha256"] = None
        elif path.is_dir():
            entry["sha256"] = None
            children = []
            try:
                for child in sorted(path.iterdir()):
                    child_entry = process_path(child, child.name)
                    if child_entry:
                        children.append(child_entry)
            except PermissionError:
                pass
            entry["children"] = children
        else:
            return None

        return entry

    # Process root directory
    print(f"Scanning {root_path}...")
    for item in sorted(root.iterdir()):
        entry = process_path(item, item.name)
        if entry:
            fs_data["fsroot"].append(entry)

    print(f"Total size: {fs_data['size'] / 1024 / 1024:.1f} MB")
    print(f"Unique files: {len(file_hashes)}")

    return fs_data

def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <source_dir> <output_dir>")
        sys.exit(1)

    source_dir = sys.argv[1]
    output_dir = sys.argv[2]

    fs_data = scan_directory(source_dir, output_dir)

    # Write JSON
    json_path = os.path.dirname(output_dir.rstrip('/')) + '/arch-fs.json'
    with open(json_path, 'w') as f:
        json.dump(fs_data, f, separators=(',', ':'))

    print(f"Filesystem JSON written to: {json_path}")

if __name__ == "__main__":
    main()
PYTHON_SCRIPT

chmod +x "$FS2JSON"

# Convert filesystem
echo "Converting filesystem to 9p format..."
echo "This may take several minutes..."
echo ""

python3 "$FS2JSON" "$MOUNT_POINT" "$OUTPUT_DIR"

# Also copy kernel and initramfs for direct loading
echo ""
echo "Extracting kernel and initramfs..."

if [ -f "$MOUNT_POINT/boot/vmlinuz-linux" ]; then
    cp "$MOUNT_POINT/boot/vmlinuz-linux" "$OUTPUT_DIR/../vmlinuz-arch"
    echo "Kernel: $OUTPUT_DIR/../vmlinuz-arch"
fi

if [ -f "$MOUNT_POINT/boot/initramfs-linux.img" ]; then
    cp "$MOUNT_POINT/boot/initramfs-linux.img" "$OUTPUT_DIR/../initramfs-arch.img"
    echo "Initramfs: $OUTPUT_DIR/../initramfs-arch.img"
fi

# Cleanup
echo ""
echo "Cleaning up..."
umount "$MOUNT_POINT"
losetup -d "$LOOP_DEV" 2>/dev/null || true
kpartx -d "$DISK_IMAGE" 2>/dev/null || true

echo ""
echo "============================================"
echo "Conversion complete!"
echo "============================================"
echo ""
echo "9p filesystem: $OUTPUT_DIR/"
echo "Metadata JSON: $(dirname $OUTPUT_DIR)/arch-fs.json"
echo ""
