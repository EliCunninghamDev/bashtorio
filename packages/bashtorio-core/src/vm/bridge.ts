import { V86 } from '#v86';
import type { V86Emulator, V86Config } from '../types/v86';
import type { VMConfig } from './LinuxVM';
import { createLogger } from '../util/logger';

const log = createLogger('VM');

/**
 * Low-level wrapper around the v86 emulator.
 * Owns the emulator lifecycle, serial I/O, 9p filesystem, and state management.
 */
export class V86Bridge {
  private emulator: V86Emulator | null = null;
  private _ready = false;
  private _fs9pReady = false;
  private _fs9pRoot = false;
  private _networkRelay: string | null = null;

  get ready(): boolean { return this._ready; }
  get fs9pReady(): boolean { return this._fs9pReady; }
  get fs9pRoot(): boolean { return this._fs9pRoot; }
  get networkRelay(): string | null { return this._networkRelay; }

  /** 9p host-side path prefix for job/shell files */
  get jobPrefix(): string {
    return this._fs9pRoot ? 'tmp/bashtorio/jobs' : 'jobs';
  }

  /** Guest filesystem path for job/shell files */
  get guestJobDir(): string {
    return this._fs9pRoot ? '/tmp/bashtorio/jobs' : '/mnt/host/jobs';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(config: VMConfig): Promise<void> {
    const {
      vmAssetsUrl, bootIso = 'linux4.iso', vmSnapshot, rootfsBaseUrl,
      rootfsManifest, screenContainer, networkRelayUrl, onStatus = () => {},
    } = config;

    onStatus('Creating emulator...');
    this._fs9pRoot = !!rootfsManifest;

    return new Promise((resolve, reject) => {
      const memorySize = 512 * 1024 * 1024;

      let v86Config: V86Config;

      if (rootfsManifest) {
        v86Config = {
          wasm_path: `${vmAssetsUrl}/v86.wasm`,
          memory_size: memorySize,
          vga_memory_size: 2 * 1024 * 1024,
          screen_container: screenContainer,
          bios: { url: `${vmAssetsUrl}/seabios.bin` },
          vga_bios: { url: `${vmAssetsUrl}/vgabios.bin` },
          autostart: true,
          filesystem: {
            basefs: `${vmAssetsUrl}/${rootfsManifest}`,
            baseurl: rootfsBaseUrl || `${vmAssetsUrl}/alpine-rootfs-flat/`,
          },
          bzimage_initrd_from_filesystem: true,
          cmdline: 'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable console=ttyS0',
        };
      } else {
        v86Config = {
          wasm_path: `${vmAssetsUrl}/v86.wasm`,
          memory_size: memorySize,
          vga_memory_size: 2 * 1024 * 1024,
          screen_container: screenContainer,
          bios: { url: `${vmAssetsUrl}/seabios.bin` },
          vga_bios: { url: `${vmAssetsUrl}/vgabios.bin` },
          cdrom: { url: `${vmAssetsUrl}/${bootIso}` },
          autostart: true,
          filesystem: rootfsBaseUrl ? { baseurl: rootfsBaseUrl } : {},
        };
      }

      if (vmSnapshot) {
        v86Config.initial_state = { url: vmSnapshot.startsWith('http') ? vmSnapshot : `${vmAssetsUrl}/${vmSnapshot}` };
        delete v86Config.cdrom;
        onStatus('Loading pre-booted state...');
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
              await this.sleep(2000);
            }
            this._ready = true;
            onStatus('State loaded, ready!');
            await this.mount9p(onStatus);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 1000);
      }

      let booted = !!vmSnapshot;
      let sentEnter = false;
      let buffer = '';

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
              try {
                this.emulator!.serial0_send('stty -echo\n');
                await this.sleep(100);
                this.emulator!.serial0_send('PS1=""\n');
                await this.sleep(100);
                this.emulator!.serial0_send('mkdir -p /tmp/bashtorio\n');
                await this.sleep(100);

                if (this._networkRelay) {
                  onStatus('Configuring network...');
                  this.emulator!.serial0_send('[ -e /sys/class/net/eth0 ] && udhcpc -i eth0 2>/dev/null &\n');
                  await this.sleep(2000);
                }

                this._ready = true;
                await this.mount9p(onStatus);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, 500);
          }
        }
      });

      setTimeout(() => {
        if (!booted) reject(new Error('Boot timeout'));
      }, 120000);
    });
  }

  destroy(): void {
    if (this.emulator) {
      this.emulator.destroy();
      this.emulator = null;
    }
    this._ready = false;
    this._fs9pReady = false;
    this._fs9pRoot = false;
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
    this.debug9pTree();

    if (this._fs9pRoot) {
      log.info('Setting up 9p-root job directory...');
      onStatus('Setting up 9p job directory...');
      this.ensure9pDir('tmp/bashtorio/jobs');
      const ready = this.waitForSerial(marker);
      this.emulator.serial0_send(`mkdir -p /tmp/bashtorio/jobs && echo ${marker}\n`);
      await ready;
      this.debug9pTree();
      this._fs9pReady = true;
      log.info('9p-root filesystem ready');
      onStatus('Ready!');
    } else {
      log.info('Mounting legacy 9p filesystem...');
      onStatus('Mounting 9p filesystem...');
      const ready = this.waitForSerial(marker);
      this.emulator.serial0_send(`mkdir -p /mnt/host && mount -t 9p -o trans=virtio,version=9p2000.L host9p /mnt/host 2>/dev/null; mkdir -p /mnt/host/jobs && printf '1' > /mnt/host/jobs/.ready && echo ${marker}\n`);
      await ready;
      const data = await this.emulator.read_file('jobs/.ready');
      if (data[0] !== 49) throw new Error('9p: verification mismatch');
      this._fs9pReady = true;
      log.info('9p filesystem ready');
      onStatus('Ready!');
    }
  }

  private debug9pTree(): void {
    const fs = this.emulator?.fs9p;
    if (!fs) { log.debug('9p: no filesystem'); return; }

    const S_IFDIR = 0x4000;
    const lines: string[] = [];

    const walk = (id: number, prefix: string, depth: number) => {
      if (depth > 6) return;
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
