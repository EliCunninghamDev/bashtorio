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

// Helper to place a splitter
function placeSplitter(grid: any[][], x: number, y: number, dir: Direction) {
  grid[x][y] = { type: CellType.SPLITTER, dir, toggle: 0 };
}

// Helper to place a machine
function placeMachine(grid: any[][], machines: any[], x: number, y: number, type: MachineType, opts: { command?: string; autoStart?: boolean; async?: boolean; sinkId?: number; flipperTrigger?: string; flipperDir?: Direction; emitInterval?: number; sourceText?: string } = {}) {
  const idx = machines.length;
  const m: any = {
    x, y, type,
    command: opts.command ?? 'cat',
    autoStart: opts.autoStart ?? false,
    sinkId: opts.sinkId ?? 0,
  };
  if (opts.async !== undefined) m.async = opts.async;
  if (opts.flipperTrigger !== undefined) m.flipperTrigger = opts.flipperTrigger;
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

// Emoji party preset
function createEmojiPartyPreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  // Emoji source at (1, 2)
  placeMachine(grid, machines, 1, 2, MachineType.EMOJI);

  // Belt to display
  for (let x = 2; x <= 5; x++) {
    placeBelt(grid, x, 2, Direction.RIGHT);
  }

  // Display at (6, 2)
  placeMachine(grid, machines, 6, 2, MachineType.DISPLAY);

  // Another emoji source at (1, 5)
  placeMachine(grid, machines, 1, 5, MachineType.EMOJI);

  // Belt to sink
  for (let x = 2; x <= 5; x++) {
    placeBelt(grid, x, 5, Direction.RIGHT);
  }

  // Sink at (6, 5)
  placeMachine(grid, machines, 6, 5, MachineType.SINK, { sinkId: 1 });

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

// Cowsay preset (requires autoStart since cowsay reads all input)
function createCowsayPreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'Moo!\n' });

  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
    command: 'cowsay',
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

// Flipper sorter - sed extracts 3 groups, flipper routes alternating lines
function createFlipperSorterPreset(): SaveData {
  const cols = 14, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  // Source at (1, 3)
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE, { sourceText: 'top middle bottom\ntop middle bottom\ntop middle bottom\n' });

  // Belt from source to sed
  placeBelt(grid, 2, 3, Direction.RIGHT);
  placeBelt(grid, 3, 3, Direction.RIGHT);

  // sed extracts (top)(middle)(bottom) onto separate lines
  placeMachine(grid, machines, 4, 3, MachineType.COMMAND, {
    command: "sed -nE 's/.*(top).*(middle).*(bottom).*/\\1\\n\\2\\n\\3/p'",
  });

  // Belt from sed to flipper
  placeBelt(grid, 5, 3, Direction.RIGHT);
  placeBelt(grid, 6, 3, Direction.RIGHT);

  // Flipper at (7, 3) - triggers on newline
  placeMachine(grid, machines, 7, 3, MachineType.FLIPPER, { flipperDir: Direction.RIGHT });

  // --- Path 1: RIGHT → sink 1 (gets "top" and "bottom") ---
  for (let x = 8; x <= 10; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }
  placeMachine(grid, machines, 11, 3, MachineType.SINK, { sinkId: 1 });

  // --- Path 2: DOWN → sink 2 (gets "middle") ---
  placeBelt(grid, 7, 4, Direction.DOWN);
  for (let x = 7; x <= 10; x++) {
    placeBelt(grid, x, 5, Direction.RIGHT);
  }
  placeMachine(grid, machines, 11, 5, MachineType.SINK, { sinkId: 2 });

  return {
    version: 1,
    gridCols: cols,
    gridRows: rows,
    grid,
    machines,
    sinkIdCounter: 3,
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

// Text Analysis Mega-Factory - elaborate preset showcasing every machine type
function createMegaFactoryPreset(): SaveData {
	const cols = 24, rows = 14;
	const grid = emptyGrid(cols, rows);
	const machines: any[] = [];

	// ═══ Emoji decorations - top border ═══
	placeMachine(grid, machines, 0, 0, MachineType.EMOJI);
	placeMachine(grid, machines, 8, 0, MachineType.EMOJI);
	placeMachine(grid, machines, 16, 0, MachineType.EMOJI);
	placeMachine(grid, machines, 23, 0, MachineType.EMOJI);

	// ═══ Main pipeline (Row 1): SOURCE → DUP → UPPERCASE → DUP → SINK ═══
	placeMachine(grid, machines, 0, 1, MachineType.SOURCE, { sourceText: 'Hello World!\nBashtorio rocks!\nPipes are magic.\nalpha bravo charlie\ndelta echo foxtrot\nThe quick brown fox.\n' });
	for (let x = 1; x <= 3; x++) placeBelt(grid, x, 1, Direction.RIGHT);
	placeMachine(grid, machines, 4, 1, MachineType.DUPLICATOR);
	for (let x = 5; x <= 7; x++) placeBelt(grid, x, 1, Direction.RIGHT);
	placeMachine(grid, machines, 8, 1, MachineType.COMMAND, { command: "tr 'a-z' 'A-Z'" });
	for (let x = 9; x <= 11; x++) placeBelt(grid, x, 1, Direction.RIGHT);
	placeMachine(grid, machines, 12, 1, MachineType.DUPLICATOR);
	placeBelt(grid, 13, 1, Direction.RIGHT);
	placeBelt(grid, 14, 1, Direction.RIGHT);
	placeMachine(grid, machines, 15, 1, MachineType.SINK, { sinkId: 1 });

	// ═══ Rev branch (from DUP at 12,1 going down) ═══
	placeBelt(grid, 12, 2, Direction.DOWN);
	placeBelt(grid, 12, 3, Direction.DOWN);
	placeMachine(grid, machines, 12, 4, MachineType.COMMAND, { command: 'rev' });
	placeBelt(grid, 13, 4, Direction.RIGHT);
	placeBelt(grid, 14, 4, Direction.RIGHT);
	placeMachine(grid, machines, 15, 4, MachineType.SINK, { sinkId: 2 });

	// ═══ Flipper branch (from DUP at 4,1 going down) ═══
	placeBelt(grid, 4, 2, Direction.DOWN);
	placeBelt(grid, 4, 3, Direction.DOWN);
	placeMachine(grid, machines, 4, 4, MachineType.FLIPPER, {
		flipperTrigger: '\n',
		flipperDir: Direction.RIGHT,
	});

	// Flipper RIGHT path → sort → sink
	placeBelt(grid, 5, 4, Direction.RIGHT);
	placeBelt(grid, 6, 4, Direction.RIGHT);
	placeMachine(grid, machines, 7, 4, MachineType.COMMAND, { command: 'sort' });
	placeBelt(grid, 8, 4, Direction.RIGHT);
	placeBelt(grid, 9, 4, Direction.RIGHT);
	placeMachine(grid, machines, 10, 4, MachineType.SINK, { sinkId: 3 });

	// Flipper DOWN path → sed word-split → splitter
	placeBelt(grid, 4, 5, Direction.DOWN);
	placeBelt(grid, 4, 6, Direction.DOWN);
	placeMachine(grid, machines, 4, 7, MachineType.COMMAND, { command: "sed 's/ /\\n/g'" });
	placeBelt(grid, 5, 7, Direction.RIGHT);
	placeBelt(grid, 6, 7, Direction.RIGHT);
	placeSplitter(grid, 7, 7, Direction.RIGHT); // alternates UP / DOWN

	// Splitter UP path → redirect right → display
	placeBelt(grid, 7, 6, Direction.RIGHT);
	placeBelt(grid, 8, 6, Direction.RIGHT);
	placeMachine(grid, machines, 9, 6, MachineType.DISPLAY);

	// Splitter DOWN path → redirect right → sink
	placeBelt(grid, 7, 8, Direction.RIGHT);
	placeBelt(grid, 8, 8, Direction.RIGHT);
	placeMachine(grid, machines, 9, 8, MachineType.SINK, { sinkId: 4 });

	// ═══ Decorative linefeed → null pair ═══
	placeMachine(grid, machines, 17, 10, MachineType.LINEFEED);
	placeBelt(grid, 18, 10, Direction.RIGHT);
	placeMachine(grid, machines, 19, 10, MachineType.NULL);

	// ═══ Emoji decorations - bottom border ═══
	placeMachine(grid, machines, 0, 13, MachineType.EMOJI);
	placeMachine(grid, machines, 8, 13, MachineType.EMOJI);
	placeMachine(grid, machines, 16, 13, MachineType.EMOJI);
	placeMachine(grid, machines, 23, 13, MachineType.EMOJI);

	return {
		version: 1,
		gridCols: cols,
		gridRows: rows,
		grid,
		machines,
		sinkIdCounter: 5,
	};
}

// Even/Odd sorter - async counter streams numbers, awk filters into two sinks
function createEvenOddPreset(): SaveData {
	const cols = 16, rows = 9;
	const grid = emptyGrid(cols, rows);
	const machines: any[] = [];

	// Auto-start async counter at (1, 3)
	placeMachine(grid, machines, 1, 3, MachineType.COMMAND, {
		command: 'i=0; while true; do echo $((i++)); sleep 0.5; done',
		autoStart: true,
		async: true,
	});

	// Belt from counter to duplicator
	placeBelt(grid, 2, 3, Direction.RIGHT);
	placeBelt(grid, 3, 3, Direction.RIGHT);

	// Duplicator at (4, 3)
	placeMachine(grid, machines, 4, 3, MachineType.DUPLICATOR);

	// --- Upper path: even numbers ---
	placeBelt(grid, 4, 2, Direction.UP);
	placeBelt(grid, 4, 1, Direction.RIGHT);
	placeBelt(grid, 5, 1, Direction.RIGHT);
	placeMachine(grid, machines, 6, 1, MachineType.COMMAND, {
		command: "awk '$1 % 2 == 0'",
	});
	for (let x = 7; x <= 11; x++) {
		placeBelt(grid, x, 1, Direction.RIGHT);
	}
	placeMachine(grid, machines, 12, 1, MachineType.SINK, { sinkId: 1 });

	// --- Lower path: odd numbers ---
	placeBelt(grid, 4, 4, Direction.DOWN);
	placeBelt(grid, 4, 5, Direction.RIGHT);
	placeBelt(grid, 5, 5, Direction.RIGHT);
	placeMachine(grid, machines, 6, 5, MachineType.COMMAND, {
		command: "awk '$1 % 2 != 0'",
	});
	for (let x = 7; x <= 11; x++) {
		placeBelt(grid, x, 5, Direction.RIGHT);
	}
	placeMachine(grid, machines, 12, 5, MachineType.SINK, { sinkId: 2 });

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
    id: 'emoji',
    name: 'Emoji Party',
    description: 'Random emojis flowing to display and sink',
    data: createEmojiPartyPreset(),
  },
  {
    id: 'cowsay',
    name: 'Cowsay',
    description: 'Make a cow say your message (if installed)',
    data: createCowsayPreset(),
  },
  {
    id: 'flipper-sorter',
    name: 'Flipper Sorter',
    description: 'sed extracts 3 groups onto lines, flipper routes top+bottom vs middle',
    data: createFlipperSorterPreset(),
  },
  {
    id: 'duplicator-demo',
    name: 'Duplicator Demo',
    description: 'Duplicator splits alternating-case text into uppercase and lowercase paths',
    data: createDuplicatorDemoPreset(),
  },
  {
    id: 'even-odd',
    name: 'Even/Odd Sorter',
    description: 'Async counter streams numbers forever - duplicator feeds two awk filters that split into even and odd sinks',
    data: createEvenOddPreset(),
  },
  {
    id: 'mega-factory',
    name: 'Text Analysis Mega-Factory',
    description: 'Elaborate pipeline: duplicators split text into uppercase, reverse, sort, and word-extraction paths with flipper routing and splitter distribution',
    data: createMegaFactoryPreset(),
  },
];
