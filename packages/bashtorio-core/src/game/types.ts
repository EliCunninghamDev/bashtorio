// Grid and rendering constants
export const GRID_COLS = 32;
export const GRID_ROWS = 32;
export const GRID_SIZE = 48;
export const PACKET_SIZE = 32;
export const PACKET_SPEED = 2;

export enum Direction {
  RIGHT = 0,
  DOWN = 1,
  LEFT = 2,
  UP = 3,
}

export const DirDelta: Record<Direction, { dx: number; dy: number }> = {
  [Direction.RIGHT]: { dx: 1, dy: 0 },
  [Direction.DOWN]: { dx: 0, dy: 1 },
  [Direction.LEFT]: { dx: -1, dy: 0 },
  [Direction.UP]: { dx: 0, dy: -1 },
};

export const DirArrows = ['→', '↓', '←', '↑'] as const;

export enum CellType {
  EMPTY = 'empty',
  BELT = 'belt',
  SPLITTER = 'splitter',
  MACHINE = 'machine',
}

export enum MachineType {
  SOURCE = 'source',
  SINK = 'sink',
  COMMAND = 'command',
  DISPLAY = 'display',
  EMOJI = 'emoji',
  NULL = 'null',
  LINEFEED = 'linefeed',
  FLIPPER = 'flipper',
  DUPLICATOR = 'duplicator',
  CONSTANT = 'constant',
  FILTER = 'filter',
  COUNTER = 'counter',
  DELAY = 'delay',
  KEYBOARD = 'keyboard',
}

export interface EmptyCell {
  type: CellType.EMPTY;
}

export interface BeltCell {
  type: CellType.BELT;
  dir: Direction;
}

export interface SplitterCell {
  type: CellType.SPLITTER;
  dir: Direction;
  toggle: number;
}

export interface MachineCell {
  type: CellType.MACHINE;
  machine: Machine;
}

export type Cell = EmptyCell | BeltCell | SplitterCell | MachineCell;

export interface Machine {
  x: number;
  y: number;
  type: MachineType;
  command: string;
  autoStart: boolean;
  // For display machine
  displayBuffer: string;
  displayText: string;
  displayTime: number;
  lastByteTime: number;
  // For command machine
  pendingInput: string;
  outputBuffer: string;
  processing: boolean;
  lastInputTime: number;
  autoStartRan: boolean;
  cwd: string; // Current working directory
  // For sink machine
  sinkId: number;
  // For emoji machine
  lastEmojiTime: number;
  // Flash effect timestamp
  lastCommandTime: number;
  // For linefeed machine
  emitInterval: number;
  lastEmitTime: number;
  // For source machine
  sourcePos: number;
  // For flipper machine
  flipperTrigger: string;
  flipperDir: number;   // Initial direction (Direction), persisted
  flipperState: number; // Current runtime direction (Direction), reset on sim start
  // For constant machine
  constantText: string;
  constantInterval: number;
  constantPos: number;
  // For filter machine
  filterByte: string;
  filterMode: 'pass' | 'block';
  // For counter machine
  counterTrigger: string;
  counterCount: number;
  // For delay machine
  delayMs: number;
  delayQueue: { char: string; time: number }[];
}

export interface Packet {
  id: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  content: string;
  dir: Direction;
  waiting: boolean;
}

export type CursorMode = 'select' | 'erase' | 'machine';
export type PlaceableType = 'belt' | 'splitter' | 'source' | 'command' | 'sink' | 'display' | 'emoji' | 'null' | 'linefeed' | 'flipper' | 'duplicator' | 'constant' | 'filter' | 'counter' | 'delay' | 'keyboard';

export interface OrphanedPacket {
	id: number;
	worldX: number;
	worldY: number;
	vx: number;
	vy: number;
	content: string;
	age: number;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

// Legacy alias for backwards compatibility during migration
export type ToolType = CursorMode;
