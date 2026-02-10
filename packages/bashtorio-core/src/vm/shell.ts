import type { V86Bridge } from './bridge';
import { encodeHex } from './commands';
import { createLogger } from '../util/logger';

const log = createLogger('Shell');

let shellIdCounter = 0;

/**
 * A persistent FIFO-based `sh` process running inside the VM guest.
 *
 * On `start()`, creates a named pipe (FIFO) and launches `sh` reading from it,
 * with stdout+stderr redirected to an output file readable via 9p.
 *
 * - `write(text)` sends data to the shell's stdin via the FIFO.
 * - `read()` returns new output bytes since the last read (non-blocking).
 * - `getCwd()` queries the shell's current working directory.
 */
export class ShellInstance {
  readonly id: string;
  private bridge: V86Bridge;
  private bytesRead = 0;
  private _started = false;

  constructor(bridge: V86Bridge, id?: string) {
    this.bridge = bridge;
    this.id = id ?? `sh_${shellIdCounter++}`;
    log.debug(`Created ${this.id}`);
  }

  get started(): boolean { return this._started; }

  /** Get the host-side 9p path for a file belonging to this shell */
  private filePath(suffix: string): string {
    return `${this.bridge.jobPrefix}/${this.id}_${suffix}`;
  }

  /** Get the guest-side path for a file belonging to this shell */
  private guestPath(suffix: string): string {
    return `${this.bridge.guestJobDir}/${this.id}_${suffix}`;
  }

  /**
   * Start the shell process in the guest.
   * Pre-creates the output file via 9p, sends setup command via serial.
   * Uses the same FIFO pattern as the old startStream: stdbuf -o0 sh <> FIFO > OUT 2>&1
   * No blocking wait — the shell is ready by the next poll cycle.
   */
  async start(initialCwd = '/'): Promise<void> {
    log.debug(`${this.id} starting (cwd: ${initialCwd}, jobPrefix: ${this.bridge.jobPrefix}, guestDir: ${this.bridge.guestJobDir})`);

    // Ensure host-side 9p directory exists and pre-create empty output file
    this.bridge.ensure9pDir(this.bridge.jobPrefix);
    await this.bridge.createFile(this.filePath('out'), new Uint8Array(0));

    const fifo = this.guestPath('fifo');
    const out = this.guestPath('out');
    const pid = this.guestPath('pid');
    const cmd = `mkfifo ${fifo}; (cd ${initialCwd} 2>/dev/null || cd /; stdbuf -o0 sh <> ${fifo} > ${out} 2>&1) & echo $! > ${pid}`;

    log.debug(`${this.id} sending serial cmd (${cmd.length} chars)`);
    this.bridge.sendSerial(cmd + '\n');

    this._started = true;
    this.bytesRead = 0;
    log.info(`${this.id} started (cwd: ${initialCwd})`);
  }

  /** Write text to the shell's stdin FIFO */
  write(text: string): void {
    if (!this._started) { log.debug(`${this.id} write() ignored — not started`); return; }
    const hex = encodeHex(text);
    log.debug(`${this.id} write(${text.length} chars) → hex(${hex.length} chars)`);
    this.bridge.sendSerial(`printf '%b' '${hex}' > ${this.guestPath('fifo')}\n`);
  }

  /** Read new output bytes since last read. Non-blocking — returns '' if nothing new. */
  async read(): Promise<string> {
    if (!this._started) return '';
    try {
      const data = await this.bridge.readFile(this.filePath('out'));
      if (data.byteLength > this.bytesRead) {
        const newBytes = data.slice(this.bytesRead);
        this.bytesRead = data.byteLength;
        const text = new TextDecoder().decode(newBytes);
        log.debug(`${this.id} read() → ${text.length} new chars (total ${data.byteLength}b)`);
        return text;
      }
    } catch (e) {
      log.debug(`${this.id} read() failed: ${e}`);
    }
    return '';
  }

  /** Query the shell's current working directory */
  async getCwd(): Promise<string> {
    if (!this._started) return '/';
    log.debug(`${this.id} getCwd() querying...`);
    this.write('pwd > ' + this.guestPath('cwd') + '\n');
    await new Promise(r => setTimeout(r, 150));
    try {
      const data = await this.bridge.readFile(this.filePath('cwd'));
      const cwd = new TextDecoder().decode(data).trim();
      log.debug(`${this.id} getCwd() → "${cwd}"`);
      return cwd || '/';
    } catch (e) {
      log.debug(`${this.id} getCwd() failed: ${e}`);
      return '/';
    }
  }

  /** Stop the shell process and clean up guest files */
  async stop(): Promise<void> {
    if (!this._started) { log.debug(`${this.id} stop() ignored — not started`); return; }
    this._started = false;
    const guestDir = this.bridge.guestJobDir;
    const id = this.id;
    log.debug(`${this.id} stopping — killing PID and cleaning up`);
    this.bridge.sendSerial(
      `kill $(cat ${guestDir}/${id}_pid) 2>/dev/null; rm -f ${guestDir}/${id}_fifo ${guestDir}/${id}_out ${guestDir}/${id}_pid ${guestDir}/${id}_cwd\n`
    );
    log.info(`${this.id} stopped`);
  }
}
