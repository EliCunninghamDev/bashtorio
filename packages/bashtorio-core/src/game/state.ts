import type { Machine, Packet, OrphanedPacket, CursorMode, PlaceableType, Direction } from './types';

export interface GameState {
  packets: Packet[];
  orphanedPackets: OrphanedPacket[];
  packetId: number;

  running: boolean;
  timescale: number;
  beltSpeed: number;
  currentMode: CursorMode;
  currentPlaceable: PlaceableType;
  currentDir: Direction;

  selectedMachine: Machine | null;
  mouseDown: boolean;
}

export function createInitialState(): GameState {
  return {
    packets: [],
    orphanedPackets: [],
    packetId: 0,

    running: false,
    timescale: 1,
    beltSpeed: 2,
    currentMode: 'machine',
    currentPlaceable: 'belt',
    currentDir: 0, // Direction.RIGHT

    selectedMachine: null,
    mouseDown: false,
  };
}
