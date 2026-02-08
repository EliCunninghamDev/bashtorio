import { GRID_SIZE } from './types';
import { emitGameEvent, onGameEvent } from '../events/bus';
import { getMachineBounds } from './edit';

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

// --- Module state ---

let x = 0;
let y = 0;
let scale = 1;
let canvasW = 0;
let canvasH = 0;

// --- Canvas binding ---

export function bindCanvas(canvas: HTMLCanvasElement): void {
  canvasW = canvas.width;
  canvasH = canvas.height;
}

export function updateCanvasSize(w: number, h: number): void {
  canvasW = w;
  canvasH = h;
}

// --- Getters ---

export function getX(): number { return x; }
export function getY(): number { return y; }
export function getScale(): number { return scale; }

// --- Viewport helpers ---

/** Width of the visible area in world pixels. */
export function viewportW(): number { return canvasW / scale; }

/** Height of the visible area in world pixels. */
export function viewportH(): number { return canvasH / scale; }

/** Bounding box of the visible area in world pixels. */
export function viewportBounds(): { left: number; top: number; right: number; bottom: number } {
  const w = canvasW / scale;
  const h = canvasH / scale;
  return { left: x, top: y, right: x + w, bottom: y + h };
}

/** Visible grid-cell range (inclusive, with 1-cell padding). */
export function visibleGridRange(): { startCol: number; endCol: number; startRow: number; endRow: number } {
  const w = canvasW / scale;
  const h = canvasH / scale;
  return {
    startCol: Math.floor(x / GRID_SIZE) - 1,
    endCol: Math.ceil((x + w) / GRID_SIZE) + 1,
    startRow: Math.floor(y / GRID_SIZE) - 1,
    endRow: Math.ceil((y + h) / GRID_SIZE) + 1,
  };
}

/** Center of the viewport in world pixels. */
export function viewportCenter(): { cx: number; cy: number } {
  return { cx: x + canvasW / scale / 2, cy: y + canvasH / scale / 2 };
}

// --- Coordinate transforms ---

/** Screen pixel → world pixel. */
export function screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
  return { wx: sx / scale + x, wy: sy / scale + y };
}

/** Screen pixel → grid cell. */
export function screenToGrid(sx: number, sy: number): { gx: number; gy: number } {
  const wx = sx / scale + x;
  const wy = sy / scale + y;
  return { gx: Math.floor(wx / GRID_SIZE), gy: Math.floor(wy / GRID_SIZE) };
}

// --- Mutations ---

export function setPosition(nx: number, ny: number): void {
  x = nx;
  y = ny;
}

export function setScale(s: number): void {
  scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s));
}

/** Change zoom while keeping the current viewport center fixed. */
export function zoom(newScale: number): void {
  newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
  const cx = x + canvasW / scale / 2;
  const cy = y + canvasH / scale / 2;
  scale = newScale;
  x = cx - canvasW / newScale / 2;
  y = cy - canvasH / newScale / 2;
  emitGameEvent('zoomChanged', { scale });
}

export function zoomIn(): void { zoom(scale + ZOOM_STEP); }
export function zoomOut(): void { zoom(scale - ZOOM_STEP); }

/** Center the viewport on a world-pixel point. */
export function centerOn(wx: number, wy: number): void {
  x = wx - canvasW / scale / 2;
  y = wy - canvasH / scale / 2;
}

/** Center on the midpoint of a grid-cell bounding box (minX..maxX, minY..maxY inclusive). */
export function centerOnGridBounds(minX: number, minY: number, maxX: number, maxY: number): void {
  const cx = (minX + maxX + 1) / 2 * GRID_SIZE;
  const cy = (minY + maxY + 1) / 2 * GRID_SIZE;
  centerOn(cx, cy);
}

export function reset(): void {
  x = 0;
  y = 0;
  scale = 1;
}

/** Wire camera-related event-bus handlers. */
export function setupCameraEvents(): void {
  onGameEvent('zoomIn', () => zoomIn());
  onGameEvent('zoomOut', () => zoomOut());
  onGameEvent('zoomSet', ({ scale }) => zoom(scale));

  let panStartCamX = 0;
  let panStartCamY = 0;
  let panStartScreenX = 0;
  let panStartScreenY = 0;

  onGameEvent('+pan', ({ screenX, screenY }) => {
    panStartScreenX = screenX;
    panStartScreenY = screenY;
    panStartCamX = x;
    panStartCamY = y;
  });

  onGameEvent('panMove', ({ screenX, screenY }) => {
    const dx = screenX - panStartScreenX;
    const dy = screenY - panStartScreenY;
    setPosition(panStartCamX - dx / scale, panStartCamY - dy / scale);
  });

  onGameEvent('cameraToFactory', () => {
    const bounds = getMachineBounds();
    if (!bounds) {
      emitGameEvent('toast', { message: 'Factory has no machines to center on.' });
      return;
    }
    centerOnGridBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  });

  onGameEvent('saveLoaded', () => {
    emitGameEvent('cameraToFactory');
  });
}
