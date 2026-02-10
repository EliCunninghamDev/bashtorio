// ----------- Re-exports: Types & State -----------
export * from './game/types';
export * from './game/state';

// ----------- Re-exports: VM -----------
export { LinuxVM, V86Bridge, ShellInstance, encodeHex, shellEscape } from './vm';
export type { VMConfig } from './vm';
export * as vm from './game/vm';

// ----------- Re-exports: Render -----------
export { Renderer } from './render';
export type { RendererConfig } from './render';
export { applyRendererTheme } from './render/renderer';

// ----------- Re-exports: UI -----------
export { InputHandler, Editor } from './ui';
export { ByteInput } from './ui/components/ByteInput';
export type { ByteInputOptions } from './ui/components/ByteInput';
export { HexInput } from './ui/components/HexInput';
export type { HexInputOptions } from './ui/components/HexInput';

// ----------- Re-exports: Audio -----------
export { initSound, loadSounds, connectSoundEvents, play, startLoop, stopLoop, isMuted, setMuted, toggleMute, setAmbientVolume, setMachineVolume, destroySound } from './audio/SoundSystem';
export type { SoundName, SoundSystemConfig } from './audio/SoundSystem';

// ----------- Re-exports: Events -----------
export { emitGameEvent, onGameEvent, destroyGameEvents } from './events/bus';
export type { GameEventMap, GameEvent } from './events/bus';

// ----------- Re-exports: Game -----------
export { startSimulation, stopSimulation, updateSimulation, toggleSimulation, startSim, stopSim, setSpeed, setupSimulationEvents } from './game/simulation';
export { initGrid, clearGrid, getCell, forEachBelt, forEachNonEmpty, getBeltDir, getMachineIndex, setBelt, setMachineCell, setEmpty, reindexAfterSplice, getCellType } from './game/grid';
export { getSplitterSecondary, getMachineAt, getMachineBounds, updateConfig, placeBelt, placeSplitter, placeMachine, clearCell } from './game/edit';
export { machines, nextSinkId, getSinkIdCounter, setSinkIdCounter, clearMachines, createMachine } from './game/machines';
export type { MachineDefaults } from './game/machines';
export { ChunkedGrid, NO_MACHINE, CHUNK_SIZE } from './game/ChunkedGrid';
export * as camera from './game/camera';
export * as clock from './game/clock';

// ----------- Re-exports: Utilities -----------
export { clearState, serializeState, deserializeState, downloadSave, uploadSave, saveToBase64, loadFromBase64, loadFromURLParam, setupSaveLoadHandlers, type SaveData } from './util/saveload';
export { PRESETS, type Preset } from './util/presets';
export { THEMES, getThemeById, applyUITheme, type ColorTheme } from './util/themes';
export { createLogger, setLogLevel, getLogLevel, type LogLevel, type Logger } from './util/logger';
export { initAssets, vmBase, soundsBase, spritesBase, rootfsBase, vmAsset, soundAsset, spriteAsset, rootfsAsset, resolveUrl, type AssetOverrides } from './util/assets';

// ----------- Side-effect Imports (custom element registration) -----------
import './ui/statsPanel';
import './ui/commandLog';
import './ui/sinkOutputPanel';
import './ui/toast';
import './ui/vmStatus';
import './ui/components/IngameLogo.ts';
import './ui/eventButton';
import './ui/placeableButton';
import './ui/machinePicker';
import './ui/fsCacheProgress';

// ----------- Internal Imports: Game -----------
import { createInitialState, type GameState } from './game/state';
import { initGrid } from './game/grid';
import { updateSimulation, setupSimulationEvents, startSim, stopSim } from './game/simulation';
import * as vm from './game/vm';
import { setupCameraEvents } from './game/camera';
import * as cam from './game/camera';
import { tick } from './game/clock';

// ----------- Internal Imports: Render -----------
import { Renderer } from './render';

// ----------- Internal Imports: UI -----------
import { InputHandler, Editor } from './ui';
import { Toolbar } from './ui/toolbar';
import { setupModals } from './ui/modals/index';
import type { StatsPanel } from './ui/statsPanel';
import type { Toast } from './ui/toast';
import type { MachinePicker } from './ui/machinePicker';

// ----------- Internal Imports: Audio -----------
import { initSound, connectSoundEvents, loadSounds, startLoop, destroySound, play } from './audio/SoundSystem';
import { connectToneEvents, destroyTones } from './audio/ToneEngine';
import { connectSpeechEvents, destroySpeech } from './audio/SpeechEngine';

// ----------- Internal Imports: Events -----------
import { emitGameEvent, onGameEvent, destroyGameEvents } from './events/bus';
import type { GameEventMap } from './events/bus';

// ----------- Internal Imports: Utilities -----------
import { setupSaveLoadHandlers } from './util/saveload';
import { loadSettings } from './util/settings';
import { createLogger } from './util/logger';
import { initAssets, vmAsset, rootfsBase } from './util/assets';
import type { AssetOverrides } from './util/assets';
import acknowledgements from './generated/acknowledgements.json';

const log = createLogger('Mount');

export interface BashtorioConfig {
  container: HTMLElement;
  vmAssetsUrl: string;
  /** VM state snapshot identifier (URL or filename relative to vmAssetsUrl) */
  vmStateUrl: string;
  /** @deprecated Use assets.rootfsBaseUrl instead */
  rootfsBaseUrl?: string;
  /** 9p rootfs JSON manifest filename */
  rootfsManifest: string;
  /** @deprecated Use assets.soundsUrl instead */
  soundsUrl?: string;
  /** Unified asset URL overrides */
  assets?: AssetOverrides;
  onBootStatus?: (status: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface BashtorioInstance {
  state: GameState;
  vm: typeof vm;
  renderer: Renderer;
  input: InputHandler;
  start: () => void;
  stop: () => void;
  clear: () => void;
  destroy: () => void;
  /** For creating pre-booted VM snapshots */
  downloadState: () => Promise<void>;
}

// ----------- 9p Filesystem Prefetch -----------

type FsEntry = [string, number, number, number, number, number, string | FsEntry[]]

function collectChunks(fsroot: FsEntry[]): string[] {
  const chunks = new Set<string>()
  function walk(entries: FsEntry[]) {
    for (const entry of entries) {
      const payload = entry[6]
      if (typeof payload === 'string' && payload.endsWith('.bin.zst')) {
        chunks.add(payload)
      } else if (Array.isArray(payload)) {
        walk(payload)
      }
    }
  }
  walk(fsroot)
  return [...chunks]
}

/**
 * Prefetch all 9p filesystem chunks into the browser HTTP cache.
 * Runs in the background with limited concurrency so it doesn't
 * starve the VM boot of bandwidth.
 */
async function prefetch9pFiles(rootfsManifest: string, concurrency = 8): Promise<void> {
  const res = await fetch(vmAsset(rootfsManifest))
  const manifest = await res.json()
  const chunks = collectChunks(manifest.fsroot)
  const baseurl = rootfsBase() + '/'
  const total = chunks.length
  let loaded = 0

  let i = 0
  async function next(): Promise<void> {
    while (i < chunks.length) {
      const url = baseurl + chunks[i++]
      await fetch(url).catch(() => {})
      loaded++
      emitGameEvent('fsCacheProgress', { loaded, total })
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()))
}

type FocusMode = GameEventMap['focusModeChange']['mode'];

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

}

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

function setupMachinePicker(
  container: HTMLElement,
  state: GameState,
  canvas: HTMLCanvasElement,
) {
  const picker = container.querySelector('bt-machine-picker') as MachinePicker;
  picker.init(state);
  let mouseX = 0;
  let mouseY = 0;

  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  onGameEvent('editorKeyPress', ({ key, preventDefault }) => {
    if (key === 'e' || key === 'E') {
      preventDefault();
      picker.toggle(mouseX, mouseY);
    }
    if (key === 'Escape') {
      picker.hide();
    }
  });
}

export async function mount(config: BashtorioConfig): Promise<BashtorioInstance> {
  const { container, vmAssetsUrl, vmStateUrl, rootfsBaseUrl, rootfsManifest, soundsUrl, assets, onBootStatus, onReady, onError } = config;

  initAssets(vmAssetsUrl, {
    soundsUrl: soundsUrl ?? assets?.soundsUrl,
    spritesUrl: assets?.spritesUrl,
    rootfsBaseUrl: rootfsBaseUrl ?? assets?.rootfsBaseUrl,
  });

  // Wait for asset preload (progress bar) to finish before replacing the loader DOM
  const preload = (window as unknown as Record<string, unknown>).__preloadReady as Promise<void> | undefined;
  if (preload) await preload;
  const preloadBuffers = (window as unknown as Record<string, unknown>).__preloadBuffers as Record<string, ArrayBuffer> | undefined;

  container.innerHTML = `
    <div class="bashtorio-root">
      <div class="bashtorio-boot">
        <div class="boot-content">
          <h1 class="boot-title">ba<span class="boot-sh">sh</span>torio<span class="boot-terminal-cursor">_</span></h1>
          <p class="boot-subtitle">A Unix Pipe Factory Game</p>
          <div class="boot-status">Initializing...</div>
          <div class="boot-progress">
            <div class="boot-progress-bar"></div>
          </div>
          <div class="boot-terminal" style="display:none">
            <div class="screen-container">
              <div style="white-space: pre; font: 14px monospace"></div>
              <canvas style="display: none"></canvas>
            </div>
          </div>
        </div>
        <div class="boot-error" style="display: none;">
          <div class="boot-error-title">Error</div>
          <div class="boot-error-detail"></div>
          <div class="boot-error-suggestion"></div>
          <button class="boot-error-retry">Retry</button>
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
      <bt-drum-modal></bt-drum-modal>
      <bt-tone-modal></bt-tone-modal>
      <bt-speak-modal></bt-speak-modal>
      <bt-screen-modal></bt-screen-modal>
      <bt-byte-modal></bt-byte-modal>
      <bt-punchcard-modal></bt-punchcard-modal>
      <bt-button-modal></bt-button-modal>

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
  const gameTerminal = container.querySelector('.game-terminal') as HTMLElement;

  const settings = loadSettings();
  const state = createInitialState();
  state.timescale = settings.speed;

  const setStatus = (status: string) => {
    bootStatus.textContent = status;
    onBootStatus?.(status);
  };

  try {
    await vm.initVM({
      vmAssetsUrl,
      vmStateUrl,
      rootfsBaseUrl,
      rootfsManifest,
      screenContainer,
      preloadBuffers,
      onStatus: setStatus,
    });

    setStatus('Testing VM...');
    const ok = await vm.testVM();

    // Prefetch remaining 9p chunks AFTER boot (preload already awaited above)
    if (rootfsManifest) {
      prefetch9pFiles(rootfsManifest).catch(e => log.warn('9p prefetch failed:', e))
    }

    if (!ok) {
      throw new Error('VM test failed');
    }

    setStatus('Ready!');

    const toast = container.querySelector('bt-toast') as Toast;

    initSound({
      muted: settings.muted,
      ambientVolume: settings.ambientVolume,
      machineVolume: settings.machineVolume,
    });
    connectSoundEvents(settings);
    connectToneEvents();
    connectSpeechEvents();
    loadSounds().then(() => {
      startLoop('editingAmbient');
    }).catch(e => log.warn('Sound init failed:', e));

    await new Promise(r => setTimeout(r, 500));

    const terminalPanel = container.querySelector('.bashtorio-terminal') as HTMLElement;
    const terminalToggle = container.querySelector('.terminal-toggle') as HTMLElement;
    const terminalToggleIcon = container.querySelector('.terminal-toggle-icon') as HTMLElement;
    terminalToggle.addEventListener('click', () => {
      const collapsed = terminalPanel.classList.toggle('collapsed');
      terminalToggleIcon.textContent = collapsed ? '▶' : '▼';
    });

    gameTerminal.appendChild(screenContainer);
    screenContainer.setAttribute('tabindex', '0');

    screenContainer.addEventListener('click', () => {
      screenContainer.focus();
    });

    setupKeyboardRouter(toast, screenContainer);

    bootScreen.style.display = 'none';
    gameScreen.style.display = 'grid';

    const renderer = new Renderer({ canvas });
    const statsPanel = container.querySelector('bt-stats-panel') as StatsPanel;

    new Editor(state); // wires itself to events in constructor
    const input = new InputHandler(state, renderer, canvas);
    input.init();

    setupCameraEvents();
    const modals = setupModals(container, acknowledgements);
    setupSimulationEvents(state, settings);
    new Toolbar(
      container.querySelector('.bashtorio-toolbar') as HTMLElement,
      container.querySelector('.bashtorio-systembar') as HTMLElement,
      state,
    );

    setupSaveLoadHandlers(state);

    setupCursorEvents(canvas, renderer, state);
    setupModalRouting(modals, state);

    onGameEvent('editFailed', ({ message }) => {
      emitGameEvent('toast', { message });
      play('deny');
    });

    renderer.handleResize(state);
    cam.updateCanvasSize(canvas.width, canvas.height);
    initGrid();

    emitGameEvent('loadPresetByName', { id: 'sample' });
    emitGameEvent('requestLoadURL');
    renderer.updateCursor(state.currentMode);
    modals.updateNetworkUI();

    setupSidebarResize(container, renderer, state, canvas);
    setupMachinePicker(container, state, canvas);

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
        destroySpeech();
        destroyGameEvents();
        container.innerHTML = '';
      },
      downloadState: () => vm.downloadState(),
    };

    onReady?.();
    return instance;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const msg = err.message;

    let title: string;
    let suggestion: string;

    if (msg.includes('9p: timed out') || msg.includes('9p: verification')) {
      title = 'Filesystem failed to start';
      suggestion = 'The VM booted but the 9p filesystem didn\u2019t respond. Try reloading.';
    } else if (msg.includes('Boot timeout')) {
      title = 'VM took too long to boot';
      suggestion = 'The VM didn\u2019t finish booting in time. Check your snapshot URL or try reloading.';
    } else if (msg.includes('VM test failed')) {
      title = 'VM isn\u2019t responding';
      suggestion = 'The VM booted but didn\u2019t respond to a test command. Try reloading.';
    } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
      title = 'Failed to load game assets';
      suggestion = 'A network request failed. Check your connection and asset URLs.';
    } else {
      title = 'Something went wrong';
      suggestion = 'An unexpected error occurred. Try reloading the page.';
    }

    setStatus('');

    const bootContent = container.querySelector('.boot-content') as HTMLElement;
    const bootError = container.querySelector('.boot-error') as HTMLElement;
    const errorTitle = container.querySelector('.boot-error-title') as HTMLElement;
    const errorDetail = container.querySelector('.boot-error-detail') as HTMLElement;
    const errorSuggestion = container.querySelector('.boot-error-suggestion') as HTMLElement;
    const retryBtn = container.querySelector('.boot-error-retry') as HTMLElement;

    errorTitle.textContent = title;
    errorDetail.textContent = msg;
    errorSuggestion.textContent = suggestion;
    retryBtn.addEventListener('click', () => location.reload());

    // Show VM terminal on the error screen for debugging
    const bootTerminal = container.querySelector('.boot-terminal') as HTMLElement;
    if (bootTerminal) {
      bootTerminal.style.display = '';
      bootError.appendChild(bootTerminal);
    }

    bootContent.style.display = 'none';
    bootError.style.display = '';

    onError?.(err);
    throw err;
  }
}

