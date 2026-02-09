import { MachineType, Direction, type Machine, type MachineByType, type MachineBase } from './types';

export const machines: Machine[] = [];
let sinkIdCounter = 1;

export function nextSinkId(): number { return sinkIdCounter++; }
export function getSinkIdCounter(): number { return sinkIdCounter; }
export function setSinkIdCounter(v: number): void { sinkIdCounter = v; }

export function clearMachines(): void {
  machines.length = 0;
  sinkIdCounter = 1;
}

// ---------------------------------------------------------------------------
// Machine defaults
// ---------------------------------------------------------------------------

export type MachineDefaults<T extends MachineType> = Omit<MachineByType[T], keyof MachineBase | 'type'>;

export function sourceDefaults(): MachineDefaults<MachineType.SOURCE> {
  return { sourceText: 'Hello World!\n', sourcePos: 0, emitInterval: 500, lastEmitTime: 0, gapInterval: 0, gapRemaining: 0 };
}

export function sinkDefaults(): MachineDefaults<MachineType.SINK> {
  const id = nextSinkId();
  return { sinkId: id, name: `Sink ${id}`, drainRing: [], drainHead: 0 };
}

export function commandDefaults(): MachineDefaults<MachineType.COMMAND> {
  return {
    command: 'cat', autoStart: false, stream: false, inputMode: 'pipe',
    pendingInput: '', outputBuffer: '', processing: false, lastInputTime: 0,
    autoStartRan: false, cwd: '/', activeJobId: '', lastPollTime: 0,
    bytesRead: 0, streamBytesWritten: 0, lastStreamWriteTime: 0,
  };
}

export function displayDefaults(): MachineDefaults<MachineType.DISPLAY> {
  return { displayBuffer: '', displayText: '', displayTime: 0, lastByteTime: 0 };
}

export function linefeedDefaults(): MachineDefaults<MachineType.LINEFEED> {
  return { emitInterval: 500, lastEmitTime: 0 };
}

export function flipperDefaults(dir: Direction): MachineDefaults<MachineType.FLIPPER> {
  return { flipperDir: dir, flipperState: dir, outputQueue: [] };
}

export function duplicatorDefaults(): MachineDefaults<MachineType.DUPLICATOR> {
  return { outputBuffer: '' };
}

export function constantDefaults(): MachineDefaults<MachineType.CONSTANT> {
  return { constantText: 'hello\n', emitInterval: 500, constantPos: 0, lastEmitTime: 0, gapInterval: 0, gapRemaining: 0 };
}

export function filterDefaults(): MachineDefaults<MachineType.FILTER> {
  return { filterByte: '\n', filterMode: 'pass', outputBuffer: '' };
}

export function counterDefaults(): MachineDefaults<MachineType.COUNTER> {
  return { counterTrigger: '\n', counterCount: 0, outputBuffer: '' };
}

export function delayDefaults(): MachineDefaults<MachineType.DELAY> {
  return { delayMs: 1000, delayQueue: [], outputBuffer: '' };
}

export function keyboardDefaults(): MachineDefaults<MachineType.KEYBOARD> {
  return { outputBuffer: '' };
}

export function packerDefaults(dir: Direction): MachineDefaults<MachineType.PACKER> {
  return { packerDelimiter: '\n', preserveDelimiter: true, packerDir: dir, accumulatedBuffer: '', outputBuffer: '' };
}

export function unpackerDefaults(): MachineDefaults<MachineType.UNPACKER> {
  return { outputBuffer: '' };
}

export function routerDefaults(): MachineDefaults<MachineType.ROUTER> {
  return { routerByte: '\n', routerMatchDir: Direction.RIGHT, routerElseDir: Direction.DOWN, matchBuffer: '', elseBuffer: '' };
}

export function gateDefaults(): MachineDefaults<MachineType.GATE> {
  return { gateDataDir: Direction.LEFT, gateControlDir: Direction.UP, gateOpen: false, outputBuffer: '' };
}

export function wirelessDefaults(): MachineDefaults<MachineType.WIRELESS> {
  return { wirelessChannel: 0, wifiArc: 0, outputBuffer: '' };
}

export function replaceDefaults(): MachineDefaults<MachineType.REPLACE> {
  return { replaceFrom: 'a', replaceTo: 'b', outputBuffer: '', lastActivation: 0, animationProgress: 0 };
}

export function mathDefaults(): MachineDefaults<MachineType.MATH> {
  return { mathOp: 'add', mathOperand: 1, outputBuffer: '' };
}

export function clockDefaults(): MachineDefaults<MachineType.CLOCK> {
  return { clockByte: '*', emitInterval: 1000, lastEmitTime: 0 };
}

export function latchDefaults(): MachineDefaults<MachineType.LATCH> {
  return { latchDataDir: Direction.LEFT, latchControlDir: Direction.UP, latchStored: '', outputBuffer: '' };
}


export function splitterDefaults(dir: Direction): MachineDefaults<MachineType.SPLITTER> {
  return { dir, toggle: 0, outputBuffer: '' };
}

export function sevensegDefaults(): MachineDefaults<MachineType.SEVENSEG> {
  return { lastByte: -1, outputBuffer: '' };
}

export function drumDefaults(): MachineDefaults<MachineType.DRUM> {
  return { outputBuffer: '' };
}

export function toneDefaults(): MachineDefaults<MachineType.TONE> {
  return { waveform: 'sine' };
}

export function speakDefaults(): MachineDefaults<MachineType.SPEAK> {
  return { speakRate: 1, speakPitch: 1, speakDelimiter: '\n', accumulatedBuffer: '', displayText: '', displayTime: 0 };
}

export function screenDefaults(): MachineDefaults<MachineType.SCREEN> {
  return { resolution: 8, buffer: new Uint8Array(8), writePos: 0 };
}

export function byteDefaults(): MachineDefaults<MachineType.BYTE> {
  return { byteData: new Uint8Array(0), bytePos: 0, emitInterval: 500, lastEmitTime: 0, gapInterval: 0, gapRemaining: 0 };
}

// ---------------------------------------------------------------------------
// Machine factory
// ---------------------------------------------------------------------------

export function createMachine(x: number, y: number, machineType: MachineType, dir: Direction = Direction.RIGHT): Machine {
  const base = { x, y, lastCommandTime: 0 };

  switch (machineType) {
    case MachineType.SOURCE:     return { ...base, type: MachineType.SOURCE, ...sourceDefaults() };
    case MachineType.SINK:       return { ...base, type: MachineType.SINK, ...sinkDefaults() };
    case MachineType.COMMAND:    return { ...base, type: MachineType.COMMAND, ...commandDefaults() };
    case MachineType.DISPLAY:    return { ...base, type: MachineType.DISPLAY, ...displayDefaults() };
    case MachineType.NULL:       return { ...base, type: MachineType.NULL };
    case MachineType.LINEFEED:   return { ...base, type: MachineType.LINEFEED, ...linefeedDefaults() };
    case MachineType.FLIPPER:    return { ...base, type: MachineType.FLIPPER, ...flipperDefaults(dir) };
    case MachineType.DUPLICATOR: return { ...base, type: MachineType.DUPLICATOR, ...duplicatorDefaults() };
    case MachineType.CONSTANT:   return { ...base, type: MachineType.CONSTANT, ...constantDefaults() };
    case MachineType.FILTER:     return { ...base, type: MachineType.FILTER, ...filterDefaults() };
    case MachineType.COUNTER:    return { ...base, type: MachineType.COUNTER, ...counterDefaults() };
    case MachineType.DELAY:      return { ...base, type: MachineType.DELAY, ...delayDefaults() };
    case MachineType.KEYBOARD:   return { ...base, type: MachineType.KEYBOARD, ...keyboardDefaults() };
    case MachineType.PACKER:     return { ...base, type: MachineType.PACKER, ...packerDefaults(dir) };
    case MachineType.UNPACKER:   return { ...base, type: MachineType.UNPACKER, ...unpackerDefaults() };
    case MachineType.ROUTER:     return { ...base, type: MachineType.ROUTER, ...routerDefaults() };
    case MachineType.GATE:       return { ...base, type: MachineType.GATE, ...gateDefaults() };
    case MachineType.WIRELESS:   return { ...base, type: MachineType.WIRELESS, ...wirelessDefaults() };
    case MachineType.REPLACE:    return { ...base, type: MachineType.REPLACE, ...replaceDefaults() };
    case MachineType.MATH:       return { ...base, type: MachineType.MATH, ...mathDefaults() };
    case MachineType.CLOCK:      return { ...base, type: MachineType.CLOCK, ...clockDefaults() };
    case MachineType.LATCH:      return { ...base, type: MachineType.LATCH, ...latchDefaults() };

    case MachineType.SPLITTER:   return { ...base, type: MachineType.SPLITTER, ...splitterDefaults(dir) };
    case MachineType.SEVENSEG:   return { ...base, type: MachineType.SEVENSEG, ...sevensegDefaults() };
    case MachineType.DRUM:       return { ...base, type: MachineType.DRUM, ...drumDefaults() };
    case MachineType.TONE:       return { ...base, type: MachineType.TONE, ...toneDefaults() };
    case MachineType.SPEAK:      return { ...base, type: MachineType.SPEAK, ...speakDefaults() };
    case MachineType.SCREEN:     return { ...base, type: MachineType.SCREEN, ...screenDefaults() };
    case MachineType.BYTE:       return { ...base, type: MachineType.BYTE, ...byteDefaults() };
  }
}
