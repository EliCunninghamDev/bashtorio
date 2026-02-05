#!/bin/bash
# Build a custom Alpine Linux ISO for Bashtorio with extra utilities
# Requires: Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../apps/web/public/v86"
IMAGE_NAME="bashtorio-linux.iso"

echo "Building custom Linux image for Bashtorio..."

# Create a temporary build directory
BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

# Create the Dockerfile for building the ISO
cat > "$BUILD_DIR/Dockerfile" << 'DOCKERFILE'
FROM alpine:3.19

# Install build tools
RUN apk add --no-cache \
    alpine-sdk \
    build-base \
    apk-tools \
    alpine-conf \
    busybox \
    fakeroot \
    syslinux \
    xorriso \
    squashfs-tools \
    mtools \
    dosfstools \
    grub-efi

WORKDIR /build

# Create the build script
COPY build-iso.sh /build/
RUN chmod +x /build/build-iso.sh

CMD ["/build/build-iso.sh"]
DOCKERFILE

# Create the ISO build script
cat > "$BUILD_DIR/build-iso.sh" << 'BUILDSCRIPT'
#!/bin/sh
set -e

WORKDIR=/build/rootfs
ISO_DIR=/build/iso
OUTPUT=/output/bashtorio-linux.iso

# Create root filesystem
mkdir -p $WORKDIR
cd $WORKDIR

# Initialize APK in the new root
mkdir -p $WORKDIR/etc/apk
cp /etc/apk/repositories $WORKDIR/etc/apk/
apk add --root $WORKDIR --initdb --no-cache \
    alpine-base \
    busybox \
    busybox-binsh \
    coreutils \
    util-linux \
    grep \
    sed \
    gawk \
    findutils \
    diffutils \
    patch \
    less \
    file \
    bc \
    jq \
    curl \
    wget \
    openssl \
    ca-certificates \
    git \
    bash \
    zsh \
    vim \
    nano \
    tree \
    ncurses \
    figlet \
    toilet \
    cowsay \
    fortune \
    sl \
    lolcat \
    htop \
    procps \
    psmisc \
    net-tools \
    iproute2 \
    iputils \
    bind-tools \
    openssh-client \
    rsync \
    tar \
    gzip \
    bzip2 \
    xz \
    zip \
    unzip \
    p7zip \
    sqlite \
    python3 \
    py3-pip \
    nodejs \
    npm \
    lua5.4 \
    perl \
    ruby \
    mandoc \
    man-pages

# Set up basic system files
cat > $WORKDIR/etc/inittab << 'EOF'
::sysinit:/bin/mount -t proc proc /proc
::sysinit:/bin/mount -t sysfs sys /sys
::sysinit:/bin/mount -t devtmpfs dev /dev
::sysinit:/bin/mkdir -p /dev/pts
::sysinit:/bin/mount -t devpts devpts /dev/pts
::sysinit:/bin/hostname bashtorio
ttyS0::respawn:/bin/sh
EOF

cat > $WORKDIR/etc/passwd << 'EOF'
root:x:0:0:root:/root:/bin/sh
EOF

cat > $WORKDIR/etc/group << 'EOF'
root:x:0:
EOF

cat > $WORKDIR/etc/shadow << 'EOF'
root::0:0:99999:7:::
EOF

mkdir -p $WORKDIR/root
cat > $WORKDIR/root/.profile << 'EOF'
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
export TERM=linux
cd /root
EOF

# Create init script
cat > $WORKDIR/init << 'EOF'
#!/bin/sh
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mkdir -p /dev/pts
mount -t devpts devpts /dev/pts
hostname bashtorio

# Start shell on serial console
exec /bin/sh </dev/ttyS0 >/dev/ttyS0 2>&1
EOF
chmod +x $WORKDIR/init

# Create the ISO
mkdir -p $ISO_DIR/boot/grub
mkdir -p $ISO_DIR/isolinux

# Create initramfs
cd $WORKDIR
find . | cpio -H newc -o | gzip > $ISO_DIR/boot/initramfs.gz

# Copy kernel
cp /boot/vmlinuz-lts $ISO_DIR/boot/vmlinuz 2>/dev/null || \
cp $WORKDIR/boot/vmlinuz-* $ISO_DIR/boot/vmlinuz 2>/dev/null || \
apk fetch --stdout linux-lts | tar -xzf - -C /tmp && cp /tmp/boot/vmlinuz-* $ISO_DIR/boot/vmlinuz

# Create GRUB config
cat > $ISO_DIR/boot/grub/grub.cfg << 'EOF'
set timeout=0
set default=0

menuentry "Bashtorio Linux" {
    linux /boot/vmlinuz console=ttyS0 quiet
    initrd /boot/initramfs.gz
}
EOF

# Create isolinux config
cp /usr/share/syslinux/isolinux.bin $ISO_DIR/isolinux/
cp /usr/share/syslinux/ldlinux.c32 $ISO_DIR/isolinux/
cat > $ISO_DIR/isolinux/isolinux.cfg << 'EOF'
DEFAULT linux
LABEL linux
    KERNEL /boot/vmlinuz
    APPEND initrd=/boot/initramfs.gz console=ttyS0 quiet
EOF

# Build ISO
xorriso -as mkisofs \
    -o $OUTPUT \
    -isohybrid-mbr /usr/share/syslinux/isohdpfx.bin \
    -c isolinux/boot.cat \
    -b isolinux/isolinux.bin \
    -no-emul-boot \
    -boot-load-size 4 \
    -boot-info-table \
    $ISO_DIR

echo "ISO created: $OUTPUT"
ls -lh $OUTPUT
BUILDSCRIPT

echo "Building Docker image..."
docker build -t bashtorio-linux-builder "$BUILD_DIR"

echo "Running build..."
mkdir -p "$OUTPUT_DIR"
docker run --rm -v "$OUTPUT_DIR:/output" bashtorio-linux-builder

echo ""
echo "Done! New image created at: $OUTPUT_DIR/$IMAGE_NAME"
echo ""
echo "To use it, update LinuxVM.ts to use 'bashtorio-linux.iso' instead of 'linux4.iso'"
