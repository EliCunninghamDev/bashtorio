import {
  GRID_SIZE,
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
  SINK_DRAIN_SLOTS,
  PACKET_SIZE,
} from './types';
import { viewportBounds } from './camera';

import type { GameState } from './state';
import { getCell } from './grid';
import { getSplitterSecondary } from './edit';
import { machines } from './machines';
import { createPacket, isCellEmpty } from './packets';
import { emitGameEvent, onGameEvent } from '../events/bus';
import type { Settings } from '../util/settings';
import { saveSettings } from '../util/settings';
import { MarkerShell } from '../vm/markerShell';
import * as vm from './vm';
import { now, delta } from './clock';
import { createLogger } from '../util/logger';

const log = createLogger('CMD');

/** MarkerShell instances for non-stream COMMAND machines (keyed by machine object) */
const markerShells = new WeakMap<CommandMachine, MarkerShell>();

/** Wire event-bus listeners that belong to the simulation layer. */
export function setupSimulationEvents(state: GameState, settings: Settings): void {
  onGameEvent('simulationKeyPress', ({ char }) => {
    for (const machine of machines) {
      if (machine.type === MachineType.KEYBOARD) {
        machine.outputBuffer += char;
      }
    }
  });

  onGameEvent('startSimulation', async () => {
    if (!state.running) {
      emitGameEvent('modeChange', { mode: 'select' });
      await startSimulation(state);
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

  onGameEvent('beltSpeedSet', ({ beltSpeed }) => {
    state.beltSpeed = beltSpeed;
    emitGameEvent('beltSpeedChanged', { beltSpeed });
  });

  onGameEvent('machineInteract', ({ machine }) => {
    if (!state.running) return;
    switch (machine.type) {
      case MachineType.BUTTON:
        machine.outputQueue.push(machine.buttonByte);
        machine.lastCommandTime = performance.now();
        break;
      case MachineType.KEYBOARD:
        emitGameEvent('requestKeyboardFocus');
        break;
    }
  });
}

export async function startSimulation(state: GameState): Promise<void> {
  if (state.running) return;

  state.running = true;
  state.packets = [];
  state.orphanedPackets = [];

  // Reset machines
  for (const machine of machines) {
    switch (machine.type) {
      case MachineType.SOURCE:
        machine.sourcePos = 0;
        machine.clock.reset();
        machine.gapTimer.timeRemaining = 0;
        break;
      case MachineType.SINK:
        machine.drainRing = [];
        machine.drainHead = 0;
        break;
      case MachineType.COMMAND:
        machine.pendingInput = '';
        machine.outputBuffer = '';
        machine.processing = false;
        machine.lastInputTime = 0;
        machine.autoStartRan = false;
        machine.shell = null;
        machine.pollPending = false;
        machine.bytesIn = 0;
        machine.bytesOut = 0;
        markerShells.delete(machine);
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
        machine.outputQueue = [];
        break;
      case MachineType.KEYBOARD:
      case MachineType.UNPACKER:
        machine.outputBuffer = '';
        break;
      case MachineType.COUNTER:
        machine.counterCount = 0;
        machine.outputBuffer = '';
        break;
      case MachineType.DELAY:
        machine.delayQueue = [];
        machine.outputQueue = [];
        break;
      case MachineType.LINEFEED:
        machine.clock.reset();
        break;
      case MachineType.PACKER:
        machine.accumulatedBuffer = '';
        machine.outputBuffer = '';
        break;
      case MachineType.ROUTER:
        machine.matchQueue = [];
        machine.elseQueue = [];
        break;
      case MachineType.GATE:
        machine.gateOpen = false;
        machine.outputQueue = [];
        break;
      case MachineType.WIRELESS:
        machine.outputQueue = [];
        machine.wifiArc = 0;
        break;
      case MachineType.REPLACE:
      case MachineType.MATH:
        machine.outputBuffer = '';
        break;
      case MachineType.SPLITTER:
        machine.outputQueue = [];
        machine.toggle = 0;
        break;
      case MachineType.SEVENSEG:
        machine.lastByte = -1;
        machine.outputQueue = [];
        break;
      case MachineType.DRUM:
        machine.outputQueue = [];
        break;
      case MachineType.CLOCK:
        machine.clock.reset();
        break;
      case MachineType.LATCH:
        machine.latchStored = '';
        machine.outputQueue = [];
        break;
      // TONE - silence on start
      case MachineType.TONE:
        emitGameEvent('toneNote', { machineId: `m_${machine.x}_${machine.y}`, byte: 0, waveform: machine.waveform, dutyCycle: machine.dutyCycle });
        break;
      case MachineType.NOISE:
        emitGameEvent('noiseNote', { machineId: `m_${machine.x}_${machine.y}`, byte: 0, mode: machine.noiseMode });
        break;
      case MachineType.SPEAK:
        machine.accumulatedBuffer = '';
        machine.displayText = '';
        machine.displayTime = 0;
        break;
      case MachineType.SCREEN:
        machine.writePos = 0;
        machine.buffer.fill(0);
        break;
      case MachineType.BYTE:
        machine.bytePos = 0;
        machine.clock.reset();
        machine.gapTimer.timeRemaining = 0;
        break;
      case MachineType.PUNCHCARD:
        machine.cardPos = 0;
        machine.clock.reset();
        machine.gapTimer.timeRemaining = 0;
        break;
      case MachineType.TNT:
        machine.packetCount = 0;
        machine.stored = [];
        machine.exploded = false;
        break;
      case MachineType.BUTTON:
        machine.outputQueue = [];
        break;
      // SINK, NULL - no runtime state to reset
    }
  }

  // Pre-create shells for autoStart commands before the sim loop ticks
  await createAllAutostartShells();
}

/** Create a ShellInstance for a command machine */
async function initCommandShell(machine: CommandMachine): Promise<void> {
  const machineId = `m_${machine.x}_${machine.y}`;
  machine.processing = true;

  try {
    const shell = await vm.createShell(machine.cwd);
    machine.shell = shell;
    machine.processing = false;
    log.info(`Shell ready for ${machineId}`);

    // Non-stream machines get a MarkerShell wrapper
    if (!machine.stream) {
      markerShells.set(machine, new MarkerShell(shell));
    }
  } catch (e) {
    log.error(`Failed to create shell for ${machineId}:`, e);
    machine.processing = false;
    emitGameEvent('vmStatusChange', { status: 'error' });
  }
}

/** Pre-create shells for all autoStart command machines so they're ready before the sim ticks */
async function createAllAutostartShells(): Promise<void> {
  if (!vm.isReady() || !vm.isFs9pReady()) return;

  const promises: Promise<void>[] = [];
  for (const machine of machines) {
    if (machine.type === MachineType.COMMAND && machine.autoStart) {
      promises.push(initCommandShell(machine));
    }
  }
  await Promise.all(promises);
}

export function stopSimulation(state: GameState): void {
  state.running = false;
  state.orphanedPackets = [];

  // Stop active shells, silence tones, cancel speech
  for (const machine of machines) {
    if (machine.type === MachineType.COMMAND) {
      if (machine.shell) machine.shell.stop();
      machine.shell = null;
      machine.pendingInput = '';
      machine.outputBuffer = '';
      machine.processing = false;
      machine.lastInputTime = 0;
      machine.autoStartRan = false;
      machine.pollPending = false;
      machine.bytesIn = 0;
      machine.bytesOut = 0;
      markerShells.delete(machine);
    }
    if (machine.type === MachineType.TONE) {
      emitGameEvent('toneNote', { machineId: `m_${machine.x}_${machine.y}`, byte: 0, waveform: machine.waveform, dutyCycle: machine.dutyCycle });
    }
    if (machine.type === MachineType.NOISE) {
      emitGameEvent('noiseNote', { machineId: `m_${machine.x}_${machine.y}`, byte: 0, mode: machine.noiseMode });
    }
    if (machine.type === MachineType.TNT) {
      machine.packetCount = 0;
      machine.stored = [];
      machine.exploded = false;
    }
  }
  emitGameEvent('speakCancel');
}

export async function toggleSimulation(state: GameState): Promise<void> {
  if (state.running) {
    stopSimulation(state);
    emitGameEvent('simulationEnded');
  } else {
    await startSimulation(state);
    emitGameEvent('simulationStarted');
  }
}

export async function startSim(state: GameState): Promise<void> {
  if (!state.running) {
    await startSimulation(state);
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

// ---------------------------------------------------------------------------
// Command machine input processing
// ---------------------------------------------------------------------------

/** Write pending input to a command machine's shell */
function processCommandInput(machine: CommandMachine): void {
  if (!machine.shell || machine.processing) return;

  const machineId = `m_${machine.x}_${machine.y}`;

  // Stream mode: start command on first input, then write raw
  if (machine.stream) {
    if (!machine.autoStartRan) {
      machine.autoStartRan = true;
      machine.shell.write(`stdbuf -o0 ${machine.command}\n`);
      emitGameEvent('commandStart', { machineId, command: machine.command, input: '', stream: true });
    }
    if (machine.pendingInput.length > 0) {
      const bytes = machine.pendingInput.length;
      machine.shell.write(machine.pendingInput);
      machine.bytesIn += bytes;
      emitGameEvent('streamWrite', { machineId, bytes });
      machine.pendingInput = '';
    }
    return;
  }

  const ms = markerShells.get(machine);
  if (!ms) return;

  // AutoStart commands run without input
  if (machine.autoStart && !machine.autoStartRan) {
    machine.autoStartRan = true;
    ms.execBare(machine.command);
    machine.processing = true;
    emitGameEvent('vmStatusChange', { status: 'busy' });
    emitGameEvent('commandStart', { machineId, command: machine.command, input: '', inputMode: machine.inputMode });
    return;
  }

  if (machine.pendingInput.length === 0) return;

  // Non-stream: process when we have a complete line
  const newlineIdx = machine.pendingInput.indexOf('\n');
  if (newlineIdx === -1) return;

  const line = machine.pendingInput.substring(0, newlineIdx + 1);
  machine.pendingInput = machine.pendingInput.substring(newlineIdx + 1);
  const input = line.replace(/\n$/, '');

  ms.exec(machine.command, input, machine.inputMode);
  machine.bytesIn += input.length;
  machine.processing = true;
  emitGameEvent('vmStatusChange', { status: 'busy' });
  emitGameEvent('commandStart', { machineId, command: machine.command, input, inputMode: machine.inputMode });
}

/** Poll a command machine's shell for output */
function pollCommandOutput(machine: CommandMachine): void {
  if (!machine.shell) return;

  if (machine.pollPending) return;
  machine.pollPending = true;

  const machineId = `m_${machine.x}_${machine.y}`;

  const pollStderr = () => {
    machine.shell!.readErr().then(stderr => {
      if (stderr) emitGameEvent('commandError', { machineId, command: machine.command, stderr });
    }).catch(() => {});
  };

  if (machine.stream) {
    // Stream mode: output flows continuously, no markers
    machine.shell.read().then(output => {
      if (!output) return;
      machine.outputBuffer += output;
      machine.bytesOut += output.length;
      machine.lastCommandTime = performance.now();
    }).catch(e => {
      log.error('Poll error:', e);
    }).finally(() => {
      pollStderr();
      machine.pollPending = false;
    });
    return;
  }

  // Non-stream: delegate to MarkerShell
  const ms = markerShells.get(machine);
  if (!ms) { machine.pollPending = false; return; }

  ms.poll().then(result => {
    if (result === null) return;

    if (result.length > 0) {
      machine.outputBuffer += result;
      machine.bytesOut += result.length;
    }

    machine.processing = false;
    machine.lastCommandTime = performance.now();
    emitGameEvent('vmStatusChange', { status: 'ready' });
    emitGameEvent('commandComplete', {
      machineId, command: machine.command, output: machine.outputBuffer, durationMs: performance.now() - ms.lastExecTime, error: false,
    });
  }).catch(e => {
    log.error('Poll error:', e);
  }).finally(() => {
    pollStderr();
    machine.pollPending = false;
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

/** Returns true if the machine accepted the packet, false if rejected. */
function deliverToMachine(state: GameState, machine: Machine, content: string, fromDir?: Direction): boolean {
  if (machine.type === MachineType.SINK) {
    // Push into circular drain-animation ring
    const entry = { char: content, time: now };
    if (machine.drainRing.length < SINK_DRAIN_SLOTS) {
      machine.drainRing.push(entry);
      machine.drainHead = machine.drainRing.length % SINK_DRAIN_SLOTS;
    } else {
      machine.drainRing[machine.drainHead] = entry;
      machine.drainHead = (machine.drainHead + 1) % SINK_DRAIN_SLOTS;
    }
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
      emitGameEvent('streamWrite', { machineId: `m_${machine.x}_${machine.y}`, bytes: content.length });
    } else {
      emitGameEvent('machineReceive', { char: content });
    }
  }
  // NULL machines silently discard packets
  // DUPLICATOR machines buffer input for replication to all outputs
  else if (machine.type === MachineType.DUPLICATOR) {
    machine.outputQueue.push(content);
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
    emitGameEvent('flipperRotate');
  }
  // FILTER: pass or block a specific byte
  else if (machine.type === MachineType.FILTER) {
    const match = content === machine.filterByte;
    if ((machine.filterMode === 'pass' && match) || (machine.filterMode === 'block' && !match)) {
      machine.outputQueue.push(content);
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
      machine.matchQueue.push(content);
    } else {
      machine.elseQueue.push(content);
    }
  }
  // GATE: dual-input conditional pass
  else if (machine.type === MachineType.GATE) {
    if (fromDir !== undefined && fromDir === machine.gateControlDir) {
      machine.gateOpen = true;
      emitGameEvent('gateOpen');
    } else if (fromDir !== undefined && fromDir === machine.gateDataDir) {
      if (machine.gateOpen) {
        machine.outputQueue.push(content);
        machine.gateOpen = false;
        emitGameEvent('gatePass');
      }
    } else {
      // No direction info - treat as data
      if (machine.gateOpen) {
        machine.outputQueue.push(content);
        machine.gateOpen = false;
        emitGameEvent('gatePass');
      }
    }
  }
  // WIRELESS: broadcast to all same-channel wireless machines
  else if (machine.type === MachineType.WIRELESS) {
    machine.lastCommandTime = now;
    machine.wifiArc = (machine.wifiArc + 1) % 4;
    for (const other of machines) {
      if (other.type === MachineType.WIRELESS && other !== machine && other.wirelessChannel === machine.wirelessChannel) {
        other.outputQueue.push(content);
        other.lastCommandTime = now;
        other.wifiArc = (other.wifiArc + 1) % 4;
      }
    }
    emitGameEvent('wirelessSend');
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
        machine.outputQueue.push(machine.latchStored);
        emitGameEvent('latchRelease');
      }
    } else if (fromDir !== undefined && fromDir === machine.latchDataDir) {
      machine.latchStored = content;
      emitGameEvent('latchStore');
    } else {
      // No direction info - treat as data
      machine.latchStored = content;
      emitGameEvent('latchStore');
    }
  }

  // SPLITTER: buffer input for alternating dual-output
  else if (machine.type === MachineType.SPLITTER) {
    machine.outputQueue.push(content);
  }
  // SEVENSEG: passthrough display
  else if (machine.type === MachineType.SEVENSEG) {
    machine.lastByte = content.charCodeAt(0);
    machine.outputQueue.push(content);
    machine.lastCommandTime = now;
  }
  // DRUM: play sound based on byte, pass through
  else if (machine.type === MachineType.DRUM) {
    machine.outputQueue.push(content);
    machine.lastCommandTime = now;
    const byte = content.charCodeAt(0);
    if (machine.bitmask) {
      for (let i = 0; i < 4; i++) {
        if (byte & (1 << i)) emitGameEvent('drumHit', { sample: i });
      }
    } else {
      emitGameEvent('drumHit', { sample: byte % 4 });
    }
  }
  // TONE: continuous oscillator, consumes byte (terminal)
  else if (machine.type === MachineType.TONE) {
    machine.lastCommandTime = now;
    emitGameEvent('toneNote', { machineId: `m_${machine.x}_${machine.y}`, byte: content.charCodeAt(0), waveform: machine.waveform, dutyCycle: machine.dutyCycle });
  }
  // NOISE: LFSR noise channel, consumes byte (terminal)
  else if (machine.type === MachineType.NOISE) {
    const byte = content.charCodeAt(0);
    machine.lastCommandTime = byte === 0 ? 0 : now;
    emitGameEvent('noiseNote', { machineId: `m_${machine.x}_${machine.y}`, byte, mode: machine.noiseMode });
  }
  // SPEAK: accumulate bytes, speak on delimiter (terminal)
  else if (machine.type === MachineType.SPEAK) {
    if (content === machine.speakDelimiter) {
      if (machine.accumulatedBuffer.length > 0) {
        machine.displayText = machine.accumulatedBuffer;
        machine.displayTime = now;
        emitGameEvent('speak', { text: machine.accumulatedBuffer, rate: machine.speakRate, pitch: machine.speakPitch });
        machine.accumulatedBuffer = '';
        machine.lastCommandTime = now;
      }
    } else {
      machine.accumulatedBuffer += content;
    }
  }
  // SCREEN: write bytes into circular buffer (terminal, no re-emission)
  else if (machine.type === MachineType.SCREEN) {
    machine.lastCommandTime = now;
    for (let i = 0; i < content.length; i++) {
      machine.buffer[machine.writePos] = content.charCodeAt(i);
      machine.writePos = (machine.writePos + 1) % machine.buffer.length;
    }
  }
  // TNT: collect packets, explode at 20
  else if (machine.type === MachineType.TNT) {
    if (machine.exploded) return false;
    machine.stored.push(content);
    machine.packetCount++;
    machine.lastCommandTime = now;
    emitGameEvent('tntSpark', { machineId: `m_${machine.x}_${machine.y}`, count: machine.packetCount });
    if (machine.packetCount >= 20) {
      machine.exploded = true;
      const count = machine.stored.length;
      const speed = state.beltSpeed * 3;
      const centerX = machine.x * GRID_SIZE + GRID_SIZE / 2;
      const centerY = machine.y * GRID_SIZE + GRID_SIZE / 2;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        state.orphanedPackets.push({
          id: state.packetId++,
          worldX: centerX,
          worldY: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          content: machine.stored[i],
          age: 0,
        });
      }
      machine.stored = [];
      emitGameEvent('tntExplode', { machineId: `m_${machine.x}_${machine.y}`, x: machine.x, y: machine.y, count });
    }
  }
  // KEYBOARD: output-only, no-op on receive
  return true;
}

// A packet must never move more than one cell per frame, or it skips cells.
const MAX_PACKET_STEP = GRID_SIZE - 1;
const ORPHAN_GRAVITY = 0.15;
const ORPHAN_MAX_AGE = 10000;
const ORPHAN_BOUNCE = 0.7;   // velocity retained after bounce

function orphanPacket(state: GameState, packet: Packet, cellX: number, cellY: number): void {
	const worldX = cellX * GRID_SIZE + packet.offsetX;
	const worldY = cellY * GRID_SIZE + packet.offsetY;
	const delta = DirDelta[packet.dir];

	state.orphanedPackets.push({
		id: state.packetId++,
		worldX,
		worldY,
		vx: delta.dx * state.beltSpeed * 1.5,
		vy: delta.dy * state.beltSpeed * 1.5,
		content: packet.content,
		age: 0,
	});
}

function updateOrphanedPackets(state: GameState, deltaTime: number): void {
	const timeScale = state.timescale * (deltaTime / 16);
	const bounds = viewportBounds();
	const margin = PACKET_SIZE / 2;

	for (let i = state.orphanedPackets.length - 1; i >= 0; i--) {
		const op = state.orphanedPackets[i];

		op.vy += ORPHAN_GRAVITY * timeScale;
		op.worldX += op.vx * timeScale;
		op.worldY += op.vy * timeScale;
		op.age += deltaTime;

		// Bounce off viewport edges
		if (op.worldX < bounds.left + margin) {
			op.worldX = bounds.left + margin;
			op.vx = Math.abs(op.vx) * ORPHAN_BOUNCE;
		} else if (op.worldX > bounds.right - margin) {
			op.worldX = bounds.right - margin;
			op.vx = -Math.abs(op.vx) * ORPHAN_BOUNCE;
		}
		if (op.worldY < bounds.top + margin) {
			op.worldY = bounds.top + margin;
			op.vy = Math.abs(op.vy) * ORPHAN_BOUNCE;
		} else if (op.worldY > bounds.bottom - margin) {
			op.worldY = bounds.bottom - margin;
			op.vy = -Math.abs(op.vy) * ORPHAN_BOUNCE;
		}

		if (op.age > ORPHAN_MAX_AGE) {
			state.orphanedPackets.splice(i, 1);
		}
	}
}

function updatePacket(
  state: GameState,
  packet: Packet,
  deltaTime: number,
): boolean {
  const raw = state.beltSpeed * state.timescale * (deltaTime / 16);
  const speed = Math.min(raw, MAX_PACKET_STEP);
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
    const accepted = deliverToMachine(state, machineCell.machine, packet.content, ((packet.dir + 2) % 4) as Direction);
    if (!accepted) {
      orphanPacket(state, packet, nextX, nextY);
    }
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

    const packet = machine.outputQueue.shift()!;
    createPacket(state, o.x, o.y, packet, dir);
    machine.toggle = 1 - machine.toggle;
    return true;
  }

  return false;
}

function emitFromMachine(state: GameState, machine: Machine): boolean {
  const dt = delta * state.timescale;

  // --- Timer machines: advance clock before checking output ---

  if (machine.type === MachineType.SOURCE) {
    if (machine.sourceText.length === 0) return false;
    if (machine.sourcePos >= machine.sourceText.length) return false;
    if (machine.gapTimer.timeRemaining > 0) {
      machine.gapTimer.advance(dt);
      if (!machine.gapTimer.shouldTick()) return false;
      machine.clock.start(-machine.gapTimer.timeRemaining);
    } else {
      machine.clock.advance(dt);
    }
    if (!machine.clock.shouldTick()) return false;
    const output = findMachineOutput(machine);
    if (!output || !isCellEmpty(state, output.x, output.y)) return false;
    const char = machine.sourceText[machine.sourcePos];
    createPacket(state, output.x, output.y, char, output.dir);
    const drift = -machine.clock.timeRemaining;
    machine.sourcePos++;
    if (machine.sourcePos >= machine.sourceText.length) {
      if (machine.loop) {
        machine.sourcePos = 0;
        if (machine.gapTimer.interval > 0) {
          machine.gapTimer.start(drift);
          return true;
        }
      }
    }
    machine.clock.start(drift);
    return true;
  }

  if (machine.type === MachineType.LINEFEED) {
    machine.clock.advance(dt);
    if (!machine.clock.shouldTick()) return false;
    const output = findMachineOutput(machine);
    if (!output || !isCellEmpty(state, output.x, output.y)) return false;
    createPacket(state, output.x, output.y, '\n', output.dir);
    machine.clock.start(-machine.clock.timeRemaining);
    return true;
  }

  if (machine.type === MachineType.CLOCK) {
    machine.clock.advance(dt);
    if (!machine.clock.shouldTick()) return false;
    const output = findMachineOutput(machine);
    if (!output || !isCellEmpty(state, output.x, output.y)) return false;
    createPacket(state, output.x, output.y, machine.clockByte, output.dir);
    machine.clock.start(-machine.clock.timeRemaining);
    return true;
  }

  if (machine.type === MachineType.BYTE) {
    if (machine.byteData.length === 0) return false;
    if (machine.gapTimer.timeRemaining > 0) {
      machine.gapTimer.advance(dt);
      if (!machine.gapTimer.shouldTick()) return false;
      machine.clock.start(-machine.gapTimer.timeRemaining);
    } else {
      machine.clock.advance(dt);
    }
    if (!machine.clock.shouldTick()) return false;
    const output = findMachineOutput(machine);
    if (!output || !isCellEmpty(state, output.x, output.y)) return false;
    const char = String.fromCharCode(machine.byteData[machine.bytePos]);
    createPacket(state, output.x, output.y, char, output.dir);
    const drift = -machine.clock.timeRemaining;
    machine.bytePos = (machine.bytePos + 1) % machine.byteData.length;
    if (machine.bytePos === 0 && machine.gapTimer.interval > 0) {
      machine.gapTimer.start(drift);
      return true;
    }
    machine.clock.start(drift);
    return true;
  }

  if (machine.type === MachineType.PUNCHCARD) {
    if (machine.cardData.length === 0) return false;
    if (machine.cardPos >= machine.cardData.length) return false;
    if (machine.gapTimer.timeRemaining > 0) {
      machine.gapTimer.advance(dt);
      if (!machine.gapTimer.shouldTick()) return false;
      machine.clock.start(-machine.gapTimer.timeRemaining);
    } else {
      machine.clock.advance(dt);
    }
    if (!machine.clock.shouldTick()) return false;
    const output = findMachineOutput(machine);
    if (!output || !isCellEmpty(state, output.x, output.y)) return false;
    const char = String.fromCharCode(machine.cardData[machine.cardPos]);
    createPacket(state, output.x, output.y, char, output.dir);
    const drift = -machine.clock.timeRemaining;
    machine.cardPos++;
    if (machine.cardPos >= machine.cardData.length) {
      if (machine.loop) {
        machine.cardPos = 0;
        if (machine.gapTimer.interval > 0) {
          machine.gapTimer.start(drift);
          return true;
        }
      }
    }
    machine.clock.start(drift);
    return true;
  }

  // --- Buffering machines: emit freely when output is clear ---

  const output = findMachineOutput(machine);
  if (!output) return false;
  if (!isCellEmpty(state, output.x, output.y)) return false;

  if (machine.type === MachineType.COMMAND) {
    if (machine.outputBuffer.length > 0) {
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, output.x, output.y, char, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.DUPLICATOR) {
    if (machine.outputQueue.length > 0) {
      const outputs = findFlipperOutputs(machine);
      if (outputs.length === 0) return false;
      for (const o of outputs) {
        if (!isCellEmpty(state, o.x, o.y)) return false;
      }
      const packet = machine.outputQueue.shift()!;
      for (const o of outputs) {
        createPacket(state, o.x, o.y, packet, o.dir);
      }
      return true;
    }
  } else if (machine.type === MachineType.FLIPPER) {
    if (machine.outputQueue.length > 0) {
      const dir = machine.flipperState as Direction;
      const d = DirDelta[dir];
      const nx = machine.x + d.dx;
      const ny = machine.y + d.dy;
      const cell = getCell(nx, ny);
      if (cell.type !== CellType.BELT || (cell as BeltCell).dir !== dir) return false;
      if (!isCellEmpty(state, nx, ny)) return false;
      const packet = machine.outputQueue.shift()!;
      createPacket(state, nx, ny, packet, dir);
      return true;
    }
  } else if (machine.type === MachineType.FILTER || machine.type === MachineType.DELAY) {
    if (machine.outputQueue.length > 0) {
      const packet = machine.outputQueue.shift()!;
      createPacket(state, output.x, output.y, packet, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.COUNTER || machine.type === MachineType.KEYBOARD || machine.type === MachineType.UNPACKER) {
    if (machine.outputBuffer.length > 0) {
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, output.x, output.y, char, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.PACKER) {
    if (machine.outputBuffer.length > 0) {
      const dir = machine.packerDir;
      const d = DirDelta[dir];
      const nx = machine.x + d.dx;
      const ny = machine.y + d.dy;
      const cell = getCell(nx, ny);
      if (cell.type !== CellType.BELT || (cell as BeltCell).dir !== dir) return false;
      if (!isCellEmpty(state, nx, ny)) return false;
      createPacket(state, nx, ny, machine.outputBuffer, dir);
      machine.outputBuffer = '';
      return true;
    }
  } else if (machine.type === MachineType.ROUTER) {
    let emitted = false;
    if (machine.matchQueue.length > 0) {
      const dir = machine.routerMatchDir;
      const d = DirDelta[dir];
      const nx = machine.x + d.dx;
      const ny = machine.y + d.dy;
      const cell = getCell(nx, ny);
      if (cell.type === CellType.BELT && (cell as BeltCell).dir === dir && isCellEmpty(state, nx, ny)) {
        const packet = machine.matchQueue.shift()!;
        createPacket(state, nx, ny, packet, dir);
        emitted = true;
      }
    }
    if (machine.elseQueue.length > 0) {
      const dir = machine.routerElseDir;
      const d = DirDelta[dir];
      const nx = machine.x + d.dx;
      const ny = machine.y + d.dy;
      const cell = getCell(nx, ny);
      if (cell.type === CellType.BELT && (cell as BeltCell).dir === dir && isCellEmpty(state, nx, ny)) {
        const packet = machine.elseQueue.shift()!;
        createPacket(state, nx, ny, packet, dir);
        emitted = true;
      }
    }
    return emitted;
  } else if (machine.type === MachineType.LATCH) {
    if (machine.outputQueue.length > 0) {
      const packet = machine.outputQueue.shift()!;
      createPacket(state, output.x, output.y, packet, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.GATE || machine.type === MachineType.WIRELESS || machine.type === MachineType.SEVENSEG || machine.type === MachineType.DRUM || machine.type === MachineType.BUTTON) {
    if (machine.outputQueue.length > 0) {
      const packet = machine.outputQueue.shift()!;
      createPacket(state, output.x, output.y, packet, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.REPLACE || machine.type === MachineType.MATH) {
    if (machine.outputBuffer.length > 0) {
      const char = machine.outputBuffer[0];
      machine.outputBuffer = machine.outputBuffer.slice(1);
      createPacket(state, output.x, output.y, char, output.dir);
      return true;
    }
  } else if (machine.type === MachineType.SPLITTER) {
    if (machine.outputQueue.length > 0) {
      return emitFromSplitter(state, machine);
    }
  }

  return false;
}

export function updateSimulation(
  state: GameState,
): void {
  if (!state.running) return;

  // Emit from all machines — each checks its own clock or emits freely
  for (const machine of machines) {
    emitFromMachine(state, machine);
  }

  // Process delay queues: move ready items to outputQueue
  for (const machine of machines) {
    if (machine.type === MachineType.DELAY && machine.delayQueue.length > 0) {
      while (machine.delayQueue.length > 0 && now - machine.delayQueue[0].time >= machine.delayMs) {
        machine.outputQueue.push(machine.delayQueue.shift()!.char);
      }
    }
  }

  // Process command machines and check display timeouts
  for (const machine of machines) {
    if (machine.type === MachineType.COMMAND) {
      if (machine.shell) {
        // Write pending input to the shell
        processCommandInput(machine);
        // Poll for output
        pollCommandOutput(machine);
      } else if (!machine.processing && vm.isReady() && vm.isFs9pReady()) {
        // Shell not yet created (e.g. VM became ready after sim started)
        initCommandShell(machine);
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
