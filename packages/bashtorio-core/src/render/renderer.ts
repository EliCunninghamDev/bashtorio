import {
  GRID_COLS,
  GRID_ROWS,
  GRID_SIZE,
  PACKET_SIZE,
  Direction,
  CellType,
  MachineType,
  type Machine,
  type Packet,
  type BeltCell,
  type SplitterCell,
  type CursorMode,
  type Camera,
  type OrphanedPacket,
} from '../game/types';
import type { GameState } from '../game/state';
import { initGrid } from '../game/grid';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const HALF_GRID = GRID_SIZE / 2;           // 24
const CELL_INSET = 3;
const CELL_INNER = GRID_SIZE - CELL_INSET * 2;  // 42

const BELT_THICKNESS = 6;
const BELT_ARROW_SIZE = 5;
const BELT_ANIM_PERIOD = 500;
const BELT_ARROW_COUNT_MIN = -1;
const BELT_ARROW_COUNT_MAX = 1;

const SPLITTER_INSET = 2;
const SPLITTER_LINE_WIDTH = 3;
const SPLITTER_EDGE_PAD = 4;

const DOT_COUNT = 4;
const DOT_SPACING = 7;
const DOT_RADIUS = 2;
const DOT_MOD = 5;
const DOT_Y_INSET = 9;

const FLASH_DURATION_MS = 300;

const LABEL_MAX_WIDTH = GRID_SIZE - 10;

const PACKET_CORNER_RADIUS = 4;

const BUBBLE_PADDING = 10;
const BUBBLE_HEIGHT = 30;
const BUBBLE_MAX_WIDTH = 300;
const BUBBLE_RADIUS = 6;
const BUBBLE_POINTER_HALF = 6;
const BUBBLE_POINTER_HEIGHT = 8;
const BUBBLE_MARGIN = 5;
const BUBBLE_GAP = 12;
const BUBBLE_FADE_START_MS = 5000;
const BUBBLE_FADE_DURATION_MS = 2000;

const TOOLTIP_PADDING = 10;
const TOOLTIP_LINE_HEIGHT = 16;
const TOOLTIP_MAX_WIDTH = 350;
const TOOLTIP_RADIUS = 6;
const TOOLTIP_BUFFER_TRUNC = 30;
const TOOLTIP_BUFFER_SLICE = 27;

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const CLR_CANVAS_BG       = '#12121f';
const CLR_GRID_LINE       = '#1e1e32';

const CLR_BELT_BG         = '#2a2a3a';
const CLR_BELT_EDGE       = '#3a3a4a';
const CLR_BELT_ARROW      = '#4a4a5a';

const CLR_SPLITTER_BG     = '#3a2a4a';
const CLR_SPLITTER_SYMBOL = '#8a6aaa';

const CLR_CMD_GREEN       = '#33ff33';
const CLR_INPUT_AMBER     = '#ffaa00';
const CLR_DOT_EMPTY       = '#333';

const CLR_PACKET_BG       = '#1a1a2a';
const CLR_PACKET_HEX      = '#666';
const CLR_PACKET_CONTROL  = '#ff9632';
const CLR_PACKET_SPACE    = '#888888';
const CLR_PACKET_LOWER    = '#64c8ff';
const CLR_PACKET_UPPER    = '#64ffc8';
const CLR_PACKET_DIGIT    = '#ffff64';
const CLR_PACKET_EXTENDED = '#c896ff';
const CLR_PACKET_PUNCT    = '#ff96c8';

const CLR_BUBBLE_BG       = '#2a2a4a';
const CLR_BUBBLE_BORDER   = '#6a5acd';
const CLR_BUBBLE_TEXT     = '#fff';

const CLR_TOOLTIP_BG      = '#0a0a0a';
const CLR_TOOLTIP_BORDER  = '#cccccc';
const CLR_TOOLTIP_CMD     = CLR_CMD_GREEN;
const CLR_TOOLTIP_INPUT   = CLR_INPUT_AMBER;
const CLR_TOOLTIP_OUTPUT  = '#cccccc';

// Flash interpolation targets (0x33, 0xff, 0x33) = #33ff33
const FLASH_R = 0x33;
const FLASH_G = 0xff;
const FLASH_B = 0x33;

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const FONT_LABEL          = '11px system-ui, sans-serif';
const FONT_PACKET         = '12px Consolas, monospace';
const FONT_PACKET_TINY    = '7px system-ui';
const FONT_PACKET_SMALL   = '8px system-ui';
const FONT_TOOLTIP        = '12px Consolas, monospace';
const FONT_BUBBLE         = '14px "Segoe UI Emoji", "Noto Color Emoji", system-ui';

// ---------------------------------------------------------------------------
// Machine color map  (hoisted so it's allocated once, not per-frame)
// ---------------------------------------------------------------------------

interface MachineColor { bg: string; border: string; text: string }

const MACHINE_COLORS: Record<MachineType, MachineColor> = {
  [MachineType.SOURCE]:  { bg: '#2a5a2a', border: '#4a8a4a', text: '#ccc' },
  [MachineType.SINK]:    { bg: '#5a2a2a', border: '#8a4a4a', text: '#ccc' },
  [MachineType.COMMAND]: { bg: '#0a0a0a', border: '#cccccc', text: CLR_CMD_GREEN },
  [MachineType.DISPLAY]: { bg: '#5a3a6a', border: '#8a5a9a', text: '#ccc' },
  [MachineType.EMOJI]:   { bg: '#5a5a2a', border: '#8a8a4a', text: '#ccc' },
  [MachineType.NULL]:     { bg: '#2a2a2a', border: '#555555', text: '#888' },
  [MachineType.LINEFEED]: { bg: '#2a4a5a', border: '#4a8aaa', text: '#ccc' },
  [MachineType.FLIPPER]:    { bg: '#2a5a5a', border: '#4a9a9a', text: '#ccc' },
  [MachineType.DUPLICATOR]: { bg: '#5a3a2a', border: '#9a6a4a', text: '#ccc' },
  [MachineType.CONSTANT]:   { bg: '#2a5a4a', border: '#4a9a7a', text: '#ccc' },
  [MachineType.FILTER]:     { bg: '#3a3a2a', border: '#7a7a4a', text: '#ccc' },
  [MachineType.COUNTER]:    { bg: '#2a3a5a', border: '#4a6a9a', text: '#ccc' },
  [MachineType.DELAY]:      { bg: '#4a3a3a', border: '#7a5a5a', text: '#ccc' },
  [MachineType.KEYBOARD]:   { bg: '#4a2a5a', border: '#7a4a9a', text: '#ccc' },
};

// ---------------------------------------------------------------------------
// Control-character name table (allocated once)
// ---------------------------------------------------------------------------

const CTRL_NAMES = [
  'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
  'BS',  'TAB', 'LF',  'VT',  'FF',  'CR',  'SO',  'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
  'CAN', 'EM',  'SUB', 'ESC', 'FS',  'GS',  'RS',  'US',
];

const CLR_FLIPPER_ARROW    = '#4a9a9a';

// ---------------------------------------------------------------------------
// Small pure helpers – all monomorphic, no allocations, V8 will inline these
// ---------------------------------------------------------------------------

/** Grid col/row → pixel origin. */
function gx(col: number): number { return col * GRID_SIZE; }
function gy(row: number): number { return row * GRID_SIZE; }

/** Grid col/row → pixel center. */
function cx(col: number): number { return col * GRID_SIZE + HALF_GRID; }
function cy(row: number): number { return row * GRID_SIZE + HALF_GRID; }

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Clamp n into [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface RendererConfig {
  canvas: HTMLCanvasElement;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationTime = 0;
  private hoveredMachine: Machine | null = null;
  /** Mouse position in world pixels (already inverse-camera-transformed). */
  private mouseX = 0;
  private mouseY = 0;
  private mouseOnCanvas = false;
  private camera: Camera = { x: 0, y: 0, scale: 1 };
  /** fitScale * camera.scale - maps world pixels to screen pixels. */
  private effectiveScale = 1;
  hoverCol = -1;
  hoverRow = -1;

  constructor(config: RendererConfig) {
    this.canvas = config.canvas;
    this.ctx = config.canvas.getContext('2d')!;

    window.addEventListener('resize', () => this.handleResize());

    // Track mouse for hover tooltips and previews - store as world coords
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      // Screen → world using effective scale
      this.mouseX = screenX / this.effectiveScale + this.camera.x;
      this.mouseY = screenY / this.effectiveScale + this.camera.y;
      this.mouseOnCanvas = true;
    });

    this.canvas.addEventListener('mouseenter', () => {
      this.mouseOnCanvas = true;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredMachine = null;
      this.mouseOnCanvas = false;
    });
  }

  updateCursor(mode: CursorMode): void {
    switch (mode) {
      case 'select':
        this.canvas.style.cursor = 'default';
        break;
      case 'erase':
        this.canvas.style.cursor = 'not-allowed';
        break;
      case 'machine':
        this.canvas.style.cursor = 'pointer';
        break;
    }
  }

  handleResize(state?: GameState): void {
    // Reset backing buffer so intrinsic size doesn't prevent the
    // grid cell (and thus clientWidth/Height) from shrinking.
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;

    if (state && (state.gridCols !== GRID_COLS || state.gridRows !== GRID_ROWS)) {
      const oldGrid = state.grid;
      const oldCols = state.gridCols;
      const oldRows = state.gridRows;

      initGrid(state, GRID_COLS, GRID_ROWS);

      for (let x = 0; x < Math.min(GRID_COLS, oldCols); x++) {
        for (let y = 0; y < Math.min(GRID_ROWS, oldRows); y++) {
          if (oldGrid[x] && oldGrid[x][y]) {
            state.grid[x][y] = oldGrid[x][y];
          }
        }
      }
    }
  }

  render(state: GameState, time: number): void {
    this.animationTime = time;
    const ctx = this.ctx;
    const { gridCols, gridRows } = state;
    const cam = state.camera;
    this.camera = cam;

    this.effectiveScale = cam.scale;

    // Clear entire canvas (in screen space, before camera transform)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = CLR_CANVAS_BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply camera transform: world → screen
    const s = cam.scale;
    ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);

    // Grid lines
    ctx.strokeStyle = CLR_GRID_LINE;
    ctx.lineWidth = 1;

    for (let x = 0; x <= gridCols; x++) {
      const px = gx(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, gy(gridRows));
      ctx.stroke();
    }
    for (let y = 0; y <= gridRows; y++) {
      const py = gy(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(gx(gridCols), py);
      ctx.stroke();
    }

    // Cells
    for (let x = 0; x < gridCols; x++) {
      for (let y = 0; y < gridRows; y++) {
        const cell = state.grid[x][y];
        if (cell.type === CellType.BELT) {
          this.drawBelt(x, y, (cell as BeltCell).dir, state.running);
        } else if (cell.type === CellType.SPLITTER) {
          this.drawSplitter(x, y, (cell as SplitterCell).dir);
        }
      }
    }

    // Machines
    for (const machine of state.machines) {
      this.drawMachine(machine);
    }

    // Packets
    for (const packet of state.packets) {
      this.drawPacket(packet);
    }

    // Orphaned packets (falling with gravity)
    for (const op of state.orphanedPackets) {
      this.drawOrphanedPacket(op);
    }

    // Speech bubbles
    for (const machine of state.machines) {
      if (machine.type === MachineType.DISPLAY && machine.displayText) {
        this.drawSpeechBubble(machine);
      }
    }

    // Hover detection (mouseX/mouseY are already in world coords)
    const hoverCol = Math.floor(this.mouseX / GRID_SIZE);
    const hoverRow = Math.floor(this.mouseY / GRID_SIZE);
    this.hoverCol = this.mouseOnCanvas ? hoverCol : -1;
    this.hoverRow = this.mouseOnCanvas ? hoverRow : -1;
    this.hoveredMachine = null;

    for (const machine of state.machines) {
      if (machine.x === hoverCol && machine.y === hoverRow) {
        this.hoveredMachine = machine;
        break;
      }
    }

    if (this.hoveredMachine && this.hoveredMachine.type === MachineType.COMMAND) {
      this.drawMachineTooltip(this.hoveredMachine);
    }

    // Placement preview
    if (this.mouseOnCanvas && state.currentMode === 'machine') {
      this.drawPlacementPreview(state, hoverCol, hoverRow);
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // -------------------------------------------------------------------------
  // Placement preview
  // -------------------------------------------------------------------------

  private drawPlacementPreview(state: GameState, col: number, row: number): void {
    if (col < 0 || col >= state.gridCols || row < 0 || row >= state.gridRows) return;

    const cell = state.grid[col]?.[row];
    if (cell && cell.type === CellType.MACHINE) return;

    const ctx = this.ctx;
    ctx.globalAlpha = 0.5;

    switch (state.currentPlaceable) {
      case 'belt':
        this.drawBelt(col, row, state.currentDir);
        break;
      case 'splitter':
        this.drawSplitter(col, row, state.currentDir);
        break;
      case 'source':
        this.drawMachineBox(col, row, MachineType.SOURCE, 'SRC');
        break;
      case 'command':
        this.drawMachineBox(col, row, MachineType.COMMAND, 'SHL');
        break;
      case 'sink':
        this.drawMachineBox(col, row, MachineType.SINK, 'SINK');
        break;
      case 'display':
        this.drawMachineBox(col, row, MachineType.DISPLAY, 'UTF8');
        break;
      case 'emoji':
        this.drawMachineBox(col, row, MachineType.EMOJI, '🎲');
        break;
      case 'null':
        this.drawMachineBox(col, row, MachineType.NULL, 'NULL');
        break;
      case 'linefeed':
        this.drawMachineBox(col, row, MachineType.LINEFEED, 'LF');
        break;
      case 'flipper':
        this.drawMachineBox(col, row, MachineType.FLIPPER, 'FLIP');
        this.drawDirectionArrow(col, row, state.currentDir);
        break;
      case 'duplicator':
        this.drawMachineBox(col, row, MachineType.DUPLICATOR, 'DUP');
        break;
      case 'constant':
        this.drawMachineBox(col, row, MachineType.CONSTANT, 'LOOP');
        break;
      case 'filter':
        this.drawMachineBox(col, row, MachineType.FILTER, 'FLTR');
        break;
      case 'counter':
        this.drawMachineBox(col, row, MachineType.COUNTER, '0');
        break;
      case 'delay':
        this.drawMachineBox(col, row, MachineType.DELAY, 'DLY');
        break;
      case 'keyboard':
        this.drawMachineBox(col, row, MachineType.KEYBOARD, 'KEY');
        break;
    }

    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Shared machine box  (used by both preview and full drawMachine)
  // -------------------------------------------------------------------------

  private drawMachineBox(col: number, row: number, type: MachineType, label: string): void {
    const px = gx(col);
    const py = gy(row);
    const ctx = this.ctx;
    const color = MACHINE_COLORS[type];

    ctx.fillStyle = color.bg;
    ctx.fillRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

    ctx.strokeStyle = color.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

    ctx.fillStyle = color.text;
    ctx.font = FONT_LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx(col), cy(row));
  }

  // -------------------------------------------------------------------------
  // Belt
  // -------------------------------------------------------------------------

  private drawBelt(col: number, row: number, dir: Direction, running = false): void {
    const px = gx(col);
    const py = gy(row);
    const ctx = this.ctx;
    const isHorizontal = dir === Direction.LEFT || dir === Direction.RIGHT;

    // Belt background
    ctx.fillStyle = CLR_BELT_BG;
    if (isHorizontal) {
      ctx.fillRect(px, py + BELT_THICKNESS, GRID_SIZE, GRID_SIZE - BELT_THICKNESS * 2);
    } else {
      ctx.fillRect(px + BELT_THICKNESS, py, GRID_SIZE - BELT_THICKNESS * 2, GRID_SIZE);
    }

    // Belt edges
    ctx.strokeStyle = CLR_BELT_EDGE;
    ctx.lineWidth = 2;

    if (isHorizontal) {
      ctx.beginPath();
      ctx.moveTo(px, py + BELT_THICKNESS);
      ctx.lineTo(px + GRID_SIZE, py + BELT_THICKNESS);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py + GRID_SIZE - BELT_THICKNESS);
      ctx.lineTo(px + GRID_SIZE, py + GRID_SIZE - BELT_THICKNESS);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(px + BELT_THICKNESS, py);
      ctx.lineTo(px + BELT_THICKNESS, py + GRID_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + GRID_SIZE - BELT_THICKNESS, py);
      ctx.lineTo(px + GRID_SIZE - BELT_THICKNESS, py + GRID_SIZE);
      ctx.stroke();
    }

    // Direction arrows
    const centerX = cx(col);
    const centerY = cy(row);
    const anim = running ? ((this.animationTime / BELT_ANIM_PERIOD) % 1) * HALF_GRID : 0;

    ctx.strokeStyle = CLR_BELT_ARROW;
    ctx.lineWidth = 2;

    for (let i = BELT_ARROW_COUNT_MIN; i <= BELT_ARROW_COUNT_MAX; i++) {
      let offset = i * (GRID_SIZE / 3) + anim;
      if (offset > HALF_GRID) offset -= GRID_SIZE;
      if (offset < -HALF_GRID) offset += GRID_SIZE;

      const s = BELT_ARROW_SIZE;
      let ax: number, ay: number, bx: number, by: number, cx2: number, cy2: number;

      switch (dir) {
        case Direction.RIGHT:
          ax = centerX + offset; ay = centerY;
          bx = ax - s; by = centerY - s;
          cx2 = ax - s; cy2 = centerY + s;
          break;
        case Direction.LEFT:
          ax = centerX - offset; ay = centerY;
          bx = ax + s; by = centerY - s;
          cx2 = ax + s; cy2 = centerY + s;
          break;
        case Direction.DOWN:
          ax = centerX; ay = centerY + offset;
          bx = centerX - s; by = ay - s;
          cx2 = centerX + s; cy2 = ay - s;
          break;
        case Direction.UP:
          ax = centerX; ay = centerY - offset;
          bx = centerX - s; by = ay + s;
          cx2 = centerX + s; cy2 = ay + s;
          break;
      }

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ax, ay);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // Splitter
  // -------------------------------------------------------------------------

  private drawSplitter(col: number, row: number, dir: Direction): void {
    const px = gx(col);
    const py = gy(row);
    const centerX = cx(col);
    const centerY = cy(row);
    const ctx = this.ctx;

    ctx.fillStyle = CLR_SPLITTER_BG;
    ctx.fillRect(px + SPLITTER_INSET, py + SPLITTER_INSET,
      GRID_SIZE - SPLITTER_INSET * 2, GRID_SIZE - SPLITTER_INSET * 2);

    ctx.strokeStyle = CLR_SPLITTER_SYMBOL;
    ctx.lineWidth = SPLITTER_LINE_WIDTH;

    const len = GRID_SIZE / 3;

    ctx.beginPath();
    switch (dir) {
      case Direction.RIGHT:
        ctx.moveTo(px + SPLITTER_EDGE_PAD, centerY);
        ctx.lineTo(centerX, centerY);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + len, centerY - len / 2);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + len, centerY + len / 2);
        break;
      case Direction.LEFT:
        ctx.moveTo(px + GRID_SIZE - SPLITTER_EDGE_PAD, centerY);
        ctx.lineTo(centerX, centerY);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX - len, centerY - len / 2);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX - len, centerY + len / 2);
        break;
      case Direction.DOWN:
        ctx.moveTo(centerX, py + SPLITTER_EDGE_PAD);
        ctx.lineTo(centerX, centerY);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX - len / 2, centerY + len);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + len / 2, centerY + len);
        break;
      case Direction.UP:
        ctx.moveTo(centerX, py + GRID_SIZE - SPLITTER_EDGE_PAD);
        ctx.lineTo(centerX, centerY);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX - len / 2, centerY - len);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + len / 2, centerY - len);
        break;
    }
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // Machine (full, with indicators)
  // -------------------------------------------------------------------------

  private drawMachine(machine: Machine): void {
    const px = gx(machine.x);
    const py = gy(machine.y);
    const ctx = this.ctx;
    const color = MACHINE_COLORS[machine.type];

    // Box
    ctx.fillStyle = color.bg;
    ctx.fillRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

    ctx.strokeStyle = color.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

    // Auto-start indicator
    if (machine.type === MachineType.COMMAND && machine.autoStart) {
      ctx.fillStyle = CLR_CMD_GREEN;
      ctx.beginPath();
      ctx.moveTo(px + GRID_SIZE - 5, py + 4);
      ctx.lineTo(px + GRID_SIZE - 5, py + 12);
      ctx.lineTo(px + GRID_SIZE - 13, py + 4);
      ctx.fill();
    }

    // Label (flipper and filter draw a mini packet instead)
    if (machine.type === MachineType.FLIPPER) {
      this.drawMiniPacket(cx(machine.x), cy(machine.y), machine.flipperTrigger);
    } else if (machine.type === MachineType.FILTER) {
      this.drawMiniPacket(cx(machine.x), cy(machine.y), machine.filterByte);
    } else {
      let label: string;
      switch (machine.type) {
        case MachineType.SOURCE:  label = 'SRC';  break;
        case MachineType.SINK:    label = 'SINK'; break;
        case MachineType.DISPLAY: label = 'UTF8'; break;
        case MachineType.COMMAND: label = machine.command.split(/\s+/)[0]; break;
        case MachineType.EMOJI:   label = '🎲';   break;
        case MachineType.NULL:     label = 'NULL'; break;
        case MachineType.LINEFEED:   label = 'LF';   break;
        case MachineType.DUPLICATOR: label = 'DUP';  break;
        case MachineType.CONSTANT:   label = 'LOOP'; break;
        case MachineType.COUNTER:    label = String(machine.counterCount); break;
        case MachineType.DELAY:      label = 'DLY';  break;
        case MachineType.KEYBOARD:   label = 'KEY';  break;
      }

      // Flash effect for command machines: white → green over FLASH_DURATION_MS
      if (machine.type === MachineType.COMMAND && machine.lastCommandTime > 0) {
        const elapsed = performance.now() - machine.lastCommandTime;
        if (elapsed < FLASH_DURATION_MS) {
          const t = elapsed / FLASH_DURATION_MS;
          const r = Math.round(lerp(255, FLASH_R, t));
          const g = Math.round(lerp(255, FLASH_G, t));
          const b = Math.round(lerp(255, FLASH_B, t));
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = color.text;
        }
      } else {
        ctx.fillStyle = color.text;
      }

      ctx.font = FONT_LABEL;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Truncate label if too wide
      if (ctx.measureText(label).width > LABEL_MAX_WIDTH) {
        while (ctx.measureText(label + '…').width > LABEL_MAX_WIDTH && label.length > 1) {
          label = label.slice(0, -1);
        }
        label += '…';
      }

      ctx.fillText(label, cx(machine.x), cy(machine.y));
    }

    // Buffer indicator dots for command machines
    if (machine.type === MachineType.COMMAND) {
      this.drawBufferDots(px, py, machine);
    }

    // Direction arrow for flipper machines
    if (machine.type === MachineType.FLIPPER) {
      this.drawDirectionArrow(machine.x, machine.y, machine.flipperState as Direction);
    }
  }

  // -------------------------------------------------------------------------
  // Buffer dots (command machine)
  // -------------------------------------------------------------------------

  private drawBufferDots(px: number, py: number, machine: Machine): void {
    const ctx = this.ctx;
    const totalWidth = (DOT_COUNT - 1) * DOT_SPACING;
    const startX = px + HALF_GRID - totalWidth / 2;

    const inputFilled = machine.pendingInput.length % DOT_MOD;

    // Input dots (bottom)
    const botY = py + GRID_SIZE - DOT_Y_INSET;
    for (let i = 0; i < DOT_COUNT; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * DOT_SPACING, botY, DOT_RADIUS, 0, Math.PI * 2);
      if (i < inputFilled) {
        ctx.fillStyle = CLR_INPUT_AMBER;
        ctx.fill();
      } else {
        ctx.strokeStyle = CLR_DOT_EMPTY;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Direction arrow (flipper machines + placement preview)
  // -------------------------------------------------------------------------

  private drawDirectionArrow(col: number, row: number, dir: Direction): void {
    const ctx = this.ctx;
    const px = gx(col);
    const py = gy(row);
    const centerX = cx(col);
    const centerY = cy(row);
    const s = 5;

    ctx.fillStyle = CLR_FLIPPER_ARROW;
    ctx.beginPath();

    switch (dir) {
      case Direction.RIGHT: {
        const ex = px + GRID_SIZE - CELL_INSET;
        ctx.moveTo(ex, centerY - s);
        ctx.lineTo(ex + s, centerY);
        ctx.lineTo(ex, centerY + s);
        break;
      }
      case Direction.DOWN: {
        const ey = py + GRID_SIZE - CELL_INSET;
        ctx.moveTo(centerX - s, ey);
        ctx.lineTo(centerX, ey + s);
        ctx.lineTo(centerX + s, ey);
        break;
      }
      case Direction.LEFT: {
        const ex = px + CELL_INSET;
        ctx.moveTo(ex, centerY - s);
        ctx.lineTo(ex - s, centerY);
        ctx.lineTo(ex, centerY + s);
        break;
      }
      case Direction.UP: {
        const ey = py + CELL_INSET;
        ctx.moveTo(centerX - s, ey);
        ctx.lineTo(centerX, ey - s);
        ctx.lineTo(centerX + s, ey);
        break;
      }
    }

    ctx.closePath();
    ctx.fill();
  }

  // -------------------------------------------------------------------------
  // Mini packet (rendered inside machine box)
  // -------------------------------------------------------------------------

  private drawMiniPacket(px: number, py: number, char: string): void {
    const ctx = this.ctx;
    const code = char.charCodeAt(0);
    const isMultibyte = code > 127;
    const color = this.packetColor(code);
    const size = PACKET_SIZE / 2 - 2;

    // Shape background + border
    ctx.fillStyle = CLR_PACKET_BG;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (isMultibyte) {
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px, py + size);
      ctx.lineTo(px - size, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(px - size, py - size, size * 2, size * 2, 3);
      ctx.fill();
      ctx.stroke();
    }

    // Character label
    ctx.fillStyle = color;
    ctx.font = FONT_PACKET;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let display = char;
    if (code < 32) {
      display = CTRL_NAMES[code];
      ctx.font = FONT_PACKET_TINY;
    } else if (code === 32) {
      display = 'SP';
      ctx.font = FONT_PACKET_SMALL;
    } else if (code === 127) {
      display = 'DEL';
      ctx.font = FONT_PACKET_TINY;
    }

    ctx.fillText(display, px, py);
  }

  // -------------------------------------------------------------------------
  // Packet
  // -------------------------------------------------------------------------

  private drawPacket(packet: Packet): void {
    const px = gx(packet.x) + packet.offsetX;
    const py = gy(packet.y) + packet.offsetY;
    const ctx = this.ctx;

    const char = packet.content;
    const code = char.charCodeAt(0);

    const isMultibyte = code > 127;
    const color = this.packetColor(code);
    const size = PACKET_SIZE / 2;

    // Shape background + border
    ctx.fillStyle = CLR_PACKET_BG;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (isMultibyte) {
      // Diamond for multi-byte UTF-8
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px, py + size);
      ctx.lineTo(px - size, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Rounded square for single-byte
      ctx.beginPath();
      ctx.roundRect(px - size, py - size, size * 2, size * 2, PACKET_CORNER_RADIUS);
      ctx.fill();
      ctx.stroke();
    }

    // Character label
    ctx.fillStyle = color;
    ctx.font = FONT_PACKET;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let display = char;
    if (code < 32) {
      display = CTRL_NAMES[code];
      ctx.font = FONT_PACKET_TINY;
    } else if (code === 32) {
      display = 'SP';
      ctx.font = FONT_PACKET_SMALL;
    } else if (code === 127) {
      display = 'DEL';
      ctx.font = FONT_PACKET_TINY;
    }

    ctx.fillText(display, px, py - 2);

    // Hex value
    ctx.fillStyle = CLR_PACKET_HEX;
    ctx.font = FONT_PACKET_SMALL;
    ctx.fillText(code.toString(16).toUpperCase().padStart(2, '0'), px, py + 8);
  }

  /** Packet color by char code. Pure, monomorphic, no allocations. */
  private packetColor(code: number): string {
    if (code < 32 || code === 127) return CLR_PACKET_CONTROL;
    if (code === 32)               return CLR_PACKET_SPACE;
    if (code >= 97 && code <= 122) return CLR_PACKET_LOWER;
    if (code >= 65 && code <= 90)  return CLR_PACKET_UPPER;
    if (code >= 48 && code <= 57)  return CLR_PACKET_DIGIT;
    if (code > 127)                return CLR_PACKET_EXTENDED;
    return CLR_PACKET_PUNCT;
  }

  // -------------------------------------------------------------------------
  // Orphaned packet (falling with gravity)
  // -------------------------------------------------------------------------

  private drawOrphanedPacket(op: OrphanedPacket): void {
    const px = op.worldX;
    const py = op.worldY;
    const ctx = this.ctx;

    const char = op.content;
    const code = char.charCodeAt(0);
    const isMultibyte = code > 127;
    const color = this.packetColor(code);
    const size = PACKET_SIZE / 2;

    // Fade out after 2s
    const fadeStart = 2000;
    const fadeDuration = 1000;
    if (op.age > fadeStart) {
      ctx.globalAlpha = Math.max(0, 1 - (op.age - fadeStart) / fadeDuration);
    }

    ctx.fillStyle = CLR_PACKET_BG;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (isMultibyte) {
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px, py + size);
      ctx.lineTo(px - size, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(px - size, py - size, size * 2, size * 2, PACKET_CORNER_RADIUS);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.font = FONT_PACKET;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let display = char;
    if (code < 32) {
      display = CTRL_NAMES[code];
      ctx.font = FONT_PACKET_TINY;
    } else if (code === 32) {
      display = 'SP';
      ctx.font = FONT_PACKET_SMALL;
    } else if (code === 127) {
      display = 'DEL';
      ctx.font = FONT_PACKET_TINY;
    }

    ctx.fillText(display, px, py - 2);

    ctx.fillStyle = CLR_PACKET_HEX;
    ctx.font = FONT_PACKET_SMALL;
    ctx.fillText(code.toString(16).toUpperCase().padStart(2, '0'), px, py + 8);

    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Speech bubble (display machines)
  // -------------------------------------------------------------------------

  private drawSpeechBubble(machine: Machine): void {
    const age = performance.now() - machine.displayTime;
    const ctx = this.ctx;

    let alpha = 1;
    if (age > BUBBLE_FADE_START_MS) {
      alpha = 1 - (age - BUBBLE_FADE_START_MS) / BUBBLE_FADE_DURATION_MS;
      if (alpha <= 0) {
        machine.displayText = '';
        return;
      }
    }

    const text = machine.displayText;
    const mx = cx(machine.x);
    const my = gy(machine.y);

    ctx.font = FONT_BUBBLE;
    const metrics = ctx.measureText(text);
    const bubbleWidth = Math.min(metrics.width + BUBBLE_PADDING * 2, BUBBLE_MAX_WIDTH);

    let bubbleX = mx - bubbleWidth / 2;
    let bubbleY = my - BUBBLE_HEIGHT - BUBBLE_GAP;

    // Keep on screen (convert canvas bounds to world coords via effective scale)
    const es = this.effectiveScale;
    const visLeft = this.camera.x + BUBBLE_MARGIN / es;
    const visRight = this.camera.x + this.canvas.width / es - bubbleWidth - BUBBLE_MARGIN / es;
    const visTop = this.camera.y + BUBBLE_MARGIN / es;
    bubbleX = clamp(bubbleX, visLeft, visRight);
    if (bubbleY < visTop) bubbleY = my + GRID_SIZE + BUBBLE_GAP;

    ctx.globalAlpha = alpha;

    // Background
    ctx.fillStyle = CLR_BUBBLE_BG;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, BUBBLE_HEIGHT, BUBBLE_RADIUS);
    ctx.fill();

    // Border
    ctx.strokeStyle = CLR_BUBBLE_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pointer
    ctx.fillStyle = CLR_BUBBLE_BG;
    ctx.beginPath();
    if (bubbleY < my) {
      ctx.moveTo(mx - BUBBLE_POINTER_HALF, bubbleY + BUBBLE_HEIGHT);
      ctx.lineTo(mx + BUBBLE_POINTER_HALF, bubbleY + BUBBLE_HEIGHT);
      ctx.lineTo(mx, bubbleY + BUBBLE_HEIGHT + BUBBLE_POINTER_HEIGHT);
    } else {
      ctx.moveTo(mx - BUBBLE_POINTER_HALF, bubbleY);
      ctx.lineTo(mx + BUBBLE_POINTER_HALF, bubbleY);
      ctx.lineTo(mx, bubbleY - BUBBLE_POINTER_HEIGHT);
    }
    ctx.fill();

    // Text
    ctx.fillStyle = CLR_BUBBLE_TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bubbleX + bubbleWidth / 2, bubbleY + BUBBLE_HEIGHT / 2,
      bubbleWidth - BUBBLE_PADDING * 2);

    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Machine tooltip (command machines)
  // -------------------------------------------------------------------------

  private drawMachineTooltip(machine: Machine): void {
    const ctx = this.ctx;
    const mx = cx(machine.x);
    const my = gy(machine.y);

    const cwd = machine.cwd || '/';
    const command = machine.command || 'cat';

    const lines: string[] = [];
    lines.push(`${cwd} $ ${command}`);

    const inputBuffer = machine.pendingInput || '';
    if (inputBuffer.length > 0) {
      const display = inputBuffer.length > TOOLTIP_BUFFER_TRUNC
        ? inputBuffer.slice(0, TOOLTIP_BUFFER_SLICE) + '...'
        : inputBuffer;
      lines.push(`> ${display.replace(/\n/g, '↵').replace(/\r/g, '')}`);
    } else {
      lines.push('>');
    }

    const outputBuffer = machine.outputBuffer || '';
    if (outputBuffer.length > 0) {
      const display = outputBuffer.length > TOOLTIP_BUFFER_TRUNC
        ? outputBuffer.slice(0, TOOLTIP_BUFFER_SLICE) + '...'
        : outputBuffer;
      lines.push(`< ${display.replace(/\n/g, '↵').replace(/\r/g, '')}`);
    } else {
      lines.push('<');
    }

    // Measure
    ctx.font = FONT_TOOLTIP;
    let maxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }

    const bubbleWidth = Math.min(maxWidth + TOOLTIP_PADDING * 2, TOOLTIP_MAX_WIDTH);
    const bubbleHeight = lines.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING * 2;

    let bubbleX = mx - bubbleWidth / 2;
    let bubbleY = my - bubbleHeight - BUBBLE_GAP;

    const ttEs = this.effectiveScale;
    const ttVisLeft = this.camera.x + BUBBLE_MARGIN / ttEs;
    const ttVisRight = this.camera.x + this.canvas.width / ttEs - bubbleWidth - BUBBLE_MARGIN / ttEs;
    const ttVisTop = this.camera.y + BUBBLE_MARGIN / ttEs;
    bubbleX = clamp(bubbleX, ttVisLeft, ttVisRight);
    if (bubbleY < ttVisTop) bubbleY = my + GRID_SIZE + BUBBLE_GAP;

    // Background
    ctx.fillStyle = CLR_TOOLTIP_BG;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, TOOLTIP_RADIUS);
    ctx.fill();

    // Border
    ctx.strokeStyle = CLR_TOOLTIP_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pointer
    ctx.fillStyle = CLR_TOOLTIP_BG;
    ctx.beginPath();
    if (bubbleY < my) {
      ctx.moveTo(mx - BUBBLE_POINTER_HALF, bubbleY + bubbleHeight);
      ctx.lineTo(mx + BUBBLE_POINTER_HALF, bubbleY + bubbleHeight);
      ctx.lineTo(mx, bubbleY + bubbleHeight + BUBBLE_POINTER_HEIGHT);
    } else {
      ctx.moveTo(mx - BUBBLE_POINTER_HALF, bubbleY);
      ctx.lineTo(mx + BUBBLE_POINTER_HALF, bubbleY);
      ctx.lineTo(mx, bubbleY - BUBBLE_POINTER_HEIGHT);
    }
    ctx.fill();

    // Lines
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ly = bubbleY + TOOLTIP_PADDING + i * TOOLTIP_LINE_HEIGHT;

      if (i === 0) {
        ctx.fillStyle = CLR_TOOLTIP_CMD;
      } else if (line.startsWith('>')) {
        ctx.fillStyle = CLR_TOOLTIP_INPUT;
      } else {
        ctx.fillStyle = CLR_TOOLTIP_OUTPUT;
      }

      ctx.fillText(line, bubbleX + TOOLTIP_PADDING, ly, bubbleWidth - TOOLTIP_PADDING * 2);
    }
  }

  // -------------------------------------------------------------------------
  // Public helpers
  // -------------------------------------------------------------------------

  getGridPosition(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    // Screen → world → grid (using effective scale = fitScale * cam.scale)
    const worldX = screenX / this.effectiveScale + this.camera.x;
    const worldY = screenY / this.effectiveScale + this.camera.y;
    const x = Math.floor(worldX / GRID_SIZE);
    const y = Math.floor(worldY / GRID_SIZE);
    return { x, y };
  }
}
