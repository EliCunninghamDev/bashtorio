import type { SaveData } from './saveload';
import { CellType, MachineType, Direction } from '../game/types';

export interface Preset {
  id: string;
  name: string;
  description: string;
  data: SaveData;
}

// Helper to create empty grid
function emptyGrid(cols: number, rows: number) {
  const grid: any[][] = [];
  for (let x = 0; x < cols; x++) {
    grid[x] = [];
    for (let y = 0; y < rows; y++) {
      grid[x][y] = { type: CellType.EMPTY };
    }
  }
  return grid;
}

// Helper to place a belt
function placeBelt(grid: any[][], x: number, y: number, dir: Direction) {
  grid[x][y] = { type: CellType.BELT, dir };
}

// Helper to place a machine
function placeMachine(grid: any[][], machines: any[], x: number, y: number, type: MachineType, opts: { command?: string; label?: string; autoStart?: boolean; async?: boolean; sinkId?: number; flipperDir?: Direction; emitInterval?: number; sourceText?: string; loop?: boolean } = {}) {
  const idx = machines.length;
  const m: any = {
    x, y, type,
    command: opts.command ?? 'cat',
    autoStart: opts.autoStart ?? false,
    sinkId: opts.sinkId ?? 0,
  };
  if (opts.label !== undefined) m.label = opts.label;
  if (opts.async !== undefined) m.async = opts.async;
  if (opts.flipperDir !== undefined) m.flipperDir = opts.flipperDir;
  if (opts.emitInterval !== undefined) m.emitInterval = opts.emitInterval;
  if (opts.sourceText !== undefined) m.sourceText = opts.sourceText;
  if (opts.loop !== undefined) m.loop = opts.loop;
  machines.push(m);
  grid[x][y] = { type: CellType.MACHINE, machineIdx: idx };
}

// Sample preset - simple source → cat → sink
function createSamplePreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  // Source at (1, 3)
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Hello Bashtorio!\nThis game is a ripoff of Factorio!\nBashtorio rocks!\n', loop: false, emitInterval: 200 });

  // Belt from source to command
  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  // grep command at (5, 3)
  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
    label: 'Filter',
    command: 'grep -i bashtorio',
  });

  // Belt from command to sink
  for (let x = 6; x <= 8; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  // Sink at (9, 3)
  placeMachine(grid, machines, 9, 3, MachineType.SINK, { sinkId: 1 });

  return {
    version: 1,
    gridCols: cols,
    gridRows: rows,
    grid,
    machines,
    sinkIdCounter: 2,
  };
}

// ROT13 Encode + Decode preset
function createRot13Preset(): SaveData {
  const cols = 16, rows = 9;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  const rot13 = "tr 'A-Za-z' 'N-ZA-Mn-za-m'";

  // Source at (1, 3)
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Hello World!\nROT13 twice returns the original text.\n', loop: false, emitInterval: 200 });

  // Belt from source to encode
  for (let x = 2; x <= 3; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  // ROT13 encode at (4, 3)
  placeMachine(grid, machines, 4, 3, MachineType.COMMAND, { label: 'Encoder', command: rot13 });

  // Belt from encode to duplicator
  placeBelt(grid, 5, 3, Direction.RIGHT);
  placeBelt(grid, 6, 3, Direction.RIGHT);

  // Duplicator at (7, 3) - sends encoded text to both paths
  placeMachine(grid, machines, 7, 3, MachineType.DUPLICATOR);

  // --- Upper path: RIGHT → Encoded sink ---
  for (let x = 8; x <= 12; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }
  placeMachine(grid, machines, 13, 3, MachineType.SINK, { sinkId: 1 });

  // --- Lower path: DOWN → ROT13 decode → Decoded sink ---
  placeBelt(grid, 7, 4, Direction.DOWN);
  placeBelt(grid, 7, 5, Direction.DOWN);
  placeMachine(grid, machines, 7, 6, MachineType.COMMAND, { label: 'Decoder', command: rot13 });
  for (let x = 8; x <= 12; x++) {
    placeBelt(grid, x, 6, Direction.RIGHT);
  }
  placeMachine(grid, machines, 13, 6, MachineType.SINK, { sinkId: 2 });

  return {
    version: 1,
    gridCols: cols,
    gridRows: rows,
    grid,
    machines,
    sinkIdCounter: 3,
  };
}

// Uppercase converter preset
function createUppercasePreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'hello world\nthis text will be uppercase\n', loop: false, emitInterval: 200 });

  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
    label: 'Uppercaser',
    command: "tr 'a-z' 'A-Z'",
  });

  for (let x = 6; x <= 8; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 9, 3, MachineType.SINK, { sinkId: 1 });

  return {
    version: 1,
    gridCols: cols,
    gridRows: rows,
    grid,
    machines,
    sinkIdCounter: 2,
  };
}

// Word reverser preset
function createWordReverserPreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Hello World\nreverse me\n', loop: false, emitInterval: 200 });

  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
    label: 'Reverser',
    command: 'rev',
  });

  for (let x = 6; x <= 8; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 9, 3, MachineType.SINK, { sinkId: 1 });

  return {
    version: 1,
    gridCols: cols,
    gridRows: rows,
    grid,
    machines,
    sinkIdCounter: 2,
  };
}

// Pipeline preset (source -> uppercase -> reverse -> sink)
function createPipelinePreset(): SaveData {
  const cols = 16, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'hello world\npipeline demo\n', loop: false, emitInterval: 200 });

  for (let x = 2; x <= 3; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 4, 3, MachineType.COMMAND, {
    label: 'Uppercaser',
    command: "tr 'a-z' 'A-Z'",
  });

  for (let x = 5; x <= 7; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 8, 3, MachineType.COMMAND, {
    label: 'Reverser',
    command: 'rev',
  });

  for (let x = 9; x <= 11; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 12, 3, MachineType.SINK, { sinkId: 1 });

  return {
    version: 1,
    gridCols: cols,
    gridRows: rows,
    grid,
    machines,
    sinkIdCounter: 2,
  };
}

// Base64 encoder preset
function createBase64Preset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Hello World!\n', loop: false, emitInterval: 200 });

  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
    label: 'Encoder',
    command: 'base64',
  });

  for (let x = 6; x <= 8; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 9, 3, MachineType.SINK, { sinkId: 1 });

  return {
    version: 1,
    gridCols: cols,
    gridRows: rows,
    grid,
    machines,
    sinkIdCounter: 2,
  };
}


// Duplicator demo - alternating-case text split into uppercase and lowercase paths
function createDuplicatorDemoPreset(): SaveData {
	const cols = 12, rows = 7;
	const grid = emptyGrid(cols, rows);
	const machines: any[] = [];

	// Source at (1, 3) - feeds alternating-case text
	placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'hElLo WoRlD\ntHiS iS bAsHtOrIo\n', loop: false, emitInterval: 200 });

	// Belt from source to duplicator
	for (let x = 2; x <= 4; x++) {
		placeBelt(grid, x, 3, Direction.RIGHT);
	}

	// Duplicator at (5, 3) - splits to upper and lower paths
	placeMachine(grid, machines, 5, 3, MachineType.DUPLICATOR);

	// --- Upper path: belt UP → uppercase command → sink 1 ---
	placeBelt(grid, 5, 2, Direction.UP);

	// Uppercase command at (5, 1)
	placeMachine(grid, machines, 5, 1, MachineType.COMMAND, {
		label: 'Uppercaser',
		command: "tr 'a-z' 'A-Z'",
	});

	// Belt from uppercase command to sink
	for (let x = 6; x <= 8; x++) {
		placeBelt(grid, x, 1, Direction.RIGHT);
	}

	// Sink 1 at (9, 1)
	placeMachine(grid, machines, 9, 1, MachineType.SINK, { sinkId: 1 });

	// --- Lower path: belt DOWN → lowercase command → sink 2 ---
	placeBelt(grid, 5, 4, Direction.DOWN);

	// Lowercase command at (5, 5)
	placeMachine(grid, machines, 5, 5, MachineType.COMMAND, {
		label: 'Lowercaser',
		command: "tr 'A-Z' 'a-z'",
	});

	// Belt from lowercase command to sink
	for (let x = 6; x <= 8; x++) {
		placeBelt(grid, x, 5, Direction.RIGHT);
	}

	// Sink 2 at (9, 5)
	placeMachine(grid, machines, 9, 5, MachineType.SINK, { sinkId: 2 });

	return {
		version: 1,
		gridCols: cols,
		gridRows: rows,
		grid,
		machines,
		sinkIdCounter: 3,
	};
}


// Fibonacci generator - awk feedback loop with duplicator, packer, flipper
function createFibonacciPreset(): SaveData {
  return {
    version: 2,
    cells: [
      // Source "0 1\n" → belt → belt → DUP
      { x: -6, y: -17, type: 'machine', machineIdx: 2 },
      { x: -5, y: -17, type: 'belt', dir: 0 },
      { x: -4, y: -17, type: 'belt', dir: 0 },
      { x: -3, y: -17, type: 'machine', machineIdx: 1 },
      // DUP right path → belt → belt → awk → belt → belt → sink loop-back
      { x: -2, y: -17, type: 'belt', dir: 0 },
      { x: -1, y: -17, type: 'belt', dir: 0 },
      { x:  0, y: -17, type: 'machine', machineIdx: 0 },
      { x:  1, y: -17, type: 'belt', dir: 0 },
      { x:  2, y: -17, type: 'belt', dir: 1 },
      // Feedback column: down to sink row, then left back
      { x:  2, y: -16, type: 'belt', dir: 1 },
      { x:  2, y: -15, type: 'belt', dir: 2 },
      { x:  1, y: -15, type: 'belt', dir: 2 },
      { x:  0, y: -15, type: 'belt', dir: 2 },
      { x: -1, y: -15, type: 'belt', dir: 2 },
      { x: -2, y: -15, type: 'belt', dir: 2 },
      { x: -3, y: -15, type: 'belt', dir: 3 },
      { x: -3, y: -16, type: 'belt', dir: 3 },
      // DUP up path: replace → packer → flipper → unpacker → belt loop
      { x: -3, y: -18, type: 'belt', dir: 3 },
      { x: -3, y: -19, type: 'machine', machineIdx: 3 },
      { x: -3, y: -20, type: 'belt', dir: 3 },
      { x: -3, y: -21, type: 'machine', machineIdx: 4 },
      { x: -3, y: -22, type: 'belt', dir: 3 },
      { x: -3, y: -23, type: 'machine', machineIdx: 5 },
      { x: -3, y: -24, type: 'belt', dir: 3 },
      { x: -3, y: -25, type: 'machine', machineIdx: 7 },
      // Flipper discard path → null
      { x: -2, y: -23, type: 'belt', dir: 0 },
      { x: -1, y: -23, type: 'machine', machineIdx: 6 },
      // Unpacker → belt loop back to awk
      { x: -2, y: -25, type: 'belt', dir: 0 },
      { x: -1, y: -25, type: 'belt', dir: 0 },
      { x:  0, y: -25, type: 'belt', dir: 0 },
      { x:  1, y: -25, type: 'belt', dir: 0 },
      { x:  2, y: -25, type: 'belt', dir: 1 },
      { x:  2, y: -24, type: 'belt', dir: 1 },
      { x:  2, y: -23, type: 'belt', dir: 1 },
      { x:  2, y: -22, type: 'belt', dir: 1 },
      { x:  2, y: -21, type: 'belt', dir: 1 },
      { x:  2, y: -20, type: 'belt', dir: 1 },
      { x:  2, y: -19, type: 'machine', machineIdx: 8 },
      // Label source → belt → sink
      { x:  0, y: -19, type: 'machine', machineIdx: 9 },
      { x:  1, y: -19, type: 'belt', dir: 0 },
    ],
    machines: [
      { x: 0, y: -17, type: MachineType.COMMAND, command: "awk '{print $2, $1+$2}'", label: 'Sequencer', autoStart: false, sinkId: 0, stream: false },
      { x: -3, y: -17, type: MachineType.DUPLICATOR, command: '', autoStart: false, sinkId: 0 },
      { x: -6, y: -17, type: MachineType.SOURCE, command: '', autoStart: false, sinkId: 0, emitInterval: 200, sourceText: '0 1\n', loop: false },
      { x: -3, y: -19, type: MachineType.REPLACE, command: '', autoStart: false, sinkId: 0, replaceFrom: ' ', replaceTo: '\n' },
      { x: -3, y: -21, type: MachineType.PACKER, command: '', autoStart: false, sinkId: 0, packerDelimiter: '\n', preserveDelimiter: true, packerDir: 3 },
      { x: -3, y: -23, type: MachineType.FLIPPER, command: '', autoStart: false, sinkId: 0, flipperDir: 3 },
      { x: -1, y: -23, type: MachineType.NULL, command: '', autoStart: false, sinkId: 0 },
      { x: -3, y: -25, type: MachineType.UNPACKER, command: '', autoStart: false, sinkId: 0 },
      { x: 2, y: -19, type: MachineType.SINK, command: '', autoStart: false, sinkId: 5, name: 'Fib' },
      { x: 0, y: -19, type: MachineType.SOURCE, command: '', autoStart: false, sinkId: 0, emitInterval: 100, sourceText: 'Fibonacci Numbers:\n', loop: false },
    ],
    sinkIdCounter: 8,
  };
}

// Cave Story Main Theme (four voices, transcribed from XM module)
function createCaveStoryPreset(): SaveData {
  // Transcribed from the official XM module by Daisuke "Pixel" Amaya
  // First 8 patterns × 24 rows = 192 bytes, 92ms per byte (Speed 6, BPM 163)
  // Bass raised +1 octave for audibility

  const lead = [
    112,112,112,126,126,126,112,112,112,126,126,126,109,109,109,126,
    126,126,109,109,109,126,126,126,106,106,106,126,126,126,106,106,
    106,126,126,126,103,103,103,126,126,126,103,103,103,106,106,109,
    112,112,112,126,126,126,112,112,112,126,126,126,109,109,109,126,
    126,126,109,109,109,126,126,126,106,106,106,126,126,126,106,106,
    106,126,126,126,135,135,135,132,132,132,126,126,126,  0,  0,  0,
    112,112,112,117,  0,117,120,120,126,120,  0,117,112,112,112,  0,
      0,  0,120,120,126,120,  0,117,112,112,112,100,100,100,120,  0,
    120,117,117,112,117,117,117,106,106,106,126,126,126,117,117,117,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  ];

  const harmony = [
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
    124,124,124,129,  0,129,132,132,138,132,  0,129,124,124,124,  0,
      0,  0,132,132,138,132,  0,129,124,124,124,112,112,112,132,  0,
    132,129,129,124,129,129,129,118,118,118,138,138,118,121,121,121,
  ];

  const bass = [
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 45, 45, 45, 48, 48, 51,
     54, 54, 54, 54, 54, 54, 54, 54, 54, 45, 45, 54, 51, 51, 51, 51,
     51, 51, 51, 51, 51, 39, 39, 51, 48, 48, 48,  0,  0,  0,  0,  0,
     48, 48, 48, 48, 77, 77, 77, 74, 74, 74, 68, 68, 68, 48, 48, 48,
     54, 54, 54,  0,  0,  0,  0,  0,  0, 48, 48, 48, 54, 54, 54,  0,
      0,  0,  0,  0,  0, 48, 48, 48, 42, 42,  0,  0,  0,  0,  0,  0,
      0, 42, 42, 42, 48, 48,  0,  0,  0,  0, 39, 39, 39, 48, 48, 48,
     54, 54,  0,  0,  0,  0,  0,  0,  0, 48, 48, 48, 54, 54,  0,  0,
      0,  0,  0,  0,  0, 48, 48, 48, 42, 42,  0,  0,  0,  0,  0,  0,
      0, 42, 42, 42, 48, 48, 48, 39, 39, 39, 39,  0, 39, 59, 59, 59,
  ];

  // Merged kick(25)/snare(100)/hat(220) from channels 4,5,6
  const drums = [
      0,  0,  0,220,  0,220,  0,  0,  0,220,  0,220,  0,  0,  0,220,
      0,220,  0,  0,  0,220,  0,220,  0,  0,  0,220,  0,220,  0,  0,
    220,220,  0,220,  0,  0,  0,220,  0,220, 25,  0, 25, 25,  0, 25,
     25,  0,  0,220,  0,220, 25,  0,  0,220,  0,220,  0,  0, 25, 25,
      0,220, 25,  0,  0,220,  0,220, 25,  0,  0,  0,  0,  0,  0,  0,
     25, 25,220, 25,100,  0, 25,100,100,100,  0,  0,  0,100,  0,100,
     25,  0,220, 25,  0,220,100,  0, 25, 25,  0, 25, 25,  0,220, 25,
      0,220,100,  0,220, 25,  0,100, 25,  0,220,220,  0,220,100,  0,
    220,220,  0, 25, 25,  0,100,100,  0,220,100,  0, 25,220,  0,100,
     25,  0,220, 25,  0,220,100,  0, 25, 25,  0, 25, 25,  0,220, 25,
      0,220,100,  0,220, 25,  0,100,220,  0, 25, 25,  0,220,100,  0,
    220,220,  0, 25, 25,  0,220,100,  0,100,100,  0,100,  0,  0,100,
  ];

  return {
    version: 2,
    cells: [
      // Lead: BYTE → 4 belts → TONE (square 50%)
      { x: 0, y: 0, type: 'machine', machineIdx: 0 },
      { x: 1, y: 0, type: 'belt', dir: 0 },
      { x: 2, y: 0, type: 'belt', dir: 0 },
      { x: 3, y: 0, type: 'belt', dir: 0 },
      { x: 4, y: 0, type: 'belt', dir: 0 },
      { x: 5, y: 0, type: 'machine', machineIdx: 1 },
      // Harmony: BYTE → 4 belts → TONE (square 25%)
      { x: 0, y: 2, type: 'machine', machineIdx: 2 },
      { x: 1, y: 2, type: 'belt', dir: 0 },
      { x: 2, y: 2, type: 'belt', dir: 0 },
      { x: 3, y: 2, type: 'belt', dir: 0 },
      { x: 4, y: 2, type: 'belt', dir: 0 },
      { x: 5, y: 2, type: 'machine', machineIdx: 3 },
      // Bass: BYTE → 4 belts → TONE (triangle)
      { x: 0, y: 4, type: 'machine', machineIdx: 4 },
      { x: 1, y: 4, type: 'belt', dir: 0 },
      { x: 2, y: 4, type: 'belt', dir: 0 },
      { x: 3, y: 4, type: 'belt', dir: 0 },
      { x: 4, y: 4, type: 'belt', dir: 0 },
      { x: 5, y: 4, type: 'machine', machineIdx: 5 },
      // Drums: BYTE → 4 belts → NOISE
      { x: 0, y: 6, type: 'machine', machineIdx: 6 },
      { x: 1, y: 6, type: 'belt', dir: 0 },
      { x: 2, y: 6, type: 'belt', dir: 0 },
      { x: 3, y: 6, type: 'belt', dir: 0 },
      { x: 4, y: 6, type: 'belt', dir: 0 },
      { x: 5, y: 6, type: 'machine', machineIdx: 7 },
    ],
    machines: [
      { x: 0, y: 0, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: lead, emitInterval: 92 },
      { x: 5, y: 0, type: MachineType.TONE, command: '', autoStart: false, sinkId: 0, waveform: 'square', dutyCycle: 0.5 },
      { x: 0, y: 2, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: harmony, emitInterval: 92 },
      { x: 5, y: 2, type: MachineType.TONE, command: '', autoStart: false, sinkId: 0, waveform: 'square', dutyCycle: 0.25 },
      { x: 0, y: 4, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: bass, emitInterval: 92 },
      { x: 5, y: 4, type: MachineType.TONE, command: '', autoStart: false, sinkId: 0, waveform: 'triangle' },
      { x: 0, y: 6, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: drums, emitInterval: 92 },
      { x: 5, y: 6, type: MachineType.NOISE, command: '', autoStart: false, sinkId: 0, noiseMode: '15bit' },
    ],
    sinkIdCounter: 1,
    beltSpeed: 8,
  };
}

// Pokémon Red theme — four-voice GB chiptune: square lead, square harmony, triangle bass, LFSR noise drums
function createGBChiptunePreset(): SaveData {
  // Note byte values: byte = round(((midi - 21) / 87) * 254 + 1)
  // ToneEngine maps bytes 1-255 → MIDI 21 (A0) through 108 (C8)
  const D3 = 86, G3 = 100, A3 = 106;
  const Fs4 = 132, G4 = 135, A4 = 141, B4 = 147;
  const Cs5 = 153, D5 = 156, E5 = 161, Fs5 = 167, G5 = 170, A5 = 176, B5 = 182;
  const _ = 0; // silence

  // Lead melody: 64 bytes = 4 bars at 110ms/byte (square wave, 50% duty)
  // D major arpeggios with Pokemon-style bounce
  const lead = [
    // Bar 1: ascending D major arpeggio
    D5,_,Fs5,_,A5,_,D5,_, A5,_,Fs5,_,D5,_,_,_,
    // Bar 2: ascending Em shape, resolve to D
    E5,_,G5,_,B5,_,G5,_, E5,_,D5,_,Cs5,_,D5,_,
    // Bar 3: repeated arpeggio climb to B5
    D5,_,D5,_,Fs5,_,A5,_, B5,_,A5,_,G5,_,Fs5,_,
    // Bar 4: descending phrase, cadence to rest
    E5,_,Fs5,_,D5,_,B4,_, A4,_,B4,_,D5,_,_,_,
  ];

  // Harmony: 64 bytes, quarter-note chord tones (square wave, 25% duty)
  const harmony = [
    A4,_,_,_, Fs4,_,_,_, D5,_,_,_, A4,_,_,_,
    G4,_,_,_, B4,_,_,_, A4,_,_,_, Fs4,_,_,_,
    Fs4,_,_,_, A4,_,_,_, Fs4,_,_,_, A4,_,_,_,
    G4,_,_,_, Fs4,_,_,_, A4,_,_,_, _,_,_,_,
  ];

  // Bass: 64 bytes, pumping eighth-note root motion (triangle wave)
  const bass = [
    D3,_,D3,_, D3,_,D3,_, D3,_,D3,_, D3,_,D3,_,
    G3,_,G3,_, G3,_,G3,_, A3,_,A3,_, A3,_,A3,_,
    D3,_,D3,_, D3,_,D3,_, D3,_,D3,_, D3,_,D3,_,
    G3,_,G3,_, G3,_,G3,_, A3,_,A3,_, A3,_,_,_,
  ];

  // Noise drums: 16 bytes = 1 bar (loops 4x per melody cycle)
  // kick=25 (low rumble), snare=100 (mid crack), hat=220 (high hiss)
  const drums = [
    25,25,220,_, 100,100,220,_, 25,25,220,220, 100,100,220,_,
  ];

  return {
    version: 2,
    cells: [
      // Lead: BYTE → 4 belts → TONE
      { x: 0, y: 0, type: 'machine', machineIdx: 0 },
      { x: 1, y: 0, type: 'belt', dir: 0 },
      { x: 2, y: 0, type: 'belt', dir: 0 },
      { x: 3, y: 0, type: 'belt', dir: 0 },
      { x: 4, y: 0, type: 'belt', dir: 0 },
      { x: 5, y: 0, type: 'machine', machineIdx: 1 },
      // Harmony: BYTE → 4 belts → TONE
      { x: 0, y: 2, type: 'machine', machineIdx: 2 },
      { x: 1, y: 2, type: 'belt', dir: 0 },
      { x: 2, y: 2, type: 'belt', dir: 0 },
      { x: 3, y: 2, type: 'belt', dir: 0 },
      { x: 4, y: 2, type: 'belt', dir: 0 },
      { x: 5, y: 2, type: 'machine', machineIdx: 3 },
      // Bass: BYTE → 4 belts → TONE
      { x: 0, y: 4, type: 'machine', machineIdx: 4 },
      { x: 1, y: 4, type: 'belt', dir: 0 },
      { x: 2, y: 4, type: 'belt', dir: 0 },
      { x: 3, y: 4, type: 'belt', dir: 0 },
      { x: 4, y: 4, type: 'belt', dir: 0 },
      { x: 5, y: 4, type: 'machine', machineIdx: 5 },
      // Drums: BYTE → 4 belts → NOISE
      { x: 0, y: 6, type: 'machine', machineIdx: 6 },
      { x: 1, y: 6, type: 'belt', dir: 0 },
      { x: 2, y: 6, type: 'belt', dir: 0 },
      { x: 3, y: 6, type: 'belt', dir: 0 },
      { x: 4, y: 6, type: 'belt', dir: 0 },
      { x: 5, y: 6, type: 'machine', machineIdx: 7 },
    ],
    machines: [
      { x: 0, y: 0, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: lead, emitInterval: 110 },
      { x: 5, y: 0, type: MachineType.TONE, command: '', autoStart: false, sinkId: 0, waveform: 'square', dutyCycle: 0.5 },
      { x: 0, y: 2, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: harmony, emitInterval: 110 },
      { x: 5, y: 2, type: MachineType.TONE, command: '', autoStart: false, sinkId: 0, waveform: 'square', dutyCycle: 0.25 },
      { x: 0, y: 4, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: bass, emitInterval: 110 },
      { x: 5, y: 4, type: MachineType.TONE, command: '', autoStart: false, sinkId: 0, waveform: 'triangle' },
      { x: 0, y: 6, type: MachineType.BYTE, command: '', autoStart: false, sinkId: 0, byteData: drums, emitInterval: 110 },
      { x: 5, y: 6, type: MachineType.NOISE, command: '', autoStart: false, sinkId: 0, noiseMode: '15bit' },
    ],
    sinkIdCounter: 1,
    beltSpeed: 8,
  };
}

// Export all presets
export const PRESETS: Preset[] = [
  {
    id: 'sample',
    name: 'Hello Bashtorio!',
    description: 'Source → grep → sink: filters lines matching "bashtorio"',
    data: createSamplePreset(),
  },
  {
    id: 'rot13',
    name: 'ROT13 Encode/Decode',
    description: 'Encodes text with ROT13, then duplicates it - one path to a sink, the other decoded back to prove the round-trip',
    data: createRot13Preset(),
  },
  {
    id: 'uppercase',
    name: 'Uppercase Converter',
    description: 'Converts all lowercase letters to uppercase',
    data: createUppercasePreset(),
  },
  {
    id: 'reverse',
    name: 'Line Reverser',
    description: 'Reverses each line of text',
    data: createWordReverserPreset(),
  },
  {
    id: 'base64',
    name: 'Base64 Encoder',
    description: 'Encodes text as Base64',
    data: createBase64Preset(),
  },
  {
    id: 'pipeline',
    name: 'Pipeline Demo',
    description: 'Chain multiple commands: uppercase → reverse',
    data: createPipelinePreset(),
  },
  {
    id: 'duplicator-demo',
    name: 'Duplicator Demo',
    description: 'Duplicator splits alternating-case text into uppercase and lowercase paths',
    data: createDuplicatorDemoPreset(),
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci Generator',
    description: 'Feedback loop: awk computes each pair, duplicator splits output to a sink and back through the loop',
    data: createFibonacciPreset(),
  },
  {
    id: 'gb-chiptune',
    name: 'GB Chiptune',
    description: 'Four-voice Game Boy chiptune — square leads, triangle bass, and LFSR noise drums',
    data: createGBChiptunePreset(),
  },
  {
    id: 'cave-story',
    name: 'Cave Story Theme',
    description: 'Cave Story main theme — four-voice chiptune transcribed from the original XM module by Pixel',
    data: createCaveStoryPreset(),
  },
];
