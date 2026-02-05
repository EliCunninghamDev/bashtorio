import { CellType, MachineType, Direction, type Cell, type Machine, type MachineCell } from './types';
import type { GameState } from './state';

export function initGrid(state: GameState, cols: number, rows: number): void {
  state.gridCols = cols;
  state.gridRows = rows;
  state.grid = [];

  for (let x = 0; x < cols; x++) {
    state.grid[x] = [];
    for (let y = 0; y < rows; y++) {
      state.grid[x][y] = { type: CellType.EMPTY };
    }
  }
}

export function getCell(state: GameState, x: number, y: number): Cell | null {
  if (x < 0 || x >= state.gridCols || y < 0 || y >= state.gridRows) {
    return null;
  }
  return state.grid[x][y];
}

export function setCell(state: GameState, x: number, y: number, cell: Cell): void {
  if (x >= 0 && x < state.gridCols && y >= 0 && y < state.gridRows) {
    state.grid[x][y] = cell;
  }
}

export function placeBelt(state: GameState, x: number, y: number, dir: Direction): void {
  const cell = getCell(state, x, y);
  if (!cell || cell.type === CellType.MACHINE) return;
  setCell(state, x, y, { type: CellType.BELT, dir });
}

export function placeSplitter(state: GameState, x: number, y: number, dir: Direction): void {
  const cell = getCell(state, x, y);
  if (!cell || cell.type === CellType.MACHINE) return;
  setCell(state, x, y, { type: CellType.SPLITTER, dir, toggle: 0 });
}

export function clearCell(state: GameState, x: number, y: number): void {
  const cell = getCell(state, x, y);
  if (!cell) return;

  if (cell.type === CellType.MACHINE) {
    const machineCell = cell as MachineCell;
    // Destroy shell session if it exists
    if (machineCell.machine?.type === MachineType.COMMAND && state.vm) {
      const machineId = `m_${x}_${y}`;
      state.vm.destroyShell(machineId);
    }
    // Remove machine from list
    const idx = state.machines.findIndex(m => m.x === x && m.y === y);
    if (idx !== -1) {
      state.machines.splice(idx, 1);
    }
  }

  setCell(state, x, y, { type: CellType.EMPTY });
}

export function placeMachine(state: GameState, x: number, y: number, machineType: MachineType): Machine | null {
  const cell = getCell(state, x, y);
  if (!cell || cell.type === CellType.MACHINE) return null;

  const base = { x, y, lastCommandTime: 0 };

  let machine: Machine;
  switch (machineType) {
    case MachineType.SOURCE:
      machine = { ...base, type: MachineType.SOURCE, sourceText: 'Hello World!\n', sourcePos: 0, emitInterval: 500, lastEmitTime: 0 };
      break;
    case MachineType.SINK:
      machine = { ...base, type: MachineType.SINK, sinkId: state.sinkIdCounter++ };
      break;
    case MachineType.COMMAND:
      machine = { ...base, type: MachineType.COMMAND, command: 'cat', autoStart: false, stream: false, inputMode: 'pipe', pendingInput: '', outputBuffer: '', processing: false, lastInputTime: 0, autoStartRan: false, cwd: '/', activeJobId: '', lastPollTime: 0, bytesRead: 0, streamBytesWritten: 0, lastStreamWriteTime: 0 };
      break;
    case MachineType.DISPLAY:
      machine = { ...base, type: MachineType.DISPLAY, displayBuffer: '', displayText: '', displayTime: 0, lastByteTime: 0 };
      break;
    case MachineType.EMOJI:
      machine = { ...base, type: MachineType.EMOJI, lastEmojiTime: 0 };
      break;
    case MachineType.NULL:
      machine = { ...base, type: MachineType.NULL };
      break;
    case MachineType.LINEFEED:
      machine = { ...base, type: MachineType.LINEFEED, emitInterval: 500, lastEmitTime: 0 };
      break;
    case MachineType.FLIPPER:
      machine = { ...base, type: MachineType.FLIPPER, flipperTrigger: '\n', flipperDir: Direction.RIGHT, flipperState: Direction.RIGHT, outputBuffer: '' };
      break;
    case MachineType.DUPLICATOR:
      machine = { ...base, type: MachineType.DUPLICATOR, outputBuffer: '' };
      break;
    case MachineType.CONSTANT:
      machine = { ...base, type: MachineType.CONSTANT, constantText: 'hello\n', emitInterval: 500, constantPos: 0, lastEmitTime: 0 };
      break;
    case MachineType.FILTER:
      machine = { ...base, type: MachineType.FILTER, filterByte: '\n', filterMode: 'pass', outputBuffer: '' };
      break;
    case MachineType.COUNTER:
      machine = { ...base, type: MachineType.COUNTER, counterTrigger: '\n', counterCount: 0, outputBuffer: '' };
      break;
    case MachineType.DELAY:
      machine = { ...base, type: MachineType.DELAY, delayMs: 1000, delayQueue: [], outputBuffer: '' };
      break;
    case MachineType.KEYBOARD:
      machine = { ...base, type: MachineType.KEYBOARD, outputBuffer: '' };
      break;
  }

  state.machines.push(machine);
  setCell(state, x, y, { type: CellType.MACHINE, machine });

  return machine;
}

export function getMachineAt(state: GameState, x: number, y: number): Machine | undefined {
  return state.machines.find(m => m.x === x && m.y === y);
}
