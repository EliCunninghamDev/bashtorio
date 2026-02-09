// Grid and rendering constants
export const DEFAULT_GRID_COLS = 32;
export const DEFAULT_GRID_ROWS = 32;
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
  EMPTY = 0,
  BELT = 1,
  MACHINE = 2,
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

  SPLITTER = 'splitter',
  SEVENSEG = 'sevenseg',
  DRUM = 'drum',
  TONE = 'tone',
  SPEAK = 'speak',
  SCREEN = 'screen',
  BYTE = 'byte',
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
  gapInterval: number;
  gapRemaining: number;
}

export const SINK_DRAIN_SLOTS = 12;
export const SINK_DRAIN_MS = 800;

export interface SinkDrainEntry { char: string; time: number }

export interface SinkMachine extends MachineBase {
  type: MachineType.SINK;
  sinkId: number;
  name: string;
  drainRing: SinkDrainEntry[];
  drainHead: number;
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
  outputQueue: string[];
}

export interface DuplicatorMachine extends MachineBase {
  type: MachineType.DUPLICATOR;
  outputBuffer: string;
}

export interface ConstantMachine extends MachineBase, EmitTimer {
  type: MachineType.CONSTANT;
  constantText: string;
  constantPos: number;
  gapInterval: number;
  gapRemaining: number;
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
  wifiArc: number;
  outputBuffer: string;
}

export interface ReplaceMachine extends MachineBase {
  type: MachineType.REPLACE;
  replaceFrom: string;
  replaceTo: string;
  outputBuffer: string;
  lastActivation: number;
  animationProgress: number;
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

export interface DrumMachine extends MachineBase {
  type: MachineType.DRUM;
  outputBuffer: string;
}

export interface ToneMachine extends MachineBase {
  type: MachineType.TONE;
  waveform: OscillatorType;
}

export interface SpeakMachine extends MachineBase {
  type: MachineType.SPEAK;
  speakRate: number;
  speakPitch: number;
  speakDelimiter: string;
  accumulatedBuffer: string;
  displayText: string;
  displayTime: number;
}

export type ScreenResolution = 8 | 16 | 32;

export interface ScreenMachine extends MachineBase {
  type: MachineType.SCREEN;
  resolution: ScreenResolution;
  buffer: Uint8Array;
  writePos: number;
}

export interface ByteMachine extends MachineBase, EmitTimer {
  type: MachineType.BYTE;
  byteData: Uint8Array;
  bytePos: number;
  gapInterval: number;
  gapRemaining: number;
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
  | SplitterMachine
  | SevenSegMachine
  | DrumMachine
  | ToneMachine
  | SpeakMachine
  | ScreenMachine
  | ByteMachine;

export interface MachineByType {
  [MachineType.SOURCE]: SourceMachine;
  [MachineType.SINK]: SinkMachine;
  [MachineType.COMMAND]: CommandMachine;
  [MachineType.DISPLAY]: DisplayMachine;
  [MachineType.NULL]: NullMachine;
  [MachineType.LINEFEED]: LinefeedMachine;
  [MachineType.FLIPPER]: FlipperMachine;
  [MachineType.DUPLICATOR]: DuplicatorMachine;
  [MachineType.CONSTANT]: ConstantMachine;
  [MachineType.FILTER]: FilterMachine;
  [MachineType.COUNTER]: CounterMachine;
  [MachineType.DELAY]: DelayMachine;
  [MachineType.KEYBOARD]: KeyboardMachine;
  [MachineType.PACKER]: PackerMachine;
  [MachineType.UNPACKER]: UnpackerMachine;
  [MachineType.ROUTER]: RouterMachine;
  [MachineType.GATE]: GateMachine;
  [MachineType.WIRELESS]: WirelessMachine;
  [MachineType.REPLACE]: ReplaceMachine;
  [MachineType.MATH]: MathMachine;
  [MachineType.CLOCK]: ClockMachine;
  [MachineType.LATCH]: LatchMachine;

  [MachineType.SPLITTER]: SplitterMachine;
  [MachineType.SEVENSEG]: SevenSegMachine;
  [MachineType.DRUM]: DrumMachine;
  [MachineType.TONE]: ToneMachine;
  [MachineType.SPEAK]: SpeakMachine;
  [MachineType.SCREEN]: ScreenMachine;
  [MachineType.BYTE]: ByteMachine;
}

export type BufferingMachine =
  | CommandMachine
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
  | SplitterMachine
  | SevenSegMachine
  | DrumMachine;

export function hasOutputBuffer(m: Machine): m is BufferingMachine {
  return 'outputBuffer' in m;
}

export type EmittingMachine = SourceMachine | LinefeedMachine | ConstantMachine | ClockMachine | ByteMachine;

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
export type PlaceableType = 'belt' | 'splitter' | 'source' | 'command' | 'sink' | 'display' | 'null' | 'linefeed' | 'flipper' | 'duplicator' | 'constant' | 'filter' | 'counter' | 'delay' | 'keyboard' | 'packer' | 'unpacker' | 'router' | 'gate' | 'wireless' | 'replace' | 'math' | 'clock' | 'latch' | 'sevenseg' | 'drum' | 'tone' | 'speak' | 'screen' | 'byte';

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
