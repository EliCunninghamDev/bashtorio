import { onGameEvent } from '../events/bus';

// ---------------------------------------------------------------------------
// Noise Engine - LFSR-based noise synthesis for NOISE machines
// ---------------------------------------------------------------------------
//
// Emulates the Game Boy noise channel using a Linear Feedback Shift Register.
// 15-bit mode = hissy white noise. 7-bit mode = metallic/buzzy.
//
// Byte 0 = silence.  Bytes 1-255 → clock rate 100 Hz to 20 kHz.
// Pre-computed LFSR buffers are looped via AudioBufferSourceNode.
// A master DynamicsCompressor acts as a brickwall limiter.
// 5 ms attack / 20 ms release eliminate clicks.
// ---------------------------------------------------------------------------

interface ActiveNoise {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const BASE_GAIN = 0.08;
const ATTACK = 0.005;
const RELEASE = 0.02;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let volumeLevel = 0.5;
let muted = false;
const activeNoises = new Map<string, ActiveNoise>();

// Cache pre-computed LFSR buffers by mode
const bufferCache = new Map<string, AudioBuffer>();

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.05;

    masterGain = ctx.createGain();
    masterGain.connect(limiter);
    limiter.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Map byte 1-255 to clock rate (100 Hz to 20 kHz logarithmic) */
function byteToClockRate(byte: number): number {
  const t = (byte - 1) / 254;
  return 100 * Math.pow(200, t); // 100 Hz to 20000 Hz
}

/** Generate an LFSR noise AudioBuffer at the given sample rate */
function generateLfsrBuffer(ac: AudioContext, mode: '15bit' | '7bit', clockRate: number): AudioBuffer {
  const sampleRate = ac.sampleRate;
  // Generate 1 second of audio
  const numSamples = sampleRate;
  const buffer = ac.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  let lfsr = mode === '7bit' ? 0x7F : 0x7FFF;
  const mask = mode === '7bit' ? 0x7F : 0x7FFF;
  const tapBit = mode === '7bit' ? 6 : 14;

  // Number of audio samples per LFSR clock tick
  const samplesPerTick = sampleRate / clockRate;
  let tickAccum = 0;
  let currentOutput = (lfsr & 1) ? 1.0 : -1.0;

  for (let i = 0; i < numSamples; i++) {
    data[i] = currentOutput;
    tickAccum += 1;

    while (tickAccum >= samplesPerTick) {
      tickAccum -= samplesPerTick;
      const xor = (lfsr & 1) ^ ((lfsr >> 1) & 1);
      lfsr >>= 1;
      lfsr |= (xor << tapBit);
      lfsr &= mask;
      currentOutput = (lfsr & 1) ? 1.0 : -1.0;
    }
  }

  return buffer;
}

function getOrCreateBuffer(ac: AudioContext, mode: '15bit' | '7bit', clockRate: number): AudioBuffer {
  // Quantize clock rate to reduce cache entries (round to nearest 50 Hz)
  const quantized = Math.round(clockRate / 50) * 50;
  const key = `${mode}_${quantized}`;
  let buffer = bufferCache.get(key);
  if (!buffer) {
    buffer = generateLfsrBuffer(ac, mode, quantized || 100);
    bufferCache.set(key, buffer);
    // Limit cache size
    if (bufferCache.size > 128) {
      const first = bufferCache.keys().next().value!;
      bufferCache.delete(first);
    }
  }
  return buffer;
}

function startNoise(id: string, byte: number, mode: '15bit' | '7bit'): void {
  const ac = ensureContext();
  const clockRate = byteToClockRate(byte);
  const buffer = getOrCreateBuffer(ac, mode, clockRate);
  const existing = activeNoises.get(id);

  if (existing) {
    // Replace with new buffer
    const t = ac.currentTime;
    existing.gain.gain.cancelScheduledValues(t);
    existing.gain.gain.setValueAtTime(existing.gain.gain.value, t);
    existing.gain.gain.linearRampToValueAtTime(0, t + RELEASE);
    existing.source.stop(t + RELEASE + 0.005);
    activeNoises.delete(id);
  }

  const source = ac.createBufferSource();
  const gain = ac.createGain();

  source.buffer = buffer;
  source.loop = true;

  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(BASE_GAIN, ac.currentTime + ATTACK);

  source.connect(gain);
  gain.connect(masterGain!);
  source.start();

  activeNoises.set(id, { source, gain });
}

function stopNoise(id: string): void {
  const noise = activeNoises.get(id);
  if (!noise) return;
  const ac = ensureContext();
  const t = ac.currentTime;
  noise.gain.gain.cancelScheduledValues(t);
  noise.gain.gain.setValueAtTime(noise.gain.gain.value, t);
  noise.gain.gain.linearRampToValueAtTime(0, t + RELEASE);
  noise.source.stop(t + RELEASE + 0.005);
  activeNoises.delete(id);
}

function stopAllNoise(): void {
  for (const [, noise] of activeNoises) {
    noise.source.stop();
    noise.source.disconnect();
    noise.gain.disconnect();
  }
  activeNoises.clear();
}

function applyGain(): void {
  if (masterGain && ctx) {
    masterGain.gain.setValueAtTime(muted ? 0 : volumeLevel, ctx.currentTime);
  }
}

export function setNoiseVolume(vol: number): void {
  volumeLevel = vol;
  applyGain();
}

export function connectNoiseEvents(): void {
  onGameEvent('noiseNote', ({ machineId, byte, mode }) => {
    if (byte === 0) {
      stopNoise(machineId);
    } else {
      startNoise(machineId, byte, mode);
    }
  });

  onGameEvent('muteChanged', ({ muted: m }) => {
    muted = m;
    applyGain();
  });

  onGameEvent('simulationEnded', () => {
    stopAllNoise();
  });
}

export function destroyNoise(): void {
  stopAllNoise();
  bufferCache.clear();
  if (ctx) {
    ctx.close();
    ctx = null;
    masterGain = null;
    limiter = null;
  }
}
