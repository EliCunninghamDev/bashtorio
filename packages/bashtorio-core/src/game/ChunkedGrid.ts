import { CellType, Direction, type Cell, type Machine, type MachineCell, type BeltCell } from './types';

export const CHUNK_SIZE = 16;
export const NO_MACHINE = 0xFFFF;

interface Chunk {
  cellType: Uint8Array;       // 256 entries: CellType.EMPTY=0, BELT=1, MACHINE=2
  conveyorDir: Uint8Array;    // 256 entries: Direction (0-3)
  machineIndex: Uint16Array;  // 256 entries: index into state.machines[], 0xFFFF = none
}

function chunkKey(cx: number, cy: number): number {
  return ((cx + 0x8000) << 16) | ((cy + 0x8000) & 0xFFFF);
}

function chunkCoord(world: number): number {
  return Math.floor(world / CHUNK_SIZE);
}

function localIndex(x: number, y: number): number {
  return ((x & 0xF) << 4) | (y & 0xF);
}

function createChunk(): Chunk {
  const machineIndex = new Uint16Array(256);
  machineIndex.fill(NO_MACHINE);
  return {
    cellType: new Uint8Array(256),
    conveyorDir: new Uint8Array(256),
    machineIndex,
  };
}

export class ChunkedGrid {
  private chunks = new Map<number, Chunk>();

  private getChunk(x: number, y: number): Chunk | undefined {
    return this.chunks.get(chunkKey(chunkCoord(x), chunkCoord(y)));
  }

  private getOrCreateChunk(x: number, y: number): Chunk {
    const key = chunkKey(chunkCoord(x), chunkCoord(y));
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = createChunk();
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getCellType(x: number, y: number): CellType {
    const chunk = this.getChunk(x, y);
    if (!chunk) return CellType.EMPTY;
    return chunk.cellType[localIndex(x, y)] as CellType;
  }

  getBeltDir(x: number, y: number): Direction {
    const chunk = this.getChunk(x, y);
    if (!chunk) return Direction.RIGHT;
    return chunk.conveyorDir[localIndex(x, y)] as Direction;
  }

  getMachineIndex(x: number, y: number): number {
    const chunk = this.getChunk(x, y);
    if (!chunk) return NO_MACHINE;
    return chunk.machineIndex[localIndex(x, y)];
  }

  setBelt(x: number, y: number, dir: Direction): void {
    const chunk = this.getOrCreateChunk(x, y);
    const idx = localIndex(x, y);
    chunk.cellType[idx] = CellType.BELT;
    chunk.conveyorDir[idx] = dir;
    chunk.machineIndex[idx] = NO_MACHINE;
  }

  setMachine(x: number, y: number, machineIdx: number): void {
    const chunk = this.getOrCreateChunk(x, y);
    const idx = localIndex(x, y);
    chunk.cellType[idx] = CellType.MACHINE;
    chunk.machineIndex[idx] = machineIdx;
  }

  setEmpty(x: number, y: number): void {
    const chunk = this.getChunk(x, y);
    if (!chunk) return;
    const idx = localIndex(x, y);
    chunk.cellType[idx] = CellType.EMPTY;
    chunk.conveyorDir[idx] = 0;
    chunk.machineIndex[idx] = NO_MACHINE;
  }

  /** Compat layer: returns a Cell object for callers that need the discriminated union. */
  getCell(x: number, y: number, machines: Machine[]): Cell {
    const chunk = this.getChunk(x, y);
    if (!chunk) return { type: CellType.EMPTY };
    const idx = localIndex(x, y);
    const ct = chunk.cellType[idx] as CellType;
    switch (ct) {
      case CellType.BELT:
        return { type: CellType.BELT, dir: chunk.conveyorDir[idx] as Direction } as BeltCell;
      case CellType.MACHINE: {
        const mi = chunk.machineIndex[idx];
        return { type: CellType.MACHINE, machine: machines[mi] } as MachineCell;
      }
      default:
        return { type: CellType.EMPTY };
    }
  }

  /** Iterate all non-empty cells across all chunks. */
  forEachNonEmpty(cb: (x: number, y: number, cellType: CellType) => void): void {
    for (const [key, chunk] of this.chunks) {
      const cx = ((key >>> 16) & 0xFFFF) - 0x8000;
      const cy = (key & 0xFFFF) - 0x8000;
      const baseX = cx * CHUNK_SIZE;
      const baseY = cy * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const idx = (lx << 4) | ly;
          const ct = chunk.cellType[idx];
          if (ct !== CellType.EMPTY) {
            cb(baseX + lx, baseY + ly, ct as CellType);
          }
        }
      }
    }
  }

  /** Iterate all belt cells across all chunks. */
  forEachBelt(cb: (x: number, y: number, dir: Direction) => void): void {
    for (const [key, chunk] of this.chunks) {
      const cx = ((key >>> 16) & 0xFFFF) - 0x8000;
      const cy = (key & 0xFFFF) - 0x8000;
      const baseX = cx * CHUNK_SIZE;
      const baseY = cy * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const idx = (lx << 4) | ly;
          if (chunk.cellType[idx] === CellType.BELT) {
            cb(baseX + lx, baseY + ly, chunk.conveyorDir[idx] as Direction);
          }
        }
      }
    }
  }

  /** After a machine is spliced from the machines array, decrement all indices > removedIdx. */
  reindexAfterSplice(removedIdx: number): void {
    for (const chunk of this.chunks.values()) {
      for (let i = 0; i < 256; i++) {
        const mi = chunk.machineIndex[i];
        if (mi !== NO_MACHINE) {
          if (mi === removedIdx) {
            // This cell's machine was the one removed - clear it
            chunk.cellType[i] = CellType.EMPTY;
            chunk.conveyorDir[i] = 0;
            chunk.machineIndex[i] = NO_MACHINE;
          } else if (mi > removedIdx) {
            chunk.machineIndex[i] = mi - 1;
          }
        }
      }
    }
  }

  clear(): void {
    this.chunks.clear();
  }

  get chunkCount(): number {
    return this.chunks.size;
  }

  getChunkKeys(): number[] {
    return Array.from(this.chunks.keys());
  }
}
