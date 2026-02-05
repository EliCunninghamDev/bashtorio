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

  // Assign sink ID for sink machines
  const sinkId = machineType === MachineType.SINK ? state.sinkIdCounter++ : 0;

  const machine: Machine = {
    x,
    y,
    type: machineType,
    command: 'cat',
    autoStart: false,
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
    sinkId,
    lastEmojiTime: 0,
    lastCommandTime: 0,
    emitInterval: 500,
    lastEmitTime: 0,
    sourcePos: 0,
    flipperTrigger: '\n',
    flipperDir: Direction.RIGHT,
    flipperState: Direction.RIGHT,
  };

  state.machines.push(machine);
  setCell(state, x, y, { type: CellType.MACHINE, machine });

  return machine;
}

export function getMachineAt(state: GameState, x: number, y: number): Machine | undefined {
  return state.machines.find(m => m.x === x && m.y === y);
}
