import type { GameState } from '../game/state';
import type { Cell, Machine } from '../game/types';
import { CellType, MachineType, Direction } from '../game/types';

/**
 * Serializable format for saved games
 */
export interface SaveData {
  version: number;
  gridCols: number;
  gridRows: number;
  grid: SerializedCell[][];
  machines: SerializedMachine[];
  sourceText: string;
  sinkIdCounter: number;
}

interface SerializedCell {
  type: CellType;
  dir?: Direction;
  toggle?: number;
  machineIdx?: number; // Index into machines array
}

interface SerializedMachine {
  x: number;
  y: number;
  type: MachineType;
  command: string;
  autoStart: boolean;
  sinkId: number;
  emitInterval?: number;
  flipperTrigger?: string;
  flipperDir?: number;
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
      } else if (cell.type === CellType.SPLITTER) {
        serialized.dir = (cell as { dir: Direction; toggle: number }).dir;
        serialized.toggle = (cell as { toggle: number }).toggle;
      } else if (cell.type === CellType.MACHINE) {
        const machine = (cell as { machine: Machine }).machine;
        serialized.machineIdx = machineMap.get(machine);
      }

      grid[x][y] = serialized;
    }
  }

  // Serialize machines
  const machines: SerializedMachine[] = state.machines.map(m => ({
    x: m.x,
    y: m.y,
    type: m.type,
    command: m.command,
    autoStart: m.autoStart,
    sinkId: m.sinkId,
    emitInterval: m.emitInterval,
    flipperTrigger: m.flipperTrigger,
    flipperDir: m.flipperDir,
  }));

  return {
    version: SAVE_VERSION,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    grid,
    machines,
    sourceText: state.sourceText,
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
    const machine: Machine = {
      x: sm.x,
      y: sm.y,
      type: sm.type,
      command: sm.command,
      autoStart: sm.autoStart,
      sinkId: sm.sinkId,
      // Reset transient state
      displayBuffer: '',
      displayText: '',
      displayTime: 0,
      lastByteTime: 0,
      pendingInput: '',
      outputBuffer: '',
      processing: false,
      lastInputTime: 0,
      autoStartRan: false,
      cwd: '/',
      lastEmojiTime: 0,
      lastCommandTime: 0,
      emitInterval: sm.emitInterval ?? 500,
      lastEmitTime: 0,
      sourcePos: 0,
      flipperTrigger: sm.flipperTrigger ?? '\n',
      flipperDir: sm.flipperDir ?? 0,
      flipperState: sm.flipperDir ?? 0,
    };
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
        case CellType.SPLITTER:
          cell = { type: CellType.SPLITTER, dir: sc.dir ?? Direction.RIGHT, toggle: sc.toggle ?? 0 };
          break;
        case CellType.MACHINE:
          const machine = state.machines[sc.machineIdx ?? 0];
          cell = { type: CellType.MACHINE, machine };
          break;
        default:
          cell = { type: CellType.EMPTY };
      }
      state.grid[x][y] = cell;
    }
  }

  // Restore other state
  state.sourceText = data.sourceText ?? '';
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
