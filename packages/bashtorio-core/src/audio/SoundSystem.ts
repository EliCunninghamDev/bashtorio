/** Sound system with event-based architecture */

import type { GameEventBus, GameEvent } from '../events/GameEventBus';

export type SoundName = 'place' | 'simulationStart' | 'simulationEnd' | 'select' | 'erase' | 'configureStart' | 'simulationAmbient' | 'editingAmbient' | 'shellType' | 'shellTypeEnter' | 'sinkReceive' | 'streamWrite' | 'pack';

const SOUND_NAMES: SoundName[] = ['place', 'simulationStart', 'simulationEnd', 'select', 'erase', 'configureStart', 'simulationAmbient', 'editingAmbient', 'shellType', 'shellTypeEnter', 'sinkReceive', 'streamWrite', 'pack'];

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
  simulationStart: { sound: 'simulationStart' },
  simulationEnd: { sound: 'simulationEnd' },
  configureStart: { sound: 'configureStart' },
};

const KEYPRESS_MIN_INTERVAL = 80;

/** Sounds with numbered file variants (e.g. shellType1.mp3 ... shellType6.mp3) */
const SOUND_VARIANTS: Partial<Record<SoundName, number>> = {
  shellType: 6,
  streamWrite: 3,
};

const LOOP_MAP: Partial<Record<GameEvent, ({ startLoop: SoundName } | { stopLoop: SoundName })[]>> = {
  simulationStart: [{ startLoop: 'simulationAmbient' }, { stopLoop: 'editingAmbient' }],
  simulationEnd: [{ stopLoop: 'simulationAmbient' }, { startLoop: 'editingAmbient' }],
};

export interface SoundSystemConfig {
  assetsUrl: string;
  muted?: boolean;
  ambientVolume?: number;
  machineVolume?: number;
}

type SoundEventCallback = (sound: SoundName) => void;

export class SoundSystem {
  private sounds = new Map<SoundName, HTMLAudioElement>();
  private variants = new Map<SoundName, HTMLAudioElement[]>();
  private loops = new Map<SoundName, HTMLAudioElement>();
  private lastPlayTime = new Map<SoundName, number>();
  private assetsUrl: string;
  private _muted: boolean;
  private _ambientVolume: number;
  private _machineVolume: number;
  private listeners: SoundEventCallback[] = [];
  private unsubscribers: (() => void)[] = [];

  constructor(config: SoundSystemConfig) {
    this.assetsUrl = config.assetsUrl.replace(/\/$/, '');
    this._muted = config.muted ?? false;
    this._ambientVolume = config.ambientVolume ?? 1;
    this._machineVolume = config.machineVolume ?? 1;
  }

  get muted(): boolean {
    return this._muted;
  }

  async init(): Promise<void> {
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
          const audio = await loadOne(`${this.assetsUrl}/${name}${i}.mp3`);
          if (audio) variantAudios.push(audio);
        }
        if (variantAudios.length > 0) {
          this.variants.set(name, variantAudios);
        }
      } else {
        const audio = await loadOne(`${this.assetsUrl}/${name}.mp3`);
        if (audio) this.sounds.set(name, audio);
      }
    });

    await Promise.all(loadPromises);
    console.log(`[SoundSystem] Loaded ${loadedFiles}/${totalFiles} sounds`);

    // Apply initial per-category volumes
    this.applyAmbientVolume();
    this.applyMachineVolume();
  }

  private applyAmbientVolume(): void {
    const v = this._ambientVolume;
    for (const name of AMBIENT_SOUNDS) {
      const audio = this.sounds.get(name);
      if (audio) audio.volume = v;
      const loop = this.loops.get(name);
      if (loop) loop.volume = v;
    }
  }

  private applyMachineVolume(): void {
    const v = this._machineVolume;
    for (const [name, audio] of this.sounds) {
      if (!AMBIENT_SOUNDS.has(name)) audio.volume = v;
    }
    for (const variantList of this.variants.values()) {
      for (const audio of variantList) {
        audio.volume = v;
      }
    }
  }

  connectTo(events: GameEventBus): void {
    for (const [event, mapping] of Object.entries(SOUND_MAP) as [GameEvent, SoundMapping][]) {
      const unsub = events.on(event, () => {
        if (mapping.minInterval) {
          const now = performance.now();
          const last = this.lastPlayTime.get(mapping.sound) ?? 0;
          if (now - last < mapping.minInterval) return;
          this.lastPlayTime.set(mapping.sound, now);
        }
        this.play(mapping.sound, mapping.options);
      });
      this.unsubscribers.push(unsub);
    }

    // shellType: line feeds play a distinct sound, other chars get
    // a deterministic pitch derived from the character code
    const receiveUnsub = events.on('machineReceive', ({ char }) => {
      if (char === '\n') {
        const now = performance.now();
        const last = this.lastPlayTime.get('shellTypeEnter') ?? 0;
        if (now - last < KEYPRESS_MIN_INTERVAL) return;
        this.lastPlayTime.set('shellTypeEnter', now);
        console.log('[SoundSystem] shellTypeEnter');
        this.play('shellTypeEnter');
      } else {
        const now = performance.now();
        const last = this.lastPlayTime.get('shellType') ?? 0;
        if (now - last < KEYPRESS_MIN_INTERVAL) return;
        this.lastPlayTime.set('shellType', now);

        this.play('shellType', { randomPitch: 0.15 });
      }
    });
    this.unsubscribers.push(receiveUnsub);

    // sinkReceive: random pitch variation
    const emitUnsub = events.on('sinkReceive', () => {
      const now = performance.now();
      const last = this.lastPlayTime.get('sinkReceive') ?? 0;
      if (now - last < KEYPRESS_MIN_INTERVAL) return;
      this.lastPlayTime.set('sinkReceive', now);
      this.play('sinkReceive', { randomPitch: 0.15 });
    });
    this.unsubscribers.push(emitUnsub);

    // pack: play pack sound with random pitch
    const packUnsub = events.on('pack', () => {
      const now = performance.now();
      const last = this.lastPlayTime.get('pack') ?? 0;
      if (now - last < KEYPRESS_MIN_INTERVAL) return;
      this.lastPlayTime.set('pack', now);
      this.play('pack', { randomPitch: 0.15 });
    });
    this.unsubscribers.push(packUnsub);

    // streamWrite: soft blip with random pitch
    const streamWriteUnsub = events.on('streamWrite', () => {
      const now = performance.now();
      const last = this.lastPlayTime.get('streamWrite') ?? 0;
      if (now - last < KEYPRESS_MIN_INTERVAL) return;
      this.lastPlayTime.set('streamWrite', now);
      this.play('streamWrite', { randomPitch: 0.2 });
    });
    this.unsubscribers.push(streamWriteUnsub);

    for (const [event, mappings] of Object.entries(LOOP_MAP) as [GameEvent, ({ startLoop?: SoundName; stopLoop?: SoundName })[]][]) {
      const unsub = events.on(event, () => {
        for (const mapping of mappings) {
          if ('startLoop' in mapping) this.startLoop(mapping.startLoop!);
          if ('stopLoop' in mapping) this.stopLoop(mapping.stopLoop!);
        }
      });
      this.unsubscribers.push(unsub);
    }
  }

  play(sound: SoundName, options?: { randomPitch?: number; pitch?: number }): void {
    if (this._muted) return;

    // Pick a random variant if available, otherwise use the base sound
    const variantList = this.variants.get(sound);
    const audio = variantList
      ? variantList[Math.floor(Math.random() * variantList.length)]
      : this.sounds.get(sound);
    if (audio) {
      // Clone for overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = audio.volume;

      if (options?.pitch) {
        // Use exact pitch value
        clone.playbackRate = options.pitch;
      } else if (options?.randomPitch) {
        // Apply random pitch variation
        const variation = (Math.random() - 0.5) * 2 * options.randomPitch;
        clone.playbackRate = 1 + variation;
      }

      clone.play().catch(() => {
        // Ignore autoplay restrictions
      });
    }

    // Notify listeners
    this.listeners.forEach(cb => cb(sound));
  }

  startLoop(sound: SoundName): void {
    // Already playing this loop
    if (this.loops.has(sound)) return;

    const audio = this.sounds.get(sound);
    if (!audio) return;

    const loop = audio.cloneNode() as HTMLAudioElement;
    loop.loop = true;
    loop.volume = audio.volume;
    this.loops.set(sound, loop);

    if (!this._muted) {
      loop.play().catch(() => {});
    }
  }

  stopLoop(sound: SoundName): void {
    const loop = this.loops.get(sound);
    if (!loop) return;

    loop.pause();
    loop.currentTime = 0;
    this.loops.delete(sound);
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    for (const loop of this.loops.values()) {
      if (muted) {
        loop.pause();
      } else {
        loop.play().catch(() => {});
      }
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  setAmbientVolume(volume: number): void {
    this._ambientVolume = Math.max(0, Math.min(1, volume));
    this.applyAmbientVolume();
  }

  setMachineVolume(volume: number): void {
    this._machineVolume = Math.max(0, Math.min(1, volume));
    this.applyMachineVolume();
  }

  setVolume(sound: SoundName, volume: number): void {
    const audio = this.sounds.get(sound);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  setGlobalVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    for (const audio of this.sounds.values()) {
      audio.volume = v;
    }
    for (const variantList of this.variants.values()) {
      for (const audio of variantList) {
        audio.volume = v;
      }
    }
    for (const loop of this.loops.values()) {
      loop.volume = v;
    }
  }

  /** Subscribe to sound events */
  onSound(callback: SoundEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    for (const loop of this.loops.values()) {
      loop.pause();
    }
    this.loops.clear();
    this.sounds.clear();
    this.variants.clear();
    this.listeners = [];
  }
}
