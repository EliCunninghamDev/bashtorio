// Re-export types and classes
export * from './game/types';
export * from './game/state';
export { LinuxVM } from './vm';
export type { VMConfig } from './vm';
export { Renderer } from './render';
export type { RendererConfig } from './render';
export { InputHandler } from './ui';
export type { InputCallbacks } from './ui';
export { ByteInput } from './ui/components/ByteInput';
export type { ByteInputOptions } from './ui/components/ByteInput';
export { SoundSystem } from './audio/SoundSystem';
export type { SoundName, SoundSystemConfig } from './audio/SoundSystem';
export { GameEventBus } from './events/GameEventBus';
export type { GameEventMap, GameEvent } from './events/GameEventBus';

// Re-export simulation functions
export { startSimulation, stopSimulation, updateSimulation } from './game/simulation';
export type { SimulationCallbacks } from './game/simulation';

// Re-export grid functions
export { initGrid, getCell, placeBelt, placeSplitter, placeMachine, clearCell, getMachineAt } from './game/grid';

// Re-export save/load functions
export { serializeState, deserializeState, downloadSave, uploadSave, type SaveData } from './util/saveload';

// Re-export presets
export { PRESETS, type Preset } from './util/presets';

// Re-export themes
export { THEMES, getThemeById, applyUITheme, type ColorTheme } from './util/themes';
export { applyRendererTheme } from './render/renderer';

import { LinuxVM } from './vm';
import { Renderer } from './render';
import { InputHandler, type InputCallbacks } from './ui';
import { ByteInput } from './ui/components/ByteInput';
import { createInitialState, type GameState } from './game/state';
import { initGrid } from './game/grid';
import { updateSimulation, type SimulationCallbacks } from './game/simulation';
import { GRID_COLS, GRID_ROWS, MachineType, type CursorMode, type PlaceableType } from './game/types';
import { ansiToHtml } from './util/ansi';
import { downloadSave, uploadSave, deserializeState } from './util/saveload';
import { PRESETS } from './util/presets';
import { loadSettings, saveSettings, type Settings } from './util/settings';
import { THEMES, getThemeById, applyUITheme } from './util/themes';
import { applyRendererTheme } from './render/renderer';
import { SoundSystem } from './audio/SoundSystem';
import { GameEventBus } from './events/GameEventBus';
import acknowledgements from './generated/acknowledgements.json';

export interface BashtorioConfig {
  /** Container element to mount the game into */
  container: HTMLElement;
  /** Path to v86 assets (wasm, bios, vgabios, linux image) */
  assetsPath: string;
  /** Linux image filename (default: linux4.iso) */
  linuxImage?: string;
  /** Pre-booted state filename (if provided, skips boot for instant start) */
  stateImage?: string;
  /** 9p filesystem URL (for rootfs flat directory) */
  filesystemUrl?: string;
  /** 9p basefs JSON manifest - when set, enables 9p-root boot mode */
  basefs?: string;
  /** Optional WebSocket relay URL for networking */
  relayUrl?: string;
  /** Path to sound assets (default: assetsPath + '/sounds') */
  soundAssetsUrl?: string;
  /** Callback when boot status changes */
  onBootStatus?: (status: string) => void;
  /** Callback when boot completes */
  onReady?: () => void;
  /** Callback when boot fails */
  onError?: (error: Error) => void;
}

export interface BashtorioInstance {
  /** The game state */
  state: GameState;
  /** The VM instance */
  vm: LinuxVM;
  /** The renderer */
  renderer: Renderer;
  /** The input handler */
  input: InputHandler;
  /** The sound system */
  sound: SoundSystem;
  /** The game event bus */
  events: GameEventBus;
  /** Start the simulation */
  start: () => void;
  /** Stop the simulation */
  stop: () => void;
  /** Clear the grid */
  clear: () => void;
  /** Destroy the instance */
  destroy: () => void;
  /** Download VM state (for creating pre-booted images) */
  downloadState: () => Promise<void>;
}

/**
 * Mount a Bashtorio game instance into a container element.
 */
export async function mount(config: BashtorioConfig): Promise<BashtorioInstance> {
  const { container, assetsPath, linuxImage = 'linux4.iso', stateImage, filesystemUrl, basefs, relayUrl, soundAssetsUrl, onBootStatus, onReady, onError } = config;

  // Create DOM structure
  container.innerHTML = `
    <div class="bashtorio-root">
      <div class="bashtorio-boot">
        <div class="boot-content">
          <h1>Ba<span class="boot-sh">sh</span>torio</h1>
          <p class="boot-subtitle">A Unix Pipe Factory Game</p>
          <div class="boot-status">Initializing...</div>
          <div class="boot-terminal">
            <div class="screen-container">
              <div style="white-space: pre; font: 14px monospace"></div>
              <canvas style="display: none"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="bashtorio-game" style="display: none;">
        <canvas class="game-canvas"></canvas>
        <div class="sidebar-resize-handle"></div>
        <div class="bashtorio-toolbar"></div>
        <div class="bashtorio-sidebar">
          <div class="bashtorio-output">
            <div class="panel-header">
              <span>📋 Output</span>
              <button class="clear-output-btn">Clear</button>
            </div>
            <div class="output-sinks"></div>
          </div>
          <div class="bashtorio-streams">
            <div class="panel-header">
              <span>📡 Streams</span>
              <button class="clear-streams-btn">Clear</button>
            </div>
            <div class="stream-entries"></div>
          </div>
          <div class="bashtorio-cmdlog">
            <div class="panel-header">
              <span>🖥️ Command Log</span>
              <div class="panel-header-actions">
                <button class="cmdlog-autoscroll-btn active" title="Auto-scroll">▼</button>
                <button class="clear-cmdlog-btn">Clear</button>
              </div>
            </div>
            <div class="cmdlog-entries"></div>
          </div>
          <div class="bashtorio-terminal collapsed">
            <div class="panel-header terminal-toggle" style="cursor: pointer;">
              <span>🖥️ VM Terminal</span>
              <span class="terminal-toggle-icon">▶</span>
            </div>
            <div class="game-terminal"></div>
          </div>
        </div>
      </div>

      <!-- Machine Picker Popup -->
      <div class="machine-picker" style="display: none;">
        <div class="picker-column">
          <span class="picker-column-label">Route</span>
          <button class="picker-item" data-placeable="belt" title="Belt (Q)">
            <span class="picker-icon">➡️</span>
            <span class="picker-label">Belt</span>
          </button>
          <button class="picker-item" data-placeable="splitter" title="Splitter (W)">
            <span class="picker-icon">⑂</span>
            <span class="picker-label">Split</span>
          </button>
          <button class="picker-item" data-placeable="flipper" title="Flipper (V)">
            <span class="picker-icon">🔀</span>
            <span class="picker-label">Flip</span>
          </button>
          <button class="picker-item" data-placeable="duplicator" title="Duplicator (D)">
            <span class="picker-icon">📋</span>
            <span class="picker-label">Dup</span>
          </button>
        </div>
        <div class="picker-column">
          <span class="picker-column-label">Source</span>
          <button class="picker-item" data-placeable="source" title="Source (E)">
            <span class="picker-icon">📤</span>
            <span class="picker-label">SRC</span>
          </button>
          <button class="picker-item" data-placeable="constant" title="Constant (T)">
            <span class="picker-icon">♻️</span>
            <span class="picker-label">Loop</span>
          </button>
          <button class="picker-item" data-placeable="keyboard" title="Keyboard (K)">
            <span class="picker-icon">⌨️</span>
            <span class="picker-label">Key</span>
          </button>
          <button class="picker-item" data-placeable="linefeed" title="Linefeed (C)">
            <span class="picker-icon">↵</span>
            <span class="picker-label">LF</span>
          </button>
          <button class="picker-item" data-placeable="emoji" title="Emoji (Z)">
            <span class="picker-icon">🎲</span>
            <span class="picker-label">Emoji</span>
          </button>
        </div>
        <div class="picker-column">
          <span class="picker-column-label">Process</span>
          <button class="picker-item" data-placeable="command" title="Shell (F)">
            <span class="picker-icon">🖥️</span>
            <span class="picker-label">Shell</span>
          </button>
          <button class="picker-item" data-placeable="filter" title="Filter (G)">
            <span class="picker-icon">🚦</span>
            <span class="picker-label">Filter</span>
          </button>
          <button class="picker-item" data-placeable="counter" title="Counter (N)">
            <span class="picker-icon">🔢</span>
            <span class="picker-label">Count</span>
          </button>
          <button class="picker-item" data-placeable="delay" title="Delay (B)">
            <span class="picker-icon">⏱️</span>
            <span class="picker-label">Delay</span>
          </button>
        </div>
        <div class="picker-column">
          <span class="picker-column-label">Output</span>
          <button class="picker-item" data-placeable="sink" title="Sink (S)">
            <span class="picker-icon">📥</span>
            <span class="picker-label">Sink</span>
          </button>
          <button class="picker-item" data-placeable="display" title="Display (A)">
            <span class="picker-icon">💬</span>
            <span class="picker-label">UTF8</span>
          </button>
          <button class="picker-item" data-placeable="null" title="Null (X)">
            <span class="picker-icon">🕳️</span>
            <span class="picker-label">Null</span>
          </button>
        </div>
      </div>

      <!-- Command Modal -->
      <div class="bashtorio-modal command-modal" style="display: none;">
        <div class="modal-content cmd-modal-content">
          <div class="cmd-terminal">
            <div class="cmd-terminal-header">
              <span class="cmd-terminal-title">Shell Machine</span>
              <div class="cmd-terminal-controls">
                <label class="cmd-autostart-label">
                  <input type="checkbox" class="cmd-autostart">
                  <span>Auto-run</span>
                </label>
                <label class="cmd-autostart-label">
                  <input type="checkbox" class="cmd-stream">
                  <span>Stream</span>
                </label>
                <select class="cmd-input-mode modal-select">
                  <option value="pipe">Pipe</option>
                  <option value="args">Args</option>
                </select>
              </div>
            </div>
            <div class="cmd-terminal-body">
              <div class="cmd-prompt-line">
                <span class="cmd-prompt">/ $</span>
                <input type="text" class="cmd-input" placeholder="shell command" spellcheck="false">
              </div>
              <div class="cmd-separator"></div>
              <div class="cmd-test-section">
                <div class="cmd-test-label">Test:</div>
                <div class="cmd-prompt-line">
                  <span class="cmd-prompt cmd-prompt-test">~$</span>
                  <input type="text" class="cmd-run-input" placeholder="echo hello | yourcommand" spellcheck="false">
                  <button class="cmd-run-btn">Run</button>
                </div>
                <pre class="cmd-run-output"></pre>
              </div>
            </div>
            <div class="cmd-terminal-footer">
              <button class="cmd-cancel">Cancel</button>
              <button class="cmd-save">Save</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Linefeed Modal -->
      <div class="bashtorio-modal linefeed-modal" style="display: none;">
        <div class="modal-content">
          <h3>Linefeed Emitter</h3>
          <p class="modal-description">Set the interval between line feed emissions.</p>
          <div class="form-group">
            <label>Interval (ms):</label>
            <input type="number" class="lf-interval" min="50" max="10000" step="50" value="500">
          </div>
          <div class="modal-buttons">
            <button class="lf-cancel">Cancel</button>
            <button class="lf-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Flipper Modal -->
      <div class="bashtorio-modal flipper-modal" style="display: none;">
        <div class="modal-content">
          <h3>Flipper</h3>
          <p class="modal-description">Set the trigger byte that flips the output direction.</p>
          <div class="form-group flip-byte-input-mount"></div>
          <div class="form-group">
            <label>Direction:</label>
            <select class="flip-dir modal-select">
              <option value="0">Right →</option>
              <option value="1">Down ↓</option>
              <option value="2">Left ←</option>
              <option value="3">Up ↑</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button class="flip-cancel">Cancel</button>
            <button class="flip-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Constant Modal -->
      <div class="bashtorio-modal constant-modal" style="display: none;">
        <div class="modal-content">
          <h3>Constant</h3>
          <p class="modal-description">Loops text forever at a set interval.</p>
          <div class="form-group">
            <label>Text:</label>
            <input type="text" class="const-text" value="hello\n">
          </div>
          <div class="form-group">
            <label>Interval (ms):</label>
            <input type="number" class="const-interval" min="50" max="10000" step="50" value="500">
          </div>
          <div class="modal-buttons">
            <button class="const-cancel">Cancel</button>
            <button class="const-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Filter Modal -->
      <div class="bashtorio-modal filter-modal" style="display: none;">
        <div class="modal-content">
          <h3>Filter</h3>
          <p class="modal-description">Pass or block a specific byte.</p>
          <div class="form-group filter-byte-input-mount"></div>
          <div class="form-group">
            <label>Mode:</label>
            <select class="filter-mode-select modal-select">
              <option value="pass">Pass (only matching)</option>
              <option value="block">Block (everything except)</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button class="filter-cancel">Cancel</button>
            <button class="filter-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Counter Modal -->
      <div class="bashtorio-modal counter-modal" style="display: none;">
        <div class="modal-content">
          <h3>Counter</h3>
          <p class="modal-description">Counts received bytes. Emits count and resets on trigger byte.</p>
          <div class="form-group counter-byte-input-mount"></div>
          <div class="modal-buttons">
            <button class="counter-cancel">Cancel</button>
            <button class="counter-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Delay Modal -->
      <div class="bashtorio-modal delay-modal" style="display: none;">
        <div class="modal-content">
          <h3>Delay</h3>
          <p class="modal-description">Holds packets for a set duration before re-emitting.</p>
          <div class="form-group">
            <label>Delay (ms):</label>
            <input type="number" class="delay-ms" min="50" max="30000" step="50" value="1000">
          </div>
          <div class="modal-buttons">
            <button class="delay-cancel">Cancel</button>
            <button class="delay-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Source Modal -->
      <div class="bashtorio-modal source-modal" style="display: none;">
        <div class="modal-content">
          <h3>Source</h3>
          <p class="modal-description">Text data emitted one character at a time.</p>
          <div class="form-group">
            <label>Text:</label>
            <textarea class="source-text" rows="6" placeholder="Enter data to emit..."></textarea>
            <div class="source-newline-warn" style="display: none;">⚠ No trailing newline - most Unix tools expect one</div>
          </div>
          <div class="form-group">
            <label>Interval (ms):</label>
            <input type="number" class="source-interval" min="50" max="10000" step="50" value="500">
          </div>
          <div class="modal-buttons">
            <button class="source-upload">Upload File</button>
            <button class="source-cancel">Cancel</button>
            <button class="source-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Network Modal -->
      <div class="bashtorio-modal network-modal" style="display: none;">
        <div class="modal-content">
          <h3>Network Settings</h3>
          <p class="modal-description">
            Connect to a WebSocket relay to enable internet access in the VM.
            Run your own relay locally for security.
          </p>
          <div class="form-group">
            <label>Relay URL:</label>
            <input type="text" class="relay-url" placeholder="ws://127.0.0.1:8080/">
          </div>
          <div class="network-status">
            <span class="status-dot"></span>
            <span class="status-text">Not connected</span>
          </div>
          <div class="modal-buttons">
            <button class="network-cancel">Close</button>
            <button class="network-connect primary">Connect</button>
          </div>
        </div>
      </div>

      <!-- Presets Modal -->
      <div class="bashtorio-modal presets-modal" style="display: none;">
        <div class="modal-content presets-modal-content">
          <h3>Load Preset</h3>
          <p class="modal-description">
            Select a preset to load. This will replace your current layout.
          </p>
          <div class="presets-list"></div>
          <div class="modal-buttons">
            <button class="presets-cancel">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Settings Modal -->
      <div class="bashtorio-modal settings-modal" style="display: none;">
        <div class="modal-content">
          <h3>Settings</h3>
          <div class="form-group">
            <label>Color Theme:</label>
            <select class="theme-select">
              ${THEMES.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Ambient Volume: <span class="ambient-vol-value">100%</span></label>
            <input type="range" class="ambient-vol-slider" min="0" max="1" step="0.05" value="1">
          </div>
          <div class="form-group">
            <label>Machine Volume: <span class="machine-vol-value">100%</span></label>
            <input type="range" class="machine-vol-slider" min="0" max="1" step="0.05" value="1">
          </div>
          <div class="modal-buttons">
            <button class="ack-open-btn">Acknowledgements</button>
            <button class="settings-close primary">Close</button>
          </div>
        </div>
      </div>

      <!-- Acknowledgements Modal -->
      <div class="bashtorio-modal acknowledgements-modal" style="display: none;">
        <div class="modal-content ack-modal-content">
          <h3>Acknowledgements</h3>
          <div class="acknowledgements-list">
            ${acknowledgements.map(pkg => `
              <div class="ack-item">
                <div class="ack-item-header">
                  <span class="ack-name">${pkg.name} <span class="ack-version">v${pkg.version}</span></span>
                  <span class="ack-license">${pkg.license}</span>
                </div>
                <div class="ack-item-meta">
                  ${pkg.author ? `<span class="ack-author">${pkg.author}</span>` : ''}
                  ${pkg.url ? `${pkg.author ? ' · ' : ''}<a class="ack-url" href="${pkg.url}" target="_blank" rel="noopener">${pkg.url.replace(/^https?:\/\//, '')}</a>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="ack-footer">
            <span>${acknowledgements.length} packages · ${new Set(acknowledgements.map(p => p.license).filter(Boolean)).size} unique licenses</span>
            <button class="ack-close primary">Close</button>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div class="bashtorio-toast" style="display: none;"></div>
    </div>
  `;

  const bootScreen = container.querySelector('.bashtorio-boot') as HTMLElement;
  const bootStatus = container.querySelector('.boot-status') as HTMLElement;
  const screenContainer = container.querySelector('.screen-container') as HTMLElement;
  const gameScreen = container.querySelector('.bashtorio-game') as HTMLElement;
  const canvas = container.querySelector('.game-canvas') as HTMLCanvasElement;
  const toolbar = container.querySelector('.bashtorio-toolbar') as HTMLElement;
  const outputSinks = container.querySelector('.output-sinks') as HTMLElement;
  const gameTerminal = container.querySelector('.game-terminal') as HTMLElement;
  const commandModal = container.querySelector('.command-modal') as HTMLElement;
  const linefeedModal = container.querySelector('.linefeed-modal') as HTMLElement;
  const flipperModal = container.querySelector('.flipper-modal') as HTMLElement;
  const constantModal = container.querySelector('.constant-modal') as HTMLElement;
  const filterModal = container.querySelector('.filter-modal') as HTMLElement;
  const counterModal = container.querySelector('.counter-modal') as HTMLElement;
  const delayModal = container.querySelector('.delay-modal') as HTMLElement;
  const sourceModal = container.querySelector('.source-modal') as HTMLElement;
  const networkModal = container.querySelector('.network-modal') as HTMLElement;
  const presetsModal = container.querySelector('.presets-modal') as HTMLElement;
  const settingsModal = container.querySelector('.settings-modal') as HTMLElement;
  const acknowledgmentsModal = container.querySelector('.acknowledgements-modal') as HTMLElement;
  const themeSelect = settingsModal.querySelector('.theme-select') as HTMLSelectElement;
  const cmdlogEntries = container.querySelector('.cmdlog-entries') as HTMLElement;
  const streamEntries = container.querySelector('.stream-entries') as HTMLElement;
  const toast = container.querySelector('.bashtorio-toast') as HTMLElement;

  // Toast display logic
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;
  function showToast(message: string) {
    toast.textContent = message;
    toast.style.display = 'block';
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  }

  // Track sink output elements
  const sinkElements = new Map<number, HTMLPreElement>();

  function getOrCreateSinkElement(sinkId: number): HTMLPreElement {
    let el = sinkElements.get(sinkId);
    if (!el) {
      const section = document.createElement('div');
      section.className = 'sink-section';
      section.dataset.sinkId = String(sinkId);

      const label = document.createElement('div');
      label.className = 'sink-label';
      label.textContent = `Sink ${sinkId}`;

      el = document.createElement('pre');
      el.className = 'sink-output';
      el.dataset.raw = '';

      section.appendChild(label);
      section.appendChild(el);
      outputSinks.appendChild(section);
      sinkElements.set(sinkId, el);
    }
    return el;
  }

  // Create state
  const settings = loadSettings();
  const state = createInitialState();
  state.timescale = settings.speed;

  // Create VM
  const vm = new LinuxVM();
  state.vm = vm;

  const setStatus = (status: string) => {
    bootStatus.textContent = status;
    onBootStatus?.(status);
  };

  try {
    await vm.init({
      assetsPath,
      linuxImage,
      stateImage,
      filesystemUrl,
      basefs,
      screenContainer,
      relayUrl,
      onStatus: setStatus,
    });

    setStatus('Testing VM...');
    const ok = await vm.test();

    if (!ok) {
      throw new Error('VM test failed');
    }

    setStatus('Ready!');

    // Initialize event bus
    const events = new GameEventBus();

    // Initialize sound system (non-blocking)
    const sound = new SoundSystem({
      assetsUrl: soundAssetsUrl || `${assetsPath}/sounds`,
      muted: settings.muted,
      ambientVolume: settings.ambientVolume,
      machineVolume: settings.machineVolume,
    });
    sound.connectTo(events);
    sound.init().then(() => {
      sound.startLoop('editingAmbient');
    }).catch(e => console.warn('[Sound] Init failed:', e));

    // Small delay before transitioning
    await new Promise(r => setTimeout(r, 500));

    // Terminal collapse toggle
    const terminalPanel = container.querySelector('.bashtorio-terminal') as HTMLElement;
    const terminalToggle = container.querySelector('.terminal-toggle') as HTMLElement;
    const terminalToggleIcon = container.querySelector('.terminal-toggle-icon') as HTMLElement;
    terminalToggle.addEventListener('click', () => {
      const collapsed = terminalPanel.classList.toggle('collapsed');
      terminalToggleIcon.textContent = collapsed ? '▶' : '▼';
    });

    // Move terminal to game view and make it focusable
    gameTerminal.appendChild(screenContainer);
    screenContainer.setAttribute('tabindex', '0');

    // Click to focus the terminal
    screenContainer.addEventListener('click', () => {
      screenContainer.focus();
    });

    // Track terminal focus state for keyboard routing
    let terminalFocused = false;
    screenContainer.addEventListener('focus', () => {
      terminalFocused = true;
    });
    screenContainer.addEventListener('blur', () => {
      terminalFocused = false;
    });

    // v86 keyboard blocking is set up after InputHandler is created (see below)

    // Hide boot, show game
    bootScreen.style.display = 'none';
    gameScreen.style.display = 'grid';

    // Create renderer
    const renderer = new Renderer({ canvas });

    // Set up command modal
    let editingMachine: { x: number; y: number } | null = null;
    const cmdInput = commandModal.querySelector('.cmd-input') as HTMLInputElement;
    const cmdAutostart = commandModal.querySelector('.cmd-autostart') as HTMLInputElement;
    const cmdStream = commandModal.querySelector('.cmd-stream') as HTMLInputElement;
    const cmdInputMode = commandModal.querySelector('.cmd-input-mode') as HTMLSelectElement;

    // When stream is checked, force pipe mode and disable dropdown
    cmdStream.addEventListener('change', () => {
      if (cmdStream.checked) {
        cmdInputMode.value = 'pipe';
        cmdInputMode.disabled = true;
      } else {
        cmdInputMode.disabled = false;
      }
    });

    function closeCommandModal() {
      if (editingMachine) {
        vm.destroyShell(`edit_${editingMachine.x}_${editingMachine.y}`);
      }
      commandModal.style.display = 'none';
      editingMachine = null;
    }

    commandModal.querySelector('.cmd-cancel')?.addEventListener('click', closeCommandModal);

    commandModal.querySelector('.cmd-save')?.addEventListener('click', () => {
      if (editingMachine) {
        const machine = state.machines.find(m => m.x === editingMachine!.x && m.y === editingMachine!.y);
        if (machine && machine.type === MachineType.COMMAND) {
          machine.command = cmdInput.value.trim() || 'cat';
          machine.autoStart = cmdAutostart.checked;
          machine.stream = cmdStream.checked;
          machine.inputMode = cmdStream.checked ? 'pipe' : cmdInputMode.value as 'pipe' | 'args';
        }
      }
      closeCommandModal();
    });

    commandModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCommandModal();
      }
    });

    // Set up command runner
    const cmdRunInput = commandModal.querySelector('.cmd-run-input') as HTMLInputElement;
    const cmdRunBtn = commandModal.querySelector('.cmd-run-btn') as HTMLButtonElement;
    const cmdRunOutput = commandModal.querySelector('.cmd-run-output') as HTMLPreElement;
    const cmdPrompt = commandModal.querySelector('.cmd-prompt') as HTMLElement;
    const cmdTestPrompt = commandModal.querySelector('.cmd-prompt-test') as HTMLElement;

    function updatePromptCwd(cwd: string) {
      const display = cwd || '/';
      if (cmdPrompt) cmdPrompt.textContent = `${display} $`;
      if (cmdTestPrompt) cmdTestPrompt.textContent = `${display} $`;
    }

    async function runCommand() {
      if (!editingMachine) return;
      const command = cmdRunInput.value.trim();
      if (!command) return;

      cmdRunBtn.disabled = true;
      cmdRunBtn.textContent = 'Running...';
      cmdRunOutput.textContent = '';

      try {
        const machineId = `edit_${editingMachine.x}_${editingMachine.y}`;
        const { output, cwd } = await vm.execInShell(machineId, command);
        cmdRunOutput.textContent = output || '(no output)';
        if (cwd) updatePromptCwd(cwd);
      } catch (err) {
        cmdRunOutput.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      } finally {
        cmdRunBtn.disabled = false;
        cmdRunBtn.textContent = 'Run';
      }
    }

    cmdRunBtn.addEventListener('click', runCommand);
    cmdRunInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runCommand();
      }
    });

    // Set up linefeed modal
    let editingLinefeed: { x: number; y: number } | null = null;
    const lfInterval = linefeedModal.querySelector('.lf-interval') as HTMLInputElement;

    function closeLinefeedModal() {
      linefeedModal.style.display = 'none';
      editingLinefeed = null;
    }

    linefeedModal.querySelector('.lf-cancel')?.addEventListener('click', closeLinefeedModal);

    linefeedModal.querySelector('.lf-save')?.addEventListener('click', () => {
      if (editingLinefeed) {
        const machine = state.machines.find(m => m.x === editingLinefeed!.x && m.y === editingLinefeed!.y);
        if (machine && machine.type === MachineType.LINEFEED) {
          machine.emitInterval = Math.max(50, parseInt(lfInterval.value) || 500);
        }
      }
      closeLinefeedModal();
    });

    linefeedModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLinefeedModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        linefeedModal.querySelector('.lf-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up flipper modal with ByteInput
    let editingFlipper: { x: number; y: number } | null = null;
    const flipByteInputMount = flipperModal.querySelector('.flip-byte-input-mount') as HTMLElement;
    const flipByteInput = new ByteInput({ value: '\n' });
    flipByteInputMount.appendChild(flipByteInput.el);
    const flipDirSelect = flipperModal.querySelector('.flip-dir') as HTMLSelectElement;

    function closeFlipperModal() {
      flipperModal.style.display = 'none';
      editingFlipper = null;
    }

    flipperModal.querySelector('.flip-cancel')?.addEventListener('click', closeFlipperModal);

    flipperModal.querySelector('.flip-save')?.addEventListener('click', () => {
      if (editingFlipper) {
        const machine = state.machines.find(m => m.x === editingFlipper!.x && m.y === editingFlipper!.y);
        if (machine && machine.type === MachineType.FLIPPER) {
          machine.flipperTrigger = flipByteInput.getValue();
          const newDir = parseInt(flipDirSelect.value);
          machine.flipperDir = newDir;
          machine.flipperState = newDir;
        }
      }
      closeFlipperModal();
    });

    flipperModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeFlipperModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        flipperModal.querySelector('.flip-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up constant modal
    let editingConstant: { x: number; y: number } | null = null;
    const constText = constantModal.querySelector('.const-text') as HTMLInputElement;
    const constInterval = constantModal.querySelector('.const-interval') as HTMLInputElement;

    function closeConstantModal() {
      constantModal.style.display = 'none';
      editingConstant = null;
    }

    constantModal.querySelector('.const-cancel')?.addEventListener('click', closeConstantModal);

    constantModal.querySelector('.const-save')?.addEventListener('click', () => {
      if (editingConstant) {
        const raw = constText.value;
        // Interpret escape sequences: \n, \t, \\
        const text = raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
        input.updateConstantConfig(
          editingConstant.x,
          editingConstant.y,
          text,
          Math.max(50, parseInt(constInterval.value) || 500),
        );
      }
      closeConstantModal();
    });

    constantModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeConstantModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        constantModal.querySelector('.const-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up filter modal with ByteInput
    let editingFilter: { x: number; y: number } | null = null;
    const filterByteInputMount = filterModal.querySelector('.filter-byte-input-mount') as HTMLElement;
    const filterByteInput = new ByteInput({ value: '\n' });
    filterByteInputMount.appendChild(filterByteInput.el);
    const filterModeSelect = filterModal.querySelector('.filter-mode-select') as HTMLSelectElement;

    function closeFilterModal() {
      filterModal.style.display = 'none';
      editingFilter = null;
    }

    filterModal.querySelector('.filter-cancel')?.addEventListener('click', closeFilterModal);

    filterModal.querySelector('.filter-save')?.addEventListener('click', () => {
      if (editingFilter) {
        input.updateFilterConfig(
          editingFilter.x,
          editingFilter.y,
          filterByteInput.getValue(),
          filterModeSelect.value as 'pass' | 'block',
        );
      }
      closeFilterModal();
    });

    filterModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeFilterModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        filterModal.querySelector('.filter-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up counter modal with ByteInput
    let editingCounter: { x: number; y: number } | null = null;
    const counterByteInputMount = counterModal.querySelector('.counter-byte-input-mount') as HTMLElement;
    const counterByteInput = new ByteInput({ value: '\n' });
    counterByteInputMount.appendChild(counterByteInput.el);

    function closeCounterModal() {
      counterModal.style.display = 'none';
      editingCounter = null;
    }

    counterModal.querySelector('.counter-cancel')?.addEventListener('click', closeCounterModal);

    counterModal.querySelector('.counter-save')?.addEventListener('click', () => {
      if (editingCounter) {
        input.updateCounterConfig(
          editingCounter.x,
          editingCounter.y,
          counterByteInput.getValue(),
        );
      }
      closeCounterModal();
    });

    counterModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCounterModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        counterModal.querySelector('.counter-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up delay modal
    let editingDelay: { x: number; y: number } | null = null;
    const delayMsInput = delayModal.querySelector('.delay-ms') as HTMLInputElement;

    function closeDelayModal() {
      delayModal.style.display = 'none';
      editingDelay = null;
    }

    delayModal.querySelector('.delay-cancel')?.addEventListener('click', closeDelayModal);

    delayModal.querySelector('.delay-save')?.addEventListener('click', () => {
      if (editingDelay) {
        input.updateDelayConfig(
          editingDelay.x,
          editingDelay.y,
          Math.max(50, parseInt(delayMsInput.value) || 1000),
        );
      }
      closeDelayModal();
    });

    delayModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDelayModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        delayModal.querySelector('.delay-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up source modal
    let editingSource: { x: number; y: number } | null = null;
    const sourceTextInput = sourceModal.querySelector('.source-text') as HTMLTextAreaElement;
    const sourceIntervalInput = sourceModal.querySelector('.source-interval') as HTMLInputElement;
    const sourceNewlineWarn = sourceModal.querySelector('.source-newline-warn') as HTMLElement;

    function updateSourceNewlineWarn() {
      const text = sourceTextInput.value;
      sourceNewlineWarn.style.display = (text.length > 0 && !text.endsWith('\n')) ? '' : 'none';
    }

    sourceTextInput.addEventListener('input', updateSourceNewlineWarn);

    function closeSourceModal() {
      sourceModal.style.display = 'none';
      editingSource = null;
    }

    sourceModal.querySelector('.source-cancel')?.addEventListener('click', closeSourceModal);

    sourceModal.querySelector('.source-save')?.addEventListener('click', () => {
      if (editingSource) {
        input.updateSourceConfig(
          editingSource.x,
          editingSource.y,
          sourceTextInput.value,
          Math.max(50, parseInt(sourceIntervalInput.value) || 500),
        );
      }
      closeSourceModal();
    });

    sourceModal.querySelector('.source-upload')?.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.txt,.csv,.json,.md,.log,text/*';
      fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          sourceTextInput.value = reader.result as string;
          updateSourceNewlineWarn();
        };
        reader.readAsText(file);
      };
      fileInput.click();
    });

    sourceModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSourceModal();
    });

    // Set up network modal
    const relayInput = networkModal.querySelector('.relay-url') as HTMLInputElement;
    const networkStatus = networkModal.querySelector('.network-status') as HTMLElement;
    const networkConnectBtn = networkModal.querySelector('.network-connect') as HTMLButtonElement;

    const savedRelay = localStorage.getItem('bashtorio_relay_url') || '';
    relayInput.value = savedRelay;

    function updateNetworkUI() {
      const dot = networkStatus.querySelector('.status-dot') as HTMLElement;
      const text = networkStatus.querySelector('.status-text') as HTMLElement;
      const networkBtn = toolbar.querySelector('.network-btn') as HTMLElement;

      if (vm.networkRelay) {
        dot.classList.add('connected');
        text.textContent = 'Connected to ' + vm.networkRelay;
        networkConnectBtn.textContent = 'Disconnect';
        networkBtn?.classList.add('connected');
      } else if (savedRelay) {
        dot.classList.remove('connected');
        text.textContent = 'Will connect on next reload';
        networkConnectBtn.textContent = 'Save & Reload';
        networkBtn?.classList.remove('connected');
      } else {
        dot.classList.remove('connected');
        text.textContent = 'Not connected';
        networkConnectBtn.textContent = 'Connect';
        networkBtn?.classList.remove('connected');
      }
    }

    networkModal.querySelector('.network-cancel')?.addEventListener('click', () => {
      networkModal.style.display = 'none';
    });

    networkConnectBtn.addEventListener('click', () => {
      const url = relayInput.value.trim();
      if (vm.networkRelay && !url) {
        localStorage.removeItem('bashtorio_relay_url');
        location.reload();
      } else if (url) {
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          alert('Relay URL must start with ws:// or wss://');
          return;
        }
        localStorage.setItem('bashtorio_relay_url', url);
        location.reload();
      } else {
        localStorage.removeItem('bashtorio_relay_url');
        updateNetworkUI();
      }
    });

    // Set up presets modal
    const presetsList = presetsModal.querySelector('.presets-list') as HTMLElement;

    // Populate presets list
    presetsList.innerHTML = PRESETS.map(preset => `
      <div class="preset-item" data-preset-id="${preset.id}">
        <div class="preset-name">${preset.name}</div>
        <div class="preset-description">${preset.description}</div>
      </div>
    `).join('');

    // Handle preset clicks
    presetsList.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.preset-item') as HTMLElement;
      if (!item) return;

      const presetId = item.dataset.presetId;
      const preset = PRESETS.find(p => p.id === presetId);
      if (!preset) return;

      // Load the preset
      if (state.running) {
        state.running = false;
      }
      outputSinks.innerHTML = '';
      sinkElements.clear();
      deserializeState(state, preset.data);
      renderer.handleResize(state);

      presetsModal.style.display = 'none';
    });

    presetsModal.querySelector('.presets-cancel')?.addEventListener('click', () => {
      presetsModal.style.display = 'none';
    });

    presetsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        presetsModal.style.display = 'none';
      }
    });

    // Set up settings modal
    themeSelect.value = settings.theme;
    const root = container.querySelector('.bashtorio-root') as HTMLElement;
    const initialTheme = getThemeById(settings.theme);
    applyRendererTheme(initialTheme);
    applyUITheme(root, initialTheme);
    document.body.style.background = initialTheme.uiBg;

    // Volume sliders
    const ambientVolSlider = settingsModal.querySelector('.ambient-vol-slider') as HTMLInputElement;
    const ambientVolValue = settingsModal.querySelector('.ambient-vol-value') as HTMLElement;
    const machineVolSlider = settingsModal.querySelector('.machine-vol-slider') as HTMLInputElement;
    const machineVolValue = settingsModal.querySelector('.machine-vol-value') as HTMLElement;

    ambientVolSlider.value = String(settings.ambientVolume);
    ambientVolValue.textContent = Math.round(settings.ambientVolume * 100) + '%';
    machineVolSlider.value = String(settings.machineVolume);
    machineVolValue.textContent = Math.round(settings.machineVolume * 100) + '%';

    ambientVolSlider.addEventListener('input', () => {
      const vol = parseFloat(ambientVolSlider.value);
      sound.setAmbientVolume(vol);
      ambientVolValue.textContent = Math.round(vol * 100) + '%';
      settings.ambientVolume = vol;
      saveSettings(settings);
    });

    machineVolSlider.addEventListener('input', () => {
      const vol = parseFloat(machineVolSlider.value);
      sound.setMachineVolume(vol);
      machineVolValue.textContent = Math.round(vol * 100) + '%';
      settings.machineVolume = vol;
      saveSettings(settings);
    });

    settingsModal.querySelector('.settings-close')?.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    settingsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        settingsModal.style.display = 'none';
      }
    });

    // Set up acknowledgements modal
    settingsModal.querySelector('.ack-open-btn')?.addEventListener('click', () => {
      acknowledgmentsModal.style.display = 'flex';
    });

    acknowledgmentsModal.querySelector('.ack-close')?.addEventListener('click', () => {
      acknowledgmentsModal.style.display = 'none';
    });

    acknowledgmentsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        acknowledgmentsModal.style.display = 'none';
      }
    });

    // Close acknowledgements modal when clicking the backdrop
    acknowledgmentsModal.addEventListener('click', (e) => {
      if (e.target === acknowledgmentsModal) {
        acknowledgmentsModal.style.display = 'none';
      }
    });

    themeSelect.addEventListener('change', () => {
      const themeId = themeSelect.value;
      const theme = getThemeById(themeId);
      applyRendererTheme(theme);
      applyUITheme(root, theme);
      document.body.style.background = theme.uiBg;
      settings.theme = themeId;
      saveSettings(settings);
    });

    // Command log + streams state
    const cmdlogMap = new Map<string, HTMLElement>();
    const streamMap = new Map<string, HTMLElement>();

    function escapeHtml(s: string): string {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function truncate(s: string, max: number): string {
      const clean = s.replace(/\n/g, ' ').trim();
      return clean.length > max ? clean.slice(0, max) + '...' : clean;
    }

    let cmdlogAutoScroll = true;
    const cmdlogAutoScrollBtn = container.querySelector('.cmdlog-autoscroll-btn') as HTMLElement;

    function cmdlogScrollToBottom() {
      if (cmdlogAutoScroll) {
        cmdlogEntries.scrollTop = cmdlogEntries.scrollHeight;
      }
    }

    cmdlogAutoScrollBtn.addEventListener('click', () => {
      cmdlogAutoScroll = !cmdlogAutoScroll;
      cmdlogAutoScrollBtn.classList.toggle('active', cmdlogAutoScroll);
      cmdlogEntries.classList.toggle('scrollable', !cmdlogAutoScroll);
      if (cmdlogAutoScroll) {
        cmdlogEntries.scrollTop = cmdlogEntries.scrollHeight;
      }
    });

    function clearCmdlog() {
      cmdlogEntries.innerHTML = '';
      cmdlogMap.clear();
    }

    function clearStreams() {
      streamEntries.innerHTML = '';
      streamMap.clear();
    }

    container.querySelector('.clear-cmdlog-btn')?.addEventListener('click', clearCmdlog);
    container.querySelector('.clear-streams-btn')?.addEventListener('click', clearStreams);

    // Wire command log events
    events.on('commandStart', (payload) => {
      const isStream = !!payload.stream;
      const entry = document.createElement('div');
      entry.className = isStream ? 'stream-entry stream-entry--running' : 'cmdlog-entry cmdlog-entry--running';
      const inputClean = payload.input.replace(/\n/g, ' ').trim();
      const cmdLine = inputClean
        ? truncate(`$ "${inputClean}" | ${payload.command}`, 60)
        : truncate(`$ ${payload.command}`, 60);

      if (isStream) {
        entry.innerHTML =
          `<div class="stream-cmd"><span class="stream-cmd-text">${escapeHtml(cmdLine)}</span><span class="stream-status">running</span></div>`;
        streamEntries.appendChild(entry);
        streamMap.set(payload.machineId, entry);
      } else {
        entry.innerHTML =
          `<div class="cmdlog-cmd"><span class="cmdlog-cmd-text">${escapeHtml(cmdLine)}</span><span class="cmdlog-status">...</span></div>`;
        cmdlogEntries.appendChild(entry);
        cmdlogScrollToBottom();
        cmdlogMap.set(payload.machineId, entry);
      }
    });

    events.on('commandComplete', (payload) => {
      if (payload.stream) {
        const entry = streamMap.get(payload.machineId);
        if (!entry) return;
        entry.classList.remove('stream-entry--running');
        if (payload.error) entry.classList.add('stream-entry--error');
        const statusEl = entry.querySelector('.stream-status') as HTMLElement;
        if (statusEl) {
          const icon = payload.error ? '✗' : '✓';
          statusEl.textContent = payload.error ? `error ${icon}` : `done ${icon}`;
        }
        // Don't remove from streamMap - keep visible until cleared
      } else {
        const entry = cmdlogMap.get(payload.machineId);
        if (!entry) return;
        entry.classList.remove('cmdlog-entry--running');
        if (payload.error) entry.classList.add('cmdlog-entry--error');
        const statusEl = entry.querySelector('.cmdlog-status') as HTMLElement;
        if (statusEl) {
          const ms = Math.round(payload.durationMs);
          const icon = payload.error ? '✗' : '✓';
          statusEl.textContent = `${ms}ms ${icon}`;
        }
        // Add output line
        const outputText = truncate(payload.output, 60);
        if (outputText) {
          const ioEl = document.createElement('div');
          ioEl.className = 'cmdlog-io';
          ioEl.textContent = '→ ' + outputText;
          entry.appendChild(ioEl);
        }
        cmdlogScrollToBottom();
        cmdlogMap.delete(payload.machineId);
      }
    });

    events.on('simulationStart', () => {
      clearCmdlog();
      clearStreams();
    });

    // Create simulation callbacks
    const simCallbacks: SimulationCallbacks = {
      onVMStatusChange: (status) => {
        const vmStatus = toolbar.querySelector('.vm-status') as HTMLElement;
        if (vmStatus) {
          vmStatus.className = 'vm-status ' + status;
          const text = vmStatus.querySelector('.status-text');
          if (text) {
            text.textContent = status === 'ready' ? 'VM Ready' : status === 'busy' ? 'Processing...' : 'VM Error';
          }
        }
      },
      onOutput: (sinkId, content) => {
        // Get or create the sink element
        const sinkOutput = getOrCreateSinkElement(sinkId);
        // Append to raw buffer stored in dataset, then re-render with ANSI colors
        const raw = (sinkOutput.dataset.raw || '') + content;
        sinkOutput.dataset.raw = raw;
        sinkOutput.innerHTML = ansiToHtml(raw);
        sinkOutput.scrollTop = sinkOutput.scrollHeight;
      },
      onMachineReceive: (char) => {
        events.emit('machineReceive', { char });
      },
      onSinkReceive: (char) => {
        events.emit('sinkReceive', { char });
      },
      events,
    };

    // Create input handler
    // Track cumulative rotation so the arrow always spins forward
    let dirRotation = state.currentDir * 90;
    let dirPrevRotation = dirRotation;

    const inputCallbacks: InputCallbacks = {
      onModeChange: (mode) => {
        toolbar.querySelectorAll('.mode-btn').forEach(btn => {
          (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
        });
        // Hide popout when switching away from machine mode
        if (mode !== 'machine') {
          const popout = toolbar.querySelector('.placeable-popout') as HTMLElement;
          if (popout) popout.style.display = 'none';
        }
        // Update cursor
        renderer.updateCursor(mode);
        // Emit select event when switching to select mode
        if (mode === 'select') {
          events.emit('select');
        }
      },
      onPlaceableChange: (placeable) => {
        toolbar.querySelectorAll('.placeable-btn').forEach(btn => {
          (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.placeable === placeable);
        });
        // Update the Place button icon and label
        const activeBtn = toolbar.querySelector(`.placeable-btn[data-placeable="${placeable}"]`);
        const icon = activeBtn?.querySelector('.tool-icon')?.textContent || '➡️';
        const label = activeBtn?.querySelector('.tool-label')?.textContent || 'Belt';
        const placeIcon = toolbar.querySelector('.placeable-icon');
        const placeLabel = toolbar.querySelector('.placeable-label');
        if (placeIcon) placeIcon.textContent = icon;
        if (placeLabel) placeLabel.textContent = label;
      },
      onDirectionChange: (dir) => {
        const arrow = toolbar.querySelector('.dir-arrow') as SVGElement;
        if (arrow) {
          dirRotation = dir * 90;
          // Keep cumulative so it never rewinds (e.g. 270 → 360 not 270 → 0)
          while (dirRotation < dirPrevRotation) dirRotation += 360;
          dirPrevRotation = dirRotation;
          arrow.style.transform = `rotate(${dirRotation}deg)`;
        }
      },
      onRunningChange: (running) => {
        const runBtn = toolbar.querySelector('.run-btn') as HTMLButtonElement;
        const stopBtn = toolbar.querySelector('.stop-btn') as HTMLButtonElement;
        if (runBtn) runBtn.disabled = running;
        if (stopBtn) stopBtn.disabled = !running;
        if (running) {
          for (const el of sinkElements.values()) {
            el.dataset.raw = '';
            el.innerHTML = '';
          }
        }
        // Emit simulation start/end events
        events.emit(running ? 'simulationStart' : 'simulationEnd');
      },
      onMachineClick: async (machine) => {
        editingMachine = { x: machine.x, y: machine.y };
        cmdInput.value = machine.command;
        cmdAutostart.checked = machine.autoStart;
        cmdStream.checked = machine.stream;
        cmdInputMode.value = machine.inputMode || 'pipe';
        cmdInputMode.disabled = machine.stream;
        updatePromptCwd(machine.cwd);
        // Clear command runner state
        cmdRunInput.value = '';
        cmdRunOutput.textContent = '';
        commandModal.style.display = 'flex';
        cmdInput.focus();
        cmdInput.select();
        events.emit('configureStart');
        // Initialize edit shell at the machine's current working directory
        const editId = `edit_${machine.x}_${machine.y}`;
        await vm.destroyShell(editId);
        await vm.createShell(editId);
        if (machine.cwd && machine.cwd !== '/') {
          await vm.execInShell(editId, `cd "${machine.cwd}"`);
        }
      },
      onLinefeedClick: (machine) => {
        editingLinefeed = { x: machine.x, y: machine.y };
        lfInterval.value = String(machine.emitInterval);
        linefeedModal.style.display = 'flex';
        lfInterval.focus();
        lfInterval.select();
        events.emit('configureStart');
      },
      onFlipperClick: (machine) => {
        editingFlipper = { x: machine.x, y: machine.y };
        flipByteInput.setValue(machine.flipperTrigger);
        flipDirSelect.value = String(machine.flipperDir);
        flipperModal.style.display = 'flex';
        flipByteInput.focus();
        events.emit('configureStart');
      },
      onConstantClick: (machine) => {
        editingConstant = { x: machine.x, y: machine.y };
        // Display escape sequences for readability
        const displayText = machine.constantText.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
        constText.value = displayText;
        constInterval.value = String(machine.emitInterval);
        constantModal.style.display = 'flex';
        constText.focus();
        constText.select();
        events.emit('configureStart');
      },
      onFilterClick: (machine) => {
        editingFilter = { x: machine.x, y: machine.y };
        filterByteInput.setValue(machine.filterByte);
        filterModeSelect.value = machine.filterMode;
        filterModal.style.display = 'flex';
        filterByteInput.focus();
        events.emit('configureStart');
      },
      onCounterClick: (machine) => {
        editingCounter = { x: machine.x, y: machine.y };
        counterByteInput.setValue(machine.counterTrigger);
        counterModal.style.display = 'flex';
        counterByteInput.focus();
        events.emit('configureStart');
      },
      onDelayClick: (machine) => {
        editingDelay = { x: machine.x, y: machine.y };
        delayMsInput.value = String(machine.delayMs);
        delayModal.style.display = 'flex';
        delayMsInput.focus();
        delayMsInput.select();
        events.emit('configureStart');
      },
      onSourceClick: (machine) => {
        editingSource = { x: machine.x, y: machine.y };
        sourceTextInput.value = machine.sourceText;
        sourceIntervalInput.value = String(machine.emitInterval);
        updateSourceNewlineWarn();
        sourceModal.style.display = 'flex';
        sourceTextInput.focus();
        events.emit('configureStart');
      },
      onToast: (message) => {
        showToast(message);
      },
    };

    const input = new InputHandler(state, renderer, canvas, events, inputCallbacks);
    input.init();

    // v86 captures keyboard events globally on window
    // We need to stop these events when terminal is not focused, but still handle game keys
    const blockV86Keyboard = (e: KeyboardEvent) => {
      // Don't block if terminal is focused - let v86 handle it
      if (terminalFocused) return;
      // Don't block if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Stop v86 from receiving this event
      e.stopImmediatePropagation();
      // Forward to InputHandler for game key handling
      if (e.type === 'keydown') {
        // Emit keyPress for KEYBOARD machines during simulation
        if (state.running && e.key.length === 1) {
          events.emit('keyPress', { char: e.key });
        } else if (state.running && e.key === 'Enter') {
          events.emit('keyPress', { char: '\n' });
        } else if (state.running && e.key === 'Tab') {
          events.emit('keyPress', { char: '\t' });
        }
        input.handleKeyDown(e);
      }
    };

    // Add at capture phase to run before v86's handlers
    window.addEventListener('keydown', blockV86Keyboard, true);
    window.addEventListener('keyup', blockV86Keyboard, true);

    // Wire keyPress events to KEYBOARD machines
    events.on('keyPress', (payload) => {
      for (const machine of state.machines) {
        if (machine.type === MachineType.KEYBOARD) {
          machine.outputBuffer += payload.char;
        }
      }
    });

    // Create toolbar UI
    createToolbar(toolbar, state, input, sound, settings, {
      onNetworkClick: () => {
        updateNetworkUI();
        networkModal.style.display = 'flex';
        relayInput.focus();
      },
      onSave: () => {
        downloadSave(state);
      },
      onLoad: async () => {
        try {
          const data = await uploadSave();
          // Stop simulation if running
          if (state.running) {
            input.stopSim();
          }
          // Clear sink outputs
          outputSinks.innerHTML = '';
          sinkElements.clear();
          // Load the save
          deserializeState(state, data);
          // Force re-render
          renderer.handleResize(state);
        } catch (e) {
          console.error('Failed to load save:', e);
          alert('Failed to load save file: ' + (e instanceof Error ? e.message : String(e)));
        }
      },
      onPresets: () => {
        presetsModal.style.display = 'flex';
      },
      onSettingsClick: () => {
        settingsModal.style.display = 'flex';
      },
    });

    // Now that toolbar is populated, resize canvas and initialize grid
    renderer.handleResize(state);
    initGrid(state, GRID_COLS, GRID_ROWS);

    // Load the sample preset by default
    const samplePreset = PRESETS.find(p => p.id === 'sample');
    if (samplePreset) {
      deserializeState(state, samplePreset.data);
      renderer.handleResize(state);
    }

    // Set initial cursor based on mode
    renderer.updateCursor(state.currentMode);

    // Initialize network UI state
    updateNetworkUI();

    // Sidebar resize handle
    const resizeHandle = container.querySelector('.sidebar-resize-handle') as HTMLElement;
    const gameEl = container.querySelector('.bashtorio-game') as HTMLElement;
    let sidebarWidth = 720;

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      resizeHandle.classList.add('dragging');
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (e: MouseEvent) => {
        const delta = startX - e.clientX;
        const newWidth = Math.max(300, Math.min(startWidth + delta, window.innerWidth - 400));
        sidebarWidth = newWidth;
        gameEl.style.setProperty('--sidebar-width', `${newWidth}px`);
        renderer.handleResize(state);
      };

      const onMouseUp = () => {
        resizeHandle.classList.remove('dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Clear output button
    const clearOutputBtn = container.querySelector('.clear-output-btn');
    clearOutputBtn?.addEventListener('click', () => {
      outputSinks.innerHTML = '';
      sinkElements.clear();
    });

    // Machine picker popup
    const machinePicker = container.querySelector('.machine-picker') as HTMLElement;
    let mouseX = 0;
    let mouseY = 0;

    // Track mouse position on canvas
    canvas.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Show picker on Tab key
    const showPicker = () => {
      // Update active state
      machinePicker.querySelectorAll('.picker-item').forEach(item => {
        (item as HTMLElement).classList.toggle('active',
          (item as HTMLElement).dataset.placeable === state.currentPlaceable);
      });
      // Position at mouse cursor
      machinePicker.style.left = `${mouseX}px`;
      machinePicker.style.top = `${mouseY}px`;
      machinePicker.style.display = 'grid';

      // Adjust if off-screen
      const rect = machinePicker.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        machinePicker.style.left = `${window.innerWidth - rect.width - 10}px`;
      }
      if (rect.bottom > window.innerHeight) {
        machinePicker.style.top = `${window.innerHeight - rect.height - 10}px`;
      }
    };

    const hidePicker = () => {
      machinePicker.style.display = 'none';
    };

    // E key handler for machine picker
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'e' || e.key === 'E') && !terminalFocused) {
        // Don't trigger if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        if (machinePicker.style.display === 'none') {
          showPicker();
        } else {
          hidePicker();
        }
      }
      if (e.key === 'Escape') {
        hidePicker();
      }
    });

    // Picker item click handlers
    machinePicker.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        const placeable = (item as HTMLElement).dataset.placeable as PlaceableType;
        input.selectPlaceable(placeable);
        input.selectMode('machine');
        hidePicker();
      });
    });

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
      if (!machinePicker.contains(e.target as Node) && machinePicker.style.display !== 'none') {
        hidePicker();
      }
    });

    // Animation loop
    let running = true;
    let lastTime = 0;
    const cursorCoords = toolbar.querySelector('.cursor-coords') as HTMLElement;
    function animate(time: number) {
      if (!running) return;
      const deltaTime = lastTime ? time - lastTime : 0;
      lastTime = time;
      updateSimulation(state, deltaTime, simCallbacks);
      renderer.render(state, time);
      if (renderer.hoverCol >= 0) {
        cursorCoords.textContent = `${renderer.hoverCol}, ${renderer.hoverRow}`;
      } else {
        cursorCoords.textContent = '';
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    const instance: BashtorioInstance = {
      state,
      vm,
      renderer,
      input,
      sound,
      events,
      start: () => input.startSim(),
      stop: () => input.stopSim(),
      clear: () => input.clearAll(),
      destroy: () => {
        running = false;
        input.destroy();
        vm.destroy();
        sound.destroy();
        events.destroy();
        container.innerHTML = '';
      },
      downloadState: () => vm.downloadState(),
    };

    window.addEventListener('beforeunload', () => instance.destroy());

    onReady?.();
    return instance;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    setStatus('Error: ' + err.message);
    onError?.(err);
    throw err;
  }
}

function createToolbar(
  toolbar: HTMLElement,
  state: GameState,
  input: InputHandler,
  sound: SoundSystem,
  settings: Settings,
  callbacks: {
    onNetworkClick?: () => void;
    onSave?: () => void;
    onLoad?: () => void;
    onPresets?: () => void;
    onSettingsClick?: () => void;
  } = {}
): void {
  const modes: { id: CursorMode; icon: string; label: string; key: string }[] = [
    { id: 'select', icon: '👆', label: 'Select', key: '1' },
    { id: 'erase', icon: '🗑️', label: 'Erase', key: '2' },
    { id: 'machine', icon: '🔧', label: 'Place', key: '3' },
  ];

  const placeableColumns: { label: string; items: { id: PlaceableType; icon: string; label: string; key: string }[] }[] = [
    { label: 'Route', items: [
      { id: 'belt', icon: '➡️', label: 'Belt', key: 'Q' },
      { id: 'splitter', icon: '⑂', label: 'Split', key: 'W' },
      { id: 'flipper', icon: '🔀', label: 'Flip', key: 'V' },
      { id: 'duplicator', icon: '📋', label: 'Dup', key: 'D' },
    ]},
    { label: 'Source', items: [
      { id: 'source', icon: '📤', label: 'SRC', key: 'E' },
      { id: 'constant', icon: '♻️', label: 'Loop', key: 'T' },
      { id: 'keyboard', icon: '⌨️', label: 'Key', key: 'K' },
      { id: 'linefeed', icon: '↵', label: 'LF', key: 'C' },
      { id: 'emoji', icon: '🎲', label: 'Emoji', key: 'Z' },
    ]},
    { label: 'Process', items: [
      { id: 'command', icon: '🖥️', label: 'Shell', key: 'F' },
      { id: 'filter', icon: '🚦', label: 'Filter', key: 'G' },
      { id: 'counter', icon: '🔢', label: 'Count', key: 'N' },
      { id: 'delay', icon: '⏱️', label: 'Delay', key: 'B' },
    ]},
    { label: 'Output', items: [
      { id: 'sink', icon: '📥', label: 'Sink', key: 'S' },
      { id: 'display', icon: '💬', label: 'UTF8', key: 'A' },
      { id: 'null', icon: '🕳️', label: 'Null', key: 'X' },
    ]},
  ];

  const placeables = placeableColumns.flatMap(c => c.items);

  // Get the current placeable's icon and label
  const currentPlaceable = placeables.find(p => p.id === state.currentPlaceable);
  const currentPlaceableIcon = currentPlaceable?.icon || '➡️';
  const currentPlaceableLabel = currentPlaceable?.label || 'Belt';

  toolbar.innerHTML = `
    <div class="toolbar-main">
      <div class="tool-group mode-group">
        ${modes.map(m => {
          if (m.id === 'machine') {
            // Place button with popout - show current placeable icon and label
            return `
              <div class="mode-btn-wrapper">
                <button class="mode-btn ${m.id === state.currentMode ? 'active' : ''}" data-mode="${m.id}" title="Place (${m.key})">
                  <span class="tool-icon placeable-icon">${currentPlaceableIcon}</span>
                  <span class="tool-label placeable-label">${currentPlaceableLabel}</span>
                </button>
                <div class="placeable-popout" style="display: none;">
                  ${placeableColumns.map(col => `
                    <div class="popout-column">
                      <span class="popout-column-label">${col.label}</span>
                      ${col.items.map(p => `
                        <button class="placeable-btn ${p.id === state.currentPlaceable ? 'active' : ''}" data-placeable="${p.id}" title="${p.label} (${p.key})">
                          <span class="tool-icon">${p.icon}</span>
                          <span class="tool-label">${p.label}</span>
                        </button>
                      `).join('')}
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }
          return `
            <button class="mode-btn ${m.id === state.currentMode ? 'active' : ''}" data-mode="${m.id}" title="${m.label} (${m.key})">
              <span class="tool-icon">${m.icon}</span>
              <span class="tool-label">${m.label}</span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="tool-group">
        <span class="direction-label">Dir:</span>
        <button class="dir-btn"><svg class="dir-arrow" style="transform: rotate(${state.currentDir * 90}deg)" viewBox="0 0 24 24" width="20" height="20"><path d="M4 12h13m-5-5 6 5-6 5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="hint">[R]</span>
      </div>
      <div class="tool-group">
        <button class="dir-btn zoom-out-btn" title="Zoom Out">−</button>
        <span class="zoom-value">${Math.round(state.camera.scale * 100)}%</span>
        <button class="dir-btn zoom-in-btn" title="Zoom In">+</button>
      </div>
      <div class="tool-group">
        <label>Speed:</label>
        <input type="range" class="speed-slider" min="0.25" max="4" step="0.25" value="${state.timescale}">
        <span class="speed-value">${state.timescale}x</span>
      </div>
      <div class="tool-group">
        <button class="action-btn run-btn">▶ Run</button>
        <button class="action-btn stop-btn" disabled>⏹ Stop</button>
        <button class="action-btn clear-btn">🗑️ Clear</button>
      </div>
      <div class="tool-group">
        <div class="mode-btn-wrapper">
          <button class="action-btn storage-btn">💾 Storage</button>
          <div class="storage-popout" style="display: none;">
            <button class="action-btn save-btn">💾 Save</button>
            <button class="action-btn load-btn">📂 Load</button>
            <button class="action-btn presets-btn">📚 Presets</button>
          </div>
        </div>
      </div>
      <div class="tool-group">
        <button class="action-btn network-btn">🌐 Network</button>
      </div>
      <div class="tool-group">
        <button class="action-btn mute-btn" title="Toggle Sound">${sound.muted ? '🔇' : '🔊'}</button>
        <button class="action-btn settings-btn" title="Settings">⚙️</button>
      </div>
      <div class="tool-group">
        <div class="vm-status ready">
          <span class="status-dot"></span>
          <span class="status-text">VM Ready</span>
        </div>
      </div>
      <div class="tool-group">
        <span class="cursor-coords"></span>
      </div>
    </div>
  `;

  const popout = toolbar.querySelector('.placeable-popout') as HTMLElement;
  const placeBtn = toolbar.querySelector('.mode-btn[data-mode="machine"]') as HTMLElement;
  const placeIcon = placeBtn?.querySelector('.placeable-icon') as HTMLElement;

  function showPopout() {
    popout.style.left = '';
    popout.style.transform = '';
    popout.style.right = '';
    popout.style.display = 'flex';
    // Clamp to viewport
    const rect = popout.getBoundingClientRect();
    const btnRect = placeBtn.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    if (rect.left < 0) {
      popout.style.left = '0';
      popout.style.transform = 'none';
    } else if (rect.right > window.innerWidth) {
      popout.style.left = 'auto';
      popout.style.right = '0';
      popout.style.transform = 'none';
    }
    // Position arrow to point at button center
    const popoutRect = popout.getBoundingClientRect();
    const arrowLeft = btnCenterX - popoutRect.left;
    popout.style.setProperty('--arrow-left', `${arrowLeft}px`);
  }

  // Mode buttons
  toolbar.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.mode as CursorMode;

      if (mode === 'machine') {
        // Toggle popout if already in machine mode, otherwise switch to machine mode and show popout
        if (state.currentMode === 'machine') {
          if (popout.style.display === 'none') {
            showPopout();
          } else {
            popout.style.display = 'none';
          }
        } else {
          input.selectMode(mode);
          showPopout();
        }
      } else {
        input.selectMode(mode);
        popout.style.display = 'none';
      }
    });
  });

  const placeLabel = placeBtn?.querySelector('.placeable-label') as HTMLElement;

  // Placeable buttons
  toolbar.querySelectorAll('.placeable-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const placeable = (btn as HTMLElement).dataset.placeable as PlaceableType;
      input.selectPlaceable(placeable);

      // Update the Place button icon and label
      const p = placeables.find(p => p.id === placeable);
      if (placeIcon) placeIcon.textContent = p?.icon || '➡️';
      if (placeLabel) placeLabel.textContent = p?.label || 'Belt';

      // Close the popout
      popout.style.display = 'none';

      // Update active state
      toolbar.querySelectorAll('.placeable-btn').forEach(b => {
        (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.placeable === placeable);
      });
    });
  });

  // Direction button
  toolbar.querySelector('.dir-btn')?.addEventListener('click', () => {
    input.rotateDirection();
  });

  // Zoom buttons
  const ZOOM_STEP = 0.25;
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3;
  const zoomValue = toolbar.querySelector('.zoom-value') as HTMLElement;

  function applyZoom(newScale: number) {
    state.camera.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
    zoomValue.textContent = Math.round(state.camera.scale * 100) + '%';
  }

  toolbar.querySelector('.zoom-in-btn')?.addEventListener('click', () => {
    applyZoom(state.camera.scale + ZOOM_STEP);
  });
  toolbar.querySelector('.zoom-out-btn')?.addEventListener('click', () => {
    applyZoom(state.camera.scale - ZOOM_STEP);
  });

  // Speed slider
  const speedSlider = toolbar.querySelector('.speed-slider') as HTMLInputElement;
  const speedValue = toolbar.querySelector('.speed-value') as HTMLElement;
  speedSlider?.addEventListener('input', () => {
    const speed = parseFloat(speedSlider.value);
    input.setSpeed(speed);
    speedValue.textContent = speed + 'x';
    saveSettings({ ...settings, speed });
  });

  // Action buttons
  toolbar.querySelector('.run-btn')?.addEventListener('click', () => input.startSim());
  toolbar.querySelector('.stop-btn')?.addEventListener('click', () => input.stopSim());
  toolbar.querySelector('.clear-btn')?.addEventListener('click', () => input.clearAll());

  // Storage popout
  const storagePopout = toolbar.querySelector('.storage-popout') as HTMLElement;
  const storageBtn = toolbar.querySelector('.storage-btn') as HTMLElement;

  function showStoragePopout() {
    storagePopout.style.left = '';
    storagePopout.style.transform = '';
    storagePopout.style.right = '';
    storagePopout.style.display = 'flex';
    // Clamp to viewport
    const rect = storagePopout.getBoundingClientRect();
    const btnRect = storageBtn.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    if (rect.right > window.innerWidth) {
      storagePopout.style.left = 'auto';
      storagePopout.style.right = '0';
      storagePopout.style.transform = 'none';
    }
    const popoutRect = storagePopout.getBoundingClientRect();
    const arrowLeft = btnCenterX - popoutRect.left;
    storagePopout.style.setProperty('--arrow-left', `${arrowLeft}px`);
  }

  storageBtn.addEventListener('click', () => {
    if (storagePopout.style.display === 'none') {
      showStoragePopout();
    } else {
      storagePopout.style.display = 'none';
    }
  });

  // Save/Load/Presets buttons
  toolbar.querySelector('.save-btn')?.addEventListener('click', () => {
    storagePopout.style.display = 'none';
    callbacks.onSave?.();
  });
  toolbar.querySelector('.load-btn')?.addEventListener('click', () => {
    storagePopout.style.display = 'none';
    callbacks.onLoad?.();
  });
  toolbar.querySelector('.presets-btn')?.addEventListener('click', () => {
    storagePopout.style.display = 'none';
    callbacks.onPresets?.();
  });

  // Close storage popout on outside click
  document.addEventListener('click', (e) => {
    const wrapper = storageBtn.closest('.mode-btn-wrapper');
    if (wrapper && !wrapper.contains(e.target as Node) && storagePopout.style.display !== 'none') {
      storagePopout.style.display = 'none';
    }
  });

  // Network button
  toolbar.querySelector('.network-btn')?.addEventListener('click', () => {
    callbacks.onNetworkClick?.();
  });

  // Mute button
  const muteBtn = toolbar.querySelector('.mute-btn') as HTMLElement;
  muteBtn?.addEventListener('click', () => {
    const muted = sound.toggleMute();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    saveSettings({ ...settings, muted });
  });

  // Settings button
  toolbar.querySelector('.settings-btn')?.addEventListener('click', () => {
    callbacks.onSettingsClick?.();
  });
}
