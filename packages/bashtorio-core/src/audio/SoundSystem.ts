/** Sound system - module-level singleton */

import { onGameEvent, emitGameEvent, type GameEvent } from '../events/bus';
import type { Settings } from '../util/settings';
import { saveSettings } from '../util/settings';

const SOUND_NAMES = ['place', 'simulationStart', 'simulationEnd', 'select', 'erase', 'configureStart', 'deny', 'simulationAmbient', 'editingAmbient', 'shellType', 'shellTypeEnter', 'sinkReceive', 'streamWrite', 'pack', 'drumKick', 'drumSnare', 'drumHat', 'drumTom'] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

const AMBIENT_SOUNDS: ReadonlySet<SoundName> = new Set(['editingAmbient', 'simulationAmbient']);

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

/** Sounds with numbered file variants (e.g. shellType1.mp3 ... shellType6.mp3) */
const SOUND_VARIANTS: Partial<Record<SoundName, number>> = {
  shellType: 6,
  streamWrite: 3,
};

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

// ── Module-level state ──────────────────────────────────────────────

let sounds = new Map<SoundName, HTMLAudioElement>();
let variants = new Map<SoundName, HTMLAudioElement[]>();
let loops = new Map<SoundName, HTMLAudioElement>();
let lastPlayTime = new Map<SoundName, number>();
let assetsUrl = '';
let _muted = false;
let _ambientVolume = 1;
let _machineVolume = 1;
let listeners: ((sound: SoundName) => void)[] = [];
let unsubscribers: (() => void)[] = [];

// ── Private helpers ─────────────────────────────────────────────────

function applyAmbientVolume(): void {
  const v = _ambientVolume;
  for (const name of AMBIENT_SOUNDS) {
    const audio = sounds.get(name);
    if (audio) audio.volume = v;
    const loop = loops.get(name);
    if (loop) loop.volume = v;
  }
}

function applyMachineVolume(): void {
  const v = _machineVolume;
  for (const [name, audio] of sounds) {
    if (!AMBIENT_SOUNDS.has(name)) audio.volume = v;
  }
  for (const variantList of variants.values()) {
    for (const audio of variantList) {
      audio.volume = v;
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────

export function initSound(config: SoundSystemConfig): void {
  assetsUrl = config.assetsUrl.replace(/\/$/, '');
  _muted = config.muted ?? false;
  _ambientVolume = config.ambientVolume ?? 1;
  _machineVolume = config.machineVolume ?? 1;
}

export async function loadSounds(): Promise<void> {
  let totalFiles = 0;
  let loadedFiles = 0;

  const loadOne = async (url: string): Promise<HTMLAudioElement | null> => {
    totalFiles++;
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      await new Promise<void>((resolve) => {
        audio.addEventListener('canplaythrough', () => resolve(), { once: true });
        audio.addEventListener('error', () => {
          console.warn(`[SoundSystem] Failed to load sound: ${url}`);
          resolve();
        }, { once: true });
        audio.load();
      });
      loadedFiles++;
      return audio;
    } catch (e) {
      console.warn(`[SoundSystem] Error loading sound ${url}:`, e);
      return null;
    }
  };

  const loadPromises = SOUND_NAMES.map(async (name) => {
    const variantCount = SOUND_VARIANTS[name];
    if (variantCount) {
      const variantAudios: HTMLAudioElement[] = [];
      for (let i = 1; i <= variantCount; i++) {
        const audio = await loadOne(`${assetsUrl}/${name}${i}.mp3`);
        if (audio) variantAudios.push(audio);
      }
      if (variantAudios.length > 0) {
        variants.set(name, variantAudios);
      }
    } else {
      const audio = await loadOne(`${assetsUrl}/${name}.mp3`);
      if (audio) sounds.set(name, audio);
    }
  });

  await Promise.all(loadPromises);
  console.log(`[SoundSystem] Loaded ${loadedFiles}/${totalFiles} sounds`);

  applyAmbientVolume();
  applyMachineVolume();
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

  const variantList = variants.get(sound);
  const audio = variantList
    ? variantList[Math.floor(Math.random() * variantList.length)]
    : sounds.get(sound);
  if (audio) {
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = audio.volume;

    if (options?.pitch) {
      clone.playbackRate = options.pitch;
    } else if (options?.randomPitch) {
      const variation = (Math.random() - 0.5) * 2 * options.randomPitch;
      clone.playbackRate = 1 + variation;
    }

    clone.play().catch(() => {});
  }

  listeners.forEach(cb => cb(sound));
}

export function startLoop(sound: SoundName): void {
  if (loops.has(sound)) return;

  const audio = sounds.get(sound);
  if (!audio) return;

  const loop = audio.cloneNode() as HTMLAudioElement;
  loop.loop = true;
  loop.volume = audio.volume;
  loops.set(sound, loop);

  if (!_muted) {
    loop.play().catch(() => {});
  }
}

export function stopLoop(sound: SoundName): void {
  const loop = loops.get(sound);
  if (!loop) return;

  loop.pause();
  loop.currentTime = 0;
  loops.delete(sound);
}

export function isMuted(): boolean {
  return _muted;
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  for (const loop of loops.values()) {
    if (muted) {
      loop.pause();
    } else {
      loop.play().catch(() => {});
    }
  }
}

export function toggleMute(): boolean {
  setMuted(!_muted);
  return _muted;
}

export function setAmbientVolume(volume: number): void {
  _ambientVolume = Math.max(0, Math.min(1, volume));
  applyAmbientVolume();
}

export function setMachineVolume(volume: number): void {
  _machineVolume = Math.max(0, Math.min(1, volume));
  applyMachineVolume();
}

export function destroySound(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers = [];
  for (const loop of loops.values()) {
    loop.pause();
  }
  loops.clear();
  sounds.clear();
  variants.clear();
  listeners = [];
}
