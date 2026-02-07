import type { GameState } from '../game/state';
import type { Cell, Machine, MathOp } from '../game/types';
import { CellType, MachineType, Direction } from '../game/types';
import { getSplitterSecondary } from '../game/grid';

/**
 * Serializable format for saved games
 */
export interface SaveData {
  version: number;
  gridCols: number;
  gridRows: number;
  grid: SerializedCell[][];
  machines: SerializedMachine[];
  sourceText?: string;
  sinkIdCounter: number;
}

interface SerializedCell {
  type: CellType;
  dir?: Direction;
  machineIdx?: number; // Index into machines array
}

interface SerializedMachine {
  x: number;
  y: number;
  type: MachineType;
  command: string;
  autoStart: boolean;
  sinkId: number;
  name?: string;
  emitInterval?: number;
  flipperTrigger?: string; // legacy: old saves used this
  flipperDir?: number;
  constantText?: string;
  constantInterval?: number; // legacy: old saves used this for CONSTANT
  filterByte?: string;
  filterMode?: 'pass' | 'block';
  counterTrigger?: string;
  delayMs?: number;
  stream?: boolean;
  async?: boolean; // legacy: old saves used this for stream
  inputMode?: 'pipe' | 'args';
  sourceText?: string;
  packerDelimiter?: string;
  preserveDelimiter?: boolean;
  packerDir?: number;
  routerByte?: string;
  routerMatchDir?: number;
  routerElseDir?: number;
  gateDataDir?: number;
  gateControlDir?: number;
  wirelessChannel?: number;
  replaceFrom?: string;
  replaceTo?: string;
  mathOp?: MathOp;
  mathOperand?: number;
  clockByte?: string;
  latchDataDir?: number;
  latchControlDir?: number;
  splitterDir?: number;
}

const SAVE_VERSION = 1;

/**
 * Serialize game state to JSON-compatible object
 */
export function serializeState(state: GameState): SaveData {
  // Create machine index map
  const machineMap = new Map<Machine, number>();
  state.machines.forEach((m, idx) => machineMap.set(m, idx));

  // Serialize grid
  const grid: SerializedCell[][] = [];
  for (let x = 0; x < state.gridCols; x++) {
    grid[x] = [];
    for (let y = 0; y < state.gridRows; y++) {
      const cell = state.grid[x][y];
      const serialized: SerializedCell = { type: cell.type };

      if (cell.type === CellType.BELT) {
        serialized.dir = (cell as { dir: Direction }).dir;
      } else if (cell.type === CellType.MACHINE) {
        const machine = (cell as { machine: Machine }).machine;
        serialized.machineIdx = machineMap.get(machine);
      }

      grid[x][y] = serialized;
    }
  }

  // Serialize machines
  const machines: SerializedMachine[] = state.machines.map(m => {
    const base: SerializedMachine = { x: m.x, y: m.y, type: m.type, command: '', autoStart: false, sinkId: 0 };
    switch (m.type) {
      case MachineType.SOURCE:
        base.emitInterval = m.emitInterval;
        base.sourceText = m.sourceText;
        break;
      case MachineType.SINK:
        base.sinkId = m.sinkId;
        base.name = m.name;
        break;
      case MachineType.COMMAND:
        base.command = m.command;
        base.autoStart = m.autoStart;
        base.stream = m.stream;
        if (m.inputMode !== 'pipe') base.inputMode = m.inputMode;
        break;
      case MachineType.LINEFEED:
        base.emitInterval = m.emitInterval;
        break;
      case MachineType.FLIPPER:
        base.flipperDir = m.flipperDir;
        break;
      case MachineType.CONSTANT:
        base.constantText = m.constantText;
        base.emitInterval = m.emitInterval;
        break;
      case MachineType.FILTER:
        base.filterByte = m.filterByte;
        base.filterMode = m.filterMode;
        break;
      case MachineType.COUNTER:
        base.counterTrigger = m.counterTrigger;
        break;
      case MachineType.DELAY:
        base.delayMs = m.delayMs;
        break;
      case MachineType.PACKER:
        base.packerDelimiter = m.packerDelimiter;
        base.preserveDelimiter = m.preserveDelimiter;
        base.packerDir = m.packerDir;
        break;
      case MachineType.ROUTER:
        base.routerByte = m.routerByte;
        base.routerMatchDir = m.routerMatchDir;
        base.routerElseDir = m.routerElseDir;
        break;
      case MachineType.GATE:
        base.gateDataDir = m.gateDataDir;
        base.gateControlDir = m.gateControlDir;
        break;
      case MachineType.WIRELESS:
        base.wirelessChannel = m.wirelessChannel;
        break;
      case MachineType.REPLACE:
        base.replaceFrom = m.replaceFrom;
        base.replaceTo = m.replaceTo;
        break;
      case MachineType.MATH:
        base.mathOp = m.mathOp;
        base.mathOperand = m.mathOperand;
        break;
      case MachineType.CLOCK:
        base.clockByte = m.clockByte;
        base.emitInterval = m.emitInterval;
        break;
      case MachineType.LATCH:
        base.latchDataDir = m.latchDataDir;
        base.latchControlDir = m.latchControlDir;
        break;
      case MachineType.SPLITTER:
        base.splitterDir = m.dir;
        break;
      case MachineType.SEVENSEG:
        break;
    }
    return base;
  });

  return {
    version: SAVE_VERSION,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    grid,
    machines,
    sinkIdCounter: state.sinkIdCounter,
  };
}

/**
 * Deserialize saved data into game state
 */
export function deserializeState(state: GameState, data: SaveData): void {
  if (data.version !== SAVE_VERSION) {
    console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${data.version}`);
  }

  // Clear existing state
  state.machines = [];
  state.packets = [];
  state.running = false;

  // Restore grid dimensions
  state.gridCols = data.gridCols;
  state.gridRows = data.gridRows;
  state.grid = [];

  // Restore machines first (we need them for grid references)
  for (const sm of data.machines) {
    const base = { x: sm.x, y: sm.y, lastCommandTime: 0 };
    let machine: Machine;
    switch (sm.type) {
      case MachineType.SOURCE:
        machine = {
          ...base,
          type: MachineType.SOURCE,
          sourceText: sm.sourceText ?? data.sourceText ?? '',
          sourcePos: 0,
          emitInterval: sm.emitInterval ?? 500,
          lastEmitTime: 0,
        };
        break;
      case MachineType.SINK:
        machine = {
          ...base,
          type: MachineType.SINK,
          sinkId: sm.sinkId,
          name: sm.name ?? `Sink ${sm.sinkId}`,
        };
        break;
      case MachineType.COMMAND:
        machine = {
          ...base,
          type: MachineType.COMMAND,
          command: sm.command,
          autoStart: sm.autoStart,
          stream: sm.stream ?? sm.async ?? false,
          inputMode: sm.inputMode ?? 'pipe',
          pendingInput: '',
          outputBuffer: '',
          processing: false,
          lastInputTime: 0,
          autoStartRan: false,
          cwd: '/',
          activeJobId: '',
          lastPollTime: 0,
          bytesRead: 0,
          streamBytesWritten: 0,
          lastStreamWriteTime: 0,
        };
        break;
      case MachineType.DISPLAY:
        machine = {
          ...base,
          type: MachineType.DISPLAY,
          displayBuffer: '',
          displayText: '',
          displayTime: 0,
          lastByteTime: 0,
        };
        break;
      case MachineType.NULL:
        machine = { ...base, type: MachineType.NULL };
        break;
      case MachineType.LINEFEED:
        machine = {
          ...base,
          type: MachineType.LINEFEED,
          emitInterval: sm.emitInterval ?? 500,
          lastEmitTime: 0,
        };
        break;
      case MachineType.FLIPPER:
        machine = {
          ...base,
          type: MachineType.FLIPPER,
          flipperDir: sm.flipperDir ?? 0,
          flipperState: sm.flipperDir ?? 0,
          outputBuffer: '',
        };
        break;
      case MachineType.DUPLICATOR:
        machine = { ...base, type: MachineType.DUPLICATOR, outputBuffer: '' };
        break;
      case MachineType.CONSTANT:
        machine = {
          ...base,
          type: MachineType.CONSTANT,
          constantText: sm.constantText ?? 'hello\n',
          emitInterval: sm.emitInterval ?? sm.constantInterval ?? 500,
          constantPos: 0,
          lastEmitTime: 0,
        };
        break;
      case MachineType.FILTER:
        machine = {
          ...base,
          type: MachineType.FILTER,
          filterByte: sm.filterByte ?? '\n',
          filterMode: sm.filterMode ?? 'pass',
          outputBuffer: '',
        };
        break;
      case MachineType.COUNTER:
        machine = {
          ...base,
          type: MachineType.COUNTER,
          counterTrigger: sm.counterTrigger ?? '\n',
          counterCount: 0,
          outputBuffer: '',
        };
        break;
      case MachineType.DELAY:
        machine = {
          ...base,
          type: MachineType.DELAY,
          delayMs: sm.delayMs ?? 1000,
          delayQueue: [],
          outputBuffer: '',
        };
        break;
      case MachineType.KEYBOARD:
        machine = { ...base, type: MachineType.KEYBOARD, outputBuffer: '' };
        break;
      case MachineType.UNPACKER:
        machine = { ...base, type: MachineType.UNPACKER, outputBuffer: '' };
        break;
      case MachineType.PACKER:
        machine = {
          ...base,
          type: MachineType.PACKER,
          packerDelimiter: sm.packerDelimiter ?? '\n',
          preserveDelimiter: sm.preserveDelimiter ?? true,
          packerDir: sm.packerDir ?? Direction.RIGHT,
          accumulatedBuffer: '',
          outputBuffer: '',
        };
        break;
      case MachineType.ROUTER:
        machine = {
          ...base,
          type: MachineType.ROUTER,
          routerByte: sm.routerByte ?? '\n',
          routerMatchDir: sm.routerMatchDir ?? Direction.RIGHT,
          routerElseDir: sm.routerElseDir ?? Direction.DOWN,
          matchBuffer: '',
          elseBuffer: '',
        };
        break;
      case MachineType.GATE:
        machine = {
          ...base,
          type: MachineType.GATE,
          gateDataDir: sm.gateDataDir ?? Direction.LEFT,
          gateControlDir: sm.gateControlDir ?? Direction.UP,
          gateOpen: false,
          outputBuffer: '',
        };
        break;
      case MachineType.WIRELESS:
        machine = {
          ...base,
          type: MachineType.WIRELESS,
          wirelessChannel: sm.wirelessChannel ?? 0,
          outputBuffer: '',
        };
        break;
      case MachineType.REPLACE:
        machine = {
          ...base,
          type: MachineType.REPLACE,
          replaceFrom: sm.replaceFrom ?? 'a',
          replaceTo: sm.replaceTo ?? 'b',
          outputBuffer: '',
        };
        break;
      case MachineType.MATH:
        machine = {
          ...base,
          type: MachineType.MATH,
          mathOp: sm.mathOp ?? 'add',
          mathOperand: sm.mathOperand ?? 1,
          outputBuffer: '',
        };
        break;
      case MachineType.CLOCK:
        machine = {
          ...base,
          type: MachineType.CLOCK,
          clockByte: sm.clockByte ?? '*',
          emitInterval: sm.emitInterval ?? 1000,
          lastEmitTime: 0,
        };
        break;
      case MachineType.LATCH:
        machine = {
          ...base,
          type: MachineType.LATCH,
          latchDataDir: sm.latchDataDir ?? Direction.LEFT,
          latchControlDir: sm.latchControlDir ?? Direction.UP,
          latchStored: '',
          outputBuffer: '',
        };
        break;
      case MachineType.MERGER:
        machine = { ...base, type: MachineType.MERGER, outputBuffer: '' };
        break;
      case MachineType.SPLITTER:
        machine = {
          ...base,
          type: MachineType.SPLITTER,
          dir: sm.splitterDir ?? Direction.RIGHT,
          toggle: 0,
          outputBuffer: '',
        };
        break;
      case MachineType.SEVENSEG:
        machine = { ...base, type: MachineType.SEVENSEG, lastByte: -1, outputBuffer: '' };
        break;
      default:
        // Fallback for unknown types in old saves
        machine = { ...base, type: MachineType.NULL };
        break;
    }
    state.machines.push(machine);
  }

  // Restore grid
  for (let x = 0; x < data.gridCols; x++) {
    state.grid[x] = [];
    for (let y = 0; y < data.gridRows; y++) {
      const sc = data.grid[x]?.[y];
      if (!sc) {
        state.grid[x][y] = { type: CellType.EMPTY };
        continue;
      }

      let cell: Cell;
      switch (sc.type) {
        case CellType.BELT:
          cell = { type: CellType.BELT, dir: sc.dir ?? Direction.RIGHT };
          break;
        case CellType.MACHINE: {
          const machine = state.machines[sc.machineIdx ?? 0];
          cell = { type: CellType.MACHINE, machine };
          break;
        }
        default:
          // Handles CellType.EMPTY and legacy CellType.SPLITTER (now a machine)
          cell = { type: CellType.EMPTY };
      }
      state.grid[x][y] = cell;
    }
  }

  // Post-load fixup: ensure splitter secondary cells are set
  for (const machine of state.machines) {
    if (machine.type === MachineType.SPLITTER) {
      const sec = getSplitterSecondary(machine);
      if (sec.x >= 0 && sec.x < state.gridCols && sec.y >= 0 && sec.y < state.gridRows) {
        state.grid[sec.x][sec.y] = { type: CellType.MACHINE, machine };
      }
    }
  }

  // Restore other state
  state.sinkIdCounter = data.sinkIdCounter ?? 1;
}

/**
 * Download save data as JSON file
 */
export function downloadSave(state: GameState, filename = 'bashtorio-save.json'): void {
  const data = serializeState(state);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Load save data from JSON file (returns Promise)
 */
/**
 * Compress a Uint8Array using deflate-raw via CompressionStream.
 */
async function compress(input: Uint8Array): Promise<Uint8Array> {
	const cs = new CompressionStream('deflate-raw');
	const writer = cs.writable.getWriter();
	writer.write(input.buffer as ArrayBuffer);
	writer.close();
	const chunks: Uint8Array[] = [];
	const reader = cs.readable.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const total = chunks.reduce((n, c) => n + c.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}

/**
 * Decompress a deflate-raw Uint8Array via DecompressionStream.
 */
async function decompress(input: Uint8Array): Promise<Uint8Array> {
	const ds = new DecompressionStream('deflate-raw');
	const writer = ds.writable.getWriter();
	writer.write(input.buffer as ArrayBuffer);
	writer.close();
	const chunks: Uint8Array[] = [];
	const reader = ds.readable.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const total = chunks.reduce((n, c) => n + c.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}

/**
 * Encode save data as a compressed, base64url string (URL-safe, no padding).
 */
export async function saveToBase64(state: GameState): Promise<string> {
	const data = serializeState(state);
	const json = JSON.stringify(data);
	const encoded = new TextEncoder().encode(json);
	const compressed = await compress(encoded);
	// Convert to base64url
	let binary = '';
	for (let i = 0; i < compressed.length; i++) {
		binary += String.fromCharCode(compressed[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string into SaveData.
 */
export async function loadFromBase64(base64: string): Promise<SaveData> {
	// Restore standard base64 from base64url
	const std = base64.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(std);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const decompressed = await decompress(bytes);
	const json = new TextDecoder().decode(decompressed);
	return JSON.parse(json) as SaveData;
}

/**
 * Check the current URL for a "factory" query parameter and decode it as base64 SaveData.
 * Returns null if the parameter is absent or invalid.
 */
export async function loadFromURLParam(): Promise<SaveData | null> {
	const params = new URLSearchParams(window.location.search);
	const factory = params.get('factory');
	if (!factory) return null;
	try {
		return await loadFromBase64(factory);
	} catch (e) {
		console.error('Failed to load factory from URL:', e);
		return null;
	}
}

export function uploadSave(): Promise<SaveData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as SaveData;
          resolve(data);
        } catch (e) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.click();
  });
}
