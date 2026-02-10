export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }

let _level: LogLevel = 'info'

export function setLogLevel(level: LogLevel): void { _level = level }
export function getLogLevel(): LogLevel { return _level }

const noop = () => {}

export function createLogger(tag: string): Logger {
  return {
    get debug() { return LEVELS[_level] <= LEVELS.debug ? console.debug.bind(console, `[${tag}] DEBUG`) : noop },
    get info() { return LEVELS[_level] <= LEVELS.info ? console.log.bind(console, `[${tag}] INFO`) : noop },
    get warn() { return LEVELS[_level] <= LEVELS.warn ? console.warn.bind(console, `[${tag}] WARN`) : noop },
    get error() { return LEVELS[_level] <= LEVELS.error ? console.error.bind(console, `[${tag}] ERROR`) : noop },
  }
}
