import { CellType, MachineType, Direction, type Cell, type Machine, type SplitterMachine, type MachineByType, type MachineBase } from './types';
import { getCellType, getCell, getMachineIndex, setMachineCell, setBelt, setEmpty, reindexAfterSplice } from './grid';
import { NO_MACHINE } from './ChunkedGrid';
import * as vm from './vm';
import { machines, createMachine } from './machines';

// ---------------------------------------------------------------------------
// Splitter helpers
// ---------------------------------------------------------------------------

export function getSplitterSecondary(m: { dir: Direction; x: number; y: number }): { x: number; y: number } {
  if (m.dir === Direction.RIGHT || m.dir === Direction.LEFT) {
    return { x: m.x, y: m.y + 1 };
  }
  return { x: m.x + 1, y: m.y };
}

// ---------------------------------------------------------------------------
// Machine lookup / modification
// ---------------------------------------------------------------------------

export function getMachineAt(x: number, y: number): Machine | undefined {
  const idx = getMachineIndex(x, y);
  return idx !== NO_MACHINE ? machines[idx] : undefined;
}

/** Returns the axis-aligned bounding box of all machines, or null if none exist. */
export function getMachineBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (machines.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of machines) {
    if (m.x < minX) minX = m.x;
    if (m.y < minY) minY = m.y;
    if (m.x > maxX) maxX = m.x;
    if (m.y > maxY) maxY = m.y;
    if (m.type === MachineType.SPLITTER) {
      const sec = getSplitterSecondary(m);
      if (sec.x > maxX) maxX = sec.x;
      if (sec.y > maxY) maxY = sec.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

export function updateConfig<T extends MachineType>(
  x: number, y: number, type: T,
  updates: Partial<Omit<MachineByType[T], keyof MachineBase | 'type'>>,
): void {
  const machine = getMachineAt(x, y);
  if (machine && machine.type === type) {
    Object.assign(machine, updates);
  }
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export function placeBelt(x: number, y: number, dir: Direction): void {
  const ct = getCellType(x, y);
  if (ct === CellType.MACHINE) return;
  setBelt(x, y, dir);
}

export function placeSplitter(x: number, y: number, dir: Direction): SplitterMachine | null {
  const sec = getSplitterSecondary({ dir, x, y });
  const ct1 = getCellType(x, y);
  const ct2 = getCellType(sec.x, sec.y);
  if (ct1 !== CellType.EMPTY) return null;
  if (ct2 !== CellType.EMPTY) return null;

  const machine = createMachine(x, y, MachineType.SPLITTER, dir) as SplitterMachine;
  machines.push(machine);
  const idx = machines.length - 1;
  setMachineCell(x, y, idx);
  setMachineCell(sec.x, sec.y, idx);
  return machine;
}

export function clearCell(x: number, y: number): void | Cell {
  const ct = getCellType(x, y);
  if (ct === CellType.EMPTY) return;

  if (ct === CellType.BELT) {
    const cell = getCell(x, y);
    setEmpty(x, y);
    return cell;
  }

  if (ct === CellType.MACHINE) {
    const mi = getMachineIndex(x, y);
    if (mi === NO_MACHINE) return;
    const machine = machines[mi];

    // Destroy shell session if it exists
    if (machine?.type === MachineType.COMMAND) {
      const machineId = `m_${machine.x}_${machine.y}`;
      vm.destroyShell(machineId);
    }

    // For splitters, clear both cells
    if (machine?.type === MachineType.SPLITTER) {
      const sec = getSplitterSecondary(machine);
      setEmpty(machine.x, machine.y);
      setEmpty(sec.x, sec.y);
    } else {
      setEmpty(x, y);
    }

    // Remove machine from list and reindex
    const idx = machines.indexOf(machine);
    if (idx !== -1) {
      machines.splice(idx, 1);
      reindexAfterSplice(idx);
    }
    return;
  }

  setEmpty(x, y);
}

export function placeMachine(x: number, y: number, machineType: MachineType, dir: Direction = Direction.RIGHT): Machine | null {
  const ct = getCellType(x, y);
  if (ct === CellType.MACHINE) return null;
  if (machineType === MachineType.SPLITTER) return null;

  const machine = createMachine(x, y, machineType, dir);
  machines.push(machine);
  setMachineCell(x, y, machines.length - 1);
  return machine;
}
