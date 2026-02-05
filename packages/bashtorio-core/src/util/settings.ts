const STORAGE_KEY = 'bashtorio_settings';

export interface Settings {
  muted: boolean;
  speed: number;
  theme: string;
  ambientVolume: number;
  machineVolume: number;
}

const DEFAULTS: Settings = {
  muted: false,
  speed: 1,
  theme: 'midnight',
  ambientVolume: 1,
  machineVolume: 1,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // Ignore corrupt or unavailable storage
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}
