import { LinuxVM, type VMConfig } from '../vm';

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

export async function testVM(): Promise<boolean> {
  if (!instance) return false;
  return instance.test();
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
// Shell lifecycle
// ---------------------------------------------------------------------------

export function createShell(shellTag: string): Promise<number> {
  return instance!.createShell(shellTag);
}

export function destroyShell(shellTag: string): Promise<void> {
  return instance!.destroyShell(shellTag);
}

// ---------------------------------------------------------------------------
// Job API
// ---------------------------------------------------------------------------

export function startJob(shellTag: string, cmd: string, stdin?: string): Promise<string> {
  return instance!.startJob(shellTag, cmd, stdin);
}

export function pollJob(jobId: string): Promise<{ newOutput: string; done: boolean; exitCode: number | null; cwd: string }> {
  return instance!.pollJob(jobId);
}

export function cleanupJob(jobId: string): Promise<void> {
  return instance!.cleanupJob(jobId);
}

// ---------------------------------------------------------------------------
// Stream API
// ---------------------------------------------------------------------------

export function startStream(shellTag: string, cmd: string): Promise<string> {
  return instance!.startStream(shellTag, cmd);
}

export function writeToStream(jobId: string, data: string): void {
  instance!.writeToStream(jobId, data);
}

export function stopStream(jobId: string): Promise<void> {
  return instance!.stopStream(jobId);
}

// ---------------------------------------------------------------------------
// Legacy exec
// ---------------------------------------------------------------------------

export function execInShell(shellTag: string, cmd: string, opts?: { forceSerial?: boolean }): Promise<{ output: string; cwd: string }> {
  return instance!.execInShell(shellTag, cmd, opts);
}

export function pipeInShell(shellTag: string, input: string, command: string, opts?: { forceSerial?: boolean }): Promise<{ output: string; cwd: string }> {
  return instance!.pipeInShell(shellTag, input, command, opts);
}

// ---------------------------------------------------------------------------
// Escape hatch (for index.ts screen container setup)
// ---------------------------------------------------------------------------

export function getInstance(): LinuxVM | null {
  return instance;
}
