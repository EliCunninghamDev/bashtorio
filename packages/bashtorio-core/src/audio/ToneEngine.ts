import { onGameEvent } from '../events/bus';

// ---------------------------------------------------------------------------
// Tone Engine - Web Audio oscillator management for TONE machines
// ---------------------------------------------------------------------------

interface ActiveTone {
  osc: OscillatorNode;
  gain: GainNode;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const activeTones = new Map<string, ActiveTone>();

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function byteToFreq(byte: number): number {
  return 55 * Math.pow(2, byte * 5 / 255);
}

function startTone(id: string, freq: number, waveform: OscillatorType): void {
  const ac = ensureContext();
  const existing = activeTones.get(id);

  if (existing) {
    existing.osc.frequency.setValueAtTime(freq, ac.currentTime);
    existing.osc.type = waveform;
    return;
  }

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start();

  activeTones.set(id, { osc, gain });
}

function stopTone(id: string): void {
  const tone = activeTones.get(id);
  if (!tone) return;
  tone.osc.stop();
  tone.osc.disconnect();
  tone.gain.disconnect();
  activeTones.delete(id);
}

function stopAllTones(): void {
  for (const [id] of activeTones) {
    stopTone(id);
  }
}

function setMuted(muted: boolean): void {
  if (masterGain) {
    masterGain.gain.setValueAtTime(muted ? 0 : 1, ctx!.currentTime);
  }
}

export function connectToneEvents(): void {
  onGameEvent('toneNote', ({ machineId, byte, waveform }) => {
    if (byte === 0) {
      stopTone(machineId);
    } else {
      startTone(machineId, byteToFreq(byte), waveform);
    }
  });

  onGameEvent('muteChanged', ({ muted }) => {
    setMuted(muted);
  });

  onGameEvent('simulationEnded', () => {
    stopAllTones();
  });
}

export function destroyTones(): void {
  stopAllTones();
  if (ctx) {
    ctx.close();
    ctx = null;
    masterGain = null;
  }
}
