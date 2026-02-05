#!/bin/bash
# Build a minimal Arch Linux 32-bit image for Bashtorio using Packer + QEMU
# Requires: packer, qemu, kpartx, python3
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKER_DIR="$SCRIPT_DIR/packer"
OUTPUT_DIR="$SCRIPT_DIR/../public/v86"
ARCH_DIR="$OUTPUT_DIR/arch"

echo "============================================"
echo "Bashtorio Arch Linux Image Builder"
echo "============================================"
echo ""

# Check dependencies
check_dep() {
    if ! command -v "$1" &> /dev/null; then
        echo "Error: $1 is required but not installed."
        echo "Install with: $2"
        exit 1
    fi
}

check_dep packer "your package manager (e.g., pacman -S packer)"
check_dep qemu-system-i386 "pacman -S qemu-full"
check_dep kpartx "pacman -S multipath-tools"
check_dep python3 "pacman -S python"

# Create packer directory if it doesn't exist
mkdir -p "$PACKER_DIR"

# Download Arch Linux 32 ISO if not present
ISO_URL="https://mirror.archlinux32.org/archisos/archlinux32-2024.01.01-i686.iso"
ISO_FILE="$PACKER_DIR/archlinux32.iso"

if [ ! -f "$ISO_FILE" ]; then
    echo "Downloading Arch Linux 32-bit ISO..."
    curl -L -o "$ISO_FILE" "$ISO_URL" || {
        echo "Primary mirror failed, trying alternate..."
        curl -L -o "$ISO_FILE" "https://archlinux32.org/archisos/archlinux32-2024.01.01-i686.iso"
    }
fi

# Create Packer template
cat > "$PACKER_DIR/template.pkr.hcl" << 'PACKER_TEMPLATE'
packer {
  required_plugins {
    qemu = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/qemu"
    }
  }
}

variable "iso_url" {
  type    = string
  default = "archlinux32.iso"
}

source "qemu" "arch" {
  iso_url          = var.iso_url
  iso_checksum     = "none"
  output_directory = "output"
  shutdown_command = "poweroff"
  disk_size        = "2G"
  format           = "raw"
  accelerator      = "kvm"
  memory           = 1024
  cpus             = 2
  net_device       = "virtio-net"
  disk_interface   = "virtio"
  boot_wait        = "5s"
  boot_command = [
    "<enter><wait60>",
    "root<enter><wait5>",
    "curl -O http://{{ .HTTPIP }}:{{ .HTTPPort }}/provision.sh && chmod +x provision.sh && ./provision.sh<enter>"
  ]
  http_directory   = "."
  ssh_username     = "root"
  ssh_password     = "bashtorio"
  ssh_timeout      = "20m"
  vm_name          = "arch.img"
  headless         = true
}

build {
  sources = ["source.qemu.arch"]

  provisioner "shell" {
    inline = ["echo 'Build complete!'"]
  }
}
PACKER_TEMPLATE

# Create provision script that runs inside the Arch installer
cat > "$PACKER_DIR/provision.sh" << 'PROVISION_SCRIPT'
#!/bin/bash
# Arch Linux provision script for Bashtorio
# This runs inside the Arch Linux installer environment
set -e

echo "=== Bashtorio Arch Linux Provisioner ==="

# Partition the disk
echo "Partitioning disk..."
parted -s /dev/vda mklabel msdos
parted -s /dev/vda mkpart primary ext4 1MiB 100%
parted -s /dev/vda set 1 boot on

# Format
echo "Formatting..."
mkfs.ext4 -F /dev/vda1

# Mount
echo "Mounting..."
mount /dev/vda1 /mnt

# Initialize pacman keyring (sometimes needed)
pacman-key --init
pacman-key --populate archlinux32

# Install base system with shell utilities
echo "Installing packages (this takes a while)..."
pacstrap /mnt \
    base \
    linux \
    linux-firmware \
    grub \
    dhcpcd \
    openssh \
    bash \
    coreutils \
    util-linux \
    grep \
    sed \
    gawk \
    findutils \
    diffutils \
    less \
    file \
    bc \
    jq \
    curl \
    wget \
    openssl \
    ca-certificates \
    git \
    vim \
    nano \
    tree \
    ncurses \
    figlet \
    cowsay \
    fortune-mod \
    htop \
    procps-ng \
    psmisc \
    net-tools \
    iproute2 \
    iputils \
    bind \
    rsync \
    tar \
    gzip \
    bzip2 \
    xz \
    zip \
    unzip \
    p7zip \
    sqlite \
    python \
    python-pip \
    nodejs \
    npm \
    lua \
    perl \
    ruby \
    man-db \
    man-pages

# Generate fstab
echo "Generating fstab..."
genfstab -U /mnt >> /mnt/etc/fstab

# Chroot and configure
echo "Configuring system..."
arch-chroot /mnt /bin/bash << 'CHROOT_COMMANDS'
# Set timezone
ln -sf /usr/share/zoneinfo/UTC /etc/localtime
hwclock --systohc

# Locale
echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
locale-gen
echo "LANG=en_US.UTF-8" > /etc/locale.conf

# Hostname
echo "bashtorio" > /etc/hostname

# Set root password for SSH (used during build only)
echo "root:bashtorio" | chpasswd

# Enable serial console login
mkdir -p /etc/systemd/system/getty@ttyS0.service.d
cat > /etc/systemd/system/getty@ttyS0.service.d/override.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin root --noclear %I 115200 linux
EOF

systemctl enable getty@ttyS0

# Configure 9p support for v86
cat > /etc/mkinitcpio.conf << 'EOF'
MODULES=(9p 9pnet 9pnet_virtio atkbd i8042 virtio virtio_pci virtio_ring)
BINARIES=()
FILES=()
HOOKS=(base udev autodetect modconf block filesystems keyboard fsck)
EOF

# Regenerate initramfs
mkinitcpio -P

# Install GRUB
grub-install --target=i386-pc /dev/vda

# Configure GRUB for serial console
cat > /etc/default/grub << 'EOF'
GRUB_DEFAULT=0
GRUB_TIMEOUT=0
GRUB_CMDLINE_LINUX_DEFAULT="console=ttyS0,115200 quiet"
GRUB_CMDLINE_LINUX=""
GRUB_TERMINAL="serial console"
GRUB_SERIAL_COMMAND="serial --speed=115200"
EOF

grub-mkconfig -o /boot/grub/grub.cfg

# Enable DHCP
systemctl enable dhcpcd

# Enable SSH (for build process)
systemctl enable sshd

# Create welcome message
cat > /etc/profile.d/bashtorio.sh << 'EOF'
export PS1='[\u@\h \W]\$ '
echo "Welcome to Bashtorio Linux (Arch)"
echo "Available tools: bash, grep, sed, awk, jq, git, python, node, and more"
EOF

CHROOT_COMMANDS

# Unmount
echo "Finalizing..."
umount -R /mnt

echo "=== Provision complete! ==="
poweroff
PROVISION_SCRIPT

chmod +x "$PACKER_DIR/provision.sh"

# Build the image
echo ""
echo "Building Arch Linux image with Packer..."
echo "This will take 10-20 minutes..."
echo ""

cd "$PACKER_DIR"

# Initialize packer plugins
packer init template.pkr.hcl

# Build
packer build -var "iso_url=$ISO_FILE" template.pkr.hcl

# Check if image was created
if [ ! -f "$PACKER_DIR/output/arch.img" ]; then
    echo "Error: Build failed, no image created"
    exit 1
fi

echo ""
echo "Image built successfully!"
echo ""

# Convert to 9p filesystem
echo "Converting to 9p filesystem format..."
"$SCRIPT_DIR/convert-to-9p.sh" "$PACKER_DIR/output/arch.img" "$ARCH_DIR"

echo ""
echo "============================================"
echo "Build complete!"
echo "============================================"
echo ""
echo "Arch Linux filesystem created at: $ARCH_DIR"
echo "Filesystem metadata: $OUTPUT_DIR/arch-fs.json"
echo ""
echo "The game will now use Arch Linux instead of Buildroot."
echo ""
