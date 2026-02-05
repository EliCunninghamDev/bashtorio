import type { V86Emulator, V86Config } from '../types/v86';

export interface VMConfig {
	/** Path to v86 assets (wasm, bios, etc.) */
	assetsPath: string;
	/** Linux image filename (default: linux4.iso) */
	linuxImage?: string;
	/** Pre-booted state filename (if provided, skips boot) */
	stateImage?: string;
	/** 9p filesystem base URL (for Arch Linux etc.) */
	filesystemUrl?: string;
	/** 9p basefs JSON manifest - when set, enables 9p-root boot mode */
	basefs?: string;
	/** Container element for the VGA screen */
	screenContainer: HTMLElement;
	/** Optional WebSocket relay URL for networking */
	relayUrl?: string | null;
	/** Status callback during boot */
	onStatus?: (status: string) => void;
}

/** Per-machine shell session state, stored in /tmp/bashtorio/shN on the guest */
interface ShellState {
	id: number;
	/** Guest filesystem path for this shell's working files */
	workDir: string;
	/** Last known working directory, persisted across commands */
	cwd: string;
}

/** Tracks an in-flight file-based job */
interface Job {
	id: string;
	machineId: string;
	bytesRead: number;
	done: boolean;
	exitCode: number | null;
	cwd: string;
	/** If true, this is a FIFO-based stream (persistent command) */
	stream?: boolean;
}

/** Legacy: Tracks an in-flight command's serial output until its end marker appears */
interface PendingRead {
	output: string;
	done: boolean;
	endMarker: string;
}

/**
 * Wraps a v86 emulator instance to provide a shell execution interface.
 *
 * Commands are executed by writing stdin to 9p files, triggering execution
 * via serial0, and polling output/exit files via the emulator's read_file API.
 * Each game machine gets its own shell session with an independent working
 * directory persisted in the guest filesystem.
 *
 * Falls back to serial-marker-based I/O if 9p is unavailable.
 */
export class LinuxVM {
	private emulator: V86Emulator | null = null;
	private _ready = false;
	/** Active shell sessions keyed by machineId (e.g. "m_3_5") */
	private shells = new Map<string, ShellState>();
	private shellIdCounter = 0;
	/** Legacy: In-flight command reads keyed by jobId, listening on the serial stream */
	private pendingReads = new Map<string, PendingRead>();
	/** Active file-based jobs keyed by jobId */
	private activeJobs = new Map<string, Job>();
	private _networkRelay: string | null = null;
	private _fs9pReady = false;
	private _fs9pRoot = false;
	private jobIdCounter = 0;

	get ready(): boolean {
		return this._ready;
	}

	get networkRelay(): string | null {
		return this._networkRelay;
	}

	get fs9pReady(): boolean {
		return this._fs9pReady;
	}

	async init(config: VMConfig): Promise<void> {
		const { assetsPath, linuxImage = 'linux4.iso', stateImage, filesystemUrl, basefs, screenContainer, relayUrl, onStatus = () => {} } = config;

		onStatus('Creating emulator...');

		// Track whether we're using 9p-root boot mode
		this._fs9pRoot = !!basefs;

		return new Promise((resolve, reject) => {
			const memorySize = 512 * 1024 * 1024;

			let v86Config: V86Config;

			if (basefs) {
				// 9p-root boot: kernel/initramfs from the 9p filesystem, root IS the 9p fs
				v86Config = {
					wasm_path: `${assetsPath}/v86.wasm`,
					memory_size: memorySize,
					vga_memory_size: 2 * 1024 * 1024,
					screen_container: screenContainer,
					bios: { url: `${assetsPath}/seabios.bin` },
					vga_bios: { url: `${assetsPath}/vgabios.bin` },
					autostart: true,
					filesystem: {
						basefs: `${assetsPath}/${basefs}`,
						baseurl: filesystemUrl || `${assetsPath}/alpine-rootfs-flat/`,
					},
					bzimage_initrd_from_filesystem: true,
					cmdline: 'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable console=ttyS0',
				};
			} else {
				// Legacy CD-ROM boot
				v86Config = {
					wasm_path: `${assetsPath}/v86.wasm`,
					memory_size: memorySize,
					vga_memory_size: 2 * 1024 * 1024,
					screen_container: screenContainer,
					bios: { url: `${assetsPath}/seabios.bin` },
					vga_bios: { url: `${assetsPath}/vgabios.bin` },
					cdrom: { url: `${assetsPath}/${linuxImage}` },
					autostart: true,
					filesystem: filesystemUrl ? { baseurl: filesystemUrl } : {},
				};
			}

			// If we have a pre-booted state, use it for instant boot
			if (stateImage) {
				v86Config.initial_state = { url: `${assetsPath}/${stateImage}` };
				// No cdrom needed when loading state
				delete v86Config.cdrom;
				onStatus('Loading pre-booted state...');
			}

			if (relayUrl) {
				v86Config.network_relay_url = relayUrl;
				this._networkRelay = relayUrl;
				onStatus('Creating emulator with network...');
			}

			this.emulator = new V86(v86Config);

			// If loading from a pre-booted state, skip serial boot detection entirely
			if (stateImage) {
				onStatus('Restoring state...');
				setTimeout(() => {
					this._ready = true;
					onStatus('State loaded, ready!');
					this.mount9p(onStatus).then(() => resolve());
				}, 1000);
			}

			let booted = !!stateImage;
			let sentEnter = false;
			let buffer = '';

			// Serial0 listener: handles boot detection and legacy serial I/O fallback
			this.emulator.add_listener('serial0-output-byte', (byte: number) => {
				const char = String.fromCharCode(byte);
				buffer += char;
				if (buffer.length > 50000) buffer = buffer.slice(-25000);

				if (!booted) {
					if (!sentEnter && (buffer.includes('Files send via emulator') || buffer.includes('localhost login:'))) {
						sentEnter = true;
						onStatus('Starting shell...');
						setTimeout(() => this.emulator!.serial0_send('\n'), 500);
					}

					if (sentEnter && (buffer.includes('/ #') || buffer.includes('~%') || buffer.includes('# ') || buffer.includes('localhost:~#'))) {
						booted = true;
						onStatus('Configuring...');
						setTimeout(async () => {
							this.emulator!.serial0_send('stty -echo\n');
							await this.sleep(100);
							this.emulator!.serial0_send('PS1=""\n');
							await this.sleep(100);
							this.emulator!.serial0_send('mkdir -p /tmp/bashtorio\n');
							await this.sleep(100);

							if (this._networkRelay) {
								onStatus('Configuring network...');
								this.emulator!.serial0_send('udhcpc -i eth0 2>/dev/null &\n');
								await this.sleep(2000);
							}

							this._ready = true;
							await this.mount9p(onStatus);
							resolve();
						}, 500);
					}
					return;
				}

				// Route serial bytes to legacy pending reads (fallback mode)
				for (const [, pending] of this.pendingReads) {
					pending.output += char;
					if (pending.output.includes(pending.endMarker)) {
						pending.done = true;
					}
				}
			});

			setTimeout(() => {
				if (!booted) reject(new Error('Boot timeout'));
			}, 120000);
		});
	}

	/** Set up 9p filesystem for file-based I/O */
	private async mount9p(onStatus: (status: string) => void): Promise<void> {
		if (!this.emulator) return;

		if (this._fs9pRoot) {
			// 9p-root mode: root fs IS the 9p fs, no mount needed
			onStatus('Setting up 9p job directory...');
			this.emulator.serial0_send('mkdir -p /tmp/bashtorio/jobs\n');
			await this.sleep(300);
			// Verify create_file/read_file work
			try {
				await this.emulator.create_file('tmp/bashtorio/jobs/.ready', new Uint8Array([49])); // "1"
				const data = await this.emulator.read_file('tmp/bashtorio/jobs/.ready');
				if (data[0] === 49) {
					this._fs9pReady = true;
					console.log('[VM] 9p-root filesystem ready');
					onStatus('Ready!');
				} else {
					throw new Error('read_file verification failed');
				}
			} catch (e) {
				console.warn('[VM] 9p-root file I/O failed, falling back to serial:', e);
				this._fs9pReady = false;
				onStatus('Ready (no 9p)');
			}
		} else {
			// Legacy: mount 9p guest filesystem
			onStatus('Mounting 9p filesystem...');
			this.emulator.serial0_send('mkdir -p /mnt/host && mount -t 9p -o trans=virtio,version=9p2000.L host9p /mnt/host 2>/dev/null && echo 9P_MOUNT_OK || echo 9P_MOUNT_FAIL\n');
			await this.sleep(500);
			this.emulator.serial0_send('mkdir -p /mnt/host/jobs\n');
			await this.sleep(100);
			try {
				await this.emulator.create_file('jobs/.ready', new Uint8Array([49])); // "1"
				this._fs9pReady = true;
				console.log('[VM] 9p filesystem mounted successfully');
				onStatus('Ready!');
			} catch (e) {
				console.warn('[VM] 9p mount failed, falling back to serial I/O:', e);
				this._fs9pReady = false;
				onStatus('Ready (no 9p)');
			}
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(r => setTimeout(r, ms));
	}

	/** Get the 9p file path prefix for job files */
	private get jobPrefix(): string {
		return this._fs9pRoot ? 'tmp/bashtorio/jobs' : 'jobs';
	}

	/** Get the guest filesystem path for job files */
	private get guestJobDir(): string {
		return this._fs9pRoot ? '/tmp/bashtorio/jobs' : '/mnt/host/jobs';
	}

	/** Parse output between markers (legacy serial fallback) */
	private parseMarkerOutput(
		raw: string,
		startMarker: string,
		endMarker: string,
		cwdMarker: string
	): { output: string; cwd: string } {
		const startNl = raw.indexOf(startMarker + '\n');
		const startIdx = startNl >= 0 ? startNl : raw.lastIndexOf(startMarker);
		const endNl = raw.indexOf(endMarker + '\n');
		const endIdx = endNl >= 0 ? endNl : raw.lastIndexOf(endMarker);
		const cwdIdx = raw.indexOf(cwdMarker);

		let output = '';
		let cwd = '';

		if (startIdx >= 0 && endIdx > startIdx) {
			output = raw.slice(startIdx + startMarker.length, endIdx).trim();
		}

		if (cwdIdx >= 0) {
			const cwdEnd = raw.indexOf('\n', cwdIdx);
			cwd = raw.slice(cwdIdx + cwdMarker.length, cwdEnd > cwdIdx ? cwdEnd : undefined).trim() || '/';
		}

		return { output, cwd };
	}

	async createShell(machineId: string): Promise<number> {
		if (!this.emulator) throw new Error('Emulator not initialized');

		const shellId = this.shellIdCounter++;
		const workDir = `/tmp/bashtorio/sh${shellId}`;

		const initCmd = `mkdir -p ${workDir} && echo "/" > ${workDir}/cwd`;
		this.emulator.serial0_send(initCmd + '\n');
		await this.sleep(100);

		this.shells.set(machineId, {
			id: shellId,
			workDir,
			cwd: '/',
		});

		console.log(`[VM] Created shell ${shellId} for machine ${machineId}`);
		return shellId;
	}

	async destroyShell(machineId: string): Promise<void> {
		if (!this.emulator) return;

		const shell = this.shells.get(machineId);
		if (shell) {
			this.emulator.serial0_send(`rm -rf ${shell.workDir}\n`);
			this.shells.delete(machineId);
			console.log(`[VM] Destroyed shell for machine ${machineId}`);
		}
	}

	// ── File-based job API ──────────────────────────────────────────────

	/**
	 * Start a new file-based job. Writes stdin to a 9p file if provided,
	 * then sends a background command via serial0 that redirects stdout/stderr
	 * to 9p files and writes exit code on completion.
	 */
	async startJob(machineId: string, cmd: string, stdin?: string): Promise<string> {
		if (!this.emulator || !this._fs9pReady) {
			throw new Error('9p not available');
		}

		let shell = this.shells.get(machineId);
		if (!shell) {
			await this.createShell(machineId);
			shell = this.shells.get(machineId)!;
		}

		const jobId = `j${this.jobIdCounter++}`;
		const prefix = `${this.jobPrefix}/${jobId}`;
		const guestDir = this.guestJobDir;

		// Create empty output file so read_file won't fail immediately
		await this.emulator.create_file(`${prefix}_out`, new Uint8Array(0));

		// Write stdin file if provided
		if (stdin && stdin.length > 0) {
			const encoder = new TextEncoder();
			await this.emulator.create_file(`${prefix}_in`, encoder.encode(stdin));
		}

		const job: Job = {
			id: jobId,
			machineId,
			bytesRead: 0,
			done: false,
			exitCode: null,
			cwd: shell.cwd,
		};
		this.activeJobs.set(jobId, job);

		// Build the guest-side command
		const cwdCmd = `cd "$(cat ${shell.workDir}/cwd)" 2>/dev/null || cd /`;
		let execCmd: string;
		if (stdin && stdin.length > 0) {
			execCmd = `cat ${guestDir}/${jobId}_in | ${cmd}`;
		} else {
			execCmd = cmd;
		}

		// The full command: cd to cwd, run command with output redirected, save exit code and cwd
		const fullCmd = `(${cwdCmd}; ${execCmd} > ${guestDir}/${jobId}_out 2>&1; echo $? > ${guestDir}/${jobId}_exit; pwd > ${guestDir}/${jobId}_cwd; pwd > ${shell.workDir}/cwd) &`;

		this.emulator.serial0_send(fullCmd + '\n');

		console.log(`[VM] Started job ${jobId} for ${machineId}: ${cmd.substring(0, 60)}`);
		return jobId;
	}

	/**
	 * Poll a running job for new output. Returns new bytes since last poll.
	 * Also checks for the exit file to detect completion.
	 */
	async pollJob(jobId: string): Promise<{ newOutput: string; done: boolean; exitCode: number | null; cwd: string }> {
		const job = this.activeJobs.get(jobId);
		if (!job || !this.emulator) {
			return { newOutput: '', done: true, exitCode: null, cwd: '/' };
		}

		const prefix = `${this.jobPrefix}/${jobId}`;
		let newOutput = '';

		// Read stdout file and extract new bytes
		try {
			const data = await this.emulator.read_file(`${prefix}_out`);
			if (data.byteLength > job.bytesRead) {
				const decoder = new TextDecoder();
				const newBytes = data.slice(job.bytesRead);
				newOutput = decoder.decode(newBytes);
				job.bytesRead = data.byteLength;
			}
		} catch {
			// File doesn't exist yet or read failed - skip
		}

		// Check for exit file (command finished)
		if (!job.done) {
			try {
				const exitData = await this.emulator.read_file(`${prefix}_exit`);
				const decoder = new TextDecoder();
				const exitStr = decoder.decode(exitData).trim();
				job.exitCode = parseInt(exitStr, 10) || 0;
				job.done = true;

				// Read final cwd
				try {
					const cwdData = await this.emulator.read_file(`${prefix}_cwd`);
					const cwdStr = new TextDecoder().decode(cwdData).trim();
					if (cwdStr) {
						job.cwd = cwdStr;
						// Update shell state
						const shell = this.shells.get(job.machineId);
						if (shell) shell.cwd = cwdStr;
					}
				} catch {
					// cwd file not written yet, keep existing
				}

				// Do one final read of stdout to get any remaining output
				try {
					const finalData = await this.emulator.read_file(`${prefix}_out`);
					if (finalData.byteLength > job.bytesRead) {
						const finalNew = new TextDecoder().decode(finalData.slice(job.bytesRead));
						newOutput += finalNew;
						job.bytesRead = finalData.byteLength;
					}
				} catch {
					// ignore
				}
			} catch {
				// Exit file doesn't exist yet - command still running
			}
		}

		return {
			newOutput,
			done: job.done,
			exitCode: job.exitCode,
			cwd: job.cwd,
		};
	}

	/** Clean up job files from 9p filesystem */
	async cleanupJob(jobId: string): Promise<void> {
		const job = this.activeJobs.get(jobId);
		const isStream = job?.stream;
		this.activeJobs.delete(jobId);
		if (!this.emulator) return;

		const guestDir = this.guestJobDir;
		if (isStream) {
			this.emulator.serial0_send(`rm -f ${guestDir}/${jobId}_fifo ${guestDir}/${jobId}_out ${guestDir}/${jobId}_exit ${guestDir}/${jobId}_pid ${guestDir}/${jobId}_cwd\n`);
		} else {
			this.emulator.serial0_send(`rm -f ${guestDir}/${jobId}_in ${guestDir}/${jobId}_out ${guestDir}/${jobId}_exit ${guestDir}/${jobId}_cwd\n`);
		}
	}

	// ── FIFO-based stream API ─────────────────────────────────────────

	/**
	 * Start a persistent FIFO-based stream. Creates a named pipe on the guest,
	 * starts the command reading from it (using <> to prevent EOF), and saves
	 * the PID for later cleanup. The command stays alive until explicitly stopped.
	 */
	async startStream(machineId: string, cmd: string): Promise<string> {
		if (!this.emulator || !this._fs9pReady) {
			throw new Error('9p not available');
		}

		let shell = this.shells.get(machineId);
		if (!shell) {
			await this.createShell(machineId);
			shell = this.shells.get(machineId)!;
		}

		const jobId = `s${this.jobIdCounter++}`;
		const prefix = `${this.jobPrefix}/${jobId}`;
		const guestDir = this.guestJobDir;

		// Create empty output file so read_file won't fail immediately
		await this.emulator.create_file(`${prefix}_out`, new Uint8Array(0));

		const job: Job = {
			id: jobId,
			machineId,
			bytesRead: 0,
			done: false,
			exitCode: null,
			cwd: shell.cwd,
			stream: true,
		};
		this.activeJobs.set(jobId, job);

		// Build the guest-side command:
		// 1. Create FIFO
		// 2. Start command with <> (read-write) on the FIFO so it won't get EOF
		// 3. Save PID for later cleanup
		const cwdCmd = `cd "$(cat ${shell.workDir}/cwd)" 2>/dev/null || cd /`;
		const fullCmd = `mkfifo ${guestDir}/${jobId}_fifo; (${cwdCmd}; ${cmd} <> ${guestDir}/${jobId}_fifo > ${guestDir}/${jobId}_out 2>&1; echo $? > ${guestDir}/${jobId}_exit; pwd > ${guestDir}/${jobId}_cwd; pwd > ${shell.workDir}/cwd) & echo $! > ${guestDir}/${jobId}_pid`;

		this.emulator.serial0_send(fullCmd + '\n');

		console.log(`[VM] Started stream ${jobId} for ${machineId}: ${cmd.substring(0, 60)}`);
		return jobId;
	}

	/**
	 * Write data to a running stream's FIFO. Encodes all bytes as hex escapes
	 * for safe transport through the serial channel.
	 */
	writeToStream(jobId: string, data: string): void {
		const job = this.activeJobs.get(jobId);
		if (!job || !this.emulator) return;

		const guestDir = this.guestJobDir;
		// Encode all bytes as hex escapes for shell safety
		const encoder = new TextEncoder();
		const bytes = encoder.encode(data);
		const hex = Array.from(bytes).map(b => `\\x${b.toString(16).padStart(2, '0')}`).join('');

		this.emulator.serial0_send(`printf '%b' '${hex}' > ${guestDir}/${jobId}_fifo\n`);
	}

	/**
	 * Stop a running stream: kill the background process and clean up all files.
	 */
	async stopStream(jobId: string): Promise<void> {
		const job = this.activeJobs.get(jobId);
		if (!job || !this.emulator) {
			this.activeJobs.delete(jobId);
			return;
		}

		const guestDir = this.guestJobDir;
		this.emulator.serial0_send(`kill $(cat ${guestDir}/${jobId}_pid) 2>/dev/null; rm -f ${guestDir}/${jobId}_fifo ${guestDir}/${jobId}_out ${guestDir}/${jobId}_exit ${guestDir}/${jobId}_pid ${guestDir}/${jobId}_cwd\n`);

		this.activeJobs.delete(jobId);
		console.log(`[VM] Stopped stream ${jobId}`);
	}

	/** Get CWD for a machine's shell */
	getShellCwd(machineId: string): string {
		return this.shells.get(machineId)?.cwd ?? '/';
	}

	// ── Legacy exec/pipe methods (reimplemented over file-based I/O) ────

	async execInShell(machineId: string, cmd: string, opts?: { forceSerial?: boolean }): Promise<{ output: string; cwd: string }> {
		if (!this._ready || !this.emulator) {
			console.log('[VM] execInShell blocked - not ready');
			return { output: '', cwd: '/' };
		}

		// Use file-based I/O if available (unless forced to serial)
		if (this._fs9pReady && !opts?.forceSerial) {
			return this.execVia9p(machineId, cmd);
		}

		// Fallback to serial markers
		return this.execViaSerial(machineId, cmd);
	}

	async pipeInShell(machineId: string, input: string, command: string, opts?: { forceSerial?: boolean }): Promise<{ output: string; cwd: string }> {
		if (!this._ready || !this.emulator) {
			console.log('[VM] pipeInShell blocked - not ready');
			return { output: '', cwd: '/' };
		}

		// Use file-based I/O if available (unless forced to serial)
		if (this._fs9pReady && !opts?.forceSerial) {
			return this.execVia9p(machineId, command, input);
		}

		// Fallback to serial markers
		return this.pipeViaSerial(machineId, input, command);
	}

	/** Execute via 9p file-based I/O (start job + poll until done) */
	private async execVia9p(machineId: string, cmd: string, stdin?: string): Promise<{ output: string; cwd: string }> {
		const jobId = await this.startJob(machineId, cmd, stdin);
		let fullOutput = '';
		const start = Date.now();

		while (Date.now() - start < 15000) {
			await this.sleep(50);
			const result = await this.pollJob(jobId);
			fullOutput += result.newOutput;
			if (result.done) {
				await this.cleanupJob(jobId);
				const shell = this.shells.get(machineId);
				return { output: fullOutput.trim(), cwd: result.cwd || shell?.cwd || '/' };
			}
		}

		// Timeout
		console.warn(`[VM] Job ${jobId} timed out`);
		await this.cleanupJob(jobId);
		const shell = this.shells.get(machineId);
		return { output: fullOutput.trim(), cwd: shell?.cwd || '/' };
	}

	/** Legacy: execute via serial markers */
	private async execViaSerial(machineId: string, cmd: string): Promise<{ output: string; cwd: string }> {
		let shell = this.shells.get(machineId);
		if (!shell) {
			await this.createShell(machineId);
			shell = this.shells.get(machineId);
		}

		const jobId = Math.random().toString(36).slice(2);
		const startMarker = `START_${jobId}`;
		const endMarker = `END_${jobId}`;
		const cwdMarker = `CWD_${jobId}`;

		const pending: PendingRead = { output: '', done: false, endMarker: cwdMarker };
		this.pendingReads.set(jobId, pending);

		const fullCmd = [
			`cd "$(cat ${shell!.workDir}/cwd)" 2>/dev/null || cd /`,
			`echo ${startMarker}`,
			cmd,
			`echo ${endMarker}`,
			`pwd | tee ${shell!.workDir}/cwd | sed "s/^/${cwdMarker}/"`
		].join('; ');

		console.log('[VM] execViaSerial:', machineId, cmd);
		this.emulator!.serial0_send(fullCmd + '\n');

		const start = Date.now();
		while (!pending.done && Date.now() - start < 10000) {
			await this.sleep(50);
		}

		this.pendingReads.delete(jobId);

		const result = this.parseMarkerOutput(pending.output, startMarker, endMarker, cwdMarker);
		if (result.cwd) {
			shell!.cwd = result.cwd;
		}

		return { output: result.output, cwd: result.cwd || shell!.cwd };
	}

	/** Legacy: pipe via serial markers */
	private async pipeViaSerial(machineId: string, input: string, command: string): Promise<{ output: string; cwd: string }> {
		let shell = this.shells.get(machineId);
		if (!shell) {
			await this.createShell(machineId);
			shell = this.shells.get(machineId);
		}

		const jobId = Math.random().toString(36).slice(2);
		const startMarker = `START_${jobId}`;
		const endMarker = `END_${jobId}`;
		const cwdMarker = `CWD_${jobId}`;

		const pending: PendingRead = { output: '', done: false, endMarker: cwdMarker };
		this.pendingReads.set(jobId, pending);

		const escaped = input.replace(/'/g, "'\\''");

		const fullCmd = [
			`cd "$(cat ${shell!.workDir}/cwd)" 2>/dev/null || cd /`,
			`echo ${startMarker}`,
			`printf '%s' '${escaped}' | ${command}`,
			`echo ${endMarker}`,
			`pwd | tee ${shell!.workDir}/cwd | sed "s/^/${cwdMarker}/"`
		].join('; ');

		console.log('[VM] pipeViaSerial:', machineId, command);
		this.emulator!.serial0_send(fullCmd + '\n');

		const start = Date.now();
		while (!pending.done && Date.now() - start < 15000) {
			await this.sleep(50);
		}

		this.pendingReads.delete(jobId);

		const result = this.parseMarkerOutput(pending.output, startMarker, endMarker, cwdMarker);
		if (result.cwd) {
			shell!.cwd = result.cwd;
		}

		return { output: result.output, cwd: result.cwd || shell!.cwd };
	}

	// Legacy methods (return just output for backwards compatibility)
	async exec(cmd: string): Promise<string> {
		const { output } = await this.execInShell('_default', cmd);
		return output;
	}

	async pipe(input: string, command: string): Promise<string> {
		const { output } = await this.pipeInShell('_default', input, command);
		return output;
	}

	async test(): Promise<boolean> {
		const result = await this.exec('echo test123');
		const ok = result.includes('test123');
		console.log('[VM] Test:', ok ? 'PASS' : 'FAIL');
		return ok;
	}

	/** Save VM state to ArrayBuffer (for creating pre-booted images) */
	async saveState(): Promise<ArrayBuffer> {
		if (!this.emulator) throw new Error('Emulator not initialized');
		return this.emulator.save_state();
	}

	/** Download the current VM state as a .bin file */
	async downloadState(filename = 'bashtorio-state.bin'): Promise<void> {
		const state = await this.saveState();
		const blob = new Blob([state], { type: 'application/octet-stream' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		console.log(`[VM] State saved: ${filename} (${(state.byteLength / 1024 / 1024).toFixed(1)} MB)`);
	}

	setKeyboardEnabled(enabled: boolean): void {
		if (this.emulator) {
			this.emulator.keyboard_set_status(enabled);
		}
	}

	destroy(): void {
		if (this.emulator) {
			this.emulator.destroy();
			this.emulator = null;
		}
		this._ready = false;
		this._fs9pReady = false;
		this._fs9pRoot = false;
		this.shells.clear();
		this.pendingReads.clear();
		this.activeJobs.clear();
	}
}
