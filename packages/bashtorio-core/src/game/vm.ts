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

export function createShell(machineId: string): Promise<number> {
  return instance!.createShell(machineId);
}

export function destroyShell(machineId: string): Promise<void> {
  return instance!.destroyShell(machineId);
}

// ---------------------------------------------------------------------------
// Job API
// ---------------------------------------------------------------------------

export function startJob(machineId: string, cmd: string, stdin?: string): Promise<string> {
  return instance!.startJob(machineId, cmd, stdin);
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

export function startStream(machineId: string, cmd: string): Promise<string> {
  return instance!.startStream(machineId, cmd);
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

export function execInShell(machineId: string, cmd: string, opts?: { forceSerial?: boolean }): Promise<{ output: string; cwd: string }> {
  return instance!.execInShell(machineId, cmd, opts);
}

export function pipeInShell(machineId: string, input: string, command: string, opts?: { forceSerial?: boolean }): Promise<{ output: string; cwd: string }> {
  return instance!.pipeInShell(machineId, input, command, opts);
}

// ---------------------------------------------------------------------------
// Escape hatch (for index.ts screen container setup)
// ---------------------------------------------------------------------------

export function getInstance(): LinuxVM | null {
  return instance;
}
