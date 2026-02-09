/** Sound system - module-level singleton (Web Audio API) */

import { onGameEvent, emitGameEvent, type GameEvent } from '../events/bus';
import type { Settings } from '../util/settings';
import { saveSettings } from '../util/settings';

// ── Sound manifest ─────────────────────────────────────────────────

interface SoundDef {
  variants?: number;
  ambient?: boolean;
}

const SOUND_MANIFEST = {
  place:              {},
  simulationStart:    {},
  simulationEnd:      {},
  select:             {},
  erase:              {},
  configureStart:     {},
  deny:               {},
  simulationAmbient:  { ambient: true },
  editingAmbient:     { ambient: true },
  shellType:          { variants: 6 },
  shellTypeEnter:     {},
  sinkReceive:        {},
  streamWrite:        { variants: 3 },
  pack:               {},
  drumKick:           {},
  drumSnare:          {},
  drumHat:            {},
  drumTom:            {},
} as const;

export type SoundName = keyof typeof SOUND_MANIFEST;

const SOUND_NAMES = Object.keys(SOUND_MANIFEST) as SoundName[];

function soundDef(name: SoundName): SoundDef {
  return SOUND_MANIFEST[name] as SoundDef;
}

// ── Event → sound mappings ─────────────────────────────────────────

interface SoundMapping {
  sound: SoundName;
  options?: { randomPitch?: number };
  minInterval?: number;
}

const SOUND_MAP: Partial<Record<GameEvent, SoundMapping>> = {
  place: { sound: 'place', options: { randomPitch: 0.08 } },
  erase: { sound: 'erase' },
  select: { sound: 'select' },
  simulationStarted: { sound: 'simulationStart' },
  simulationEnded: { sound: 'simulationEnd' },
  configureStart: { sound: 'configureStart' },
  editFailed: { sound: 'deny' },
};

const KEYPRESS_MIN_INTERVAL = 80;

const LOOP_MAP: Partial<Record<GameEvent, ({ startLoop: SoundName } | { stopLoop: SoundName })[]>> = {
  simulationStarted: [{ startLoop: 'simulationAmbient' }, { stopLoop: 'editingAmbient' }],
  simulationEnded: [{ stopLoop: 'simulationAmbient' }, { startLoop: 'editingAmbient' }],
};

export interface SoundSystemConfig {
  assetsUrl: string;
  muted?: boolean;
  ambientVolume?: number;
  machineVolume?: number;
}

// ── Module-level state ─────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let machineGain: GainNode | null = null;

let buffers = new Map<SoundName, AudioBuffer>();
let variantBuffers = new Map<SoundName, AudioBuffer[]>();
let activeLoops = new Map<SoundName, AudioBufferSourceNode>();
let lastPlayTime = new Map<SoundName, number>();

let assetsUrl = '';
let _muted = false;
let _ambientVolume = 1;
let _machineVolume = 1;
let listeners: ((sound: SoundName) => void)[] = [];
let unsubscribers: (() => void)[] = [];

// ── Private helpers ────────────────────────────────────────────────

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    ambientGain = ctx.createGain();
    machineGain = ctx.createGain();
    ambientGain.connect(masterGain);
    machineGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    masterGain.gain.value = _muted ? 0 : 1;
    ambientGain.gain.value = _ambientVolume;
    machineGain.gain.value = _machineVolume;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function channelFor(name: SoundName): GainNode {
  return soundDef(name).ambient ? ambientGain! : machineGain!;
}

// ── Public API ─────────────────────────────────────────────────────

export function initSound(config: SoundSystemConfig): void {
  assetsUrl = config.assetsUrl.replace(/\/$/, '');
  _muted = config.muted ?? false;
  _ambientVolume = config.ambientVolume ?? 1;
  _machineVolume = config.machineVolume ?? 1;
}

export async function loadSounds(): Promise<void> {
  const ac = ensureContext();
  let totalFiles = 0;
  let loadedFiles = 0;

  const cache = await caches.open('bashtorio-sounds').catch(() => null);

  const loadOne = async (url: string): Promise<AudioBuffer | null> => {
    totalFiles++;
    try {
      let resp = cache ? await cache.match(url) : undefined;
      if (!resp) {
        resp = await fetch(url);
        if (!resp.ok) {
          console.warn(`[SoundSystem] Failed to fetch: ${url} (${resp.status})`);
          return null;
        }
        if (cache) await cache.put(url, resp.clone());
      }
      const audioBuf = await ac.decodeAudioData(await resp.arrayBuffer());
      loadedFiles++;
      return audioBuf;
    } catch (e) {
      console.warn(`[SoundSystem] Error loading sound ${url}:`, e);
      return null;
    }
  };

  const loadPromises = SOUND_NAMES.map(async (name) => {
    const def = soundDef(name);
    if (def.variants) {
      const loaded: AudioBuffer[] = [];
      for (let i = 1; i <= def.variants; i++) {
        const buf = await loadOne(`${assetsUrl}/${name}${i}.mp3`);
        if (buf) loaded.push(buf);
      }
      if (loaded.length > 0) variantBuffers.set(name, loaded);
    } else {
      const buf = await loadOne(`${assetsUrl}/${name}.mp3`);
      if (buf) buffers.set(name, buf);
    }
  });

  await Promise.all(loadPromises);
  console.log(`[SoundSystem] Loaded ${loadedFiles}/${totalFiles} sounds`);
}

export function connectSoundEvents(settings?: Settings): void {
  for (const [event, mapping] of Object.entries(SOUND_MAP) as [GameEvent, SoundMapping][]) {
    const unsub = onGameEvent(event, () => {
      if (mapping.minInterval) {
        const now = performance.now();
        const last = lastPlayTime.get(mapping.sound) ?? 0;
        if (now - last < mapping.minInterval) return;
        lastPlayTime.set(mapping.sound, now);
      }
      play(mapping.sound, mapping.options);
    });
    unsubscribers.push(unsub);
  }

  const receiveUnsub = onGameEvent('machineReceive', ({ char }) => {
    if (char === '\n') {
      const now = performance.now();
      const last = lastPlayTime.get('shellTypeEnter') ?? 0;
      if (now - last < KEYPRESS_MIN_INTERVAL) return;
      lastPlayTime.set('shellTypeEnter', now);
      console.log('[SoundSystem] shellTypeEnter');
      play('shellTypeEnter');
    } else {
      const now = performance.now();
      const last = lastPlayTime.get('shellType') ?? 0;
      if (now - last < KEYPRESS_MIN_INTERVAL) return;
      lastPlayTime.set('shellType', now);
      play('shellType', { randomPitch: 0.15 });
    }
  });
  unsubscribers.push(receiveUnsub);

  const emitUnsub = onGameEvent('sinkReceive', () => {
    const now = performance.now();
    const last = lastPlayTime.get('sinkReceive') ?? 0;
    if (now - last < KEYPRESS_MIN_INTERVAL) return;
    lastPlayTime.set('sinkReceive', now);
    play('sinkReceive', { randomPitch: 0.15 });
  });
  unsubscribers.push(emitUnsub);

  const packUnsub = onGameEvent('pack', () => {
    const now = performance.now();
    const last = lastPlayTime.get('pack') ?? 0;
    if (now - last < KEYPRESS_MIN_INTERVAL) return;
    lastPlayTime.set('pack', now);
    play('pack', { randomPitch: 0.15 });
  });
  unsubscribers.push(packUnsub);

  const DRUM_SAMPLES: SoundName[] = ['drumKick', 'drumSnare', 'drumHat', 'drumTom'];
  const drumUnsub = onGameEvent('drumHit', ({ sample }) => {
    const now = performance.now();
    const sound = DRUM_SAMPLES[sample];
    const last = lastPlayTime.get(sound) ?? 0;
    if (now - last < KEYPRESS_MIN_INTERVAL) return;
    lastPlayTime.set(sound, now);
    play(sound, { randomPitch: 0.05 });
  });
  unsubscribers.push(drumUnsub);

  const streamWriteUnsub = onGameEvent('streamWrite', () => {
    const now = performance.now();
    const last = lastPlayTime.get('streamWrite') ?? 0;
    if (now - last < KEYPRESS_MIN_INTERVAL) return;
    lastPlayTime.set('streamWrite', now);
    play('streamWrite', { randomPitch: 0.2 });
  });
  unsubscribers.push(streamWriteUnsub);

  for (const [event, mappings] of Object.entries(LOOP_MAP) as [GameEvent, ({ startLoop?: SoundName; stopLoop?: SoundName })[]][]) {
    const unsub = onGameEvent(event, () => {
      for (const mapping of mappings) {
        if ('startLoop' in mapping) startLoop(mapping.startLoop!);
        if ('stopLoop' in mapping) stopLoop(mapping.stopLoop!);
      }
    });
    unsubscribers.push(unsub);
  }

  if (settings) {
    const muteUnsub = onGameEvent('muteToggle', () => {
      const muted = toggleMute();
      saveSettings({ ...settings, muted });
      emitGameEvent('muteChanged', { muted });
    });
    unsubscribers.push(muteUnsub);
  }
}

export function play(sound: SoundName, options?: { randomPitch?: number; pitch?: number }): void {
  if (_muted) return;
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const variants = variantBuffers.get(sound);
  const buffer = variants
    ? variants[Math.floor(Math.random() * variants.length)]
    : buffers.get(sound);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  if (options?.pitch) {
    source.playbackRate.value = options.pitch;
  } else if (options?.randomPitch) {
    const variation = (Math.random() - 0.5) * 2 * options.randomPitch;
    source.playbackRate.value = 1 + variation;
  }

  source.connect(channelFor(sound));
  source.start(0);
  listeners.forEach(cb => cb(sound));
}

export function startLoop(sound: SoundName): void {
  if (activeLoops.has(sound)) return;
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const buffer = buffers.get(sound);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(channelFor(sound));
  activeLoops.set(sound, source);
  source.start(0);
}

export function stopLoop(sound: SoundName): void {
  const source = activeLoops.get(sound);
  if (!source) return;

  source.stop();
  source.disconnect();
  activeLoops.delete(sound);
}

export function isMuted(): boolean {
  return _muted;
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  if (masterGain && ctx) {
    masterGain.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
  }
}

export function toggleMute(): boolean {
  setMuted(!_muted);
  return _muted;
}

export function setAmbientVolume(volume: number): void {
  _ambientVolume = Math.max(0, Math.min(1, volume));
  if (ambientGain && ctx) {
    ambientGain.gain.setValueAtTime(_ambientVolume, ctx.currentTime);
  }
}

export function setMachineVolume(volume: number): void {
  _machineVolume = Math.max(0, Math.min(1, volume));
  if (machineGain && ctx) {
    machineGain.gain.setValueAtTime(_machineVolume, ctx.currentTime);
  }
}

export function destroySound(): void {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];

  for (const source of activeLoops.values()) {
    source.stop();
    source.disconnect();
  }
  activeLoops.clear();
  buffers.clear();
  variantBuffers.clear();
  listeners = [];

  if (ctx) {
    ctx.close();
    ctx = null;
    masterGain = null;
    ambientGain = null;
    machineGain = null;
  }
}
