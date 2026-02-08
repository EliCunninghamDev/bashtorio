import { CellType, Direction, type Cell } from './types';
import { ChunkedGrid } from './ChunkedGrid';
import { machines } from './machines';

// ---------------------------------------------------------------------------
// Module-level state (singleton)
// ---------------------------------------------------------------------------

let grid = new ChunkedGrid();

// ---------------------------------------------------------------------------
// Grid lifecycle
// ---------------------------------------------------------------------------

export function initGrid(): void {
  grid = new ChunkedGrid();
}

export function clearGrid(): void {
  grid.clear();
}

// ---------------------------------------------------------------------------
// Grid accessors
// ---------------------------------------------------------------------------

export function getCell(x: number, y: number): Cell {
  return grid.getCell(x, y, machines);
}

export function getCellType(x: number, y: number): CellType {
  return grid.getCellType(x, y);
}

export function getBeltDir(x: number, y: number): Direction {
  return grid.getBeltDir(x, y);
}

export function getMachineIndex(x: number, y: number): number {
  return grid.getMachineIndex(x, y);
}

// ---------------------------------------------------------------------------
// Sparse iteration (for renderer, saveload)
// ---------------------------------------------------------------------------

export function forEachBelt(cb: (x: number, y: number, dir: Direction) => void): void {
  grid.forEachBelt(cb);
}

export function forEachNonEmpty(cb: (x: number, y: number, cellType: CellType) => void): void {
  grid.forEachNonEmpty(cb);
}

// ---------------------------------------------------------------------------
// Low-level setters (for saveload deserialization and edit.ts)
// ---------------------------------------------------------------------------

export function setBelt(x: number, y: number, dir: Direction): void {
  grid.setBelt(x, y, dir);
}

export function setMachineCell(x: number, y: number, idx: number): void {
  grid.setMachine(x, y, idx);
}

export function setEmpty(x: number, y: number): void {
  grid.setEmpty(x, y);
}

export function reindexAfterSplice(removedIdx: number): void {
  grid.reindexAfterSplice(removedIdx);
}

