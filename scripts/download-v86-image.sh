#!/bin/bash
# Download a pre-built v86 Linux image with more utilities
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../apps/web/public/v86"

echo "Available v86 images:"
echo ""
echo "1. arch - Arch Linux (larger, more utilities)"
echo "2. buildroot - Buildroot Linux (small, customizable)"
echo "3. alpine - Alpine Linux (current, minimal)"
echo ""

# v86 images are available from copy.sh
# See: https://github.com/nicholasRenworthy/v86-images

# For now, let's download a specific known-working image
IMAGE_URL="https://copy.sh/v86/images/linux4.iso"

echo "The current linux4.iso is a minimal Alpine image."
echo ""
echo "For more utilities, you have these options:"
echo ""
echo "Option A: Use networking to install packages at runtime"
echo "  - Enable the network relay in Bashtorio"
echo "  - Run: apk update && apk add cowsay figlet fortune"
echo ""
echo "Option B: Download a larger pre-built image"
echo "  - Arch Linux state: https://copy.sh/v86/images/arch-state.bin"
echo "  - This is a saved VM state, not an ISO"
echo ""
echo "Option C: Build a custom image using Alpine's mkimage tool"
echo "  - See: https://wiki.alpinelinux.org/wiki/How_to_make_a_custom_ISO_image"
echo ""

read -p "Would you like to enable network support to install packages dynamically? [y/N] " response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Network support is already built into Bashtorio!"
    echo ""
    echo "To use it:"
    echo "1. Run a WebSocket-to-TCP relay locally:"
    echo "   npx websockify 8080 10.0.2.2:80"
    echo ""
    echo "2. Click the Network button in Bashtorio"
    echo "3. Enter: ws://localhost:8080"
    echo "4. Click Connect and reload"
    echo ""
    echo "Then in the VM terminal, run:"
    echo "   apk update"
    echo "   apk add cowsay figlet fortune toilet lolcat"
    echo ""
fi
