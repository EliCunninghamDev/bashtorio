import type { GameState } from '../game/state';
import type { Machine, MathOp } from '../game/types';
import { CellType, MachineType, Direction } from '../game/types';
import { EmitTimer } from '../game/clock';
import {
  clearGrid,
  forEachNonEmpty, getMachineIndex, getBeltDir,
  setBelt, setMachineCell,
} from '../game/grid';
import { getSplitterSecondary } from '../game/edit';
import { machines, getSinkIdCounter, setSinkIdCounter, getCommandIdCounter, setCommandIdCounter, clearMachines } from '../game/machines';
import { emitGameEvent, onGameEvent } from '../events/bus';
import { PRESETS } from './presets';
import { createLogger } from './logger';

const log = createLogger('Save');

/**
 * Serializable format for saved games (v2: sparse cell list)
 */
export interface SaveData {
  version: number;
  cells?: SerializedCellV2[];       // v2: sparse cell list
  gridCols?: number;                 // v1 compat
  gridRows?: number;                 // v1 compat
  grid?: SerializedCellV1[][];       // v1 compat
  machines: SerializedMachine[];
  sourceText?: string;
  sinkIdCounter: number;
  commandIdCounter?: number;
  beltSpeed?: number;
}

/** V1 cell format (dense 2D array) */
interface SerializedCellV1 {
  type: string | number;  // string in v1 saves, numeric in current CellType
  dir?: Direction;
  machineIdx?: number;
}

/** V2 cell format (sparse list) */
interface SerializedCellV2 {
  x: number;
  y: number;
  type: string;           // 'belt' | 'machine'
  dir?: number;
  machineIdx?: number;
}

interface SerializedMachine {
  x: number;
  y: number;
  type: MachineType;
  command: string;
  label?: string;
  autoStart: boolean;
  sinkId: number;
  name?: string;
  emitInterval?: number;
  flipperTrigger?: string; // legacy: old saves used this
  flipperDir?: number;
  constantText?: string;
  constantInterval?: number; // legacy: old saves used this for CONSTANT
  loop?: boolean;
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
  waveform?: string;
  dutyCycle?: number;
  noiseMode?: string;
  gapInterval?: number;
  speakRate?: number;
  speakPitch?: number;
  speakDelimiter?: string;
  screenResolution?: number;
  screenBuffer?: number[];
  screenWritePos?: number;
  byteData?: number[];
  byteInterval?: number;
  cardData?: number[];
  bitmask?: boolean;
  tntPacketCount?: number;
  tntStored?: string[];
  tntExploded?: boolean;
  buttonByte?: string;
  buttonChannel?: number;
}

const SAVE_VERSION = 2;

/**
 * Serialize game state to JSON-compatible object (v2 sparse format)
 */
export function serializeState(state: GameState): SaveData {
  // Create machine index map
  const machineMap = new Map<Machine, number>();
  machines.forEach((m, idx) => machineMap.set(m, idx));

  // Build sparse cell list
  const cells: SerializedCellV2[] = [];
  forEachNonEmpty((x, y, cellType) => {
    if (cellType === CellType.BELT) {
      cells.push({ x, y, type: 'belt', dir: getBeltDir(x, y) });
    } else if (cellType === CellType.MACHINE) {
      const mi = getMachineIndex(x, y);
      cells.push({ x, y, type: 'machine', machineIdx: mi });
    }
  });

  // Serialize machines
  const serializedMachines: SerializedMachine[] = machines.map(m => {
    const base: SerializedMachine = { x: m.x, y: m.y, type: m.type, command: '', autoStart: false, sinkId: 0 };
    switch (m.type) {
      case MachineType.SOURCE:
        base.emitInterval = m.clock.interval;
        base.sourceText = m.sourceText;
        base.loop = m.loop;
        if (m.gapTimer.interval > 0) base.gapInterval = m.gapTimer.interval;
        break;
      case MachineType.SINK:
        base.sinkId = m.sinkId;
        base.name = m.name;
        break;
      case MachineType.COMMAND:
        base.command = m.command;
        base.label = m.label;
        base.autoStart = m.autoStart;
        base.stream = m.stream;
        if (m.inputMode !== 'pipe') base.inputMode = m.inputMode;
        break;
      case MachineType.LINEFEED:
        base.emitInterval = m.clock.interval;
        break;
      case MachineType.FLIPPER:
        base.flipperDir = m.flipperDir;
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
        base.emitInterval = m.clock.interval;
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
      case MachineType.DRUM:
        base.bitmask = m.bitmask;
        break;
      case MachineType.TONE:
        base.waveform = m.waveform;
        if (m.dutyCycle !== 0.5) base.dutyCycle = m.dutyCycle;
        break;
      case MachineType.NOISE:
        base.noiseMode = m.noiseMode;
        break;
      case MachineType.SPEAK:
        base.speakRate = m.speakRate;
        base.speakPitch = m.speakPitch;
        base.speakDelimiter = m.speakDelimiter;
        break;
      case MachineType.SCREEN:
        base.screenResolution = m.resolution;
        base.screenBuffer = Array.from(m.buffer);
        base.screenWritePos = m.writePos;
        break;
      case MachineType.BYTE:
        base.byteData = Array.from(m.byteData);
        base.emitInterval = m.clock.interval;
        if (m.gapTimer.interval > 0) base.gapInterval = m.gapTimer.interval;
        break;
      case MachineType.PUNCHCARD:
        base.cardData = Array.from(m.cardData);
        base.emitInterval = m.clock.interval;
        if (m.gapTimer.interval > 0) base.gapInterval = m.gapTimer.interval;
        base.loop = m.loop;
        break;
      case MachineType.TNT:
        break;
      case MachineType.BUTTON:
        base.buttonByte = m.buttonByte;
        base.buttonChannel = m.buttonChannel;
        break;
    }
    return base;
  });

  return {
    version: SAVE_VERSION,
    cells,
    machines: serializedMachines,
    sinkIdCounter: getSinkIdCounter(),
    commandIdCounter: getCommandIdCounter(),
    beltSpeed: state.beltSpeed,
  };
}

/** Map v1 string cell types to CellType enum values */
function parseCellType(t: string | number): CellType {
  if (typeof t === 'number') return t as CellType;
  switch (t) {
    case 'belt': return CellType.BELT;
    case 'machine': return CellType.MACHINE;
    default: return CellType.EMPTY;
  }
}

export function clearState(state: GameState): void {
  emitGameEvent('endSimulation');
  clearGrid();
  clearMachines();
  state.packets = [];
  state.orphanedPackets = [];
  emitGameEvent('selectPlaceable', { placeable: 'belt' });
}

/**
 * Deserialize saved data into game state (v1 + v2 compat)
 */
export function deserializeState(state: GameState, data: SaveData): void {
  clearState(state);

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
          clock: new EmitTimer(sm.emitInterval ?? 500),
          gapTimer: new EmitTimer(sm.gapInterval ?? 0),
          loop: sm.loop ?? true,
        };
        break;
      case MachineType.SINK:
        machine = {
          ...base,
          type: MachineType.SINK,
          sinkId: sm.sinkId,
          name: sm.name ?? `Sink ${sm.sinkId}`,
          drainRing: [],
          drainHead: 0,
        };
        break;
      case MachineType.COMMAND:
        machine = {
          ...base,
          type: MachineType.COMMAND,
          label: sm.label ?? `Shell ${sm.x},${sm.y}`,
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
          shell: null,
          pollPending: false,
          bytesIn: 0,
          bytesOut: 0,
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
          clock: new EmitTimer(sm.emitInterval ?? 500),
        };
        break;
      case MachineType.FLIPPER:
        machine = {
          ...base,
          type: MachineType.FLIPPER,
          flipperDir: sm.flipperDir ?? 0,
          flipperState: sm.flipperDir ?? 0,
          outputQueue: [],
        };
        break;
      case MachineType.DUPLICATOR:
        machine = { ...base, type: MachineType.DUPLICATOR, outputQueue: [] };
        break;
      case 'constant' as MachineType:
        machine = {
          ...base,
          type: MachineType.SOURCE,
          sourceText: sm.constantText ?? 'hello\n',
          sourcePos: 0,
          clock: new EmitTimer(sm.emitInterval ?? sm.constantInterval ?? 500),
          gapTimer: new EmitTimer(sm.gapInterval ?? 0),
          loop: true,
        };
        break;
      case MachineType.FILTER:
        machine = {
          ...base,
          type: MachineType.FILTER,
          filterByte: sm.filterByte ?? '\n',
          filterMode: sm.filterMode ?? 'pass',
          outputQueue: [],
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
          outputQueue: [],
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
          matchQueue: [],
          elseQueue: [],
        };
        break;
      case MachineType.GATE:
        machine = {
          ...base,
          type: MachineType.GATE,
          gateDataDir: sm.gateDataDir ?? Direction.LEFT,
          gateControlDir: sm.gateControlDir ?? Direction.UP,
          gateOpen: false,
          outputQueue: [],
        };
        break;
      case MachineType.WIRELESS:
        machine = {
          ...base,
          type: MachineType.WIRELESS,
          wirelessChannel: sm.wirelessChannel ?? 0,
          wifiArc: 0,
          outputQueue: [],
        };
        break;
      case MachineType.REPLACE:
        machine = {
          ...base,
          type: MachineType.REPLACE,
          replaceFrom: sm.replaceFrom ?? 'a',
          replaceTo: sm.replaceTo ?? 'b',
          outputBuffer: '',
          lastActivation: 0,
          animationProgress: 0,
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
          clock: new EmitTimer(sm.emitInterval ?? 1000),
        };
        break;
      case MachineType.LATCH:
        machine = {
          ...base,
          type: MachineType.LATCH,
          latchDataDir: sm.latchDataDir ?? Direction.LEFT,
          latchControlDir: sm.latchControlDir ?? Direction.UP,
          latchStored: '',
          outputQueue: [],
        };
        break;

      case MachineType.SPLITTER:
        machine = {
          ...base,
          type: MachineType.SPLITTER,
          dir: sm.splitterDir ?? Direction.RIGHT,
          toggle: 0,
          outputQueue: [],
        };
        break;
      case MachineType.SEVENSEG:
        machine = { ...base, type: MachineType.SEVENSEG, lastByte: -1, outputQueue: [] };
        break;
      case MachineType.DRUM:
        machine = { ...base, type: MachineType.DRUM, bitmask: sm.bitmask ?? false, outputQueue: [] };
        break;
      case MachineType.TONE:
        machine = { ...base, type: MachineType.TONE, waveform: (sm.waveform ?? 'sine') as OscillatorType, dutyCycle: sm.dutyCycle ?? 0.5 };
        break;
      case MachineType.NOISE:
        machine = { ...base, type: MachineType.NOISE, noiseMode: (sm.noiseMode ?? '15bit') as '15bit' | '7bit' };
        break;
      case MachineType.SPEAK:
        machine = {
          ...base,
          type: MachineType.SPEAK,
          speakRate: sm.speakRate ?? 1,
          speakPitch: sm.speakPitch ?? 1,
          speakDelimiter: sm.speakDelimiter ?? '\n',
          accumulatedBuffer: '',
          displayText: '',
          displayTime: 0,
        };
        break;
      case MachineType.SCREEN: {
        const res = (sm.screenResolution ?? 8) as 8 | 16 | 32;
        const bufSize = (res * res) / 8;
        const buf = sm.screenBuffer ? new Uint8Array(sm.screenBuffer) : new Uint8Array(bufSize);
        machine = {
          ...base,
          type: MachineType.SCREEN,
          resolution: res,
          buffer: buf,
          writePos: sm.screenWritePos ?? 0,
        };
        break;
      }
      case MachineType.BYTE:
        machine = {
          ...base,
          type: MachineType.BYTE,
          byteData: sm.byteData ? new Uint8Array(sm.byteData) : new Uint8Array(0),
          bytePos: 0,
          clock: new EmitTimer(sm.emitInterval ?? 500),
          gapTimer: new EmitTimer(sm.gapInterval ?? 0),
        };
        break;
      case MachineType.PUNCHCARD:
        machine = {
          ...base,
          type: MachineType.PUNCHCARD,
          cardData: sm.cardData ? new Uint8Array(sm.cardData) : new Uint8Array(0),
          cardPos: 0,
          clock: new EmitTimer(sm.emitInterval ?? 500),
          gapTimer: new EmitTimer(sm.gapInterval ?? 0),
          loop: sm.loop ?? false,
        };
        break;
      case MachineType.TNT:
        machine = {
          ...base,
          type: MachineType.TNT,
          packetCount: 0,
          stored: [],
          exploded: false,
        };
        break;
      case MachineType.BUTTON:
        machine = {
          ...base,
          type: MachineType.BUTTON,
          buttonByte: sm.buttonByte ?? '1',
          buttonChannel: sm.buttonChannel ?? 0,
          outputQueue: [],
        };
        break;
      default:
        // Fallback for unknown types in old saves
        machine = { ...base, type: MachineType.NULL };
        break;
    }
    machines.push(machine);
  }

  // Restore grid: detect v1 (has `grid` 2D array) vs v2 (has `cells` list)
  if (data.cells) {
    // V2: sparse cell list
    for (const sc of data.cells) {
      if (sc.type === 'belt') {
        setBelt(sc.x, sc.y, sc.dir ?? Direction.RIGHT);
      } else if (sc.type === 'machine') {
        setMachineCell(sc.x, sc.y, sc.machineIdx ?? 0);
      }
    }
  } else if (data.grid) {
    // V1: dense 2D array (backward compat)
    const cols = data.gridCols ?? data.grid.length;
    const rows = data.gridRows ?? (data.grid[0]?.length ?? 0);
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const sc = data.grid[x]?.[y];
        if (!sc) continue;
        const ct = parseCellType(sc.type);
        if (ct === CellType.BELT) {
          setBelt(x, y, sc.dir ?? Direction.RIGHT);
        } else if (ct === CellType.MACHINE) {
          setMachineCell(x, y, sc.machineIdx ?? 0);
        }
      }
    }
  }

  // Post-load fixup: ensure splitter secondary cells are set
  for (let i = 0; i < machines.length; i++) {
    const machine = machines[i];
    if (machine.type === MachineType.SPLITTER) {
      const sec = getSplitterSecondary(machine);
      setMachineCell(sec.x, sec.y, i);
    }
  }

  // Restore other state
  setSinkIdCounter(data.sinkIdCounter ?? 1);
  setCommandIdCounter(data.commandIdCounter ?? 1);
  state.beltSpeed = data.beltSpeed ?? 2;
  emitGameEvent('beltSpeedChanged', { beltSpeed: state.beltSpeed });
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
		log.error('Failed to load factory from URL:', e);
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

export function setupSaveLoadHandlers(
  state: GameState,
): void {
  onGameEvent('clearAll', () => clearState(state));

  onGameEvent('requestSave', () => downloadSave(state));

  onGameEvent('requestLoad', async () => {
    try {
      const data = await uploadSave();
      deserializeState(state, data);
      emitGameEvent('saveLoaded', { source: 'file' });
    } catch (e) {
      log.error('Failed to load save:', e);
      alert('Failed to load save file: ' + (e instanceof Error ? e.message : String(e)));
    }
  });

  onGameEvent('requestLoadURL', async () => {
    const data = await loadFromURLParam();
    if (data) {
      deserializeState(state, data);
      emitGameEvent('saveLoaded', { source: 'url' });
    }
  });

  onGameEvent('requestCopyLink', async () => {
    const base64 = await saveToBase64(state);
    const url = new URL(window.location.href);
    url.searchParams.set('factory', base64);
    navigator.clipboard.writeText(url.toString()).then(
      () => emitGameEvent('toast', { message: 'Factory link copied to clipboard' }),
      () => emitGameEvent('toast', { message: 'Failed to copy link' }),
    );
  });

  onGameEvent('saveLoaded', ({ source }) => {
    const messages: Record<string, string> = {
      url: 'Loaded save from URL',
      file: 'Loaded save from file',
      preset: 'Loaded preset',
    };
    const msg = messages[source];
    if (msg) emitGameEvent('toast', { message: msg });
  });

  onGameEvent('loadPresetByName', ({ id }) => {
    const preset = PRESETS.find(p => p.id === id);
    if (!preset) return;
    deserializeState(state, preset.data);
    emitGameEvent('saveLoaded', { source: 'preset' });
  });
}
