import { type PlaceableType } from '../game/types';
import type { GameState } from '../game/state';
import { toggleSimulation } from '../game/simulation';
import type { Renderer } from '../render/renderer';
import { emitGameEvent, onGameEvent } from '../events/bus';

const MOUSE_LEFT = 0;
const MOUSE_RIGHT = 2;

const KEY_TO_PLACEABLE: Record<string, PlaceableType> = {
  q: 'belt',
  w: 'splitter',
  f: 'command',
  s: 'sink',
  a: 'display',
  x: 'null',
  c: 'linefeed',
  v: 'flipper',
  d: 'duplicator',
  t: 'constant',
  g: 'filter',
  n: 'counter',
  b: 'delay',
  k: 'keyboard',
  p: 'packer',
  u: 'unpacker',
  h: 'router',
  i: 'gate',
  j: 'wireless',
  l: 'replace',
  m: 'math',
  o: 'clock',
  y: 'latch',
  z: 'sevenseg',
};

const EDITOR_KEYBINDS: Record<string, string> = {
  MODE_SELECT: '1',
  MODE_ERASE: '2',
  MODE_PLACE: '3',
};

/**
 * Thin input layer: translates DOM events (mouse, keyboard) into semantic
 * game events on the event bus. Contains no game logic - that lives in Editor.
 */
export class EditorInput {
  private state: GameState;
  private renderer: Renderer;
  private canvas: HTMLCanvasElement;
  private panning = false;

  constructor(state: GameState, renderer: Renderer, canvas: HTMLCanvasElement) {
    this.state = state;
    this.renderer = renderer;
    this.canvas = canvas;
  }

  init(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    onGameEvent('editorKeyPress', (payload) => this.handleKeyDown(payload));
  }

  destroy(): void {
    // Note: bound handlers can't be removed this way - acceptable for now
    // since destroy() tears down the entire game instance.
  }

  // --- Mouse ---

  private handleMouseDown(e: MouseEvent): void {
    // Ctrl+left-click: start panning
    if (e.button === MOUSE_LEFT && e.ctrlKey) {
      this.panning = true;
      emitGameEvent('+pan', { screenX: e.clientX, screenY: e.clientY });
      return;
    }

    const pos = this.renderer.getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    if (e.button === MOUSE_LEFT) {
      emitGameEvent('+place', { grid_x: pos.x, grid_y: pos.y });
    } else if (e.button === MOUSE_RIGHT) {
      emitGameEvent('+erase', { grid_x: pos.x, grid_y: pos.y });
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.panning) {
      emitGameEvent('panMove', { screenX: e.clientX, screenY: e.clientY });
      return;
    }

    const pos = this.renderer.getGridPosition(e.clientX, e.clientY);
    if (!pos) return;

    emitGameEvent('gridMouseMove', { gridX: pos.x, gridY: pos.y });
  }

  private handleMouseUp(): void {
    if (this.panning) {
      this.panning = false;
      emitGameEvent('-pan');
      return;
    }

    emitGameEvent('-erase');
    emitGameEvent('-place');
  }

  // --- Keyboard ---

  private handleKeyDown(e: { key: string; preventDefault: () => void }): void {
    const key = e.key.toLowerCase();

    // Mode selection
    if (key === EDITOR_KEYBINDS.MODE_SELECT) { emitGameEvent('modeChange', { mode: 'select' }); return; }
    if (key === EDITOR_KEYBINDS.MODE_ERASE) { emitGameEvent('modeChange', { mode: 'erase' }); return; }
    if (key === EDITOR_KEYBINDS.MODE_PLACE) { emitGameEvent('modeChange', { mode: 'machine' }); return; }

    // Rotate
    if (key === 'r') { emitGameEvent('rotate'); return; }

    // Toggle simulation
    if (key === ' ') { e.preventDefault(); toggleSimulation(this.state); return; }

    // Placeable selection (only in machine mode)
    if (this.state.currentMode === 'machine') {
      const placeable = KEY_TO_PLACEABLE[key];
      if (placeable) {
        emitGameEvent('selectPlaceable', { placeable });
        return;
      }
    }
  }
}
