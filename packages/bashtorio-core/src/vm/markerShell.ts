import type { ShellInstance } from './shell'
import { shellEscape } from './commands'

/**
 * Thin wrapper around a ShellInstance that encapsulates the
 * `__S_N__` / `__E_N__` marker protocol used by non-stream COMMAND machines.
 *
 * Owns the command counter, raw output buffer, and marker parsing logic —
 * keeping simulation.ts focused on orchestration.
 */
export class MarkerShell {
  private shell: ShellInstance
  private counter = 0
  private rawBuffer = ''
  private _lastExecTime = 0

  constructor(shell: ShellInstance) {
    this.shell = shell
  }

  /** Timestamp (performance.now()) of the most recent exec/execBare call */
  get lastExecTime(): number { return this._lastExecTime }

  /** Wrap a command with input and markers, write to shell */
  exec(command: string, input: string, inputMode: 'pipe' | 'args'): void {
    const n = this.counter++
    const startM = `__S_${n}__`
    const endM = `__E_${n}__`

    let cmd: string
    if (inputMode === 'args') {
      cmd = `${command} '${shellEscape(input)}'`
    } else {
      cmd = `printf '%s' '${shellEscape(input)}' | ${command}`
    }

    this._lastExecTime = performance.now()
    this.shell.write(`echo '${startM}'; ${cmd}; echo '${endM}'\n`)
  }

  /** Wrap a bare command (no input) with markers, write to shell */
  execBare(command: string): void {
    const n = this.counter++
    const startM = `__S_${n}__`
    const endM = `__E_${n}__`
    this._lastExecTime = performance.now()
    this.shell.write(`echo '${startM}'; ${command}; echo '${endM}'\n`)
  }

  /**
   * Read from shell, parse markers. Returns extracted output or null if
   * no complete marker pair found yet.
   */
  async poll(): Promise<string | null> {
    const output = await this.shell.read()
    if (output) this.rawBuffer += output

    const endPattern = /__E_\d+__\n?/
    const endMatch = this.rawBuffer.match(endPattern)
    if (!endMatch) return null

    const startPattern = /__S_\d+__\n?/
    const startMatch = this.rawBuffer.match(startPattern)
    if (!startMatch) return null

    const startIdx = this.rawBuffer.indexOf(startMatch[0]) + startMatch[0].length
    const endIdx = this.rawBuffer.indexOf(endMatch[0])
    const cmdOutput = this.rawBuffer.substring(startIdx, endIdx)

    // Remove everything up to and including the end marker
    const beforeStart = this.rawBuffer.substring(0, this.rawBuffer.indexOf(startMatch[0]))
    const afterEnd = this.rawBuffer.substring(endIdx + endMatch[0].length)
    this.rawBuffer = beforeStart + afterEnd

    if (cmdOutput.length === 0) return ''
    return cmdOutput.endsWith('\n') ? cmdOutput : cmdOutput + '\n'
  }

  /** Reset internal state (counter, buffer) */
  reset(): void {
    this.counter = 0
    this.rawBuffer = ''
  }
}
