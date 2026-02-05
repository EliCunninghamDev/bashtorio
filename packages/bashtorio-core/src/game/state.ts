import type { Cell, Machine, Packet, CursorMode, PlaceableType, Direction } from './types';
import type { LinuxVM } from '../vm';

export interface GameState {
  grid: Cell[][];
  gridCols: number;
  gridRows: number;
  machines: Machine[];
  packets: Packet[];
  packetId: number;
  sinkIdCounter: number;

  running: boolean;
  timescale: number;
  currentMode: CursorMode;
  currentPlaceable: PlaceableType;
  currentDir: Direction;

  selectedMachine: Machine | null;
  mouseDown: boolean;

  sourceText: string;
  sourcePos: number;
  lastEmitTime: number;
  emitDelay: number;

  vm: LinuxVM | null;
}

export function createInitialState(): GameState {
  return {
    grid: [],
    gridCols: 0,
    gridRows: 0,
    machines: [],
    packets: [],
    packetId: 0,
    sinkIdCounter: 1,

    running: false,
    timescale: 1,
    currentMode: 'machine',
    currentPlaceable: 'belt',
    currentDir: 0, // Direction.RIGHT

    selectedMachine: null,
    mouseDown: false,

    sourceText: 'Hello World!\nBashtorio is cool.\nUnix pipes are fun!',
    sourcePos: 0,
    lastEmitTime: 0,
    emitDelay: 150,

    vm: null,
  };
}
