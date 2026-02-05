import {
  GRID_SIZE,
  PACKET_SPEED,
  Direction,
  CellType,
  MachineType,
  DirDelta,
  type Packet,
  type Machine,
  type BeltCell,
  type SplitterCell,
  type MachineCell,
} from './types';

// Emoji pool for the emoji machine
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
  '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '🤪', '😜', '🤓',
  '😎', '🥳', '🤯', '🤠', '👻', '👽', '🤖', '💀', '👾', '🎃',
  '🐱', '🐶', '🐼', '🦊', '🦁', '🐸', '🐵', '🦄', '🐝', '🦋',
  '🌈', '⭐', '🌟', '💫', '✨', '🔥', '💥', '❤️', '💜', '💙',
  '🎵', '🎶', '🎸', '🎺', '🥁', '🎨', '🎭', '🎪', '🎢', '🎡',
  '🍕', '🍔', '🍟', '🌮', '🍣', '🍩', '🍪', '🎂', '🍰', '🧁',
  '🚀', '🛸', '🌍', '🌙', '☀️', '⚡', '🌊', '🏔️', '🌲', '🌸',
];

const EMOJI_DELAY = 800; // ms between emoji emissions
import type { GameState } from './state';
import { getCell } from './grid';
import { createPacket, isCellEmpty } from './packets';

export interface SimulationCallbacks {
  onVMStatusChange?: (status: 'ready' | 'busy' | 'error') => void;
  onOutput?: (sinkId: number, content: string) => void;
  onMachineReceive?: (char: string) => void;
  onSinkReceive?: (char: string) => void;
}

export function startSimulation(state: GameState): void {
  if (state.running) return;

  state.running = true;
  state.sourcePos = 0;
  state.lastEmitTime = performance.now();
  state.packets = [];
  state.orphanedPackets = [];

  // Reset machines
  for (const machine of state.machines) {
    machine.displayBuffer = '';
    machine.displayText = '';
    machine.displayTime = 0;
    machine.pendingInput = '';
    machine.outputBuffer = '';
    machine.processing = false;
    machine.lastInputTime = 0;
    machine.autoStartRan = false;
    machine.sourcePos = 0;
    machine.flipperState = machine.flipperDir;
    machine.constantPos = 0;
    machine.counterCount = 0;
    machine.delayQueue = [];
  }
}

export function stopSimulation(state: GameState): void {
  state.running = false;
  state.orphanedPackets = [];
}

export function findMachineOutput(
  state: GameState,
  machine: Machine
): { x: number; y: number; dir: Direction } | null {
  const directions = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];
  const deltas = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
  ];

  for (let i = 0; i < 4; i++) {
    const nx = machine.x + deltas[i].dx;
    const ny = machine.y + deltas[i].dy;
    const cell = getCell(state, nx, ny);

    if (cell && cell.type === CellType.BELT && (cell as BeltCell).dir === directions[i]) {
      return { x: nx, y: ny, dir: directions[i] };
    }
  }
  return null;
}

export function findFlipperOutputs(
  state: GameState,
  machine: Machine
): { x: number; y: number; dir: Direction }[] {
  const directions = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];
  const deltas = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
  ];

  const outputs: { x: number; y: number; dir: Direction }[] = [];
  for (let i = 0; i < 4; i++) {
    const nx = machine.x + deltas[i].dx;
    const ny = machine.y + deltas[i].dy;
    const cell = getCell(state, nx, ny);

    if (cell && cell.type === CellType.BELT && (cell as BeltCell).dir === directions[i]) {
      outputs.push({ x: nx, y: ny, dir: directions[i] });
    }
  }
  return outputs;
}

async function processCommandMachine(
  state: GameState,
  machine: Machine,
  input: string,
  callbacks: SimulationCallbacks
): Promise<string> {
  if (!state.vm || !state.vm.ready) return input;

  const machineId = `m_${machine.x}_${machine.y}`;

  callbacks.onVMStatusChange?.('busy');
  try {
    let result: { output: string; cwd: string };
    if (input && input.length > 0) {
      result = await state.vm.pipeInShell(machineId, input, machine.command);
    } else {
      result = await state.vm.execInShell(machineId, machine.command);
    }
    // Update machine's current working directory
    if (result.cwd) {
      machine.cwd = result.cwd;
    }
    callbacks.onVMStatusChange?.('ready');
    return result.output || '';
  } catch (e) {
    console.error('[CMD] Error:', e);
    callbacks.onVMStatusChange?.('error');
    return '';
  }
}

function deliverToMachine(state: GameState, machine: Machine, content: string, callbacks: SimulationCallbacks): void {
  if (machine.type === MachineType.SINK) {
    callbacks.onOutput?.(machine.sinkId, content);
    callbacks.onSinkReceive?.(content);
  } else if (machine.type === MachineType.DISPLAY) {
    if (content === '\n' || content === '\r') {
      if (machine.displayBuffer.length > 0) {
        machine.displayText = machine.displayBuffer;
        machine.displayTime = performance.now();
        machine.displayBuffer = '';
      }
    } else {
      machine.displayBuffer += content;
      machine.lastByteTime = performance.now();
    }
  } else if (machine.type === MachineType.COMMAND) {
    machine.pendingInput += content;
    machine.lastInputTime = performance.now();
    callbacks.onMachineReceive?.(content);
  }
  // NULL machines silently discard packets
  // DUPLICATOR machines buffer input for replication to all outputs
  else if (machine.type === MachineType.DUPLICATOR) {
    machine.outputBuffer += content;
  }
  // FLIPPER machines buffer input and rotate clockwise on trigger byte
  else if (machine.type === MachineType.FLIPPER) {
    if (content === machine.flipperTrigger) {
      // Rotate clockwise to the next direction that has a valid output belt
      for (let step = 1; step <= 4; step++) {
        const nextDir = ((machine.flipperState + step) % 4) as Direction;
        const delta = DirDelta[nextDir];
        const nx = machine.x + delta.dx;
        const ny = machine.y + delta.dy;
        const cell = getCell(state, nx, ny);
        if (cell && cell.type === CellType.BELT && (cell as BeltCell).dir === nextDir) {
          machine.flipperState = nextDir;
          break;
        }
      }
    }
    machine.outputBuffer += content;
  }
  // FILTER: pass or block a specific byte
  else if (machine.type === MachineType.FILTER) {
    const match = content === machine.filterByte;
    if ((machine.filterMode === 'pass' && match) || (machine.filterMode === 'block' && !match)) {
      machine.outputBuffer += content;
    }
  }
  // COUNTER: increment count, emit digits on trigger
  else if (machine.type === MachineType.COUNTER) {
    machine.counterCount++;
    if (content === machine.counterTrigger) {
      machine.outputBuffer += String(machine.counterCount);
      machine.counterCount = 0;
    }
  }
  // DELAY: push to delay queue
  else if (machine.type === MachineType.DELAY) {
    machine.delayQueue.push({ char: content, time: performance.now() });
  }
  // KEYBOARD: output-only, no-op on receive
}

const ORPHAN_GRAVITY = 0.15;
const ORPHAN_MAX_AGE = 10000;
const ORPHAN_TOSS = PACKET_SPEED * 1.5;

function orphanPacket(state: GameState, packet: Packet, cellX: number, cellY: number): void {
	const worldX = cellX * GRID_SIZE + packet.offsetX;
	const worldY = cellY * GRID_SIZE + packet.offsetY;
	const delta = DirDelta[packet.dir];

	state.orphanedPackets.push({
		id: state.packetId++,
		worldX,
		worldY,
		vx: delta.dx * ORPHAN_TOSS,
		vy: delta.dy * ORPHAN_TOSS,
		content: packet.content,
		age: 0,
	});
}

function updateOrphanedPackets(state: GameState, deltaTime: number): void {
	const timeScale = state.timescale * (deltaTime / 16);
	const maxY = state.gridRows * GRID_SIZE + 500;

	for (let i = state.orphanedPackets.length - 1; i >= 0; i--) {
		const op = state.orphanedPackets[i];

		op.vy += ORPHAN_GRAVITY * timeScale;
		op.worldX += op.vx * timeScale;
		op.worldY += op.vy * timeScale;
		op.age += deltaTime;

		if (op.worldY > maxY || op.age > ORPHAN_MAX_AGE) {
			state.orphanedPackets.splice(i, 1);
		}
	}
}

function updatePacket(
  state: GameState,
  packet: Packet,
  deltaTime: number,
  callbacks: SimulationCallbacks
): boolean {
  const speed = PACKET_SPEED * state.timescale * (deltaTime / 16);
  const center = GRID_SIZE / 2;

  const delta = DirDelta[packet.dir];
  packet.offsetX += delta.dx * speed;
  packet.offsetY += delta.dy * speed;

  // Pull toward center perpendicular to travel
  const pull = 0.1 * state.timescale * (deltaTime / 16);
  if (packet.dir === Direction.LEFT || packet.dir === Direction.RIGHT) {
    packet.offsetY += (center - packet.offsetY) * pull;
  } else {
    packet.offsetX += (center - packet.offsetX) * pull;
  }

  // Check if leaving current cell
  let leaving = false;
  let nextX = packet.x;
  let nextY = packet.y;

  if (packet.offsetX >= GRID_SIZE) {
    leaving = true;
    nextX++;
    packet.offsetX -= GRID_SIZE;
  } else if (packet.offsetX < 0) {
    leaving = true;
    nextX--;
    packet.offsetX += GRID_SIZE;
  } else if (packet.offsetY >= GRID_SIZE) {
    leaving = true;
    nextY++;
    packet.offsetY -= GRID_SIZE;
  } else if (packet.offsetY < 0) {
    leaving = true;
    nextY--;
    packet.offsetY += GRID_SIZE;
  }

  if (!leaving) return true;

  const nextCell = getCell(state, nextX, nextY);

  // Fell off the grid or into empty space - orphan the packet
  if (!nextCell || nextCell.type === CellType.EMPTY) {
    orphanPacket(state, packet, nextX, nextY);
    return false;
  }

  // Entering a machine
  if (nextCell.type === CellType.MACHINE) {
    const machineCell = nextCell as MachineCell;
    deliverToMachine(state, machineCell.machine, packet.content, callbacks);
    return false;
  }

  // Block if next cell is occupied
  if (!isCellEmpty(state, nextX, nextY)) {
    if (packet.dir === Direction.RIGHT) packet.offsetX = GRID_SIZE - 1;
    else if (packet.dir === Direction.LEFT) packet.offsetX = 1;
    else if (packet.dir === Direction.DOWN) packet.offsetY = GRID_SIZE - 1;
    else if (packet.dir === Direction.UP) packet.offsetY = 1;
    packet.waiting = true;
    return true;
  }

  // Move to next cell
  packet.x = nextX;
  packet.y = nextY;
  packet.waiting = false;

  if (nextCell.type === CellType.BELT) {
    packet.dir = (nextCell as BeltCell).dir;
  } else if (nextCell.type === CellType.SPLITTER) {
    const splitter = nextCell as SplitterCell;
    const leftDir = ((splitter.dir + 3) % 4) as Direction;
    const rightDir = ((splitter.dir + 1) % 4) as Direction;
    packet.dir = splitter.toggle === 0 ? leftDir : rightDir;
    splitter.toggle = 1 - splitter.toggle;
  }

  return true;
}

async function processCommandInput(
  state: GameState,
  machine: Machine,
  callbacks: SimulationCallbacks
): Promise<void> {
  if (machine.processing) return;

  // AutoStart commands run without input
  if (machine.autoStart && !machine.autoStartRan) {
    machine.autoStartRan = true;
    machine.processing = true;

    try {
      const output = await processCommandMachine(state, machine, '', callbacks);
      if (output && output !== '(timeout)' && output !== '(error)') {
        machine.outputBuffer += output;
        if (!output.endsWith('\n')) {
          machine.outputBuffer += '\n';
        }
        console.log('[CMD] AutoStart output:', output.substring(0, 50));
      }
    } catch (e) {
      console.error('[CMD] AutoStart error:', e);
    }

    machine.lastCommandTime = performance.now();
    machine.processing = false;
    return;
  }

  if (machine.pendingInput.length === 0) return;

  // Process when we have a complete line
  const newlineIdx = machine.pendingInput.indexOf('\n');
  if (newlineIdx === -1) return;

  const line = machine.pendingInput.substring(0, newlineIdx + 1);
  machine.pendingInput = machine.pendingInput.substring(newlineIdx + 1);

  machine.processing = true;

  try {
    const output = await processCommandMachine(state, machine, line, callbacks);
    if (output && output !== '(timeout)' && output !== '(error)') {
      machine.outputBuffer += output;
      if (output.length > 0 && !output.endsWith('\n')) {
        machine.outputBuffer += '\n';
      }
    }
  } catch (e) {
    console.error('[CMD] Error:', e);
  }

  machine.lastCommandTime = performance.now();
  machine.processing = false;
}

function emitFromMachine(state: GameState, machine: Machine): boolean {
  const output = findMachineOutput(state, machine);
  if (!output) return false;

  if (!isCellEmpty(state, output.x, output.y)) return false;

  if (machine.type === MachineType.SOURCE) {
    if (machine.sourcePos < state.sourceText.length) {
      const char = state.sourceText[machine.sourcePos];
      createPacket(state, output.x, output.y, char, output.dir);
      machine.sourcePos++;

      return true;
    }
  } else if (machine.type === MachineType.COMMAND) {
    if (machine.outputBuffer.length > 0) {
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, output.x, output.y, char, output.dir);

      return true;
    }
  } else if (machine.type === MachineType.EMOJI) {
    const now = performance.now();
    const adjustedDelay = EMOJI_DELAY / state.timescale;
    if (now - machine.lastEmojiTime > adjustedDelay) {
      const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      createPacket(state, output.x, output.y, emoji, output.dir);
      machine.lastEmojiTime = now;
      return true;
    }
  } else if (machine.type === MachineType.LINEFEED) {
    const now = performance.now();
    const adjustedDelay = machine.emitInterval / state.timescale;
    if (now - machine.lastEmitTime > adjustedDelay) {
      createPacket(state, output.x, output.y, '\n', output.dir);
      machine.lastEmitTime = now;
      return true;
    }
  } else if (machine.type === MachineType.DUPLICATOR) {
    if (machine.outputBuffer.length > 0) {
      const outputs = findFlipperOutputs(state, machine);
      if (outputs.length === 0) return false;
      // Only emit when ALL output cells are clear
      for (const o of outputs) {
        if (!isCellEmpty(state, o.x, o.y)) return false;
      }
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      for (const o of outputs) {
        createPacket(state, o.x, o.y, char, o.dir);
      }
      return true;
    }
  } else if (machine.type === MachineType.FLIPPER) {
    if (machine.outputBuffer.length > 0) {
      const dir = machine.flipperState as Direction;
      const delta = DirDelta[dir];
      const nx = machine.x + delta.dx;
      const ny = machine.y + delta.dy;
      const cell = getCell(state, nx, ny);
      if (!cell || cell.type !== CellType.BELT || (cell as BeltCell).dir !== dir) return false;
      if (!isCellEmpty(state, nx, ny)) return false;
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, nx, ny, char, dir);
      return true;
    }
  } else if (machine.type === MachineType.CONSTANT) {
    if (machine.constantText.length === 0) return false;
    const now = performance.now();
    const adjustedDelay = machine.constantInterval / state.timescale;
    if (now - machine.lastEmitTime > adjustedDelay) {
      const char = machine.constantText[machine.constantPos];
      createPacket(state, output.x, output.y, char, output.dir);
      machine.constantPos = (machine.constantPos + 1) % machine.constantText.length;
      machine.lastEmitTime = now;
      return true;
    }
  } else if (machine.type === MachineType.FILTER || machine.type === MachineType.COUNTER || machine.type === MachineType.DELAY || machine.type === MachineType.KEYBOARD) {
    if (machine.outputBuffer.length > 0) {
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, output.x, output.y, char, output.dir);
      return true;
    }
  }

  return false;
}

export function updateSimulation(
  state: GameState,
  deltaTime: number,
  callbacks: SimulationCallbacks
): void {
  if (!state.running) return;

  const now = performance.now();

  // Emit from source, command, and emoji machines
  const adjustedDelay = state.emitDelay / state.timescale;
  if (now - state.lastEmitTime > adjustedDelay) {
    for (const machine of state.machines) {
      if (machine.type === MachineType.SOURCE || machine.type === MachineType.COMMAND || machine.type === MachineType.FLIPPER || machine.type === MachineType.DUPLICATOR || machine.type === MachineType.FILTER || machine.type === MachineType.COUNTER || machine.type === MachineType.DELAY || machine.type === MachineType.KEYBOARD) {
        if (emitFromMachine(state, machine)) {
          state.lastEmitTime = now;
        }
      }
    }
  }

  // Emoji, linefeed, and constant machines emit on their own timer
  for (const machine of state.machines) {
    if (machine.type === MachineType.EMOJI || machine.type === MachineType.LINEFEED || machine.type === MachineType.CONSTANT) {
      emitFromMachine(state, machine);
    }
  }

  // Process delay queues: move ready items to outputBuffer
  for (const machine of state.machines) {
    if (machine.type === MachineType.DELAY && machine.delayQueue.length > 0) {
      while (machine.delayQueue.length > 0 && now - machine.delayQueue[0].time >= machine.delayMs) {
        machine.outputBuffer += machine.delayQueue.shift()!.char;
      }
    }
  }

  // Process command machines and check display timeouts
  for (const machine of state.machines) {
    if (machine.type === MachineType.COMMAND) {
      if (!machine.processing) {
        if ((machine.autoStart && !machine.autoStartRan) || machine.pendingInput.length > 0) {
          processCommandInput(state, machine, callbacks);
        }
      }
    } else if (machine.type === MachineType.DISPLAY) {
      if (machine.displayBuffer.length > 0 && machine.lastByteTime > 0) {
        if (now - machine.lastByteTime > 500) {
          machine.displayText = machine.displayBuffer;
          machine.displayTime = now;
          machine.displayBuffer = '';
          machine.lastByteTime = 0;
        }
      }
    }
  }

  // Update all packets
  for (let i = state.packets.length - 1; i >= 0; i--) {
    if (!updatePacket(state, state.packets[i], deltaTime, callbacks)) {
      state.packets.splice(i, 1);
    }
  }

  // Update orphaned packets (gravity physics)
  updateOrphanedPackets(state, deltaTime);
}
