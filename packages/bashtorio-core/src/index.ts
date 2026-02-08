// Re-export types and classes
export * from './game/types';
export * from './game/state';
export { LinuxVM } from './vm';
export type { VMConfig } from './vm';

// Re-export VM singleton module
export * as vm from './game/vm';
export { Renderer } from './render';
export type { RendererConfig } from './render';
export { InputHandler } from './ui';
export { Editor } from './ui';
export { ByteInput } from './ui/components/ByteInput';
export type { ByteInputOptions } from './ui/components/ByteInput';
export { initSound, loadSounds, connectSoundEvents, play, startLoop, stopLoop, isMuted, setMuted, toggleMute, setAmbientVolume, setMachineVolume, destroySound } from './audio/SoundSystem';
export type { SoundName, SoundSystemConfig } from './audio/SoundSystem';
export { emitGameEvent, onGameEvent, destroyGameEvents } from './events/bus';
export type { GameEventMap, GameEvent } from './events/bus';

// Re-export simulation functions
export { startSimulation, stopSimulation, updateSimulation, toggleSimulation, startSim, stopSim, setSpeed, setupSimulationEvents } from './game/simulation';

// Re-export grid functions + module state
export { initGrid, clearGrid, getCell, forEachBelt, forEachNonEmpty, getBeltDir, getMachineIndex, setBelt, setMachineCell, setEmpty, reindexAfterSplice, getCellType } from './game/grid';
export { getSplitterSecondary, getMachineAt, getMachineBounds, updateConfig, placeBelt, placeSplitter, placeMachine, clearCell } from './game/edit';
export { machines, nextSinkId, getSinkIdCounter, setSinkIdCounter, clearMachines, createMachine } from './game/machines';
export type { MachineDefaults } from './game/machines';
export { ChunkedGrid, NO_MACHINE, CHUNK_SIZE } from './game/ChunkedGrid';

// Re-export camera module
export * as camera from './game/camera';

// Re-export clock module
export * as clock from './game/clock';

// Re-export save/load functions
export { clearState, serializeState, deserializeState, downloadSave, uploadSave, saveToBase64, loadFromBase64, loadFromURLParam, setupSaveLoadHandlers, type SaveData } from './util/saveload';

// Re-export presets
export { PRESETS, type Preset } from './util/presets';

// Re-export themes
export { THEMES, getThemeById, applyUITheme, type ColorTheme } from './util/themes';
export { applyRendererTheme } from './render/renderer';

import { Renderer } from './render';
import { InputHandler, Editor } from './ui';
import { createInitialState, type GameState } from './game/state';
import { initGrid } from './game/grid';
import { updateSimulation, setupSimulationEvents } from './game/simulation';
import * as vm from './game/vm';
// Side-effect imports to register custom elements
import './ui/statsPanel';
import './ui/commandLog';
import './ui/sinkOutputPanel';
import './ui/toast';
import './ui/vmStatus';
import type { StatsPanel } from './ui/statsPanel';
import type { Toast } from './ui/toast';
import { setupSaveLoadHandlers } from './util/saveload';
import { loadSettings } from './util/settings';
import { startSim, stopSim } from './game/simulation';
import { setupCameraEvents } from './game/camera';
import * as cam from './game/camera';
import { tick } from './game/clock';
import { initSound, connectSoundEvents, loadSounds, startLoop, destroySound, play } from './audio/SoundSystem';
import { connectToneEvents, destroyTones } from './audio/ToneEngine';
import { emitGameEvent, onGameEvent, destroyGameEvents } from './events/bus';
import acknowledgements from './generated/acknowledgements.json';
import { setupModals } from './ui/modals/index';
import { Toolbar } from './ui/toolbar';
import './ui/eventButton';
import './ui/placeableButton';
import './ui/machinePicker';
import type { MachinePicker } from './ui/machinePicker';
import type { GameEventMap } from './events/bus';

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
  /** The VM singleton facade */
  vm: typeof vm;
  /** The renderer */
  renderer: Renderer;
  /** The input handler */
  input: InputHandler;
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

type FocusMode = GameEventMap['focusModeChange']['mode'];

/** Wire focus-mode state, terminal focus/blur, and the central keyboard router. */
function setupKeyboardRouter(
  toast: Toast,
  screenContainer: HTMLElement,
) {
  let focusMode: FocusMode = 'editor';

  onGameEvent('focusModeChange', ({ mode }) => {
    focusMode = mode;
    if (mode === 'simulationPassthrough') {
      toast.showPersistent('Simulation input active. Press Esc to exit.');
    } else {
      toast.hide();
    }
  });

  screenContainer.addEventListener('focus', () => {
    emitGameEvent('focusModeChange', { mode: 'virtualMachine' });
  });
  screenContainer.addEventListener('blur', () => {
    if (focusMode === 'virtualMachine') emitGameEvent('focusModeChange', { mode: 'editor' });
  });

  const handleKeyboardInput = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (focusMode === 'virtualMachine') return;

    // Block v86 from receiving this event in all non-VM modes
    // Let Escape propagate so modals/popovers can close naturally
    if (e.key !== 'Escape') e.stopImmediatePropagation();

    // Show grab cursor while Ctrl is held (pan modifier)
    if (e.key === 'Control') {
      emitGameEvent('panHold', { held: e.type === 'keydown' });
    }

    if (e.type !== 'keydown') return;

    if (focusMode === 'simulationPassthrough') {
      if (e.key === 'Escape') { emitGameEvent('focusModeChange', { mode: 'editor' }); return; }
      if (e.key.length === 1) emitGameEvent('simulationKeyPress', { char: e.key });
      else if (e.key === 'Enter') emitGameEvent('simulationKeyPress', { char: '\n' });
      else if (e.key === 'Tab') { e.preventDefault(); emitGameEvent('simulationKeyPress', { char: '\t' }); }
      else if (e.key === 'Backspace') emitGameEvent('simulationKeyPress', { char: '\x7f' });
      return;
    }

    // focusMode === 'editor'
    emitGameEvent('editorKeyPress', { key: e.key, preventDefault: () => e.preventDefault() });
  };

  window.addEventListener('keydown', handleKeyboardInput, true);
  window.addEventListener('keyup', handleKeyboardInput, true);

  onGameEvent('simulationEnded', () => emitGameEvent('focusModeChange', { mode: 'editor' }));

  return { getFocusMode: () => focusMode };
}

/** Wire cursor updates from pan state and mode changes. */
function setupCursorEvents(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  state: GameState,
) {
  let panning = false;
  let panHeld = false;

  function updateCursor() {
    if (panning)  { canvas.style.cursor = 'grabbing'; return; }
    if (panHeld)  { canvas.style.cursor = 'grab'; return; }
    renderer.updateCursor(state.currentMode);
  }

  onGameEvent('panHold', ({ held }) => { panHeld = held; updateCursor(); });
  onGameEvent('+pan', () => { panning = true; updateCursor(); });
  onGameEvent('-pan', () => { panning = false; updateCursor(); });
  onGameEvent('modeChange', ({ mode }) => {
    if (mode === 'select') emitGameEvent('select');
    updateCursor();
  });
}

/** Wire top-level modal-open events and keyboard focus requests. */
function setupModalRouting(
  modals: ReturnType<typeof setupModals>,
  state: GameState,
) {
  onGameEvent('openNetwork', () => modals.openNetwork());
  onGameEvent('openPresets', () => modals.openPresets());
  onGameEvent('openSettings', () => modals.openSettings());
  onGameEvent('openHelp', () => modals.openHelp());
  onGameEvent('openManual', () => modals.openManual());
  onGameEvent('requestKeyboardFocus', () => {
    if (state.running) emitGameEvent('focusModeChange', { mode: 'simulationPassthrough' });
  });
}


/** Wire sidebar resize-handle drag logic. */
function setupSidebarResize(
  container: HTMLElement,
  renderer: Renderer,
  state: GameState,
  canvas: HTMLCanvasElement,
) {
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
      cam.updateCanvasSize(canvas.width, canvas.height);
    };

    const onMouseUp = () => {
      resizeHandle.classList.remove('dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

/** Wire machine picker popup, mouse tracking, and E key toggle. */
function setupMachinePicker(
  container: HTMLElement,
  state: GameState,
  canvas: HTMLCanvasElement,
  getFocusMode: () => FocusMode,
) {
  const picker = container.querySelector('bt-machine-picker') as MachinePicker;
  picker.init(state);
  let mouseX = 0;
  let mouseY = 0;

  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  window.addEventListener('keydown', (e) => {
    if ((e.key === 'e' || e.key === 'E') && getFocusMode() === 'editor') {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      picker.toggle(mouseX, mouseY);
    }
    if (e.key === 'Escape') {
      picker.hide();
    }
  });
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
        <div class="bashtorio-systembar"></div>
        <canvas class="game-canvas"></canvas>
        <div class="sidebar-resize-handle"></div>
        <div class="bashtorio-toolbar"></div>
        <div class="bashtorio-sidebar">
          <bt-sink-output class="bashtorio-output"></bt-sink-output>
          <bt-stats-panel class="bashtorio-stats"></bt-stats-panel>
          <bt-command-log></bt-command-log>
          <div class="bashtorio-terminal collapsed">
            <div class="panel-header terminal-toggle" style="cursor: pointer;">
              <span>🖥️ VM Terminal</span>
              <span class="terminal-toggle-icon">▶</span>
            </div>
            <div class="game-terminal"></div>
          </div>
        </div>
      </div>

      <bt-machine-picker></bt-machine-picker>

      <!-- Machine Config Modals (custom elements) -->
      <bt-command-modal></bt-command-modal>
      <bt-source-modal></bt-source-modal>
      <bt-linefeed-modal></bt-linefeed-modal>
      <bt-flipper-modal></bt-flipper-modal>
      <bt-constant-modal></bt-constant-modal>
      <bt-filter-modal></bt-filter-modal>
      <bt-counter-modal></bt-counter-modal>
      <bt-delay-modal></bt-delay-modal>
      <bt-packer-modal></bt-packer-modal>
      <bt-router-modal></bt-router-modal>
      <bt-gate-modal></bt-gate-modal>
      <bt-wireless-modal></bt-wireless-modal>
      <bt-replace-modal></bt-replace-modal>
      <bt-math-modal></bt-math-modal>
      <bt-clock-modal></bt-clock-modal>
      <bt-latch-modal></bt-latch-modal>
      <bt-sink-modal></bt-sink-modal>
      <bt-tone-modal></bt-tone-modal>

      <!-- Utility Modals (custom elements) -->
      <bt-network-modal></bt-network-modal>
      <bt-presets-modal></bt-presets-modal>
      <bt-settings-modal></bt-settings-modal>
      <bt-help-modal></bt-help-modal>
      <bt-manual-modal></bt-manual-modal>
      <bt-acknowledgements-modal></bt-acknowledgements-modal>

      <bt-toast></bt-toast>
    </div>
  `;

  const bootScreen = container.querySelector('.bashtorio-boot') as HTMLElement;
  const bootStatus = container.querySelector('.boot-status') as HTMLElement;
  const screenContainer = container.querySelector('.screen-container') as HTMLElement;
  const gameScreen = container.querySelector('.bashtorio-game') as HTMLElement;
  const canvas = container.querySelector('.game-canvas') as HTMLCanvasElement;
  const toolbar = container.querySelector('.bashtorio-toolbar') as HTMLElement;
  const systembar = container.querySelector('.bashtorio-systembar') as HTMLElement;
  const gameTerminal = container.querySelector('.game-terminal') as HTMLElement;

  // Create state
  const settings = loadSettings();
  const state = createInitialState();
  state.timescale = settings.speed;

  const setStatus = (status: string) => {
    bootStatus.textContent = status;
    onBootStatus?.(status);
  };

  try {
    // Create and initialize VM via singleton
    await vm.initVM({
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
    const ok = await vm.testVM();

    if (!ok) {
      throw new Error('VM test failed');
    }

    setStatus('Ready!');

    const toast = container.querySelector('bt-toast') as Toast;

    // Initialize sound system (non-blocking)
    initSound({
      assetsUrl: soundAssetsUrl || `${assetsPath}/sounds`,
      muted: settings.muted,
      ambientVolume: settings.ambientVolume,
      machineVolume: settings.machineVolume,
    });
    connectSoundEvents(settings);
    connectToneEvents();
    loadSounds().then(() => {
      startLoop('editingAmbient');
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

    const { getFocusMode } = setupKeyboardRouter(toast, screenContainer);

    // Hide boot, show game
    bootScreen.style.display = 'none';
    gameScreen.style.display = 'grid';

    // Create renderer
    const renderer = new Renderer({ canvas });

    // Modals are initialized after input handler is created (see below)
    let modals: ReturnType<typeof setupModals>;

    // Stats panel (ref needed for update() in animation loop)
    const statsPanel = container.querySelector('bt-stats-panel') as StatsPanel;

    // Create editor (game logic: placement, erase, configure) and input (DOM → events)
    // Editor wires itself to events in the constructor - no further ref needed.
    new Editor(state);
    const input = new InputHandler(state, renderer, canvas);
    input.init();

    // Wire camera event handlers
    setupCameraEvents();

    // Set up modals (after input handler, since modals need input for save handlers)
    modals = setupModals(container, acknowledgements);

    // Wire simulation-layer event listeners
    setupSimulationEvents(state, settings);

    // Create toolbar UI
    new Toolbar(toolbar, systembar, state);

    // Wire save/load handlers
    setupSaveLoadHandlers(state);

    setupCursorEvents(canvas, renderer, state);
    setupModalRouting(modals, state);

    onGameEvent('editFailed', ({ message }) => {
      emitGameEvent('toast', { message });
      play('deny');
    });

    // Now that toolbar is populated, resize canvas and initialize grid
    renderer.handleResize(state);
    cam.updateCanvasSize(canvas.width, canvas.height);
    initGrid();

    // Load the sample preset by default
    emitGameEvent('loadPresetByName', { id: 'sample' });

    // Check URL for factory param and load if present
    emitGameEvent('requestLoadURL');

    // Set initial cursor based on mode
    renderer.updateCursor(state.currentMode);

    // Initialize network UI state
    modals.updateNetworkUI();

    setupSidebarResize(container, renderer, state, canvas);
    setupMachinePicker(container, state, canvas, getFocusMode);

    // Animation loop
    let running = true;
    function animate() {
      if (!running) return;
      tick();
      updateSimulation(state);
      renderer.render(state);
      if (state.running) statsPanel.update(state.packets.length);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    const instance: BashtorioInstance = {
      state,
      vm,
      renderer,
      input,
      start: () => startSim(state),
      stop: () => stopSim(state),
      clear: () => emitGameEvent('clearAll'),
      destroy: () => {
        running = false;
        input.destroy();
        vm.destroyVM();
        destroySound();
        destroyTones();
        destroyGameEvents();
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

