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
  MACHINE = 'machine',
}

export enum MachineType {
  SOURCE = 'source',
  SINK = 'sink',
  COMMAND = 'command',
  DISPLAY = 'display',
  NULL = 'null',
  LINEFEED = 'linefeed',
  FLIPPER = 'flipper',
  DUPLICATOR = 'duplicator',
  CONSTANT = 'constant',
  FILTER = 'filter',
  COUNTER = 'counter',
  DELAY = 'delay',
  KEYBOARD = 'keyboard',
  PACKER = 'packer',
  UNPACKER = 'unpacker',
  ROUTER = 'router',
  GATE = 'gate',
  WIRELESS = 'wireless',
  REPLACE = 'replace',
  MATH = 'math',
  CLOCK = 'clock',
  LATCH = 'latch',
  MERGER = 'merger',
  SPLITTER = 'splitter',
  SEVENSEG = 'sevenseg',
}

export interface EmptyCell {
  type: CellType.EMPTY;
}

export interface BeltCell {
  type: CellType.BELT;
  dir: Direction;
}

export interface MachineCell {
  type: CellType.MACHINE;
  machine: Machine;
}

export type Cell = EmptyCell | BeltCell | MachineCell;

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
  name: string;
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

export interface NullMachine extends MachineBase {
  type: MachineType.NULL;
}

export interface LinefeedMachine extends MachineBase, EmitTimer {
  type: MachineType.LINEFEED;
}

export interface FlipperMachine extends MachineBase {
  type: MachineType.FLIPPER;
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

export interface PackerMachine extends MachineBase {
  type: MachineType.PACKER;
  packerDelimiter: string;
  preserveDelimiter: boolean;
  packerDir: Direction;
  accumulatedBuffer: string;
  outputBuffer: string;
}

export interface UnpackerMachine extends MachineBase {
  type: MachineType.UNPACKER;
  outputBuffer: string;
}

export type MathOp = 'add' | 'sub' | 'mul' | 'mod' | 'xor' | 'and' | 'or' | 'not';

export interface RouterMachine extends MachineBase {
  type: MachineType.ROUTER;
  routerByte: string;
  routerMatchDir: Direction;
  routerElseDir: Direction;
  matchBuffer: string;
  elseBuffer: string;
}

export interface GateMachine extends MachineBase {
  type: MachineType.GATE;
  gateDataDir: Direction;
  gateControlDir: Direction;
  gateOpen: boolean;
  outputBuffer: string;
}

export interface WirelessMachine extends MachineBase {
  type: MachineType.WIRELESS;
  wirelessChannel: number;
  outputBuffer: string;
}

export interface ReplaceMachine extends MachineBase {
  type: MachineType.REPLACE;
  replaceFrom: string;
  replaceTo: string;
  outputBuffer: string;
}

export interface MathMachine extends MachineBase {
  type: MachineType.MATH;
  mathOp: MathOp;
  mathOperand: number;
  outputBuffer: string;
}

export interface ClockMachine extends MachineBase, EmitTimer {
  type: MachineType.CLOCK;
  clockByte: string;
}

export interface LatchMachine extends MachineBase {
  type: MachineType.LATCH;
  latchDataDir: Direction;
  latchControlDir: Direction;
  latchStored: string;
  outputBuffer: string;
}

export interface MergerMachine extends MachineBase {
  type: MachineType.MERGER;
  outputBuffer: string;
}

export interface SplitterMachine extends MachineBase {
  type: MachineType.SPLITTER;
  dir: Direction;
  toggle: number;
  outputBuffer: string;
}

export interface SevenSegMachine extends MachineBase {
  type: MachineType.SEVENSEG;
  lastByte: number;
  outputBuffer: string;
}

export type Machine =
  | SourceMachine
  | SinkMachine
  | CommandMachine
  | DisplayMachine
  | NullMachine
  | LinefeedMachine
  | FlipperMachine
  | DuplicatorMachine
  | ConstantMachine
  | FilterMachine
  | CounterMachine
  | DelayMachine
  | KeyboardMachine
  | PackerMachine
  | UnpackerMachine
  | RouterMachine
  | GateMachine
  | WirelessMachine
  | ReplaceMachine
  | MathMachine
  | ClockMachine
  | LatchMachine
  | MergerMachine
  | SplitterMachine
  | SevenSegMachine;

export type BufferingMachine =
  | CommandMachine
  | FlipperMachine
  | DuplicatorMachine
  | FilterMachine
  | CounterMachine
  | DelayMachine
  | KeyboardMachine
  | PackerMachine
  | UnpackerMachine
  | GateMachine
  | WirelessMachine
  | ReplaceMachine
  | MathMachine
  | LatchMachine
  | MergerMachine
  | SplitterMachine
  | SevenSegMachine;

export function hasOutputBuffer(m: Machine): m is BufferingMachine {
  return 'outputBuffer' in m;
}

export type EmittingMachine = SourceMachine | LinefeedMachine | ConstantMachine | ClockMachine;

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
export type PlaceableType = 'belt' | 'splitter' | 'source' | 'command' | 'sink' | 'display' | 'null' | 'linefeed' | 'flipper' | 'duplicator' | 'constant' | 'filter' | 'counter' | 'delay' | 'keyboard' | 'packer' | 'unpacker' | 'router' | 'gate' | 'wireless' | 'replace' | 'math' | 'clock' | 'latch' | 'merger' | 'sevenseg';

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
