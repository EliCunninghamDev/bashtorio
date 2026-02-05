// Re-export types and classes
export * from './game/types';
export * from './game/state';
export { LinuxVM } from './vm';
export type { VMConfig } from './vm';
export { Renderer } from './render';
export type { RendererConfig } from './render';
export { InputHandler } from './ui';
export type { InputCallbacks } from './ui';
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

import { LinuxVM } from './vm';
import { Renderer } from './render';
import { InputHandler, type InputCallbacks } from './ui';
import { createInitialState, type GameState } from './game/state';
import { initGrid } from './game/grid';
import { updateSimulation, type SimulationCallbacks } from './game/simulation';
import { GRID_SIZE, DirArrows, type CursorMode, type PlaceableType } from './game/types';
import { ansiToHtml } from './util/ansi';
import { downloadSave, uploadSave, deserializeState } from './util/saveload';
import { PRESETS } from './util/presets';
import { loadSettings, saveSettings } from './util/settings';
import { SoundSystem } from './audio/SoundSystem';
import { GameEventBus } from './events/GameEventBus';

export interface BashtorioConfig {
  /** Container element to mount the game into */
  container: HTMLElement;
  /** Path to v86 assets (wasm, bios, vgabios, linux image) */
  assetsPath: string;
  /** Linux image filename (default: linux4.iso) */
  linuxImage?: string;
  /** Pre-booted state filename (if provided, skips boot for instant start) */
  stateImage?: string;
  /** 9p filesystem URL (for Arch Linux, point to https://k.copy.sh/arch/) */
  filesystemUrl?: string;
  /** Optional WebSocket relay URL for networking */
  relayUrl?: string;
  /** Path to sound assets (default: assetsPath + '/sounds') */
  soundAssetsUrl?: string;
  /** Initial source text */
  sourceText?: string;
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
  const { container, assetsPath, linuxImage = 'linux4.iso', stateImage, filesystemUrl, relayUrl, soundAssetsUrl, sourceText, onBootStatus, onReady, onError } = config;

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
              <div style="white-space: pre; font: 14px monospace; line-height: 14px"></div>
              <canvas style="display: none"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="bashtorio-game" style="display: none;">
        <canvas class="game-canvas"></canvas>
        <div class="bashtorio-toolbar"></div>
        <div class="bashtorio-sidebar">
          <div class="bashtorio-output">
            <div class="panel-header">
              <span>📋 Output</span>
              <button class="clear-output-btn">Clear</button>
            </div>
            <div class="output-sinks"></div>
          </div>
          <div class="bashtorio-source">
            <div class="panel-header">
              <span>📝 Source Data</span>
            </div>
            <textarea class="source-input" placeholder="Enter data to send through the pipeline..."></textarea>
          </div>
          <div class="bashtorio-terminal">
            <div class="panel-header">
              <span>🖥️ VM Terminal</span>
            </div>
            <div class="game-terminal"></div>
          </div>
        </div>
      </div>

      <!-- Machine Picker Popup -->
      <div class="machine-picker" style="display: none;">
        <button class="picker-item" data-placeable="belt" title="Belt (Q)">
          <span class="picker-icon">➡️</span>
          <span class="picker-label">Belt</span>
        </button>
        <button class="picker-item" data-placeable="splitter" title="Splitter (W)">
          <span class="picker-icon">⑂</span>
          <span class="picker-label">Split</span>
        </button>
        <button class="picker-item" data-placeable="source" title="Source (E)">
          <span class="picker-icon">📤</span>
          <span class="picker-label">SRC</span>
        </button>
        <button class="picker-item" data-placeable="command" title="Shell (F)">
          <span class="picker-icon">🖥️</span>
          <span class="picker-label">Shell</span>
        </button>
        <button class="picker-item" data-placeable="sink" title="Sink (S)">
          <span class="picker-icon">📥</span>
          <span class="picker-label">Sink</span>
        </button>
        <button class="picker-item" data-placeable="display" title="Display (A)">
          <span class="picker-icon">💬</span>
          <span class="picker-label">UTF8</span>
        </button>
        <button class="picker-item" data-placeable="emoji" title="Emoji (Z)">
          <span class="picker-icon">🎲</span>
          <span class="picker-label">Emoji</span>
        </button>
        <button class="picker-item" data-placeable="flipper" title="Flipper (V)">
          <span class="picker-icon">🔀</span>
          <span class="picker-label">Flip</span>
        </button>
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
          <div class="form-group">
            <label>Trigger:</label>
            <select class="flip-trigger-select">
              <option value="\n">Newline (\\n)</option>
              <option value=" ">Space</option>
              <option value="\t">Tab (\\t)</option>
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value="|">Pipe (|)</option>
              <option value="custom">Custom...</option>
            </select>
            <input type="text" class="flip-trigger-custom" maxlength="1" placeholder="char" style="display: none; width: 60px; margin-left: 8px;">
          </div>
          <div class="modal-buttons">
            <button class="flip-cancel">Cancel</button>
            <button class="flip-save primary">Save</button>
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
  const sidebar = container.querySelector('.bashtorio-sidebar') as HTMLElement;
  const outputSinks = container.querySelector('.output-sinks') as HTMLElement;
  const sourceInput = container.querySelector('.source-input') as HTMLTextAreaElement;
  const gameTerminal = container.querySelector('.game-terminal') as HTMLElement;
  const commandModal = container.querySelector('.command-modal') as HTMLElement;
  const linefeedModal = container.querySelector('.linefeed-modal') as HTMLElement;
  const flipperModal = container.querySelector('.flipper-modal') as HTMLElement;
  const networkModal = container.querySelector('.network-modal') as HTMLElement;
  const presetsModal = container.querySelector('.presets-modal') as HTMLElement;
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
  if (sourceText) {
    state.sourceText = sourceText;
  }

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
    });
    sound.connectTo(events);
    sound.init().then(() => {
      sound.startLoop('editingAmbient');
    }).catch(e => console.warn('[Sound] Init failed:', e));

    // Small delay before transitioning
    await new Promise(r => setTimeout(r, 500));

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

    // Create renderer (but don't resize yet - toolbar not populated)
    const renderer = new Renderer({
      canvas,
      toolbar,
      outputPanel: sidebar,
    });

    // Set up source input
    sourceInput.value = state.sourceText;
    sourceInput.addEventListener('input', () => {
      state.sourceText = sourceInput.value;
    });

    // Set up command modal
    let editingMachine: { x: number; y: number } | null = null;
    const cmdInput = commandModal.querySelector('.cmd-input') as HTMLInputElement;
    const cmdAutostart = commandModal.querySelector('.cmd-autostart') as HTMLInputElement;

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
        if (machine) {
          machine.command = cmdInput.value.trim() || 'cat';
          machine.autoStart = cmdAutostart.checked;
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
        if (machine) {
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

    // Set up flipper modal
    let editingFlipper: { x: number; y: number } | null = null;
    const flipTriggerSelect = flipperModal.querySelector('.flip-trigger-select') as HTMLSelectElement;
    const flipTriggerCustom = flipperModal.querySelector('.flip-trigger-custom') as HTMLInputElement;

    function closeFlipperModal() {
      flipperModal.style.display = 'none';
      editingFlipper = null;
    }

    function triggerToSelectValue(trigger: string): string {
      if (trigger === '\n') return '\\n';
      if (trigger === ' ') return ' ';
      if (trigger === '\t') return '\\t';
      if (trigger === ',') return ',';
      if (trigger === ';') return ';';
      if (trigger === '|') return '|';
      return 'custom';
    }

    function selectValueToTrigger(value: string): string {
      if (value === '\\n') return '\n';
      if (value === ' ') return ' ';
      if (value === '\\t') return '\t';
      return value;
    }

    flipTriggerSelect.addEventListener('change', () => {
      flipTriggerCustom.style.display = flipTriggerSelect.value === 'custom' ? 'inline-block' : 'none';
    });

    flipperModal.querySelector('.flip-cancel')?.addEventListener('click', closeFlipperModal);

    flipperModal.querySelector('.flip-save')?.addEventListener('click', () => {
      if (editingFlipper) {
        const machine = state.machines.find(m => m.x === editingFlipper!.x && m.y === editingFlipper!.y);
        if (machine) {
          if (flipTriggerSelect.value === 'custom') {
            machine.flipperTrigger = flipTriggerCustom.value || '\n';
          } else {
            machine.flipperTrigger = selectValueToTrigger(flipTriggerSelect.value);
          }
        }
      }
      closeFlipperModal();
    });

    flipperModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeFlipperModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        flipperModal.querySelector('.flip-save')?.dispatchEvent(new Event('click'));
      }
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
      sourceInput.value = state.sourceText;
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
    };

    // Create input handler
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
        const dirBtn = toolbar.querySelector('.dir-btn');
        if (dirBtn) dirBtn.textContent = DirArrows[dir];
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
        const selVal = triggerToSelectValue(machine.flipperTrigger);
        flipTriggerSelect.value = selVal;
        if (selVal === 'custom') {
          flipTriggerCustom.style.display = 'inline-block';
          flipTriggerCustom.value = machine.flipperTrigger;
        } else {
          flipTriggerCustom.style.display = 'none';
          flipTriggerCustom.value = '';
        }
        flipperModal.style.display = 'flex';
        flipTriggerSelect.focus();
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
        input.handleKeyDown(e);
      }
    };

    // Add at capture phase to run before v86's handlers
    window.addEventListener('keydown', blockV86Keyboard, true);
    window.addEventListener('keyup', blockV86Keyboard, true);

    // Create toolbar UI
    createToolbar(toolbar, state, input, sound, {
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
          // Update source input
          sourceInput.value = state.sourceText;
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
    });

    // Now that toolbar is populated, resize canvas and initialize grid
    renderer.handleResize(state);
    const cols = Math.floor(canvas.width / GRID_SIZE);
    const rows = Math.floor(canvas.height / GRID_SIZE);
    initGrid(state, cols, rows);

    // Load the sample preset by default
    const samplePreset = PRESETS.find(p => p.id === 'sample');
    if (samplePreset) {
      deserializeState(state, samplePreset.data);
      sourceInput.value = state.sourceText;
      renderer.handleResize(state);
    }

    // Set initial cursor based on mode
    renderer.updateCursor(state.currentMode);

    // Initialize network UI state
    updateNetworkUI();

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
    function animate(time: number) {
      if (!running) return;
      const deltaTime = lastTime ? time - lastTime : 0;
      lastTime = time;
      updateSimulation(state, deltaTime, simCallbacks);
      renderer.render(state, time);
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
  callbacks: {
    onNetworkClick?: () => void;
    onSave?: () => void;
    onLoad?: () => void;
    onPresets?: () => void;
  } = {}
): void {
  const modes: { id: CursorMode; icon: string; label: string; key: string }[] = [
    { id: 'select', icon: '👆', label: 'Select', key: '1' },
    { id: 'erase', icon: '🗑️', label: 'Erase', key: '2' },
    { id: 'machine', icon: '🔧', label: 'Place', key: '3' },
  ];

  const placeables: { id: PlaceableType; icon: string; label: string; key: string }[] = [
    { id: 'belt', icon: '➡️', label: 'Belt', key: 'Q' },
    { id: 'splitter', icon: '⑂', label: 'Split', key: 'W' },
    { id: 'source', icon: '📤', label: 'SRC', key: 'E' },
    { id: 'command', icon: '🖥️', label: 'Shell', key: 'F' },
    { id: 'sink', icon: '📥', label: 'Sink', key: 'S' },
    { id: 'display', icon: '💬', label: 'UTF8', key: 'A' },
    { id: 'emoji', icon: '🎲', label: 'Emoji', key: 'Z' },
    { id: 'null', icon: '🕳️', label: 'Null', key: 'X' },
    { id: 'linefeed', icon: '↵', label: 'LF', key: 'C' },
    { id: 'flipper', icon: '🔀', label: 'Flip', key: 'V' },
  ];

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
                  ${placeables.map(p => `
                    <button class="placeable-btn ${p.id === state.currentPlaceable ? 'active' : ''}" data-placeable="${p.id}" title="${p.label} (${p.key})">
                      <span class="tool-icon">${p.icon}</span>
                      <span class="tool-label">${p.label}</span>
                    </button>
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
        <button class="dir-btn">${DirArrows[state.currentDir]}</button>
        <span class="hint">[R]</span>
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
        <button class="action-btn save-btn">💾 Save</button>
        <button class="action-btn load-btn">📂 Load</button>
        <button class="action-btn presets-btn">📚 Presets</button>
      </div>
      <div class="tool-group">
        <button class="action-btn network-btn">🌐 Network</button>
      </div>
      <div class="tool-group">
        <button class="action-btn mute-btn" title="Toggle Sound">${sound.muted ? '🔇' : '🔊'}</button>
      </div>
      <div class="tool-group">
        <div class="vm-status ready">
          <span class="status-dot"></span>
          <span class="status-text">VM Ready</span>
        </div>
      </div>
    </div>
  `;

  const popout = toolbar.querySelector('.placeable-popout') as HTMLElement;
  const placeBtn = toolbar.querySelector('.mode-btn[data-mode="machine"]') as HTMLElement;
  const placeIcon = placeBtn?.querySelector('.placeable-icon') as HTMLElement;

  // Mode buttons
  toolbar.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.mode as CursorMode;

      if (mode === 'machine') {
        // Toggle popout if already in machine mode, otherwise switch to machine mode and show popout
        if (state.currentMode === 'machine') {
          popout.style.display = popout.style.display === 'none' ? 'flex' : 'none';
        } else {
          input.selectMode(mode);
          popout.style.display = 'flex';
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

  // Speed slider
  const speedSlider = toolbar.querySelector('.speed-slider') as HTMLInputElement;
  const speedValue = toolbar.querySelector('.speed-value') as HTMLElement;
  speedSlider?.addEventListener('input', () => {
    const speed = parseFloat(speedSlider.value);
    input.setSpeed(speed);
    speedValue.textContent = speed + 'x';
    saveSettings({ muted: sound.muted, speed });
  });

  // Action buttons
  toolbar.querySelector('.run-btn')?.addEventListener('click', () => input.startSim());
  toolbar.querySelector('.stop-btn')?.addEventListener('click', () => input.stopSim());
  toolbar.querySelector('.clear-btn')?.addEventListener('click', () => input.clearAll());

  // Save/Load/Presets buttons
  toolbar.querySelector('.save-btn')?.addEventListener('click', () => {
    callbacks.onSave?.();
  });
  toolbar.querySelector('.load-btn')?.addEventListener('click', () => {
    callbacks.onLoad?.();
  });
  toolbar.querySelector('.presets-btn')?.addEventListener('click', () => {
    callbacks.onPresets?.();
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
    saveSettings({ muted, speed: state.timescale });
  });
}
