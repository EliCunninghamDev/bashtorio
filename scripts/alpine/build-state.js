#!/usr/bin/env node
/**
 * Boots the Alpine 9p-root image in v86 and saves a pre-booted state file.
 * Usage: node scripts/alpine/build-state.js
 */

const fs = require("fs");
const path = require("path");

const V86_DIR = path.join(__dirname, "../../apps/web/public/v86");
const STATE_FILE = path.join(V86_DIR, "alpine-state.bin");

const V86_MJS = path.join(__dirname, "../../packages/bashtorio-core/vendor/v86/libv86.mjs");
const V86_WASM = path.join(V86_DIR, "v86.wasm");

async function main() {
	if (!fs.existsSync(V86_MJS)) {
		console.error("Vendored v86 not found at", V86_MJS);
		console.error("Run: bash scripts/build-v86.sh");
		process.exit(1);
	}

	const alpineFsJson = path.join(V86_DIR, "alpine-fs.json");
	const alpineRootfsFlat = path.join(V86_DIR, "alpine-rootfs-flat");

	if (!fs.existsSync(alpineFsJson)) {
		console.error("alpine-fs.json not found. Run scripts/alpine/build.sh first.");
		process.exit(1);
	}

	console.log("Loading v86 from", V86_MJS);
	const { V86 } = await import("file://" + V86_MJS);

	console.log("Booting Alpine Linux...");

	const emulator = new V86({
		wasm_path: V86_WASM,
		memory_size: 512 * 1024 * 1024,
		vga_memory_size: 2 * 1024 * 1024,
		screen_container: null,
		bios: { url: path.join(V86_DIR, "seabios.bin") },
		vga_bios: { url: path.join(V86_DIR, "vgabios.bin") },
		filesystem: {
			basefs: alpineFsJson,
			baseurl: alpineRootfsFlat + "/",
		},
		bzimage_initrd_from_filesystem: true,
		cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable console=ttyS0",
		autostart: true,
	});

	let buffer = "";
	let booted = false;

	emulator.add_listener("serial0-output-byte", (byte) => {
		const char = String.fromCharCode(byte);
		process.stdout.write(char);
		buffer += char;
		if (buffer.length > 100000) buffer = buffer.slice(-50000);
	});

	// Wait for boot prompt
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error("Boot timeout (120s)"));
		}, 120000);

		const check = setInterval(() => {
			if (buffer.includes("localhost:~#") || buffer.includes("localhost login:") || buffer.includes("~ #")) {
				if (!booted) {
					booted = true;
					console.log("\n\n=== Boot detected! ===");
					clearInterval(check);
					clearTimeout(timeout);
					resolve();
				}
			}
		}, 500);
	});

	// If we got a login prompt, send root
	if (buffer.includes("localhost login:")) {
		console.log("Sending login...");
		emulator.serial0_send("root\n");
		await new Promise(r => setTimeout(r, 3000));
	}

	// Configure shell
	console.log("Configuring shell...");
	emulator.serial0_send("hostname localhost\n");
	await new Promise(r => setTimeout(r, 500));
	emulator.serial0_send("stty -echo\n");
	await new Promise(r => setTimeout(r, 500));
	emulator.serial0_send('PS1="localhost:~# "\n');
	await new Promise(r => setTimeout(r, 500));
	emulator.serial0_send("mkdir -p /tmp/bashtorio\n");
	await new Promise(r => setTimeout(r, 500));

	// Drop caches for smaller state file
	console.log("Dropping caches...");
	emulator.serial0_send("sync && echo 3 > /proc/sys/vm/drop_caches\n");
	await new Promise(r => setTimeout(r, 500));

	// Wait for things to settle
	console.log("Waiting 10s for system to settle...");
	await new Promise(r => setTimeout(r, 10000));

	// Save state
	console.log("Saving state...");
	const state = await emulator.save_state();

	const stateBuffer = Buffer.from(state);
	fs.writeFileSync(STATE_FILE, stateBuffer);

	const sizeMB = (stateBuffer.length / 1024 / 1024).toFixed(1);
	console.log(`\nState saved: ${STATE_FILE} (${sizeMB} MB)`);

	emulator.stop();
	process.exit(0);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
