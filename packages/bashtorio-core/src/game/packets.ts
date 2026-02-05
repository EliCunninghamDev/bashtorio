import { GRID_SIZE, Direction, type Packet } from './types';
import type { GameState } from './state';

export function createPacket(state: GameState, x: number, y: number, content: string, dir: Direction): Packet {
  const packet: Packet = {
    id: state.packetId++,
    x,
    y,
    offsetX: GRID_SIZE / 2,
    offsetY: GRID_SIZE / 2,
    content,
    dir,
    waiting: false,
  };
  state.packets.push(packet);
  return packet;
}

export function removePacket(state: GameState, packet: Packet): void {
  const idx = state.packets.indexOf(packet);
  if (idx !== -1) {
    state.packets.splice(idx, 1);
  }
}

export function getPacketAt(state: GameState, x: number, y: number, minProgress = 0): Packet | undefined {
  return state.packets.find(p => {
    if (p.x !== x || p.y !== y) return false;

    // Calculate how far through the cell this packet is (0 to 1)
    let progress = 0;
    switch (p.dir) {
      case Direction.RIGHT:
        progress = p.offsetX / GRID_SIZE;
        break;
      case Direction.LEFT:
        progress = 1 - p.offsetX / GRID_SIZE;
        break;
      case Direction.DOWN:
        progress = p.offsetY / GRID_SIZE;
        break;
      case Direction.UP:
        progress = 1 - p.offsetY / GRID_SIZE;
        break;
    }

    return progress < minProgress + 0.4;
  });
}

export function isCellEmpty(state: GameState, x: number, y: number): boolean {
  return !state.packets.some(p => p.x === x && p.y === y);
}
