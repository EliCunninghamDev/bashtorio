import {
  GRID_SIZE,
  PACKET_SPEED,
  Direction,
  CellType,
  MachineType,
  DirDelta,
  type Packet,
  type Machine,
  type CommandMachine,
  type BeltCell,
  type MachineCell,
  type SplitterMachine,
  type MathOp,
} from './types';

import type { GameState } from './state';
import { getCell } from './grid';
import { getSplitterSecondary } from './edit';
import { machines } from './machines';
import { createPacket, isCellEmpty } from './packets';
import { emitGameEvent, onGameEvent } from '../events/bus';
import type { Settings } from '../util/settings';
import { saveSettings } from '../util/settings';
import * as vm from './vm';
import { now, delta } from './clock';

/** Wire event-bus listeners that belong to the simulation layer. */
export function setupSimulationEvents(state: GameState, settings: Settings): void {
  onGameEvent('simulationKeyPress', ({ char }) => {
    for (const machine of machines) {
      if (machine.type === MachineType.KEYBOARD) {
        machine.outputBuffer += char;
      }
    }
  });

  onGameEvent('startSimulation', () => {
    if (!state.running) {
      startSimulation(state);
      emitGameEvent('simulationStarted');
    }
  });

  onGameEvent('endSimulation', () => {
    if (state.running) {
      stopSimulation(state);
      emitGameEvent('simulationEnded');
    }
  });

  onGameEvent('speedSet', ({ speed }) => {
    setSpeed(state, speed);
    saveSettings({ ...settings, speed });
    emitGameEvent('speedChanged', { speed });
  });
}

export function startSimulation(state: GameState): void {
  if (state.running) return;

  state.running = true;
  state.lastEmitTime = now;
  state.packets = [];
  state.orphanedPackets = [];

  // Reset machines
  for (const machine of machines) {
    switch (machine.type) {
      case MachineType.SOURCE:
        machine.sourcePos = 0;
        machine.lastEmitTime = 0;
        break;
      case MachineType.COMMAND:
        machine.pendingInput = '';
        machine.outputBuffer = '';
        machine.processing = false;
        machine.lastInputTime = 0;
        machine.autoStartRan = false;
        machine.activeJobId = '';
        machine.lastPollTime = 0;
        machine.bytesRead = 0;
        machine.streamBytesWritten = 0;
        machine.lastStreamWriteTime = 0;
        break;
      case MachineType.DISPLAY:
        machine.displayBuffer = '';
        machine.displayText = '';
        machine.displayTime = 0;
        machine.lastByteTime = 0;
        break;
      case MachineType.FLIPPER:
        machine.flipperState = machine.flipperDir;
        machine.outputQueue = [];
        break;
      case MachineType.DUPLICATOR:
      case MachineType.FILTER:
      case MachineType.KEYBOARD:
      case MachineType.UNPACKER:
        machine.outputBuffer = '';
        break;
      case MachineType.CONSTANT:
        machine.constantPos = 0;
        machine.lastEmitTime = 0;
        break;
      case MachineType.COUNTER:
        machine.counterCount = 0;
        machine.outputBuffer = '';
        break;
      case MachineType.DELAY:
        machine.delayQueue = [];
        machine.outputBuffer = '';
        break;
      case MachineType.LINEFEED:
        machine.lastEmitTime = 0;
        break;
      case MachineType.PACKER:
        machine.accumulatedBuffer = '';
        machine.outputBuffer = '';
        break;
      case MachineType.ROUTER:
        machine.matchBuffer = '';
        machine.elseBuffer = '';
        break;
      case MachineType.GATE:
        machine.gateOpen = false;
        machine.outputBuffer = '';
        break;
      case MachineType.WIRELESS:
        machine.outputBuffer = '';
        machine.wifiArc = 0;
        break;
      case MachineType.REPLACE:
      case MachineType.MATH:
        machine.outputBuffer = '';
        break;
      case MachineType.SPLITTER:
        machine.outputBuffer = '';
        machine.toggle = 0;
        break;
      case MachineType.SEVENSEG:
        machine.lastByte = -1;
        machine.outputBuffer = '';
        break;
      case MachineType.DRUM:
        machine.outputBuffer = '';
        break;
      case MachineType.CLOCK:
        machine.lastEmitTime = 0;
        break;
      case MachineType.LATCH:
        machine.latchStored = '';
        machine.outputBuffer = '';
        break;
      // TONE - silence on start
      case MachineType.TONE:
        emitGameEvent('toneNote', { machineId: `m_${machine.x}_${machine.y}`, byte: 0, waveform: machine.waveform });
        break;
      // SINK, NULL - no runtime state to reset
    }
  }
}

export function stopSimulation(state: GameState): void {
  state.running = false;
  state.orphanedPackets = [];

  // Stop active FIFO streams and silence tones
  for (const machine of machines) {
    if (machine.type === MachineType.COMMAND && machine.stream && machine.activeJobId) {
      vm.stopStream(machine.activeJobId);
      machine.activeJobId = '';
      machine.processing = false;
    }
    if (machine.type === MachineType.TONE) {
      emitGameEvent('toneNote', { machineId: `m_${machine.x}_${machine.y}`, byte: 0, waveform: machine.waveform });
    }
  }
}

export function toggleSimulation(state: GameState): void {
  if (state.running) {
    stopSimulation(state);
    emitGameEvent('simulationEnded');
  } else {
    startSimulation(state);
    emitGameEvent('simulationStarted');
  }
}

export function startSim(state: GameState): void {
  if (!state.running) {
    startSimulation(state);
    emitGameEvent('simulationStarted');
  }
}

export function stopSim(state: GameState): void {
  if (state.running) {
    stopSimulation(state);
    emitGameEvent('simulationEnded');
  }
}

export function setSpeed(state: GameState, speed: number): void {
  state.timescale = speed;
}

function findMachineOutput(
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
    const cell = getCell(nx, ny);

    if (cell.type === CellType.BELT && (cell as BeltCell).dir === directions[i]) {
      return { x: nx, y: ny, dir: directions[i] };
    }
  }
  return null;
}

function findFlipperOutputs(
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
    const cell = getCell(nx, ny);

    if (cell.type === CellType.BELT && (cell as BeltCell).dir === directions[i]) {
      outputs.push({ x: nx, y: ny, dir: directions[i] });
    }
  }
  return outputs;
}

/** Non-blocking: start a file-based job for a command machine */
function startCommandJob(
  machine: CommandMachine,
  input: string,
): void {
  if (!vm.isReady()) return;

  const machineId = `m_${machine.x}_${machine.y}`;
  const startTime = now;
  machine.processing = true;
  emitGameEvent('vmStatusChange', { status: 'busy' });
  emitGameEvent('commandStart', { machineId, command: machine.command, input, inputMode: machine.inputMode });

  // Build the effective command - in args mode, append input as argument
  let effectiveCmd = machine.command;
  let effectiveStdin = input;
  if (machine.inputMode === 'args' && input && input.length > 0) {
    const arg = input.replace(/\n$/, '');
    effectiveCmd = `${machine.command} ${arg}`;
    effectiveStdin = '';
  }

  // Use file-based I/O if machine is async and 9p is available, otherwise serial
  if (machine.stream && vm.isFs9pReady()) {
    vm.startJob(machineId, effectiveCmd, effectiveStdin || undefined)
      .then(jobId => {
        machine.activeJobId = jobId;
        machine.bytesRead = 0;
        machine.lastPollTime = performance.now();
        // Store startTime for pollCommandJob to use
        (machine as any)._cmdStartTime = startTime;
        console.log(`[CMD] Started job ${jobId} for ${machineId}`);
      })
      .catch(e => {
        console.error('[CMD] Failed to start job:', e);
        machine.processing = false;
        emitGameEvent('vmStatusChange', { status: 'error' });
        emitGameEvent('commandComplete', {
          machineId, command: machine.command, output: String(e), durationMs: performance.now() - startTime, error: true,
        });
      });
  } else {
    // Serial fallback: blocking exec via serial markers
    const execPromise = effectiveStdin && effectiveStdin.length > 0
      ? vm.pipeInShell(machineId, effectiveStdin, effectiveCmd, { forceSerial: !machine.stream })
      : vm.execInShell(machineId, effectiveCmd, { forceSerial: !machine.stream });

    execPromise.then(result => {
      if (result.cwd) machine.cwd = result.cwd;
      const output = result.output || '';
      if (output && output !== '(timeout)' && output !== '(error)') {
        machine.outputBuffer += output;
        if (!output.endsWith('\n')) {
          machine.outputBuffer += '\n';
        }
      }
      machine.lastCommandTime = performance.now();
      machine.processing = false;
      emitGameEvent('vmStatusChange', { status: 'ready' });
      emitGameEvent('commandComplete', {
        machineId, command: machine.command, output, durationMs: performance.now() - startTime, error: false,
      });
    }).catch(e => {
      console.error('[CMD] Legacy exec error:', e);
      machine.processing = false;
      emitGameEvent('vmStatusChange', { status: 'error' });
      emitGameEvent('commandComplete', {
        machineId, command: machine.command, output: String(e), durationMs: performance.now() - startTime, error: true,
      });
    });
  }
}

/** Non-blocking: poll a running file-based job for new output */
function pollCommandJob(
  machine: CommandMachine,
): void {
  if (!machine.activeJobId) return;

  // Throttle polls to ~100ms
  if (now - machine.lastPollTime < 100) return;
  machine.lastPollTime = now;

  const machineId = `m_${machine.x}_${machine.y}`;
  const cmdStartTime: number = (machine as any)._cmdStartTime || now;

  vm.pollJob(machine.activeJobId).then(result => {
    if (result.newOutput) {
      machine.outputBuffer += result.newOutput;
      machine.bytesRead += result.newOutput.length;
    }
    if (result.done) {
      if (result.cwd) machine.cwd = result.cwd;
      machine.lastCommandTime = performance.now();
      // Ensure output ends with newline
      if (machine.outputBuffer.length > 0 && !machine.outputBuffer.endsWith('\n')) {
        machine.outputBuffer += '\n';
      }
      // Cleanup
      const jobId = machine.activeJobId;
      machine.activeJobId = '';
      machine.processing = false;
      emitGameEvent('vmStatusChange', { status: 'ready' });
      vm.cleanupJob(jobId);
      console.log(`[CMD] Job ${jobId} completed`);
      emitGameEvent('commandComplete', {
        machineId, command: machine.command, output: machine.outputBuffer, durationMs: performance.now() - cmdStartTime, error: false, stream: machine.stream,
      });
    }
  }).catch(e => {
    console.error('[CMD] Poll error:', e);
    emitGameEvent('commandComplete', {
      machineId, command: machine.command, output: String(e), durationMs: performance.now() - cmdStartTime, error: true, stream: machine.stream,
    });
  });
}

/** Start a persistent FIFO-based stream for a stream-mode command machine */
function startStreamJob(
  machine: CommandMachine,
): void {
  if (!vm.isReady() || !vm.isFs9pReady()) return;

  const machineId = `m_${machine.x}_${machine.y}`;
  machine.processing = true;
  if (machine.autoStart) machine.autoStartRan = true;
  emitGameEvent('vmStatusChange', { status: 'busy' });
  emitGameEvent('commandStart', { machineId, command: machine.command, input: '', stream: true });

  vm.startStream(machineId, machine.command)
    .then(jobId => {
      machine.activeJobId = jobId;
      machine.bytesRead = 0;
      machine.lastPollTime = performance.now();
      machine.processing = false;
      (machine as any)._cmdStartTime = performance.now();
      console.log(`[CMD] Started stream ${jobId} for ${machineId}`);

      // Flush any pending input that arrived while starting
      if (machine.pendingInput.length > 0) {
        const len = machine.pendingInput.length;
        machine.streamBytesWritten += len;
        machine.lastStreamWriteTime = performance.now();
        emitGameEvent('streamWrite', { machineId, bytes: len });
        vm.writeToStream(jobId, machine.pendingInput);
        machine.pendingInput = '';
      }
    })
    .catch(e => {
      console.error('[CMD] Failed to start stream:', e);
      machine.processing = false;
      emitGameEvent('vmStatusChange', { status: 'error' });
    });
}

function applyMathOp(op: MathOp, value: number, operand: number): number {
  switch (op) {
    case 'add': return (value + operand) & 0xFF;
    case 'sub': return (value - operand + 256) & 0xFF;
    case 'mul': return (value * operand) & 0xFF;
    case 'mod': return operand === 0 ? value : value % operand;
    case 'xor': return (value ^ operand) & 0xFF;
    case 'and': return (value & operand) & 0xFF;
    case 'or':  return (value | operand) & 0xFF;
    case 'not': return (~value) & 0xFF;
  }
}

function deliverToMachine(machine: Machine, content: string, fromDir?: Direction): void {
  if (machine.type === MachineType.SINK) {
    emitGameEvent('sinkOutput', { sink: machine, content });
    emitGameEvent('sinkReceive', { char: content });
  } else if (machine.type === MachineType.DISPLAY) {
    if (content === '\n' || content === '\r') {
      if (machine.displayBuffer.length > 0) {
        machine.displayText = machine.displayBuffer;
        machine.displayTime = now;
        machine.displayBuffer = '';
      }
    } else {
      machine.displayBuffer += content;
      machine.lastByteTime = now;
    }
  } else if (machine.type === MachineType.COMMAND) {
    machine.pendingInput += content;
    machine.lastInputTime = now;
    if (machine.stream) {
      machine.streamBytesWritten += content.length;
      emitGameEvent('streamWrite', { machineId: `m_${machine.x}_${machine.y}`, bytes: content.length });
    } else {
      emitGameEvent('machineReceive', { char: content });
    }
  }
  // NULL machines silently discard packets
  // DUPLICATOR machines buffer input for replication to all outputs
  else if (machine.type === MachineType.DUPLICATOR) {
    machine.outputBuffer += content;
  }
  // FLIPPER machines queue input packets and rotate clockwise on each receive
  else if (machine.type === MachineType.FLIPPER) {
    // Rotate clockwise to the next direction that has a valid output belt
    for (let step = 1; step <= 4; step++) {
      const nextDir = ((machine.flipperState + step) % 4) as Direction;
      const delta = DirDelta[nextDir];
      const nx = machine.x + delta.dx;
      const ny = machine.y + delta.dy;
      const cell = getCell(nx, ny);
      if (cell.type === CellType.BELT && (cell as BeltCell).dir === nextDir) {
        machine.flipperState = nextDir;
        break;
      }
    }
    machine.outputQueue.push(content);
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
    machine.delayQueue.push({ char: content, time: now });
  }
  // PACKER: accumulate bytes until delimiter, then flush to outputBuffer
  else if (machine.type === MachineType.PACKER) {
    if (content === machine.packerDelimiter) {
      const packed = machine.accumulatedBuffer + (machine.preserveDelimiter ? content : '');
      machine.outputBuffer += packed;
      machine.accumulatedBuffer = '';
      machine.lastCommandTime = now;
      emitGameEvent('pack', { machineId: `m_${machine.x}_${machine.y}`, length: packed.length });
    } else {
      machine.accumulatedBuffer += content;
    }
  }
  // UNPACKER: dump all chars of received content into outputBuffer
  else if (machine.type === MachineType.UNPACKER) {
    machine.outputBuffer += content;
  }
  // ROUTER: route by match byte
  else if (machine.type === MachineType.ROUTER) {
    if (content === machine.routerByte) {
      machine.matchBuffer += content;
    } else {
      machine.elseBuffer += content;
    }
  }
  // GATE: dual-input conditional pass
  else if (machine.type === MachineType.GATE) {
    if (fromDir !== undefined && fromDir === machine.gateControlDir) {
      machine.gateOpen = true;
    } else if (fromDir !== undefined && fromDir === machine.gateDataDir) {
      if (machine.gateOpen) {
        machine.outputBuffer += content;
        machine.gateOpen = false;
      }
    } else {
      // No direction info - treat as data
      if (machine.gateOpen) {
        machine.outputBuffer += content;
        machine.gateOpen = false;
      }
    }
  }
  // WIRELESS: broadcast to all same-channel wireless machines
  else if (machine.type === MachineType.WIRELESS) {
    machine.lastCommandTime = now;
    machine.wifiArc = (machine.wifiArc + 1) % 4;
    for (const other of machines) {
      if (other.type === MachineType.WIRELESS && other !== machine && other.wirelessChannel === machine.wirelessChannel) {
        other.outputBuffer += content;
        other.lastCommandTime = now;
        other.wifiArc = (other.wifiArc + 1) % 4;
      }
    }
  }
  // REPLACE: byte substitution
  else if (machine.type === MachineType.REPLACE) {
    const matched = content === machine.replaceFrom;
    machine.outputBuffer += (matched ? machine.replaceTo : content);
    if (matched) machine.lastActivation = now;
  }
  // MATH: byte arithmetic
  else if (machine.type === MachineType.MATH) {
    const code = content.charCodeAt(0);
    const result = applyMathOp(machine.mathOp, code, machine.mathOperand);
    machine.outputBuffer += String.fromCharCode(result);
  }
  // CLOCK: ignores input
  // LATCH: dual-input store/emit
  else if (machine.type === MachineType.LATCH) {
    if (fromDir !== undefined && fromDir === machine.latchControlDir) {
      if (machine.latchStored) {
        machine.outputBuffer += machine.latchStored;
      }
    } else if (fromDir !== undefined && fromDir === machine.latchDataDir) {
      machine.latchStored = content;
    } else {
      // No direction info - treat as data
      machine.latchStored = content;
    }
  }

  // SPLITTER: buffer input for alternating dual-output
  else if (machine.type === MachineType.SPLITTER) {
    machine.outputBuffer += content;
  }
  // SEVENSEG: passthrough display
  else if (machine.type === MachineType.SEVENSEG) {
    machine.lastByte = content.charCodeAt(0);
    machine.outputBuffer += content;
    machine.lastCommandTime = now;
  }
  // DRUM: play sound based on byte mod 4, pass through
  else if (machine.type === MachineType.DRUM) {
    machine.outputBuffer += content;
    machine.lastCommandTime = now;
    emitGameEvent('drumHit', { sample: content.charCodeAt(0) % 4 });
  }
  // TONE: continuous oscillator, consumes byte (terminal)
  else if (machine.type === MachineType.TONE) {
    machine.lastCommandTime = now;
    emitGameEvent('toneNote', { machineId: `m_${machine.x}_${machine.y}`, byte: content.charCodeAt(0), waveform: machine.waveform });
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
	const maxY = 100000;  // large enough for any practical grid

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

  const nextCell = getCell(nextX, nextY);

  // Fell into empty space - orphan the packet
  if (nextCell.type === CellType.EMPTY) {
    orphanPacket(state, packet, nextX, nextY);
    return false;
  }

  // Entering a machine
  if (nextCell.type === CellType.MACHINE) {
    const machineCell = nextCell as MachineCell;
    deliverToMachine(machineCell.machine, packet.content, ((packet.dir + 2) % 4) as Direction);
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
  }

  return true;
}

function processCommandInput(
  machine: CommandMachine,
): void {
  if (machine.processing) return;

  // AutoStart commands run without input
  if (machine.autoStart && !machine.autoStartRan) {
    machine.autoStartRan = true;
    startCommandJob(machine, '');
    return;
  }

  if (machine.pendingInput.length === 0) return;

  // Process when we have a complete line
  const newlineIdx = machine.pendingInput.indexOf('\n');
  if (newlineIdx === -1) return;

  const line = machine.pendingInput.substring(0, newlineIdx + 1);
  machine.pendingInput = machine.pendingInput.substring(newlineIdx + 1);

  startCommandJob(machine, line);
}

function emitFromSplitter(state: GameState, machine: SplitterMachine): boolean {
  const dir = machine.dir;
  const delta = DirDelta[dir];
  const sec = getSplitterSecondary(machine);

  // Primary output: machine position + forward
  const out0 = { x: machine.x + delta.dx, y: machine.y + delta.dy };
  // Secondary output: secondary position + forward
  const out1 = { x: sec.x + delta.dx, y: sec.y + delta.dy };

  const outputs = [out0, out1];
  const toggleSide = machine.toggle;
  const otherSide = 1 - toggleSide;

  // Try toggle side first, then overflow to other side
  for (const side of [toggleSide, otherSide]) {
    const o = outputs[side];
    const cell = getCell(o.x, o.y);
    // Accept belt cells matching direction, or machine cells
    const canAccept =
      (cell.type === CellType.BELT && (cell as BeltCell).dir === dir) ||
      cell.type === CellType.MACHINE;
    if (!canAccept) continue;
    if (!isCellEmpty(state, o.x, o.y)) continue;

    const char = machine.outputBuffer[0];
    machine.outputBuffer = machine.outputBuffer.slice(1);
    createPacket(state, o.x, o.y, char, dir);
    machine.toggle = 1 - machine.toggle;
    return true;
  }

  return false;
}

function emitFromMachine(state: GameState, machine: Machine): boolean {
  const output = findMachineOutput(machine);
  if (!output) return false;

  if (!isCellEmpty(state, output.x, output.y)) return false;

  if (machine.type === MachineType.SOURCE) {
    if (machine.sourcePos < machine.sourceText.length) {
      const char = machine.sourceText[machine.sourcePos];
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
  } else if (machine.type === MachineType.LINEFEED) {
    const adjustedDelay = machine.emitInterval / state.timescale;
    if (now - machine.lastEmitTime > adjustedDelay) {
      createPacket(state, output.x, output.y, '\n', output.dir);
      machine.lastEmitTime = now;
      return true;
    }
  } else if (machine.type === MachineType.DUPLICATOR) {
    if (machine.outputBuffer.length > 0) {
      const outputs = findFlipperOutputs(machine);
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
    if (machine.outputQueue.length > 0) {
      const dir = machine.flipperState as Direction;
      const delta = DirDelta[dir];
      const nx = machine.x + delta.dx;
      const ny = machine.y + delta.dy;
      const cell = getCell(nx, ny);
      if (cell.type !== CellType.BELT || (cell as BeltCell).dir !== dir) return false;
      if (!isCellEmpty(state, nx, ny)) return false;
      const packet = machine.outputQueue.shift()!;
      createPacket(state, nx, ny, packet, dir);
      return true;
    }
  } else if (machine.type === MachineType.CONSTANT) {
    if (machine.constantText.length === 0) return false;
    const adjustedDelay = machine.emitInterval / state.timescale;
    if (now - machine.lastEmitTime > adjustedDelay) {
      const char = machine.constantText[machine.constantPos];
      createPacket(state, output.x, output.y, char, output.dir);
      machine.constantPos = (machine.constantPos + 1) % machine.constantText.length;
      machine.lastEmitTime = now;
      return true;
    }
  } else if (machine.type === MachineType.FILTER || machine.type === MachineType.COUNTER || machine.type === MachineType.DELAY || machine.type === MachineType.KEYBOARD || machine.type === MachineType.UNPACKER) {
    if (machine.outputBuffer.length > 0) {
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, output.x, output.y, char, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.PACKER) {
    if (machine.outputBuffer.length > 0) {
      const dir = machine.packerDir;
      const delta = DirDelta[dir];
      const nx = machine.x + delta.dx;
      const ny = machine.y + delta.dy;
      const cell = getCell(nx, ny);
      if (cell.type !== CellType.BELT || (cell as BeltCell).dir !== dir) return false;
      if (!isCellEmpty(state, nx, ny)) return false;
      createPacket(state, nx, ny, machine.outputBuffer, dir);
      machine.outputBuffer = '';
      return true;
    }
  } else if (machine.type === MachineType.ROUTER) {
    // Dual-buffer directional emit
    let emitted = false;
    if (machine.matchBuffer.length > 0) {
      const dir = machine.routerMatchDir;
      const delta = DirDelta[dir];
      const nx = machine.x + delta.dx;
      const ny = machine.y + delta.dy;
      const cell = getCell(nx, ny);
      if (cell.type === CellType.BELT && (cell as BeltCell).dir === dir && isCellEmpty(state, nx, ny)) {
        const char = machine.matchBuffer[0];
        machine.matchBuffer = machine.matchBuffer.slice(1);
        createPacket(state, nx, ny, char, dir);
        emitted = true;
      }
    }
    if (machine.elseBuffer.length > 0) {
      const dir = machine.routerElseDir;
      const delta = DirDelta[dir];
      const nx = machine.x + delta.dx;
      const ny = machine.y + delta.dy;
      const cell = getCell(nx, ny);
      if (cell.type === CellType.BELT && (cell as BeltCell).dir === dir && isCellEmpty(state, nx, ny)) {
        const char = machine.elseBuffer[0];
        machine.elseBuffer = machine.elseBuffer.slice(1);
        createPacket(state, nx, ny, char, dir);
        emitted = true;
      }
    }
    return emitted;
  } else if (machine.type === MachineType.CLOCK) {
    const adjustedDelay = machine.emitInterval / state.timescale;
    if (now - machine.lastEmitTime > adjustedDelay) {
      const output = findMachineOutput(machine);
      if (!output) return false;
      if (!isCellEmpty(state, output.x, output.y)) return false;
      createPacket(state, output.x, output.y, machine.clockByte, output.dir);
      machine.lastEmitTime = now;
      return true;
    }
  } else if (machine.type === MachineType.GATE || machine.type === MachineType.WIRELESS || machine.type === MachineType.REPLACE || machine.type === MachineType.MATH || machine.type === MachineType.LATCH || machine.type === MachineType.SEVENSEG || machine.type === MachineType.DRUM) {
    if (machine.outputBuffer.length > 0) {
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, output.x, output.y, char, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.SPLITTER) {
    if (machine.outputBuffer.length > 0) {
      return emitFromSplitter(state, machine);
    }
  }

  return false;
}

export function updateSimulation(
  state: GameState,
): void {
  if (!state.running) return;

  // Emit from source, command, and buffering machines
  const adjustedDelay = state.emitDelay / state.timescale;
  if (now - state.lastEmitTime > adjustedDelay) {
    for (const machine of machines) {
      if (machine.type === MachineType.SOURCE || machine.type === MachineType.COMMAND || machine.type === MachineType.FLIPPER || machine.type === MachineType.DUPLICATOR || machine.type === MachineType.FILTER || machine.type === MachineType.COUNTER || machine.type === MachineType.DELAY || machine.type === MachineType.KEYBOARD || machine.type === MachineType.PACKER || machine.type === MachineType.UNPACKER || machine.type === MachineType.ROUTER || machine.type === MachineType.GATE || machine.type === MachineType.WIRELESS || machine.type === MachineType.REPLACE || machine.type === MachineType.MATH || machine.type === MachineType.LATCH || machine.type === MachineType.SPLITTER || machine.type === MachineType.SEVENSEG || machine.type === MachineType.DRUM) {
        if (emitFromMachine(state, machine)) {
          state.lastEmitTime = now;
        }
      }
    }
  }

  // Linefeed, constant, and clock machines emit on their own timer
  for (const machine of machines) {
    if (machine.type === MachineType.LINEFEED || machine.type === MachineType.CONSTANT || machine.type === MachineType.CLOCK) {
      emitFromMachine(state, machine);
    }
  }

  // Process delay queues: move ready items to outputBuffer
  for (const machine of machines) {
    if (machine.type === MachineType.DELAY && machine.delayQueue.length > 0) {
      while (machine.delayQueue.length > 0 && now - machine.delayQueue[0].time >= machine.delayMs) {
        machine.outputBuffer += machine.delayQueue.shift()!.char;
      }
    }
  }

  // Process command machines and check display timeouts
  for (const machine of machines) {
    if (machine.type === MachineType.COMMAND) {
      if (machine.stream && vm.isFs9pReady()) {
        // Stream mode: FIFO-based persistent command
        if (machine.activeJobId) {
          // Write any pending input to the FIFO
          if (machine.pendingInput.length > 0) {
            const len = machine.pendingInput.length;
            machine.streamBytesWritten += len;
            machine.lastStreamWriteTime = now;
            emitGameEvent('streamWrite', { machineId: `m_${machine.x}_${machine.y}`, bytes: len });
            vm.writeToStream(machine.activeJobId, machine.pendingInput);
            machine.pendingInput = '';
          }
          // Poll for output
          pollCommandJob(machine);
        } else if (!machine.processing) {
          if ((machine.autoStart && !machine.autoStartRan) || machine.pendingInput.length > 0) {
            startStreamJob(machine);
          }
        }
      } else {
        // Non-stream: one-shot job per input line
        if (machine.activeJobId) {
          pollCommandJob(machine);
        } else if (!machine.processing) {
          if ((machine.autoStart && !machine.autoStartRan) || machine.pendingInput.length > 0) {
            processCommandInput(machine);
          }
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
    if (!updatePacket(state, state.packets[i], delta)) {
      state.packets.splice(i, 1);
    }
  }

  // Update orphaned packets (gravity physics)
  updateOrphanedPackets(state, delta);
}
