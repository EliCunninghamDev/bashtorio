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
export { initGrid, getCell, placeBelt, placeSplitter, placeMachine, clearCell, getMachineAt, getSplitterSecondary, getMachineBounds } from './game/grid';

// Re-export save/load functions
export { serializeState, deserializeState, downloadSave, uploadSave, saveToBase64, loadFromBase64, loadFromURLParam, type SaveData } from './util/saveload';

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
import { GRID_COLS, GRID_ROWS, MachineType, type CursorMode, type PlaceableType, type SinkMachine } from './game/types';
import { ansiToHtml } from './util/ansi';
import { downloadSave, uploadSave, deserializeState, loadFromURLParam, saveToBase64 } from './util/saveload';
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
        <div class="bashtorio-systembar"></div>
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
          <div class="bashtorio-stats">
            <div class="panel-header">
              <span>📊 Stats</span>
              <button class="clear-stats-btn">Reset</button>
            </div>
            <div class="stats-body">
              <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">Uptime</span><span class="stat-value stats-uptime">0:00</span></div>
                <div class="stat-item"><span class="stat-label">Active</span><span class="stat-value stats-active">0</span></div>
                <div class="stat-item"><span class="stat-label">Sink bytes</span><span class="stat-value stats-sink-bytes">0</span></div>
                <div class="stat-item"><span class="stat-label">Throughput</span><span class="stat-value stats-throughput">0/s</span></div>
                <div class="stat-item"><span class="stat-label">Commands</span><span class="stat-value stats-commands">0</span></div>
                <div class="stat-item"><span class="stat-label">Errors</span><span class="stat-value stats-errors">0</span></div>
                <div class="stat-item"><span class="stat-label">Avg cmd</span><span class="stat-value stats-avg-cmd">-</span></div>
                <div class="stat-item"><span class="stat-label">Stream writes</span><span class="stat-value stats-stream-writes">0</span></div>
              </div>
            </div>
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
          <button class="picker-item" data-placeable="router" title="Router (H)">
            <span class="picker-icon">🔀</span>
            <span class="picker-label">Route</span>
          </button>
          <button class="picker-item" data-placeable="gate" title="Gate (I)">
            <span class="picker-icon">🚧</span>
            <span class="picker-label">Gate</span>
          </button>
          <button class="picker-item" data-placeable="wireless" title="Wireless (J)">
            <span class="picker-icon">📡</span>
            <span class="picker-label">Radio</span>
          </button>
          <button class="picker-item" data-placeable="merger" title="Merger">
            <span class="picker-icon">🔗</span>
            <span class="picker-label">Merge</span>
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
          <button class="picker-item" data-placeable="clock" title="Clock (O)">
            <span class="picker-icon">🕐</span>
            <span class="picker-label">Clock</span>
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
          <button class="picker-item" data-placeable="packer" title="Packer (P)">
            <span class="picker-icon">📦</span>
            <span class="picker-label">Pack</span>
          </button>
          <button class="picker-item" data-placeable="unpacker" title="Unpacker (U)">
            <span class="picker-icon">📭</span>
            <span class="picker-label">Unpack</span>
          </button>
          <button class="picker-item" data-placeable="replace" title="Replace (L)">
            <span class="picker-icon">🔄</span>
            <span class="picker-label">Repl</span>
          </button>
          <button class="picker-item" data-placeable="math" title="Math (M)">
            <span class="picker-icon">🧮</span>
            <span class="picker-label">Math</span>
          </button>
          <button class="picker-item" data-placeable="latch" title="Latch (Y)">
            <span class="picker-icon">🔒</span>
            <span class="picker-label">Latch</span>
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
          <button class="picker-item" data-placeable="sevenseg" title="7-Seg Display (Z)">
            <span class="picker-icon">🔢</span>
            <span class="picker-label">7Seg</span>
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
          <p class="modal-description">Rotates output direction clockwise on every received byte.</p>
          <div class="form-group">
            <label>Initial Direction:</label>
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

      <!-- Packer Modal -->
      <div class="bashtorio-modal packer-modal" style="display: none;">
        <div class="modal-content">
          <h3>Packer</h3>
          <p class="modal-description">Accumulates bytes until delimiter, then emits the buffer as one packet.</p>
          <div class="form-group packer-byte-input-mount"></div>
          <div class="form-group">
            <label><input type="checkbox" class="packer-preserve"> Preserve delimiter in output</label>
          </div>
          <div class="modal-buttons">
            <button class="packer-cancel">Cancel</button>
            <button class="packer-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Router Modal -->
      <div class="bashtorio-modal router-modal" style="display: none;">
        <div class="modal-content">
          <h3>Router</h3>
          <p class="modal-description">Routes bytes by match: matching byte goes to one direction, everything else to another.</p>
          <div class="form-group router-byte-input-mount"></div>
          <div class="form-group">
            <label>Match Direction:</label>
            <select class="router-match-dir modal-select">
              <option value="0">Right &rarr;</option>
              <option value="1">Down &darr;</option>
              <option value="2">Left &larr;</option>
              <option value="3">Up &uarr;</option>
            </select>
          </div>
          <div class="form-group">
            <label>Else Direction:</label>
            <select class="router-else-dir modal-select">
              <option value="0">Right &rarr;</option>
              <option value="1">Down &darr;</option>
              <option value="2">Left &larr;</option>
              <option value="3">Up &uarr;</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button class="router-cancel">Cancel</button>
            <button class="router-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Gate Modal -->
      <div class="bashtorio-modal gate-modal" style="display: none;">
        <div class="modal-content">
          <h3>Gate</h3>
          <p class="modal-description">Data passes through only when a control signal opens the gate. Gate closes after one byte passes.</p>
          <div class="form-group">
            <label>Data comes FROM:</label>
            <select class="gate-data-dir modal-select">
              <option value="0">Right &rarr;</option>
              <option value="1">Down &darr;</option>
              <option value="2">Left &larr;</option>
              <option value="3">Up &uarr;</option>
            </select>
          </div>
          <div class="form-group">
            <label>Control comes FROM:</label>
            <select class="gate-control-dir modal-select">
              <option value="0">Right &rarr;</option>
              <option value="1">Down &darr;</option>
              <option value="2">Left &larr;</option>
              <option value="3">Up &uarr;</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button class="gate-cancel">Cancel</button>
            <button class="gate-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Wireless Modal -->
      <div class="bashtorio-modal wireless-modal" style="display: none;">
        <div class="modal-content">
          <h3>Wireless</h3>
          <p class="modal-description">Broadcasts received bytes to all other wireless machines on the same channel.</p>
          <div class="form-group">
            <label>Channel:</label>
            <select class="wireless-channel modal-select">
              <option value="0">Channel 0 (Red)</option>
              <option value="1">Channel 1 (Orange)</option>
              <option value="2">Channel 2 (Yellow)</option>
              <option value="3">Channel 3 (Green)</option>
              <option value="4">Channel 4 (Cyan)</option>
              <option value="5">Channel 5 (Blue)</option>
              <option value="6">Channel 6 (Purple)</option>
              <option value="7">Channel 7 (Pink)</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button class="wireless-cancel">Cancel</button>
            <button class="wireless-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Replace Modal -->
      <div class="bashtorio-modal replace-modal" style="display: none;">
        <div class="modal-content">
          <h3>Replace</h3>
          <p class="modal-description">Substitutes one byte for another. Non-matching bytes pass through unchanged.</p>
          <div class="form-group replace-from-input-mount"></div>
          <div class="form-group replace-to-input-mount"></div>
          <div class="modal-buttons">
            <button class="replace-cancel">Cancel</button>
            <button class="replace-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Math Modal -->
      <div class="bashtorio-modal math-modal" style="display: none;">
        <div class="modal-content">
          <h3>Math</h3>
          <p class="modal-description">Apply a byte arithmetic or bitwise operation to each received byte.</p>
          <div class="form-group">
            <label>Operation:</label>
            <select class="math-op modal-select">
              <option value="add">Add (+)</option>
              <option value="sub">Subtract (-)</option>
              <option value="mul">Multiply (*)</option>
              <option value="mod">Modulo (%)</option>
              <option value="xor">XOR (^)</option>
              <option value="and">AND (&amp;)</option>
              <option value="or">OR (|)</option>
              <option value="not">NOT (~)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Operand (0-255):</label>
            <input type="number" class="math-operand" min="0" max="255" step="1" value="1">
          </div>
          <div class="modal-buttons">
            <button class="math-cancel">Cancel</button>
            <button class="math-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Clock Modal -->
      <div class="bashtorio-modal clock-modal" style="display: none;">
        <div class="modal-content">
          <h3>Clock</h3>
          <p class="modal-description">Emits a byte at regular intervals. Ignores input.</p>
          <div class="form-group clock-byte-input-mount"></div>
          <div class="form-group">
            <label>Interval (ms):</label>
            <input type="number" class="clock-interval" min="50" max="30000" step="50" value="1000">
          </div>
          <div class="modal-buttons">
            <button class="clock-cancel">Cancel</button>
            <button class="clock-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Latch Modal -->
      <div class="bashtorio-modal latch-modal" style="display: none;">
        <div class="modal-content">
          <h3>Latch</h3>
          <p class="modal-description">Stores the last data byte received. Emits stored byte when a control signal arrives.</p>
          <div class="form-group">
            <label>Data comes FROM:</label>
            <select class="latch-data-dir modal-select">
              <option value="0">Right &rarr;</option>
              <option value="1">Down &darr;</option>
              <option value="2">Left &larr;</option>
              <option value="3">Up &uarr;</option>
            </select>
          </div>
          <div class="form-group">
            <label>Control comes FROM:</label>
            <select class="latch-control-dir modal-select">
              <option value="0">Right &rarr;</option>
              <option value="1">Down &darr;</option>
              <option value="2">Left &larr;</option>
              <option value="3">Up &uarr;</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button class="latch-cancel">Cancel</button>
            <button class="latch-save primary">Save</button>
          </div>
        </div>
      </div>

      <!-- Sink Modal -->
      <div class="bashtorio-modal sink-modal" style="display: none;">
        <div class="modal-content">
          <h3>Sink</h3>
          <p class="modal-description">Collects bytes and displays output in the sidebar.</p>
          <div class="form-group">
            <label>Name:</label>
            <input class="sink-name-input modal-input" type="text" placeholder="Sink name">
          </div>
          <div class="modal-buttons">
            <button class="sink-cancel">Cancel</button>
            <button class="sink-save primary">Save</button>
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

      <!-- Help Modal -->
      <div class="bashtorio-modal help-modal" style="display: none;">
        <div class="modal-content help-modal-content">
          <h3>How It Works</h3>
          <div class="help-body">
            <h4>Unix Pipes: Connecting Programs</h4>
            <p>
              In Unix, a <strong>pipe</strong> connects the output of one program to the
              input of another. When you write <code>echo "hello" | tr a-z A-Z</code>,
              the shell creates an anonymous pipe &mdash; a small kernel buffer &mdash;
              between the two processes. <code>echo</code> writes bytes into one end,
              and <code>tr</code> reads them from the other. The data flows as a raw
              byte stream: no files on disk, no intermediate copies.
            </p>
            <pre><code class="help-diagram">  echo "hello"          tr a-z A-Z
       |                    ^
       |  ┌──────────────┐  |
       └─>│ kernel buffer │──┘
          └──────────────┘
            anonymous pipe</code></pre>
            <p>
              This is how the <code>|</code> operator works in every Unix shell. The kernel
              manages a fixed-size buffer (typically 64 KB on Linux). If the buffer fills up,
              the writing process blocks until the reader consumes some data. If the buffer is
              empty, the reader blocks until data arrives. This backpressure is what makes
              pipes efficient &mdash; no polling, no busy-waiting.
            </p>

            <h4>Named Pipes (FIFOs)</h4>
            <p>
              A <strong>named pipe</strong> (also called a FIFO) works exactly like an
              anonymous pipe, but it has a path on the filesystem. You create one with
              <code>mkfifo /tmp/mypipe</code>. Any process can then open that path for
              reading or writing &mdash; the kernel provides the same byte-stream buffer
              underneath.
            </p>
            <pre><code class="help-diagram">  # Terminal 1: read from the FIFO (blocks until data arrives)
  $ cat /tmp/mypipe

  # Terminal 2: write to the FIFO
  $ echo "hello" > /tmp/mypipe</code></pre>
            <p>
              Unlike anonymous pipes, FIFOs let <em>unrelated</em> processes communicate.
              Any program that knows the path can open it. The data still flows as a raw
              byte stream &mdash; first in, first out &mdash; and the same backpressure
              rules apply.
            </p>

            <h4>How Bashtorio Uses FIFOs</h4>
            <p>
              Bashtorio runs a real Linux system in your browser using the
              <a href="https://github.com/nicmcd/v86" target="_blank" rel="noopener" style="color: var(--ui-accent, #00d9ff);">v86</a>
              x86 emulator. Every Shell machine on the grid executes actual Unix commands
              inside this VM. There are two modes of operation:
            </p>
            <p>
              <strong>Pipe mode</strong> (default) &mdash; Each time a byte arrives at a Shell
              machine, the game pipes it into the command via stdin:
            </p>
            <pre><code class="help-diagram">  printf '%s' 'hello' | tr a-z A-Z</code></pre>
            <p>
              The command runs, produces output, and exits. The game collects the output and
              sends it downstream on the belt.
            </p>
            <p>
              <strong>Stream mode</strong> &mdash; The game creates a FIFO on the guest filesystem
              and starts the command reading from it. The command stays alive persistently, and
              incoming bytes are written into the FIFO as they arrive:
            </p>
            <pre><code class="help-diagram">  # What the VM does behind the scenes:
  mkfifo /tmp/bashtorio/s0_fifo

  # Start the command reading from the FIFO (stays alive):
  tr a-z A-Z <> /tmp/bashtorio/s0_fifo > /tmp/bashtorio/s0_out &

  # Each incoming byte gets written to the FIFO:
  printf '\\x68\\x65\\x6c\\x6c\\x6f' > /tmp/bashtorio/s0_fifo</code></pre>
            <p>
              The <code>&lt;&gt;</code> (read-write) open mode prevents the command from
              receiving EOF when the pipe empties &mdash; it keeps the process alive, waiting
              for more input. This is how stream-mode commands like <code>sed</code>,
              <code>awk</code>, or <code>cat</code> can process a continuous flow of data
              without restarting on every byte.
            </p>

            <h4>The VM Under the Hood</h4>
            <p>
              The v86 emulator runs a full x86 CPU in JavaScript/WebAssembly, booting a real
              Linux kernel with a real filesystem. Commands are sent to the guest via the
              emulated serial port, and output is collected either through a 9p shared
              filesystem or by parsing serial output markers.
            </p>
            <p>
              Each Shell machine gets its own shell session with an independent working
              directory. When you <code>cd</code> in one Shell machine, it doesn't affect
              the others &mdash; just like having multiple terminal windows open.
            </p>
          </div>
          <div class="help-footer">
            <button class="help-close primary">Close</button>
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
  const systembar = container.querySelector('.bashtorio-systembar') as HTMLElement;
  const outputSinks = container.querySelector('.output-sinks') as HTMLElement;
  const gameTerminal = container.querySelector('.game-terminal') as HTMLElement;
  const commandModal = container.querySelector('.command-modal') as HTMLElement;
  const linefeedModal = container.querySelector('.linefeed-modal') as HTMLElement;
  const flipperModal = container.querySelector('.flipper-modal') as HTMLElement;
  const constantModal = container.querySelector('.constant-modal') as HTMLElement;
  const filterModal = container.querySelector('.filter-modal') as HTMLElement;
  const counterModal = container.querySelector('.counter-modal') as HTMLElement;
  const delayModal = container.querySelector('.delay-modal') as HTMLElement;
  const packerModal = container.querySelector('.packer-modal') as HTMLElement;
  const sourceModal = container.querySelector('.source-modal') as HTMLElement;
  const routerModal = container.querySelector('.router-modal') as HTMLElement;
  const gateModal = container.querySelector('.gate-modal') as HTMLElement;
  const wirelessModal = container.querySelector('.wireless-modal') as HTMLElement;
  const replaceModal = container.querySelector('.replace-modal') as HTMLElement;
  const mathModal = container.querySelector('.math-modal') as HTMLElement;
  const clockModal = container.querySelector('.clock-modal') as HTMLElement;
  const latchModal = container.querySelector('.latch-modal') as HTMLElement;
  const sinkModal = container.querySelector('.sink-modal') as HTMLElement;
  const networkModal = container.querySelector('.network-modal') as HTMLElement;
  const presetsModal = container.querySelector('.presets-modal') as HTMLElement;
  const settingsModal = container.querySelector('.settings-modal') as HTMLElement;
  const acknowledgmentsModal = container.querySelector('.acknowledgements-modal') as HTMLElement;
  const helpModal = container.querySelector('.help-modal') as HTMLElement;
  const themeSelect = settingsModal.querySelector('.theme-select') as HTMLSelectElement;
  const cmdlogEntries = container.querySelector('.cmdlog-entries') as HTMLElement;
  const streamEntries = container.querySelector('.stream-entries') as HTMLElement;
  const toast = container.querySelector('.bashtorio-toast') as HTMLElement;

  // Stats panel refs
  const statsUptime = container.querySelector('.stats-uptime') as HTMLElement;
  const statsActive = container.querySelector('.stats-active') as HTMLElement;
  const statsSinkBytes = container.querySelector('.stats-sink-bytes') as HTMLElement;
  const statsThroughput = container.querySelector('.stats-throughput') as HTMLElement;
  const statsCommands = container.querySelector('.stats-commands') as HTMLElement;
  const statsErrors = container.querySelector('.stats-errors') as HTMLElement;
  const statsAvgCmd = container.querySelector('.stats-avg-cmd') as HTMLElement;
  const statsStreamWrites = container.querySelector('.stats-stream-writes') as HTMLElement;

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

  function getOrCreateSinkElement(sinkId: number, name?: string): HTMLPreElement {
    let el = sinkElements.get(sinkId);
    if (!el) {
      const section = document.createElement('div');
      section.className = 'sink-section';
      section.dataset.sinkId = String(sinkId);

      const label = document.createElement('div');
      label.className = 'sink-label';
      label.textContent = name || `Sink ${sinkId}`;

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

    // Focus mode: when active, keyboard input routes to keyboard machines instead of game controls
    type FocusMode = 'none' | 'simulationPassthrough';
    let focusMode: FocusMode = 'none';

    function enterFocusMode(mode: FocusMode) {
      focusMode = mode;
      toast.textContent = 'Simulation input active. Press Esc to exit.';
      toast.style.display = 'block';
      if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
    }

    function exitFocusMode() {
      focusMode = 'none';
      toast.style.display = 'none';
    }

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

    // Set up flipper modal
    let editingFlipper: { x: number; y: number } | null = null;
    const flipDirSelect = flipperModal.querySelector('.flip-dir') as HTMLSelectElement;

    function closeFlipperModal() {
      flipperModal.style.display = 'none';
      editingFlipper = null;
    }

    flipperModal.querySelector('.flip-cancel')?.addEventListener('click', closeFlipperModal);

    flipperModal.querySelector('.flip-save')?.addEventListener('click', () => {
      if (editingFlipper) {
        input.updateFlipperConfig(
          editingFlipper.x,
          editingFlipper.y,
          parseInt(flipDirSelect.value),
        );
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

    // Set up packer modal with ByteInput
    let editingPacker: { x: number; y: number } | null = null;
    const packerByteInputMount = packerModal.querySelector('.packer-byte-input-mount') as HTMLElement;
    const packerByteInput = new ByteInput({ value: '\n' });
    packerByteInputMount.appendChild(packerByteInput.el);
    const packerPreserve = packerModal.querySelector('.packer-preserve') as HTMLInputElement;

    function closePackerModal() {
      packerModal.style.display = 'none';
      editingPacker = null;
    }

    packerModal.querySelector('.packer-cancel')?.addEventListener('click', closePackerModal);

    packerModal.querySelector('.packer-save')?.addEventListener('click', () => {
      if (editingPacker) {
        input.updatePackerConfig(
          editingPacker.x,
          editingPacker.y,
          packerByteInput.getValue(),
          packerPreserve.checked,
        );
      }
      closePackerModal();
    });

    packerModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePackerModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        packerModal.querySelector('.packer-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up router modal with ByteInput
    let editingRouter: { x: number; y: number } | null = null;
    const routerByteInputMount = routerModal.querySelector('.router-byte-input-mount') as HTMLElement;
    const routerByteInput = new ByteInput({ value: '\n' });
    routerByteInputMount.appendChild(routerByteInput.el);
    const routerMatchDirSelect = routerModal.querySelector('.router-match-dir') as HTMLSelectElement;
    const routerElseDirSelect = routerModal.querySelector('.router-else-dir') as HTMLSelectElement;

    function closeRouterModal() {
      routerModal.style.display = 'none';
      editingRouter = null;
    }

    routerModal.querySelector('.router-cancel')?.addEventListener('click', closeRouterModal);

    routerModal.querySelector('.router-save')?.addEventListener('click', () => {
      if (editingRouter) {
        input.updateRouterConfig(
          editingRouter.x,
          editingRouter.y,
          routerByteInput.getValue(),
          parseInt(routerMatchDirSelect.value),
          parseInt(routerElseDirSelect.value),
        );
      }
      closeRouterModal();
    });

    routerModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeRouterModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        routerModal.querySelector('.router-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up gate modal
    let editingGate: { x: number; y: number } | null = null;
    const gateDataDirSelect = gateModal.querySelector('.gate-data-dir') as HTMLSelectElement;
    const gateControlDirSelect = gateModal.querySelector('.gate-control-dir') as HTMLSelectElement;

    function closeGateModal() {
      gateModal.style.display = 'none';
      editingGate = null;
    }

    gateModal.querySelector('.gate-cancel')?.addEventListener('click', closeGateModal);

    gateModal.querySelector('.gate-save')?.addEventListener('click', () => {
      if (editingGate) {
        input.updateGateConfig(
          editingGate.x,
          editingGate.y,
          parseInt(gateDataDirSelect.value),
          parseInt(gateControlDirSelect.value),
        );
      }
      closeGateModal();
    });

    gateModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeGateModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        gateModal.querySelector('.gate-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up wireless modal
    let editingWireless: { x: number; y: number } | null = null;
    const wirelessChannelSelect = wirelessModal.querySelector('.wireless-channel') as HTMLSelectElement;

    function closeWirelessModal() {
      wirelessModal.style.display = 'none';
      editingWireless = null;
    }

    wirelessModal.querySelector('.wireless-cancel')?.addEventListener('click', closeWirelessModal);

    wirelessModal.querySelector('.wireless-save')?.addEventListener('click', () => {
      if (editingWireless) {
        input.updateWirelessConfig(
          editingWireless.x,
          editingWireless.y,
          parseInt(wirelessChannelSelect.value),
        );
      }
      closeWirelessModal();
    });

    wirelessModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeWirelessModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        wirelessModal.querySelector('.wireless-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up replace modal with ByteInputs
    let editingReplace: { x: number; y: number } | null = null;
    const replaceFromMount = replaceModal.querySelector('.replace-from-input-mount') as HTMLElement;
    const replaceToMount = replaceModal.querySelector('.replace-to-input-mount') as HTMLElement;
    const replaceFromInput = new ByteInput({ value: 'a' });
    const replaceToInput = new ByteInput({ value: 'b' });
    replaceFromMount.appendChild(replaceFromInput.el);
    replaceToMount.appendChild(replaceToInput.el);

    function closeReplaceModal() {
      replaceModal.style.display = 'none';
      editingReplace = null;
    }

    replaceModal.querySelector('.replace-cancel')?.addEventListener('click', closeReplaceModal);

    replaceModal.querySelector('.replace-save')?.addEventListener('click', () => {
      if (editingReplace) {
        input.updateReplaceConfig(
          editingReplace.x,
          editingReplace.y,
          replaceFromInput.getValue(),
          replaceToInput.getValue(),
        );
      }
      closeReplaceModal();
    });

    replaceModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeReplaceModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        replaceModal.querySelector('.replace-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up math modal
    let editingMath: { x: number; y: number } | null = null;
    const mathOpSelect = mathModal.querySelector('.math-op') as HTMLSelectElement;
    const mathOperandInput = mathModal.querySelector('.math-operand') as HTMLInputElement;

    function closeMathModal() {
      mathModal.style.display = 'none';
      editingMath = null;
    }

    mathModal.querySelector('.math-cancel')?.addEventListener('click', closeMathModal);

    mathModal.querySelector('.math-save')?.addEventListener('click', () => {
      if (editingMath) {
        input.updateMathConfig(
          editingMath.x,
          editingMath.y,
          mathOpSelect.value,
          Math.max(0, Math.min(255, parseInt(mathOperandInput.value) || 0)),
        );
      }
      closeMathModal();
    });

    mathModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMathModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        mathModal.querySelector('.math-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up clock modal with ByteInput
    let editingClock: { x: number; y: number } | null = null;
    const clockByteInputMount = clockModal.querySelector('.clock-byte-input-mount') as HTMLElement;
    const clockByteInput = new ByteInput({ value: '*' });
    clockByteInputMount.appendChild(clockByteInput.el);
    const clockIntervalInput = clockModal.querySelector('.clock-interval') as HTMLInputElement;

    function closeClockModal() {
      clockModal.style.display = 'none';
      editingClock = null;
    }

    clockModal.querySelector('.clock-cancel')?.addEventListener('click', closeClockModal);

    clockModal.querySelector('.clock-save')?.addEventListener('click', () => {
      if (editingClock) {
        input.updateClockConfig(
          editingClock.x,
          editingClock.y,
          clockByteInput.getValue(),
          Math.max(50, parseInt(clockIntervalInput.value) || 1000),
        );
      }
      closeClockModal();
    });

    clockModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeClockModal();
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        clockModal.querySelector('.clock-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up latch modal
    let editingLatch: { x: number; y: number } | null = null;
    const latchDataDirSelect = latchModal.querySelector('.latch-data-dir') as HTMLSelectElement;
    const latchControlDirSelect = latchModal.querySelector('.latch-control-dir') as HTMLSelectElement;

    function closeLatchModal() {
      latchModal.style.display = 'none';
      editingLatch = null;
    }

    latchModal.querySelector('.latch-cancel')?.addEventListener('click', closeLatchModal);

    latchModal.querySelector('.latch-save')?.addEventListener('click', () => {
      if (editingLatch) {
        input.updateLatchConfig(
          editingLatch.x,
          editingLatch.y,
          parseInt(latchDataDirSelect.value),
          parseInt(latchControlDirSelect.value),
        );
      }
      closeLatchModal();
    });

    latchModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLatchModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        latchModal.querySelector('.latch-save')?.dispatchEvent(new Event('click'));
      }
    });

    // Set up sink modal
    let editingSink: { x: number; y: number; sinkId: number } | null = null;
    const sinkNameInput = sinkModal.querySelector('.sink-name-input') as HTMLInputElement;

    function closeSinkModal() {
      sinkModal.style.display = 'none';
      editingSink = null;
    }

    sinkModal.querySelector('.sink-cancel')?.addEventListener('click', closeSinkModal);

    sinkModal.querySelector('.sink-save')?.addEventListener('click', () => {
      if (editingSink) {
        const newName = sinkNameInput.value.trim() || `Sink ${editingSink.sinkId}`;
        input.updateSinkConfig(editingSink.x, editingSink.y, newName);
        // Update the sidebar label if the sink output element exists
        const el = sinkElements.get(editingSink.sinkId);
        if (el) {
          const section = el.closest('.sink-section');
          const label = section?.querySelector('.sink-label');
          if (label) label.textContent = newName;
        }
      }
      closeSinkModal();
    });

    sinkModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSinkModal();
      if (e.key === 'Enter') {
        e.preventDefault();
        sinkModal.querySelector('.sink-save')?.dispatchEvent(new Event('click'));
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
      const networkBtn = systembar.querySelector('.network-btn') as HTMLElement;

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

    // Set up help modal
    helpModal.querySelector('.help-close')?.addEventListener('click', () => {
      helpModal.style.display = 'none';
    });

    helpModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        helpModal.style.display = 'none';
      }
    });

    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.style.display = 'none';
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

    // Stats state
    let statsStartTime = 0;
    const stats = {
      sinkBytes: 0,
      commandCount: 0,
      commandErrors: 0,
      commandTotalMs: 0,
      streamWriteBytes: 0,
      recentSinkBytes: [] as { time: number; count: number }[],
    };

    function resetStats() {
      statsStartTime = performance.now();
      stats.sinkBytes = 0;
      stats.commandCount = 0;
      stats.commandErrors = 0;
      stats.commandTotalMs = 0;
      stats.streamWriteBytes = 0;
      stats.recentSinkBytes = [];
    }

    function formatNumber(n: number): string {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
      if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
      return String(n);
    }

    function formatBytes(n: number): string {
      if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(1) + ' GB';
      if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + ' MB';
      if (n >= 1_024) return (n / 1_024).toFixed(1) + ' KB';
      return n + ' B';
    }

    function updateStatsDisplay() {
      const elapsed = performance.now() - statsStartTime;
      const totalSec = Math.floor(elapsed / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      statsUptime.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
      statsActive.textContent = String(state.packets.length);
      statsSinkBytes.textContent = formatBytes(stats.sinkBytes);

      // Throughput: rolling 5s window
      const now = performance.now();
      const windowMs = 5000;
      stats.recentSinkBytes = stats.recentSinkBytes.filter(e => now - e.time < windowMs);
      const windowBytes = stats.recentSinkBytes.reduce((s, e) => s + e.count, 0);
      const windowSec = Math.min((now - statsStartTime), windowMs) / 1000;
      const throughput = windowSec > 0 ? windowBytes / windowSec : 0;
      statsThroughput.textContent = formatBytes(Math.round(throughput)) + '/s';

      statsCommands.textContent = formatNumber(stats.commandCount);
      statsErrors.textContent = formatNumber(stats.commandErrors);
      if (stats.commandErrors > 0) {
        statsErrors.classList.add('stat-error');
      } else {
        statsErrors.classList.remove('stat-error');
      }

      if (stats.commandCount > 0) {
        const avg = Math.round(stats.commandTotalMs / stats.commandCount);
        statsAvgCmd.textContent = avg + 'ms';
      } else {
        statsAvgCmd.textContent = '-';
      }
      statsStreamWrites.textContent = formatBytes(stats.streamWriteBytes);
    }

    container.querySelector('.clear-stats-btn')?.addEventListener('click', resetStats);

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
      resetStats();
    });

    events.on('sinkReceive', (payload) => {
      stats.sinkBytes += payload.char.length;
      stats.recentSinkBytes.push({ time: performance.now(), count: payload.char.length });
    });

    events.on('commandStart', (payload) => {
      if (!payload.stream) {
        stats.commandCount++;
      }
    });

    events.on('commandComplete', (payload) => {
      if (payload.error) stats.commandErrors++;
      if (!payload.stream) {
        stats.commandTotalMs += payload.durationMs;
      }
    });

    events.on('streamWrite', (payload) => {
      stats.streamWriteBytes += payload.bytes;
    });

    events.on('pack', (payload) => {
      stats.sinkBytes += payload.length;
      stats.recentSinkBytes.push({ time: performance.now(), count: payload.length });
    });

    // Create simulation callbacks
    const simCallbacks: SimulationCallbacks = {
      onVMStatusChange: (status) => {
        const vmStatus = systembar.querySelector('.vm-status') as HTMLElement;
        if (vmStatus) {
          vmStatus.className = 'vm-status ' + status;
          const text = vmStatus.querySelector('.status-text');
          if (text) {
            text.textContent = status === 'ready' ? 'VM Ready' : status === 'busy' ? 'Processing...' : 'VM Error';
          }
        }
      },
      onOutput: (sinkId, content) => {
        // Get or create the sink element, using the machine's custom name
        const sinkMachine = state.machines.find(m => m.type === MachineType.SINK && (m as SinkMachine).sinkId === sinkId) as SinkMachine | undefined;
        const sinkOutput = getOrCreateSinkElement(sinkId, sinkMachine?.name);
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
        } else {
          exitFocusMode();
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
        flipDirSelect.value = String(machine.flipperDir);
        flipperModal.style.display = 'flex';
        flipDirSelect.focus();
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
      onPackerClick: (machine) => {
        editingPacker = { x: machine.x, y: machine.y };
        packerByteInput.setValue(machine.packerDelimiter);
        packerPreserve.checked = machine.preserveDelimiter;
        packerModal.style.display = 'flex';
        packerByteInput.focus();
        events.emit('configureStart');
      },
      onRouterClick: (machine) => {
        editingRouter = { x: machine.x, y: machine.y };
        routerByteInput.setValue(machine.routerByte);
        routerMatchDirSelect.value = String(machine.routerMatchDir);
        routerElseDirSelect.value = String(machine.routerElseDir);
        routerModal.style.display = 'flex';
        routerByteInput.focus();
        events.emit('configureStart');
      },
      onGateClick: (machine) => {
        editingGate = { x: machine.x, y: machine.y };
        gateDataDirSelect.value = String(machine.gateDataDir);
        gateControlDirSelect.value = String(machine.gateControlDir);
        gateModal.style.display = 'flex';
        gateDataDirSelect.focus();
        events.emit('configureStart');
      },
      onWirelessClick: (machine) => {
        editingWireless = { x: machine.x, y: machine.y };
        wirelessChannelSelect.value = String(machine.wirelessChannel);
        wirelessModal.style.display = 'flex';
        wirelessChannelSelect.focus();
        events.emit('configureStart');
      },
      onReplaceClick: (machine) => {
        editingReplace = { x: machine.x, y: machine.y };
        replaceFromInput.setValue(machine.replaceFrom);
        replaceToInput.setValue(machine.replaceTo);
        replaceModal.style.display = 'flex';
        replaceFromInput.focus();
        events.emit('configureStart');
      },
      onMathClick: (machine) => {
        editingMath = { x: machine.x, y: machine.y };
        mathOpSelect.value = machine.mathOp;
        mathOperandInput.value = String(machine.mathOperand);
        mathModal.style.display = 'flex';
        mathOpSelect.focus();
        events.emit('configureStart');
      },
      onClockClick: (machine) => {
        editingClock = { x: machine.x, y: machine.y };
        clockByteInput.setValue(machine.clockByte);
        clockIntervalInput.value = String(machine.emitInterval);
        clockModal.style.display = 'flex';
        clockByteInput.focus();
        events.emit('configureStart');
      },
      onLatchClick: (machine) => {
        editingLatch = { x: machine.x, y: machine.y };
        latchDataDirSelect.value = String(machine.latchDataDir);
        latchControlDirSelect.value = String(machine.latchControlDir);
        latchModal.style.display = 'flex';
        latchDataDirSelect.focus();
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
      onSinkClick: (machine) => {
        editingSink = { x: machine.x, y: machine.y, sinkId: machine.sinkId };
        sinkNameInput.value = machine.name;
        sinkModal.style.display = 'flex';
        sinkNameInput.focus();
        sinkNameInput.select();
        events.emit('configureStart');
      },
      onMachineDelete: (machine) => {
        if (machine.type === MachineType.SINK) {
          const sinkId = (machine as SinkMachine).sinkId;
          const el = sinkElements.get(sinkId);
          if (el) {
            el.closest('.sink-section')?.remove();
            sinkElements.delete(sinkId);
          }
        }
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

      if (e.type === 'keydown') {
        if (focusMode === 'simulationPassthrough') {
          // Escape exits focus mode
          if (e.key === 'Escape') {
            exitFocusMode();
            return;
          }
          // Route to keyboard machines only
          if (e.key.length === 1) {
            events.emit('keyPress', { char: e.key });
          } else if (e.key === 'Enter') {
            events.emit('keyPress', { char: '\n' });
          } else if (e.key === 'Tab') {
            e.preventDefault();
            events.emit('keyPress', { char: '\t' });
          } else if (e.key === 'Backspace') {
            events.emit('keyPress', { char: '\x7f' });
          }
          return; // Don't forward to InputHandler
        }

        // Normal mode: forward to game controls only, no keyPress emission
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
    createToolbar(toolbar, systembar, state, input, sound, settings, {
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
      onHelpClick: () => {
        helpModal.style.display = 'flex';
      },
      onKeyboardFocusClick: () => {
        if (state.running) {
          enterFocusMode('simulationPassthrough');
        }
      },
      onCopyLink: async () => {
        const base64 = await saveToBase64(state);
        const url = new URL(window.location.href);
        url.searchParams.set('factory', base64);
        navigator.clipboard.writeText(url.toString()).then(() => {
          showToast('Factory link copied to clipboard');
        }, () => {
          showToast('Failed to copy link');
        });
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

    // Check URL for factory param and load if present
    loadFromURLParam().then(urlSave => {
      if (urlSave) {
        deserializeState(state, urlSave);
        renderer.handleResize(state);
        events.emit('saveLoaded', { source: 'url' });
      }
    });

    // Show toast when a save is loaded
    events.on('saveLoaded', (payload) => {
      if (payload.source === 'url') {
        showToast('Loaded save from URL');
      }
    });

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
    function animate(time: number) {
      if (!running) return;
      const deltaTime = lastTime ? time - lastTime : 0;
      lastTime = time;
      updateSimulation(state, deltaTime, simCallbacks);
      renderer.render(state, time);
      if (state.running) updateStatsDisplay();
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
  systembar: HTMLElement,
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
    onHelpClick?: () => void;
    onKeyboardFocusClick?: () => void;
    onCopyLink?: () => void;
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
      { id: 'router', icon: '🔀', label: 'Route', key: 'H' },
      { id: 'gate', icon: '🚧', label: 'Gate', key: 'I' },
      { id: 'wireless', icon: '📡', label: 'Radio', key: 'J' },
      { id: 'merger', icon: '🔗', label: 'Merge', key: '-' },
    ]},
    { label: 'Source', items: [
      { id: 'source', icon: '📤', label: 'SRC', key: 'E' },
      { id: 'constant', icon: '♻️', label: 'Loop', key: 'T' },
      { id: 'keyboard', icon: '⌨️', label: 'Key', key: 'K' },
      { id: 'linefeed', icon: '↵', label: 'LF', key: 'C' },
      { id: 'clock', icon: '🕐', label: 'Clock', key: 'O' },
    ]},
    { label: 'Process', items: [
      { id: 'command', icon: '🖥️', label: 'Shell', key: 'F' },
      { id: 'filter', icon: '🚦', label: 'Filter', key: 'G' },
      { id: 'counter', icon: '🔢', label: 'Count', key: 'N' },
      { id: 'delay', icon: '⏱️', label: 'Delay', key: 'B' },
      { id: 'packer', icon: '📦', label: 'Pack', key: 'P' },
      { id: 'unpacker', icon: '📭', label: 'Unpack', key: 'U' },
      { id: 'replace', icon: '🔄', label: 'Repl', key: 'L' },
      { id: 'math', icon: '🧮', label: 'Math', key: 'M' },
      { id: 'latch', icon: '🔒', label: 'Latch', key: 'Y' },
    ]},
    { label: 'Output', items: [
      { id: 'sink', icon: '📥', label: 'Sink', key: 'S' },
      { id: 'display', icon: '💬', label: 'UTF8', key: 'A' },
      { id: 'null', icon: '🕳️', label: 'Null', key: 'X' },
      { id: 'sevenseg', icon: '🔢', label: '7Seg', key: 'Z' },
    ]},
  ];

  const placeables = placeableColumns.flatMap(c => c.items);

  // Get the current placeable's icon and label
  const currentPlaceable = placeables.find(p => p.id === state.currentPlaceable);
  const currentPlaceableIcon = currentPlaceable?.icon || '➡️';
  const currentPlaceableLabel = currentPlaceable?.label || 'Belt';

  // --- System bar (top) ---
  systembar.innerHTML = `
    <div class="mode-btn-wrapper">
      <button class="action-btn storage-btn">💾 Storage</button>
      <div class="storage-popout" style="display: none;">
        <button class="action-btn save-btn">💾 Save</button>
        <button class="action-btn load-btn">📂 Load</button>
        <button class="action-btn presets-btn">📚 Presets</button>
      </div>
    </div>
    <button class="action-btn copy-link-btn" title="Copy factory link">🔗</button>
    <button class="action-btn settings-btn" title="Settings">⚙️</button>
    <button class="action-btn help-btn" title="How It Works">❓</button>
    <div class="systembar-spacer"></div>
    <div class="vm-status ready">
      <span class="status-dot"></span>
      <span class="status-text">VM Ready</span>
    </div>
    <button class="action-btn network-btn">🌐</button>
    <button class="action-btn mute-btn" title="Toggle Sound">${sound.muted ? '🔇' : '🔊'}</button>
  `;

  // --- Toolbar (bottom) ---
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
        <button class="action-btn keyboard-focus-btn" title="Simulation Input (send keystrokes to keyboard machines)">⌨️</button>
      </div>
      <div class="tool-group version-info">
        <span>v0.1.0 · Created by: <a href="https://elijahcunningham.dev" target="_blank" rel="noopener">Elijah Cunningham</a></span>
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
  toolbar.querySelector('.clear-btn')?.addEventListener('click', () => {
    if (confirm('Clear the entire grid? This cannot be undone.')) {
      input.clearAll();
    }
  });

  // Storage popout (in system bar)
  const storagePopout = systembar.querySelector('.storage-popout') as HTMLElement;
  const storageBtn = systembar.querySelector('.storage-btn') as HTMLElement;

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

  // Save/Load/Presets buttons (in system bar)
  systembar.querySelector('.save-btn')?.addEventListener('click', () => {
    storagePopout.style.display = 'none';
    callbacks.onSave?.();
  });
  systembar.querySelector('.load-btn')?.addEventListener('click', () => {
    storagePopout.style.display = 'none';
    callbacks.onLoad?.();
  });
  systembar.querySelector('.presets-btn')?.addEventListener('click', () => {
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

  // Network button (in system bar)
  systembar.querySelector('.network-btn')?.addEventListener('click', () => {
    callbacks.onNetworkClick?.();
  });

  // Keyboard focus button (stays in toolbar)
  toolbar.querySelector('.keyboard-focus-btn')?.addEventListener('click', () => {
    callbacks.onKeyboardFocusClick?.();
  });

  // Mute button (in system bar)
  const muteBtn = systembar.querySelector('.mute-btn') as HTMLElement;
  muteBtn?.addEventListener('click', () => {
    const muted = sound.toggleMute();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    saveSettings({ ...settings, muted });
  });

  // Settings button (in system bar)
  systembar.querySelector('.settings-btn')?.addEventListener('click', () => {
    callbacks.onSettingsClick?.();
  });

  // Help button (in system bar)
  systembar.querySelector('.help-btn')?.addEventListener('click', () => {
    callbacks.onHelpClick?.();
  });

  // Copy link button (in system bar)
  systembar.querySelector('.copy-link-btn')?.addEventListener('click', () => {
    callbacks.onCopyLink?.();
  });
}
