import type { EmitTimer } from './clock';
import type { ShellInstance } from '../vm/shell';

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
  NOISE = 'noise',
  SPEAK = 'speak',
  SCREEN = 'screen',
  BYTE = 'byte',
  PUNCHCARD = 'punchcard',
  TNT = 'tnt',
  BUTTON = 'button',
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

export interface SourceMachine extends MachineBase {
  type: MachineType.SOURCE;
  clock: EmitTimer;
  gapTimer: EmitTimer;
  sourceText: string;
  sourcePos: number;
  loop: boolean;
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
  label: string;
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
  shell: ShellInstance | null;
  pollPending: boolean;
  bytesIn: number;
  bytesOut: number;
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

export interface LinefeedMachine extends MachineBase {
  type: MachineType.LINEFEED;
  clock: EmitTimer;
}

export interface FlipperMachine extends MachineBase {
  type: MachineType.FLIPPER;
  flipperDir: number;   // Initial direction (Direction), persisted
  flipperState: number; // Current runtime direction (Direction), reset on sim start
  outputQueue: string[];
}

export interface DuplicatorMachine extends MachineBase {
  type: MachineType.DUPLICATOR;
  outputQueue: string[];
}

export interface FilterMachine extends MachineBase {
  type: MachineType.FILTER;
  filterByte: string;
  filterMode: 'pass' | 'block';
  outputQueue: string[];
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
  outputQueue: string[];
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
  matchQueue: string[];
  elseQueue: string[];
}

export interface GateMachine extends MachineBase {
  type: MachineType.GATE;
  gateDataDir: Direction;
  gateControlDir: Direction;
  gateOpen: boolean;
  outputQueue: string[];
}

export interface WirelessMachine extends MachineBase {
  type: MachineType.WIRELESS;
  wirelessChannel: number;
  wifiArc: number;
  outputQueue: string[];
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

export interface ClockMachine extends MachineBase {
  type: MachineType.CLOCK;
  clock: EmitTimer;
  clockByte: string;
}

export interface LatchMachine extends MachineBase {
  type: MachineType.LATCH;
  latchDataDir: Direction;
  latchControlDir: Direction;
  latchStored: string;
  outputQueue: string[];
}


export interface SplitterMachine extends MachineBase {
  type: MachineType.SPLITTER;
  dir: Direction;
  toggle: number;
  outputQueue: string[];
}

export interface SevenSegMachine extends MachineBase {
  type: MachineType.SEVENSEG;
  lastByte: number;
  outputQueue: string[];
}

export interface DrumMachine extends MachineBase {
  type: MachineType.DRUM;
  bitmask: boolean;
  outputQueue: string[];
}

export interface ToneMachine extends MachineBase {
  type: MachineType.TONE;
  waveform: OscillatorType;
  dutyCycle: number;
}

export interface NoiseMachine extends MachineBase {
  type: MachineType.NOISE;
  noiseMode: '15bit' | '7bit';
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

export interface ByteMachine extends MachineBase {
  type: MachineType.BYTE;
  clock: EmitTimer;
  gapTimer: EmitTimer;
  byteData: Uint8Array;
  bytePos: number;
}

export interface PunchCardMachine extends MachineBase {
  type: MachineType.PUNCHCARD;
  clock: EmitTimer;
  gapTimer: EmitTimer;
  cardData: Uint8Array;
  cardPos: number;
  loop: boolean;
}

export interface TntMachine extends MachineBase {
  type: MachineType.TNT;
  packetCount: number;
  stored: string[];
  exploded: boolean;
}

export interface ButtonMachine extends MachineBase {
  type: MachineType.BUTTON;
  buttonByte: string;
  buttonChannel: number;
  outputQueue: string[];
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
  | NoiseMachine
  | SpeakMachine
  | ScreenMachine
  | ByteMachine
  | PunchCardMachine
  | TntMachine
  | ButtonMachine;

export interface MachineByType {
  [MachineType.SOURCE]: SourceMachine;
  [MachineType.SINK]: SinkMachine;
  [MachineType.COMMAND]: CommandMachine;
  [MachineType.DISPLAY]: DisplayMachine;
  [MachineType.NULL]: NullMachine;
  [MachineType.LINEFEED]: LinefeedMachine;
  [MachineType.FLIPPER]: FlipperMachine;
  [MachineType.DUPLICATOR]: DuplicatorMachine;
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
  [MachineType.NOISE]: NoiseMachine;
  [MachineType.SPEAK]: SpeakMachine;
  [MachineType.SCREEN]: ScreenMachine;
  [MachineType.BYTE]: ByteMachine;
  [MachineType.PUNCHCARD]: PunchCardMachine;
  [MachineType.TNT]: TntMachine;
  [MachineType.BUTTON]: ButtonMachine;
}

export type BufferingMachine =
  | CommandMachine
  | CounterMachine
  | KeyboardMachine
  | PackerMachine
  | UnpackerMachine
  | ReplaceMachine
  | MathMachine;

export function hasOutputBuffer(m: Machine): m is BufferingMachine {
  return 'outputBuffer' in m;
}

export type QueueingMachine =
  | FlipperMachine
  | LatchMachine
  | DuplicatorMachine
  | FilterMachine
  | DelayMachine
  | GateMachine
  | WirelessMachine
  | SplitterMachine
  | SevenSegMachine
  | DrumMachine
  | ButtonMachine;

export function hasOutputQueue(m: Machine): m is QueueingMachine {
  return 'outputQueue' in m;
}

export type EmittingMachine = SourceMachine | LinefeedMachine | ClockMachine | ByteMachine | PunchCardMachine;

export function hasClock(m: Machine): m is EmittingMachine {
  return 'clock' in m;
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
export type PlaceableType = 'belt' | 'splitter' | 'source' | 'command' | 'sink' | 'display' | 'null' | 'linefeed' | 'flipper' | 'duplicator' | 'filter' | 'counter' | 'delay' | 'keyboard' | 'packer' | 'unpacker' | 'router' | 'gate' | 'wireless' | 'replace' | 'math' | 'clock' | 'latch' | 'sevenseg' | 'drum' | 'tone' | 'noise' | 'speak' | 'screen' | 'byte' | 'punchcard' | 'tnt' | 'button';

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
