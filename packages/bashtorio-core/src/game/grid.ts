import { CellType, MachineType, Direction, type Cell, type Machine, type MachineCell, type SplitterMachine } from './types';
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

export function getSplitterSecondary(m: { dir: Direction; x: number; y: number }): { x: number; y: number } {
  if (m.dir === Direction.RIGHT || m.dir === Direction.LEFT) {
    return { x: m.x, y: m.y + 1 };
  }
  return { x: m.x + 1, y: m.y };
}

export function placeSplitter(state: GameState, x: number, y: number, dir: Direction): SplitterMachine | null {
  const sec = getSplitterSecondary({ dir, x, y });
  const cell1 = getCell(state, x, y);
  const cell2 = getCell(state, sec.x, sec.y);
  if (!cell1 || cell1.type !== CellType.EMPTY) return null;
  if (!cell2 || cell2.type !== CellType.EMPTY) return null;

  const machine: SplitterMachine = {
    x, y, lastCommandTime: 0,
    type: MachineType.SPLITTER,
    dir,
    toggle: 0,
    outputBuffer: '',
  };
  state.machines.push(machine);
  setCell(state, x, y, { type: CellType.MACHINE, machine });
  setCell(state, sec.x, sec.y, { type: CellType.MACHINE, machine });
  return machine;
}

export function clearCell(state: GameState, x: number, y: number): void {
  const cell = getCell(state, x, y);
  if (!cell) return;

  if (cell.type === CellType.MACHINE) {
    const machineCell = cell as MachineCell;
    const machine = machineCell.machine;
    // Destroy shell session if it exists
    if (machine?.type === MachineType.COMMAND && state.vm) {
      const machineId = `m_${machine.x}_${machine.y}`;
      state.vm.destroyShell(machineId);
    }
    // For splitters, clear both cells
    if (machine?.type === MachineType.SPLITTER) {
      const sec = getSplitterSecondary(machine);
      setCell(state, machine.x, machine.y, { type: CellType.EMPTY });
      setCell(state, sec.x, sec.y, { type: CellType.EMPTY });
    } else {
      setCell(state, x, y, { type: CellType.EMPTY });
    }
    // Remove machine from list (use machine.x/y since clicked cell may be secondary)
    const idx = state.machines.findIndex(m => m === machine);
    if (idx !== -1) {
      state.machines.splice(idx, 1);
    }
    return;
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
    case MachineType.SINK: {
      const id = state.sinkIdCounter++;
      machine = { ...base, type: MachineType.SINK, sinkId: id, name: `Sink ${id}` };
      break;
    }
    case MachineType.COMMAND:
      machine = { ...base, type: MachineType.COMMAND, command: 'cat', autoStart: false, stream: false, inputMode: 'pipe', pendingInput: '', outputBuffer: '', processing: false, lastInputTime: 0, autoStartRan: false, cwd: '/', activeJobId: '', lastPollTime: 0, bytesRead: 0, streamBytesWritten: 0, lastStreamWriteTime: 0 };
      break;
    case MachineType.DISPLAY:
      machine = { ...base, type: MachineType.DISPLAY, displayBuffer: '', displayText: '', displayTime: 0, lastByteTime: 0 };
      break;
    case MachineType.NULL:
      machine = { ...base, type: MachineType.NULL };
      break;
    case MachineType.LINEFEED:
      machine = { ...base, type: MachineType.LINEFEED, emitInterval: 500, lastEmitTime: 0 };
      break;
    case MachineType.FLIPPER:
      machine = { ...base, type: MachineType.FLIPPER, flipperDir: Direction.RIGHT, flipperState: Direction.RIGHT, outputBuffer: '' };
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
    case MachineType.PACKER:
      machine = { ...base, type: MachineType.PACKER, packerDelimiter: '\n', preserveDelimiter: true, packerDir: Direction.RIGHT, accumulatedBuffer: '', outputBuffer: '' };
      break;
    case MachineType.UNPACKER:
      machine = { ...base, type: MachineType.UNPACKER, outputBuffer: '' };
      break;
    case MachineType.ROUTER:
      machine = { ...base, type: MachineType.ROUTER, routerByte: '\n', routerMatchDir: Direction.RIGHT, routerElseDir: Direction.DOWN, matchBuffer: '', elseBuffer: '' };
      break;
    case MachineType.GATE:
      machine = { ...base, type: MachineType.GATE, gateDataDir: Direction.LEFT, gateControlDir: Direction.UP, gateOpen: false, outputBuffer: '' };
      break;
    case MachineType.WIRELESS:
      machine = { ...base, type: MachineType.WIRELESS, wirelessChannel: 0, outputBuffer: '' };
      break;
    case MachineType.REPLACE:
      machine = { ...base, type: MachineType.REPLACE, replaceFrom: 'a', replaceTo: 'b', outputBuffer: '' };
      break;
    case MachineType.MATH:
      machine = { ...base, type: MachineType.MATH, mathOp: 'add', mathOperand: 1, outputBuffer: '' };
      break;
    case MachineType.CLOCK:
      machine = { ...base, type: MachineType.CLOCK, clockByte: '*', emitInterval: 1000, lastEmitTime: 0 };
      break;
    case MachineType.LATCH:
      machine = { ...base, type: MachineType.LATCH, latchDataDir: Direction.LEFT, latchControlDir: Direction.UP, latchStored: '', outputBuffer: '' };
      break;
    case MachineType.MERGER:
      machine = { ...base, type: MachineType.MERGER, outputBuffer: '' };
      break;
    case MachineType.SEVENSEG:
      machine = { ...base, type: MachineType.SEVENSEG, lastByte: -1, outputBuffer: '' };
      break;
    case MachineType.SPLITTER:
      // Splitters use placeSplitter() instead, but handle for exhaustiveness
      return null;
  }

  state.machines.push(machine);
  setCell(state, x, y, { type: CellType.MACHINE, machine });

  return machine;
}

export function getMachineAt(state: GameState, x: number, y: number): Machine | undefined {
  return state.machines.find(m => m.x === x && m.y === y);
}

/** Returns the axis-aligned bounding box of all machines, or null if none exist. */
export function getMachineBounds(state: GameState): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (state.machines.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of state.machines) {
    if (m.x < minX) minX = m.x;
    if (m.y < minY) minY = m.y;
    if (m.x > maxX) maxX = m.x;
    if (m.y > maxY) maxY = m.y;
    if (m.type === MachineType.SPLITTER) {
      const sec = getSplitterSecondary(m);
      if (sec.x > maxX) maxX = sec.x;
      if (sec.y > maxY) maxY = sec.y;
    }
  }
  return { minX, minY, maxX, maxY };
}
