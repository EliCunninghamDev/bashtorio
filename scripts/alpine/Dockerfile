FROM i386/alpine:3.21

# Install virt kernel with 9p support + kitchen-sink packages
RUN apk add --no-cache \
	linux-virt linux-firmware-none mkinitfs \
	# Core utils
	coreutils grep sed gawk bash vim perl python3 \
	# Fun
	figlet fortune fastfetch \
	# Tools
	jq curl wget git file bc tree less man-pages \
	# Net
	openssh-client \
	# Misc
	openrc util-linux

# Rebuild initramfs with 9p + virtio support
RUN mkinitfs -F "base virtio 9p" $(ls /lib/modules)

# Configure autologin on serial (ttyS0) and VGA (tty1) consoles
RUN sed -i 's|^#ttyS0|ttyS0|' /etc/inittab && \
	sed -i 's|ttyS0::respawn:/sbin/getty.*|ttyS0::respawn:/sbin/getty -n -l /bin/sh 115200 ttyS0 vt100|' /etc/inittab && \
	sed -i 's|^tty1::respawn:/sbin/getty.*|tty1::respawn:/sbin/getty -n -l /bin/sh 38400 tty1|' /etc/inittab

# Set hostname
RUN echo "localhost" > /etc/hostname

# Ensure /tmp exists
RUN mkdir -p /tmp

# Set root shell to bash
RUN sed -i 's|root:/bin/ash|root:/bin/bash|' /etc/passwd

# Add .bashrc for root
RUN echo 'export PS1="localhost:~# "' > /root/.bashrc && \
	echo 'cd ~' >> /root/.bashrc

# Clean up apk cache
RUN rm -rf /var/cache/apk/*
