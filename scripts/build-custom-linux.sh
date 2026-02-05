#!/bin/bash
# Build a custom Linux image for Bashtorio using Docker
# Uses direct CD-ROM boot (like linux4.iso) to avoid initramfs size limits

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../apps/web/public/v86"
BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

echo "=== Building Custom Bashtorio Linux Image ==="
echo ""

# Create Dockerfile
cat > "$BUILD_DIR/Dockerfile" << 'EOF'
FROM alpine:3.19 AS builder

# Install build tools and kernel
RUN apk add --no-cache \
    linux-lts \
    squashfs-tools \
    cpio \
    gzip

# Install utilities we want in the image
RUN apk add --no-cache \
    busybox-extras \
    coreutils \
    grep \
    sed \
    gawk \
    less \
    file \
    bc \
    jq \
    curl \
    wget \
    openssl \
    ca-certificates \
    bash \
    vim \
    tree \
    ncurses \
    ncurses-terminfo-base \
    figlet \
    util-linux \
    tar \
    gzip \
    xz \
    zip \
    unzip \
    perl

# Create cowsay script
RUN mkdir -p /usr/local/bin && \
    printf '%s\n' \
        '#!/bin/sh' \
        'msg="${*:-$(cat)}"' \
        'len=${#msg}' \
        'border=$(printf "%*s" "$((len + 2))" "" | tr " " "-")' \
        'echo " $border"' \
        'echo "< $msg >"' \
        'echo " $border"' \
        'echo "        \\   ^__^"' \
        'echo "         \\  (oo)\\_______"' \
        'echo "            (__)\\       )\\/\\"' \
        'echo "                ||----w |"' \
        'echo "                ||     ||"' \
    > /usr/local/bin/cowsay && \
    chmod +x /usr/local/bin/cowsay && \
    ln -s cowsay /usr/local/bin/cowthink

# Create fortune script
RUN printf '%s\n' \
        '#!/bin/sh' \
        'fortunes="Stay hungry, stay foolish.|Simplicity is the ultimate sophistication.|Be yourself; everyone else is taken.|Talk is cheap. Show me the code.|First, solve the problem. Then, write the code.|The only way to do great work is to love what you do.|In the middle of difficulty lies opportunity.|Life is what happens while you are busy making other plans."' \
        'echo "$fortunes" | tr "|" "\n" | shuf -n1' \
    > /usr/local/bin/fortune && \
    chmod +x /usr/local/bin/fortune

# Create minimal initramfs that mounts CD and switches root
RUN mkdir -p /build/initramfs/{bin,dev,proc,sys,mnt/cdrom,sbin} && \
    cp /bin/busybox /build/initramfs/bin/ && \
    chmod +x /build/initramfs/bin/busybox && \
    ln -s busybox /build/initramfs/bin/sh && \
    ln -s busybox /build/initramfs/bin/mount && \
    ln -s busybox /build/initramfs/bin/switch_root && \
    ln -s busybox /build/initramfs/bin/sleep

# Create init script for initramfs
RUN printf '%s\n' \
        '#!/bin/sh' \
        'mount -t proc proc /proc' \
        'mount -t sysfs sys /sys' \
        'mount -t devtmpfs dev /dev 2>/dev/null' \
        'sleep 1' \
        'mount -t iso9660 /dev/sr0 /mnt/cdrom' \
        'exec switch_root /mnt/cdrom /sbin/init' \
    > /build/initramfs/init && \
    chmod +x /build/initramfs/init

# Create root filesystem structure
RUN mkdir -p /build/rootfs/{bin,sbin,usr/bin,usr/sbin,usr/local/bin,etc,dev,proc,sys,tmp,root,var,lib,mnt} && \
    chmod 1777 /build/rootfs/tmp

# Copy busybox and create symlinks
RUN cp /bin/busybox /build/rootfs/bin/busybox && \
    chmod +x /build/rootfs/bin/busybox && \
    for cmd in $(busybox --list); do \
        ln -sf /bin/busybox /build/rootfs/bin/$cmd 2>/dev/null || true; \
    done

# Copy all installed packages to rootfs
RUN cp -a /usr/* /build/rootfs/usr/ 2>/dev/null || true && \
    cp -a /lib/* /build/rootfs/lib/ 2>/dev/null || true && \
    rm -rf /build/rootfs/lib/firmware /build/rootfs/usr/lib/firmware 2>/dev/null || true && \
    rm -rf /build/rootfs/lib/modules/*/kernel/drivers/gpu 2>/dev/null || true && \
    rm -rf /build/rootfs/lib/modules/*/kernel/sound 2>/dev/null || true && \
    rm -rf /build/rootfs/lib/modules/*/kernel/net/wireless 2>/dev/null || true

# Copy custom scripts
RUN cp /usr/local/bin/cowsay /build/rootfs/usr/local/bin/ && \
    cp /usr/local/bin/fortune /build/rootfs/usr/local/bin/ && \
    ln -sf cowsay /build/rootfs/usr/local/bin/cowthink && \
    cp -r /usr/share/figlet /build/rootfs/usr/share/ 2>/dev/null || true

# Copy essential config files
RUN cp /etc/passwd /etc/group /etc/shadow /build/rootfs/etc/ 2>/dev/null || true && \
    mkdir -p /build/rootfs/etc/apk && \
    cp /etc/apk/repositories /build/rootfs/etc/apk/ 2>/dev/null || true

# Create /sbin/init for the rootfs
RUN printf '%s\n' \
        '#!/bin/sh' \
        'export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' \
        'export HOME=/root' \
        'export TERM=linux' \
        'mount -t proc proc /proc 2>/dev/null' \
        'mount -t sysfs sys /sys 2>/dev/null' \
        'mount -t devtmpfs dev /dev 2>/dev/null || mdev -s' \
        'mkdir -p /dev/pts' \
        'mount -t devpts devpts /dev/pts 2>/dev/null' \
        'hostname bashtorio' \
        'cd /root' \
        'clear' \
        'echo "Welcome to Bashtorio Linux!"' \
        'echo "Available: cowsay, figlet, fortune, curl, wget, jq, vim, and more"' \
        'echo ""' \
        'exec /bin/sh </dev/ttyS0 >/dev/ttyS0 2>&1' \
    > /build/rootfs/sbin/init && \
    chmod +x /build/rootfs/sbin/init

# Build initramfs
RUN cd /build/initramfs && find . | cpio -H newc -o | gzip > /build/initramfs.gz

# Copy kernel
RUN cp /boot/vmlinuz-lts /build/vmlinuz

# ---- Second stage: create ISO ----
FROM alpine:3.19
RUN apk add --no-cache syslinux xorriso

COPY --from=builder /build/initramfs.gz /build/
COPY --from=builder /build/vmlinuz /build/
COPY --from=builder /build/rootfs /build/iso/

# Add isolinux
RUN mkdir -p /build/iso/isolinux /build/iso/boot && \
    mv /build/vmlinuz /build/iso/boot/ && \
    mv /build/initramfs.gz /build/iso/boot/ && \
    cp /usr/share/syslinux/isolinux.bin /build/iso/isolinux/ && \
    cp /usr/share/syslinux/ldlinux.c32 /build/iso/isolinux/

# Create isolinux config
RUN printf '%s\n' \
        'DEFAULT linux' \
        'PROMPT 0' \
        'TIMEOUT 0' \
        'LABEL linux' \
        '    KERNEL /boot/vmlinuz' \
        '    APPEND initrd=/boot/initramfs.gz console=ttyS0 quiet' \
    > /build/iso/isolinux/isolinux.cfg

# Create ISO
RUN xorriso -as mkisofs \
        -o /bashtorio-linux.iso \
        -isohybrid-mbr /usr/share/syslinux/isohdpfx.bin \
        -c isolinux/boot.cat \
        -b isolinux/isolinux.bin \
        -no-emul-boot \
        -boot-load-size 4 \
        -boot-info-table \
        -J -R \
        /build/iso

CMD ["cp", "/bashtorio-linux.iso", "/output/"]
EOF

echo "Building Docker image..."
docker build -t bashtorio-linux-builder "$BUILD_DIR"

echo ""
echo "Extracting ISO..."
mkdir -p "$OUTPUT_DIR"
docker run --rm -v "$OUTPUT_DIR:/output" bashtorio-linux-builder

# Verify the output
if [ -f "$OUTPUT_DIR/bashtorio-linux.iso" ]; then
    echo ""
    echo "=== Success! ==="
    echo "Created: $OUTPUT_DIR/bashtorio-linux.iso"
    ls -lh "$OUTPUT_DIR/bashtorio-linux.iso"
    echo ""
    echo "The image includes:"
    echo "  - cowsay, figlet, fortune"
    echo "  - curl, wget, jq"
    echo "  - rev, base64, tr, sed, awk, grep"
    echo "  - vim, tree, bc, perl"
    echo "  - Full coreutils"
else
    echo "Error: ISO was not created"
    exit 1
fi
