import { onGameEvent } from '../events/bus';

// ---------------------------------------------------------------------------
// Tone Engine - Web Audio oscillator management for TONE machines
// ---------------------------------------------------------------------------
//
// Byte 0 = silence.  Bytes 1-255 → MIDI 21 (A0) through 108 (C8),
// covering the full 88-key piano via  f = 440·2^((n-69)/12).
//
// Waveform-specific gain offsets keep perceived loudness even.
// A 4 kHz low-pass filter rolls off piercing overtones on saw/square
// (transparent for sine/triangle which lack high harmonics).
// A master DynamicsCompressor acts as a brickwall limiter to cap
// output regardless of how many tones stack up.
// 5 ms attack / 20 ms release eliminate clicks.
// ---------------------------------------------------------------------------

interface ActiveTone {
  osc: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
}

const WAVEFORM_GAIN: Record<string, number> = {
  sine: 0.15,
  triangle: 0.135,
  sawtooth: 0.08,
  square: 0.07,
};

const ATTACK = 0.005;      // 5 ms
const RELEASE = 0.02;      // 20 ms
const FILTER_FREQ = 4000;  // Hz

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let volumeLevel = 0.5;
let muted = false;
const activeTones = new Map<string, ActiveTone>();

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();

    // Brickwall limiter — prevents clipping when many tones stack
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;   // dB — start limiting early
    limiter.knee.value = 3;         // dB — gentle transition
    limiter.ratio.value = 20;       // near-brickwall
    limiter.attack.value = 0.002;   // 2 ms — fast clamp
    limiter.release.value = 0.05;   // 50 ms

    masterGain = ctx.createGain();
    masterGain.connect(limiter);
    limiter.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function byteToFreq(byte: number): number {
  // 1-255 → MIDI 21 (A0) through 108 (C8) — full 88-key piano
  const midiNote = 21 + ((byte - 1) / 254) * 87;
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function gainFor(waveform: OscillatorType): number {
  return WAVEFORM_GAIN[waveform] ?? 0.15;
}

function buildPulseWave(ac: AudioContext, duty: number): PeriodicWave {
  const N = 64;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    const angle = 2 * Math.PI * n * duty;
    real[n] = (2 / (n * Math.PI)) * Math.sin(angle);
    imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(angle));
  }
  return ac.createPeriodicWave(real, imag);
}

function startTone(id: string, freq: number, waveform: OscillatorType, dutyCycle: number): void {
  const ac = ensureContext();
  const targetGain = gainFor(waveform);
  const usePulse = waveform === 'square' && dutyCycle !== 0.5;
  const existing = activeTones.get(id);

  if (existing) {
    // Smooth glide avoids clicks between notes
    existing.osc.frequency.setTargetAtTime(freq, ac.currentTime, 0.005);
    if (usePulse) {
      existing.osc.setPeriodicWave(buildPulseWave(ac, dutyCycle));
    } else {
      existing.osc.type = waveform;
    }
    existing.gain.gain.setTargetAtTime(targetGain, ac.currentTime, 0.005);
    return;
  }

  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();

  if (usePulse) {
    osc.setPeriodicWave(buildPulseWave(ac, dutyCycle));
  } else {
    osc.type = waveform;
  }
  osc.frequency.setValueAtTime(freq, ac.currentTime);

  // 4 kHz low-pass: tames saw/square harmonics, transparent for sine/triangle
  filter.type = 'lowpass';
  filter.frequency.value = FILTER_FREQ;

  // Attack envelope — ramp from silence to avoid click
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(targetGain, ac.currentTime + ATTACK);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain!);
  osc.start();

  activeTones.set(id, { osc, gain, filter });
}

function stopTone(id: string): void {
  const tone = activeTones.get(id);
  if (!tone) return;
  const ac = ensureContext();
  const t = ac.currentTime;
  // Release envelope — ramp to silence then stop
  tone.gain.gain.cancelScheduledValues(t);
  tone.gain.gain.setValueAtTime(tone.gain.gain.value, t);
  tone.gain.gain.linearRampToValueAtTime(0, t + RELEASE);
  tone.osc.stop(t + RELEASE + 0.005);
  activeTones.delete(id);
}

function stopAllTones(): void {
  for (const [, tone] of activeTones) {
    tone.osc.stop();
    tone.osc.disconnect();
    tone.filter.disconnect();
    tone.gain.disconnect();
  }
  activeTones.clear();
}

function applyGain(): void {
  if (masterGain && ctx) {
    masterGain.gain.setValueAtTime(muted ? 0 : volumeLevel, ctx.currentTime);
  }
}

export function setToneVolume(vol: number): void {
  volumeLevel = vol;
  applyGain();
}

export function connectToneEvents(): void {
  onGameEvent('toneNote', ({ machineId, byte, waveform, dutyCycle }) => {
    if (byte === 0) {
      stopTone(machineId);
    } else {
      startTone(machineId, byteToFreq(byte), waveform, dutyCycle);
    }
  });

  onGameEvent('muteChanged', ({ muted: m }) => {
    muted = m;
    applyGain();
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
    limiter = null;
  }
}
