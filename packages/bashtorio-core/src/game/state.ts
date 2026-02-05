import type { Cell, Machine, Packet, OrphanedPacket, CursorMode, PlaceableType, Direction, Camera } from './types';
import type { LinuxVM } from '../vm';

export interface GameState {
  grid: Cell[][];
  gridCols: number;
  gridRows: number;
  machines: Machine[];
  packets: Packet[];
  orphanedPackets: OrphanedPacket[];
  packetId: number;
  sinkIdCounter: number;

  running: boolean;
  timescale: number;
  currentMode: CursorMode;
  currentPlaceable: PlaceableType;
  currentDir: Direction;

  selectedMachine: Machine | null;
  mouseDown: boolean;

  lastEmitTime: number;
  emitDelay: number;

  camera: Camera;

  vm: LinuxVM | null;
}

export function createInitialState(): GameState {
  return {
    grid: [],
    gridCols: 0,
    gridRows: 0,
    machines: [],
    packets: [],
    orphanedPackets: [],
    packetId: 0,
    sinkIdCounter: 1,

    running: false,
    timescale: 1,
    currentMode: 'machine',
    currentPlaceable: 'belt',
    currentDir: 0, // Direction.RIGHT

    selectedMachine: null,
    mouseDown: false,

    lastEmitTime: 0,
    emitDelay: 150,

    camera: { x: 0, y: 0, scale: 1 },

    vm: null,
  };
}
