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

export interface MachineBase {
  x: number;
  y: number;
  lastCommandTime: number; // flash effect on byte receive
}

export interface EmitTimer {
  emitInterval: number;
  lastEmitTime: number;
}

export interface SourceMachine extends MachineBase, EmitTimer {
  type: MachineType.SOURCE;
  sourceText: string;
  sourcePos: number;
}

export interface SinkMachine extends MachineBase {
  type: MachineType.SINK;
  sinkId: number;
}

export interface CommandMachine extends MachineBase {
  type: MachineType.COMMAND;
  command: string;
  autoStart: boolean;
  stream: boolean;
  inputMode: 'pipe' | 'args';
  pendingInput: string;
  outputBuffer: string;
  processing: boolean;
  lastInputTime: number;
  autoStartRan: boolean;
  cwd: string;
  activeJobId: string;
  lastPollTime: number;
  bytesRead: number;
  streamBytesWritten: number;
  lastStreamWriteTime: number;
}

export interface DisplayMachine extends MachineBase {
  type: MachineType.DISPLAY;
  displayBuffer: string;
  displayText: string;
  displayTime: number;
  lastByteTime: number;
}

export interface EmojiMachine extends MachineBase {
  type: MachineType.EMOJI;
  lastEmojiTime: number;
}

export interface NullMachine extends MachineBase {
  type: MachineType.NULL;
}

export interface LinefeedMachine extends MachineBase, EmitTimer {
  type: MachineType.LINEFEED;
}

export interface FlipperMachine extends MachineBase {
  type: MachineType.FLIPPER;
  flipperTrigger: string;
  flipperDir: number;   // Initial direction (Direction), persisted
  flipperState: number; // Current runtime direction (Direction), reset on sim start
  outputBuffer: string;
}

export interface DuplicatorMachine extends MachineBase {
  type: MachineType.DUPLICATOR;
  outputBuffer: string;
}

export interface ConstantMachine extends MachineBase, EmitTimer {
  type: MachineType.CONSTANT;
  constantText: string;
  constantPos: number;
}

export interface FilterMachine extends MachineBase {
  type: MachineType.FILTER;
  filterByte: string;
  filterMode: 'pass' | 'block';
  outputBuffer: string;
}

export interface CounterMachine extends MachineBase {
  type: MachineType.COUNTER;
  counterTrigger: string;
  counterCount: number;
  outputBuffer: string;
}

export interface DelayMachine extends MachineBase {
  type: MachineType.DELAY;
  delayMs: number;
  delayQueue: { char: string; time: number }[];
  outputBuffer: string;
}

export interface KeyboardMachine extends MachineBase {
  type: MachineType.KEYBOARD;
  outputBuffer: string;
}

export type Machine =
  | SourceMachine
  | SinkMachine
  | CommandMachine
  | DisplayMachine
  | EmojiMachine
  | NullMachine
  | LinefeedMachine
  | FlipperMachine
  | DuplicatorMachine
  | ConstantMachine
  | FilterMachine
  | CounterMachine
  | DelayMachine
  | KeyboardMachine;

export type BufferingMachine =
  | CommandMachine
  | FlipperMachine
  | DuplicatorMachine
  | FilterMachine
  | CounterMachine
  | DelayMachine
  | KeyboardMachine;

export function hasOutputBuffer(m: Machine): m is BufferingMachine {
  return 'outputBuffer' in m;
}

export type EmittingMachine = SourceMachine | LinefeedMachine | ConstantMachine;

export function hasEmitTimer(m: Machine): m is EmittingMachine {
  return 'emitInterval' in m;
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
