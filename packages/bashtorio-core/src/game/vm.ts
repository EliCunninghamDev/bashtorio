import { LinuxVM, type VMConfig, type ShellInstance } from '../vm';

let instance: LinuxVM | null = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function initVM(config: VMConfig): Promise<void> {
  instance = new LinuxVM();
  await instance.init(config);
}

export function destroyVM(): void {
  instance?.destroy();
  instance = null;
}

export async function testVM(onStatus?: (status: string) => void): Promise<boolean> {
  if (!instance) return false;
  return instance.test(onStatus);
}

export async function downloadState(filename?: string): Promise<void> {
  await instance?.downloadState(filename);
}

// ---------------------------------------------------------------------------
// Property accessors
// ---------------------------------------------------------------------------

export function isReady(): boolean {
  return instance?.ready ?? false;
}

export function isFs9pReady(): boolean {
  return instance?.fs9pReady ?? false;
}

export function getNetworkRelay(): string | null {
  return instance?.networkRelay ?? null;
}

// ---------------------------------------------------------------------------
// Shell creation (replaces old job/stream/exec API)
// ---------------------------------------------------------------------------

export function createShell(initialCwd?: string): Promise<ShellInstance> {
  return instance!.createShell(initialCwd);
}

// ---------------------------------------------------------------------------
// Escape hatch (for index.ts screen container setup)
// ---------------------------------------------------------------------------

export function getInstance(): LinuxVM | null {
  return instance;
}
