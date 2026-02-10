import { V86 } from '#v86';
import type { V86Emulator, V86Config } from '../types/v86';
import type { VMConfig } from './LinuxVM';
import { createLogger } from '../util/logger';

const log = createLogger('VM');

// VM configuration
const MEMORY_SIZE = 512 * 1024 * 1024;
const VGA_MEMORY_SIZE = 2 * 1024 * 1024;
const KERNEL_CMDLINE = 'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable console=ttyS0';

// Timing (ms)
const BOOT_TIMEOUT = 120_000;
const SNAPSHOT_SETTLE_DELAY = 1000;
const NETWORK_DELAY = 2000;
const LOGIN_SEND_DELAY = 500;
const SHELL_CONFIG_DELAY = 500;
const CMD_STEP_DELAY = 100;

// Serial prompts that indicate boot stages
const LOGIN_PROMPTS = ['Files send via emulator', 'localhost login:'];
const SHELL_PROMPTS = ['/ #', '~%', '# ', 'localhost:~#'];

// Serial buffer limits
const SERIAL_BUF_MAX = 50_000;
const SERIAL_BUF_TRIM = 25_000;

// Guest filesystem paths
const GUEST_BASE = '/tmp/bashtorio';
const GUEST_JOBS = `${GUEST_BASE}/jobs`;
// 9p host-side paths (relative to 9p root, no leading slash)
const HOST_BASE = 'tmp/bashtorio';
const HOST_JOBS = `${HOST_BASE}/jobs`;

/**
 * Low-level wrapper around the v86 emulator.
 * Owns the emulator lifecycle, serial I/O, 9p filesystem, and state management.
 */
export class V86Bridge {
  private emulator: V86Emulator | null = null;
  private _ready = false;
  private _fs9pReady = false;
  private _networkRelay: string | null = null;

  get ready(): boolean { return this._ready; }
  get fs9pReady(): boolean { return this._fs9pReady; }
  get networkRelay(): string | null { return this._networkRelay; }

  /** 9p host-side path prefix for job/shell files */
  get jobPrefix(): string { return HOST_JOBS; }

  /** Guest filesystem path for job/shell files */
  get guestJobDir(): string { return GUEST_JOBS; }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(config: VMConfig): Promise<void> {
    const {
      vmAssetsUrl, vmSnapshot, rootfsBaseUrl,
      rootfsManifest, screenContainer, networkRelayUrl, preloadBuffers, onStatus = () => {},
    } = config;

    onStatus('Creating emulator...');

    // Resolve state buffer before creating emulator (needs await)
    let resolvedStateBuffer: ArrayBuffer | undefined;
    if (vmSnapshot) {
      const stateUrl = vmSnapshot.startsWith('http') ? vmSnapshot : `${vmAssetsUrl}/${vmSnapshot}`;
      resolvedStateBuffer = preloadBuffers?.[stateUrl];
      if (!resolvedStateBuffer) {
        log.warn(`Preloaded state buffer not found for "${stateUrl}", keys: [${preloadBuffers ? Object.keys(preloadBuffers).join(', ') : 'none'}]`);
        const brUrl = `${stateUrl}.br`;
        try {
          onStatus('Downloading compressed state...');
          const res = await fetch(brUrl);
          if (res.ok && res.body) {
            onStatus('Decompressing state...');
            const decompressed = res.body.pipeThrough(new DecompressionStream('br' as CompressionFormat));
            resolvedStateBuffer = await new Response(decompressed).arrayBuffer();
            log.info(`Fetched and decompressed state from ${brUrl} (${(resolvedStateBuffer.byteLength / 1048576).toFixed(1)} MB)`);
          }
        } catch (e) {
          log.warn(`Failed to fetch/decompress ${brUrl}:`, e);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const v86Config: V86Config = {
        wasm_path: `${vmAssetsUrl}/v86.wasm`,
        memory_size: MEMORY_SIZE,
        vga_memory_size: VGA_MEMORY_SIZE,
        screen_container: screenContainer,
        bios: { url: `${vmAssetsUrl}/seabios.bin` },
        vga_bios: { url: `${vmAssetsUrl}/vgabios.bin` },
        autostart: true,
        filesystem: {
          basefs: `${vmAssetsUrl}/${rootfsManifest}`,
          baseurl: rootfsBaseUrl || `${vmAssetsUrl}/alpine-rootfs-flat/`,
        },
        bzimage_initrd_from_filesystem: true,
        cmdline: KERNEL_CMDLINE,
      };

      if (vmSnapshot) {
        const stateUrl = vmSnapshot.startsWith('http') ? vmSnapshot : `${vmAssetsUrl}/${vmSnapshot}`;
        if (resolvedStateBuffer) {
          v86Config.initial_state = { buffer: resolvedStateBuffer };
          log.info(`Using state buffer (${(resolvedStateBuffer.byteLength / 1048576).toFixed(1)} MB)`);
        } else {
          v86Config.initial_state = { url: stateUrl };
          log.warn(`Falling back to direct URL fetch: ${stateUrl}`);
        }
        onStatus('Restoring state...');
      }

      if (networkRelayUrl) {
        v86Config.network_relay_url = networkRelayUrl;
        this._networkRelay = networkRelayUrl;
        onStatus('Creating emulator with network...');
      }

      this.emulator = new V86(v86Config) as V86Emulator;

      if (vmSnapshot) {
        onStatus('Restoring state...');
        setTimeout(async () => {
          try {
            if (this._networkRelay) {
              onStatus('Configuring network...');
              this.emulator!.serial0_send('[ -e /sys/class/net/eth0 ] && udhcpc -i eth0 2>/dev/null &\n');
              await this.sleep(NETWORK_DELAY);
            }
            this._ready = true;
            onStatus('State loaded, ready!');
            await this.mount9p(onStatus);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, SNAPSHOT_SETTLE_DELAY);
      }

      let booted = !!vmSnapshot;
      let sentEnter = false;
      let buffer = '';

      this.emulator.add_listener('serial0-output-byte', (byte: number) => {
        const char = String.fromCharCode(byte);
        buffer += char;
        if (buffer.length > SERIAL_BUF_MAX) buffer = buffer.slice(-SERIAL_BUF_TRIM);

        if (!booted) {
          if (!sentEnter && LOGIN_PROMPTS.some(p => buffer.includes(p))) {
            sentEnter = true;
            onStatus('Starting shell...');
            setTimeout(() => this.emulator!.serial0_send('\n'), LOGIN_SEND_DELAY);
          }

          if (sentEnter && SHELL_PROMPTS.some(p => buffer.includes(p))) {
            booted = true;
            onStatus('Configuring...');
            setTimeout(async () => {
              try {
                this.emulator!.serial0_send('stty -echo\n');
                await this.sleep(CMD_STEP_DELAY);
                this.emulator!.serial0_send('PS1=""\n');
                await this.sleep(CMD_STEP_DELAY);
                this.emulator!.serial0_send(`mkdir -p ${GUEST_BASE}\n`);
                await this.sleep(CMD_STEP_DELAY);

                if (this._networkRelay) {
                  onStatus('Configuring network...');
                  this.emulator!.serial0_send('[ -e /sys/class/net/eth0 ] && udhcpc -i eth0 2>/dev/null &\n');
                  await this.sleep(NETWORK_DELAY);
                }

                this._ready = true;
                await this.mount9p(onStatus);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, SHELL_CONFIG_DELAY);
          }
        }
      });

      setTimeout(() => {
        if (!booted) reject(new Error('Boot timeout'));
      }, BOOT_TIMEOUT);
    });
  }

  destroy(): void {
    if (this.emulator) {
      this.emulator.destroy();
      this.emulator = null;
    }
    this._ready = false;
    this._fs9pReady = false;
  }

  // ---------------------------------------------------------------------------
  // Serial I/O
  // ---------------------------------------------------------------------------

  sendSerial(text: string): void {
    log.debug(`sendSerial(${text.length} chars): ${text.slice(0, 120).replace(/\n/g, '\\n')}${text.length > 120 ? '...' : ''}`);
    this.emulator?.serial0_send(text);
  }

  waitForSerial(marker: string, timeoutMs = 30000): Promise<void> {
    log.debug(`waitForSerial("${marker}", ${timeoutMs}ms)`);
    return new Promise((resolve, reject) => {
      let buf = '';
      let bytesReceived = 0;
      const timer = setTimeout(() => {
        this.emulator!.remove_listener('serial0-output-byte', onByte);
        log.warn(`Timed out waiting for serial marker "${marker}" after ${timeoutMs}ms — received ${bytesReceived} bytes, buf tail: "${buf.slice(-200).replace(/\n/g, '\\n')}"`);
        reject(new Error(`9p: timed out waiting for serial marker`));
      }, timeoutMs);

      const onByte = (byte: number) => {
        buf += String.fromCharCode(byte);
        bytesReceived++;
        if (bytesReceived <= 5 || bytesReceived % 500 === 0) {
          log.debug(`waitForSerial("${marker}") received ${bytesReceived} bytes so far`);
        }
        if (buf.includes(marker)) {
          clearTimeout(timer);
          this.emulator!.remove_listener('serial0-output-byte', onByte);
          log.debug(`Serial marker "${marker}" received after ${bytesReceived} bytes`);
          resolve();
        }
        if (buf.length > 1000) buf = buf.slice(-500);
      };

      this.emulator!.add_listener('serial0-output-byte', onByte);
    });
  }

  // ---------------------------------------------------------------------------
  // 9p Filesystem
  // ---------------------------------------------------------------------------

  readFile(path: string): Promise<Uint8Array> {
    if (!this.emulator) return Promise.reject(new Error('Emulator not initialized'));
    return this.emulator.read_file(path);
  }

  createFile(path: string, data: Uint8Array): Promise<void> {
    if (!this.emulator) return Promise.reject(new Error('Emulator not initialized'));
    return this.emulator.create_file(path, data);
  }

  ensure9pDir(path: string): void {
    const fs = this.emulator?.fs9p;
    if (!fs) return;

    let parentId = 0;
    for (const part of path.split('/').filter(Boolean)) {
      let childId = fs.Search(parentId, part);
      if (childId === -1) {
        childId = fs.CreateDirectory(part, parentId);
        log.debug(`Created 9p dir "${part}" (inode ${childId})`);
      }
      parentId = childId;
    }
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  async saveState(): Promise<ArrayBuffer> {
    if (!this.emulator) throw new Error('Emulator not initialized');
    return this.emulator.save_state();
  }

  async downloadState(filename = 'bashtorio-state.bin'): Promise<void> {
    const state = await this.saveState();
    const blob = new Blob([state], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    log.info(`State saved: ${filename} (${(state.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  }

  setKeyboardEnabled(enabled: boolean): void {
    this.emulator?.keyboard_set_status(enabled);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private async mount9p(onStatus: (status: string) => void): Promise<void> {
    if (!this.emulator) return;

    const marker = `__9p_ok_${Date.now()}__`;

    log.info('Setting up 9p job directory...');
    onStatus('Setting up 9p job directory...');
    this.ensure9pDir(HOST_JOBS);
    const ready = this.waitForSerial(marker);
    this.emulator.serial0_send(`mkdir -p ${GUEST_JOBS} && echo ${marker}\n`);
    await ready;
    this._fs9pReady = true;
    log.info('9p filesystem ready');
    onStatus('Ready!');
  }

  debug9pTree(level = 6): void {
    const fs = this.emulator?.fs9p;
    if (!fs) { log.debug('9p: no filesystem'); return; }

    const S_IFDIR = 0x4000;
    const lines: string[] = [];

    const walk = (id: number, prefix: string, depth: number) => {
      if (depth > level) return;
      const inode = fs.inodes[id];
      if (!inode || !inode.direntries) return;
      for (const [name, childId] of inode.direntries) {
        if (name === '.' || name === '..') continue;
        const child = fs.inodes[childId];
        if (!child) continue;
        const isDir = (child.mode & S_IFDIR) !== 0;
        lines.push(`${prefix}${isDir ? name + '/' : name} (${child.size}b)`);
        if (isDir) walk(childId, prefix + '  ', depth + 1);
      }
    };

    walk(0, '  ', 0);
    log.debug(`9p tree (${lines.length} entries):\n` + lines.join('\n'));
  }
}
