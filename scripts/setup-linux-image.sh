#!/bin/bash
# Setup a Linux image for Bashtorio
# Option 1: Download pre-built image
# Option 2: Build with Docker (if available)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../apps/web/public/v86"

echo "=== Bashtorio Linux Image Setup ==="
echo ""

# Check for existing custom image
if [ -f "$OUTPUT_DIR/bashtorio-linux.iso" ]; then
    echo "Custom image already exists: $OUTPUT_DIR/bashtorio-linux.iso"
    ls -lh "$OUTPUT_DIR/bashtorio-linux.iso"
    echo ""
    read -p "Rebuild/redownload? [y/N] " response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Try to use Docker first
if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
    echo "Docker is available. Building custom image..."
    exec "$SCRIPT_DIR/build-custom-linux.sh"
fi

echo "Docker is not available or not running."
echo ""
echo "Alternative options:"
echo ""
echo "1. Start Docker and run this script again"
echo "   - The build script will create a custom image with all utilities"
echo ""
echo "2. Use the current minimal image + network to install packages"
echo "   - Enable network relay in Bashtorio"
echo "   - Run: apk update && apk add cowsay figlet fortune jq curl"
echo ""
echo "3. Download a community pre-built image"
echo "   - Check https://github.com/nicholasRenworthy/v86-images"
echo ""

# Offer to create a simple script that installs packages on boot
echo "Would you like to create an auto-install script that runs on VM boot?"
echo "This will modify the VM init to install packages when network is available."
echo ""
read -p "Create auto-install script? [y/N] " response

if [[ "$response" =~ ^[Yy]$ ]]; then
    # We can't modify the ISO, but we can suggest adding a startup command
    echo ""
    echo "Unfortunately, modifying the ISO requires Docker."
    echo ""
    echo "For now, you can manually install packages in the VM terminal:"
    echo ""
    echo "  1. Click 'Network' button in Bashtorio"
    echo "  2. Start a WebSocket relay: npx websockify 8080 10.0.2.2:80"
    echo "  3. Enter ws://localhost:8080 and reload"
    echo "  4. In VM terminal, run:"
    echo "     apk update"
    echo "     apk add cowsay figlet fortune toilet jq curl wget"
    echo ""
fi
