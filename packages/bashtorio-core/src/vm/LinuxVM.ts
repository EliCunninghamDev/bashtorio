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

/** Tracks an in-flight command's serial output until its end marker appears */
interface PendingRead {
  /** Raw serial output accumulated so far */
  output: string;
  /** Set to true once endMarker is found in the output */
  done: boolean;
  /** The string we're waiting for to signal command completion */
  endMarker: string;
}

/**
 * Wraps a v86 emulator instance to provide a shell execution interface.
 *
 * All commands are sent over serial0 and their output is captured using
 * unique start/end markers (e.g. START_abc123 / END_abc123). Each game
 * machine gets its own shell session (identified by machineId) with an
 * independent working directory persisted in the guest filesystem.
 *
 * Multiple commands can run concurrently - each gets a unique jobId and
 * its own PendingRead that filters output from the shared serial stream.
 */
export class LinuxVM {
  private emulator: V86Emulator | null = null;
  private _ready = false;
  /** Active shell sessions keyed by machineId (e.g. "m_3_5") */
  private shells = new Map<string, ShellState>();
  private shellIdCounter = 0;
  /** In-flight command reads keyed by jobId, listening on the serial stream */
  private pendingReads = new Map<string, PendingRead>();
  private _networkRelay: string | null = null;

  get ready(): boolean {
    return this._ready;
  }

  get networkRelay(): string | null {
    return this._networkRelay;
  }

  async init(config: VMConfig): Promise<void> {
    const { assetsPath, linuxImage = 'linux4.iso', stateImage, filesystemUrl, screenContainer, relayUrl, onStatus = () => {} } = config;

    onStatus('Creating emulator...');

    return new Promise((resolve, reject) => {
      // Use more memory if loading a state image (likely Arch or similar)
      const memorySize = stateImage ? 512 * 1024 * 1024 : 64 * 1024 * 1024;

      const v86Config: V86Config = {
        wasm_path: `${assetsPath}/v86.wasm`,
        memory_size: memorySize,
        vga_memory_size: 2 * 1024 * 1024,
        screen_container: screenContainer,
        bios: { url: `${assetsPath}/seabios.bin` },
        vga_bios: { url: `${assetsPath}/vgabios.bin` },
        cdrom: stateImage ? undefined : { url: `${assetsPath}/${linuxImage}` },
        autostart: true,
      };

      // If we have a pre-booted state, use it for instant boot
      if (stateImage) {
        v86Config.initial_state = { url: `${assetsPath}/${stateImage}` };
        onStatus('Loading pre-booted state...');
      }

      // 9p filesystem for Arch Linux etc.
      if (filesystemUrl) {
        v86Config.filesystem = { baseurl: filesystemUrl };
        onStatus('Using 9p filesystem...');
      }

      if (relayUrl) {
        v86Config.network_relay_url = relayUrl;
        this._networkRelay = relayUrl;
        onStatus('Creating emulator with network...');
      }

      this.emulator = new V86(v86Config);

      let booted = false;
      let sentEnter = false;
      let buffer = '';

      // All VM interaction happens over serial0. This listener handles both
      // boot detection and routing command output to the correct PendingRead.
      this.emulator.add_listener('serial0-output-byte', (byte: number) => {
        const char = String.fromCharCode(byte);
        buffer += char;
        if (buffer.length > 50000) buffer = buffer.slice(-25000);

        // If loading from state, we're already booted
        if (stateImage && !booted) {
          booted = true;
          onStatus('State loaded, ready!');
          // Give a moment for state to fully restore
          setTimeout(() => {
            this._ready = true;
            resolve();
          }, 500);
          return;
        }

        if (!booted) {
          if (!sentEnter && buffer.includes('Files send via emulator')) {
            sentEnter = true;
            onStatus('Starting shell...');
            setTimeout(() => this.emulator!.serial0_send('\n'), 500);
          }

          if (sentEnter && (buffer.includes('/ #') || buffer.includes('~%') || buffer.includes('# '))) {
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
              resolve();
            }, 500);
          }
          return;
        }

        // Route each serial byte to all in-flight command reads.
        // Each PendingRead watches for its own unique end marker.
        // Multiple commands can be in flight simultaneously since each
        // has a distinct marker that won't appear in other commands' output.
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

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  /** Parse output between markers, handling shell echo by searching for marker+newline */
  private parseMarkerOutput(
    raw: string,
    startMarker: string,
    endMarker: string,
    cwdMarker: string
  ): { output: string; cwd: string } {
    // Search for marker followed by newline to skip echoed command text
    // echo outputs "START_xxx\n" while the echoed command contains "echo START_xxx; ..."
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

  async execInShell(machineId: string, cmd: string): Promise<{ output: string; cwd: string }> {
    if (!this._ready || !this.emulator) {
      console.log('[VM] execInShell blocked - not ready');
      return { output: '', cwd: '/' };
    }

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

    console.log('[VM] execInShell:', machineId, cmd);
    this.emulator.serial0_send(fullCmd + '\n');

    const start = Date.now();
    while (!pending.done && Date.now() - start < 10000) {
      await this.sleep(50);
    }

    this.pendingReads.delete(jobId);

    const result = this.parseMarkerOutput(pending.output, startMarker, endMarker, cwdMarker);

    if (result.cwd) {
      shell!.cwd = result.cwd;
    }

    console.log('[VM] execInShell result:', JSON.stringify(result.output.slice(0, 100)));
    return { output: result.output, cwd: result.cwd || shell!.cwd };
  }

  async pipeInShell(machineId: string, input: string, command: string): Promise<{ output: string; cwd: string }> {
    if (!this._ready || !this.emulator) {
      console.log('[VM] pipeInShell blocked - not ready');
      return { output: '', cwd: '/' };
    }

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

    console.log('[VM] pipeInShell:', machineId, command, 'input:', JSON.stringify(input.slice(0, 30)));
    this.emulator.serial0_send(fullCmd + '\n');

    const start = Date.now();
    while (!pending.done && Date.now() - start < 15000) {
      await this.sleep(50);
    }

    this.pendingReads.delete(jobId);

    const result = this.parseMarkerOutput(pending.output, startMarker, endMarker, cwdMarker);

    if (result.cwd) {
      shell!.cwd = result.cwd;
    }

    console.log('[VM] pipeInShell result:', JSON.stringify(result.output.slice(0, 100)));
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
    this.shells.clear();
    this.pendingReads.clear();
  }
}
