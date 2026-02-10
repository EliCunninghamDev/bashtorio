FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential gcc g++ make patch cpio unzip rsync bc \
	python3 perl file wget ca-certificates git \
	libncurses-dev libssl-dev && \
	rm -rf /var/lib/apt/lists/*

ARG BUILDROOT_VERSION=2024.11.1
RUN wget -q https://buildroot.org/downloads/buildroot-${BUILDROOT_VERSION}.tar.xz && \
	tar xf buildroot-${BUILDROOT_VERSION}.tar.xz && \
	rm buildroot-${BUILDROOT_VERSION}.tar.xz && \
	mv buildroot-${BUILDROOT_VERSION} /buildroot

WORKDIR /buildroot

# Copy config files
COPY bashtorio_defconfig configs/bashtorio_defconfig
COPY kernel.fragment /buildroot/kernel.fragment

# Build (this takes 20-40 min on first run)
ENV FORCE_UNSAFE_CONFIGURE=1
RUN make bashtorio_defconfig && make -j$(nproc)

# --- Stage 2: extract rootfs tar + kernel ---
FROM scratch
COPY --from=builder /buildroot/output/images/rootfs.tar /rootfs.tar
COPY --from=builder /buildroot/output/images/bzImage /bzImage
