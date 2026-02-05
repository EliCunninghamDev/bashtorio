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
function placeMachine(grid: any[][], machines: any[], x: number, y: number, type: MachineType, opts: { command?: string; autoStart?: boolean; sinkId?: number; flipperTrigger?: string; flipperDir?: Direction } = {}) {
  const idx = machines.length;
  const m: any = {
    x, y, type,
    command: opts.command ?? 'cat',
    autoStart: opts.autoStart ?? false,
    sinkId: opts.sinkId ?? 0,
  };
  if (opts.flipperTrigger !== undefined) m.flipperTrigger = opts.flipperTrigger;
  if (opts.flipperDir !== undefined) m.flipperDir = opts.flipperDir;
  machines.push(m);
  grid[x][y] = { type: CellType.MACHINE, machineIdx: idx };
}

// Sample preset - simple source → cat → sink
function createSamplePreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  // Source at (1, 3)
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

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
    sourceText: 'hello world\ngoodbye world\nhello again\n',
    sinkIdCounter: 2,
  };
}

// ROT13 Encoder preset
function createRot13Preset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  // Source at (1, 3)
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

  // Belt from source to command
  for (let x = 2; x <= 4; x++) {
    placeBelt(grid, x, 3, Direction.RIGHT);
  }

  // ROT13 command at (5, 3)
  placeMachine(grid, machines, 5, 3, MachineType.COMMAND, {
    command: "tr 'A-Za-z' 'N-ZA-Mn-za-m'",
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
    sourceText: 'Hello World!\nROT13 encodes text by rotating letters 13 positions.',
    sinkIdCounter: 2,
  };
}

// Uppercase converter preset
function createUppercasePreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

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
    sourceText: 'hello world\nthis text will be uppercase',
    sinkIdCounter: 2,
  };
}

// Word reverser preset
function createWordReverserPreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

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
    sourceText: 'Hello World\nreverse me',
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
    sourceText: '',
    sinkIdCounter: 2,
  };
}

// Pipeline preset (source -> uppercase -> reverse -> sink)
function createPipelinePreset(): SaveData {
  const cols = 16, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

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
    sourceText: 'hello world\npipeline demo',
    sinkIdCounter: 2,
  };
}

// Base64 encoder preset
function createBase64Preset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

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
    sourceText: 'Hello World!',
    sinkIdCounter: 2,
  };
}

// Cowsay preset (requires autoStart since cowsay reads all input)
function createCowsayPreset(): SaveData {
  const cols = 12, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

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
    sourceText: 'Moo!',
    sinkIdCounter: 2,
  };
}

// Flipper sorter - sed extracts 3 groups, flipper routes alternating lines
function createFlipperSorterPreset(): SaveData {
  const cols = 14, rows = 8;
  const grid = emptyGrid(cols, rows);
  const machines: any[] = [];

  // Source at (1, 3)
  placeMachine(grid, machines, 1, 3, MachineType.SOURCE);

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
    sourceText: 'top middle bottom\ntop middle bottom\ntop middle bottom\n',
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
    name: 'ROT13 Encoder',
    description: 'Classic cipher that rotates letters by 13 positions',
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
];
