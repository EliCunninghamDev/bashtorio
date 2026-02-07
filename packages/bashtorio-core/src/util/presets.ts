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
function placeMachine(grid: any[][], machines: any[], x: number, y: number, type: MachineType, opts: { command?: string; autoStart?: boolean; async?: boolean; sinkId?: number; flipperDir?: Direction; emitInterval?: number; sourceText?: string } = {}) {
  const idx = machines.length;
  const m: any = {
    x, y, type,
    command: opts.command ?? 'cat',
    autoStart: opts.autoStart ?? false,
    sinkId: opts.sinkId ?? 0,
  };
  if (opts.async !== undefined) m.async = opts.async;
  if (opts.flipperDir !== undefined) m.flipperDir = opts.flipperDir;
  if (opts.emitInterval !== undefined) m.emitInterval = opts.emitInterval;
  if (opts.sourceText !== undefined) m.sourceText = opts.sourceText;
  machines.push(m);
  grid[x][y] = { type: CellType.MACHINE, machineIdx: idx };
}

// Sample preset - simple source → cat → sink
function createSamplePreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  // Source at (1, 3)
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'hello world\ngoodbye world\nhello again\n' });

  // Belt from source to command
  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  // grep command at (5, 3)
  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
    command: 'grep hello',
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
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Hello World!\nROT13 twice returns the original text.\n' });

  // Belt from source to encode
  for (let x = 2; x <= 3; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  // ROT13 encode at (4, 3)
  placeMachine(grid, machines, 4, 3, MachineType.COMMAND, { command: rot13 });

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
  placeMachine(grid, machines, 7, 6, MachineType.COMMAND, { command: rot13 });
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

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'hello world\nthis text will be uppercase\n' });

  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
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

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Hello World\nreverse me\n' });

  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
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

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'hello world\npipeline demo\n' });

  for (let x = 2; x <= 3; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 4, 3, MachineType.COMMAND, {
    command: "tr 'a-z' 'A-Z'",
  });

  for (let x = 5; x <= 7; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 8, 3, MachineType.COMMAND, {
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

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Hello World!\n' });

  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
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
	placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'hElLo WoRlD\ntHiS iS bAsHtOrIo\n' });

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


// Export all presets
export const PRESETS: Preset[] = [
  {
    id: 'sample',
    name: 'Sample',
    description: 'Source → grep → sink: filters lines matching "hello"',
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
];
