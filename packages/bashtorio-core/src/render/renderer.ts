import {
  GRID_COLS,
  GRID_ROWS,
  GRID_SIZE,
  PACKET_SIZE,
  Direction,
  CellType,
  MachineType,
  type Machine,
  type CommandMachine,
  type PackerMachine,
  type SourceMachine,
  type SinkMachine,
  type DisplayMachine,
  type RouterMachine,
  type ReplaceMachine,
  type MathMachine,
  type WirelessMachine,
  type Packet,
  type BeltCell,
  type SplitterMachine,
  type SevenSegMachine,
  type CursorMode,
  type Camera,
  type OrphanedPacket,
} from '../game/types';
import type { ColorTheme, MachineColor } from '../util/themes';
import type { GameState } from '../game/state';
import { initGrid, getSplitterSecondary } from '../game/grid';

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
// Color palette  (mutable - updated by applyRendererTheme)
// ---------------------------------------------------------------------------

let CLR_CANVAS_BG       = '#12121f';
let CLR_GRID_LINE       = '#1e1e32';

let CLR_BELT_BG         = '#2a2a3a';
let CLR_BELT_EDGE       = '#3a3a4a';
let CLR_BELT_ARROW      = '#4a4a5a';

let CLR_SPLITTER_BG     = '#3a2a4a';
let CLR_SPLITTER_SYMBOL = '#8a6aaa';

let CLR_CMD_GREEN       = '#33ff33';
let CLR_INPUT_AMBER     = '#ffaa00';
let CLR_DOT_EMPTY       = '#333';

let CLR_PACKET_BG       = '#1a1a2a';
let CLR_PACKET_HEX      = '#666';
let CLR_PACKET_CONTROL  = '#ff9632';
let CLR_PACKET_SPACE    = '#888888';
let CLR_PACKET_LOWER    = '#64c8ff';
let CLR_PACKET_UPPER    = '#64ffc8';
let CLR_PACKET_DIGIT    = '#ffff64';
let CLR_PACKET_EXTENDED = '#c896ff';
let CLR_PACKET_PUNCT    = '#ff96c8';

let CLR_BUBBLE_BG       = '#2a2a4a';
let CLR_BUBBLE_BORDER   = '#6a5acd';
let CLR_BUBBLE_TEXT     = '#fff';

let CLR_TOOLTIP_BG      = '#0a0a0a';
let CLR_TOOLTIP_BORDER  = '#cccccc';
let CLR_TOOLTIP_CMD     = '#33ff33';
let CLR_TOOLTIP_INPUT   = '#ffaa00';
let CLR_TOOLTIP_OUTPUT  = '#cccccc';

// Flash interpolation targets
let FLASH_R = 0x33;
let FLASH_G = 0xff;
let FLASH_B = 0x33;

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

let MACHINE_COLORS: Record<MachineType, MachineColor> = {
  [MachineType.SOURCE]:  { bg: '#2a5a2a', border: '#4a8a4a', text: '#ccc' },
  [MachineType.SINK]:    { bg: '#5a2a2a', border: '#8a4a4a', text: '#ccc' },
  [MachineType.COMMAND]: { bg: '#0a0a0a', border: '#cccccc', text: CLR_CMD_GREEN },
  [MachineType.DISPLAY]: { bg: '#5a3a6a', border: '#8a5a9a', text: '#ccc' },
  [MachineType.NULL]:     { bg: '#2a2a2a', border: '#555555', text: '#888' },
  [MachineType.LINEFEED]: { bg: '#2a4a5a', border: '#4a8aaa', text: '#ccc' },
  [MachineType.FLIPPER]:    { bg: '#2a5a5a', border: '#4a9a9a', text: '#ccc' },
  [MachineType.DUPLICATOR]: { bg: '#5a3a2a', border: '#9a6a4a', text: '#ccc' },
  [MachineType.CONSTANT]:   { bg: '#2a5a4a', border: '#4a9a7a', text: '#ccc' },
  [MachineType.FILTER]:     { bg: '#3a3a2a', border: '#7a7a4a', text: '#ccc' },
  [MachineType.COUNTER]:    { bg: '#2a3a5a', border: '#4a6a9a', text: '#ccc' },
  [MachineType.DELAY]:      { bg: '#4a3a3a', border: '#7a5a5a', text: '#ccc' },
  [MachineType.KEYBOARD]:   { bg: '#4a2a5a', border: '#7a4a9a', text: '#ccc' },
  [MachineType.PACKER]:     { bg: '#3a2a4a', border: '#6a4a8a', text: '#ccc' },
  [MachineType.UNPACKER]:   { bg: '#4a2a3a', border: '#8a4a6a', text: '#ccc' },
  [MachineType.ROUTER]:     { bg: '#5a3a2a', border: '#9a6a4a', text: '#ccc' },
  [MachineType.GATE]:       { bg: '#5a2a2a', border: '#8a4a4a', text: '#ccc' },
  [MachineType.WIRELESS]:   { bg: '#2a5a5a', border: '#4a9a9a', text: '#ccc' },
  [MachineType.REPLACE]:    { bg: '#5a5a2a', border: '#8a8a4a', text: '#ccc' },
  [MachineType.MATH]:       { bg: '#2a5a2a', border: '#4a8a4a', text: '#ccc' },
  [MachineType.CLOCK]:      { bg: '#5a2a4a', border: '#8a4a7a', text: '#ccc' },
  [MachineType.LATCH]:      { bg: '#2a3a5a', border: '#4a6a9a', text: '#ccc' },
  [MachineType.MERGER]:     { bg: '#3a2a4a', border: '#6a4a8a', text: '#ccc' },
  [MachineType.SPLITTER]:   { bg: '#3a2a4a', border: '#8a6aaa', text: '#ccc' },
  [MachineType.SEVENSEG]:   { bg: '#000000', border: '#ffffff', text: '#ff0000' },
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

let CLR_FLIPPER_ARROW    = '#4a9a9a';

// ---------------------------------------------------------------------------
// Theme application
// ---------------------------------------------------------------------------

export function applyRendererTheme(theme: ColorTheme): void {
  CLR_CANVAS_BG       = theme.canvasBg;
  CLR_GRID_LINE       = theme.gridLine;
  CLR_BELT_BG         = theme.beltBg;
  CLR_BELT_EDGE       = theme.beltEdge;
  CLR_BELT_ARROW      = theme.beltArrow;
  CLR_SPLITTER_BG     = theme.splitterBg;
  CLR_SPLITTER_SYMBOL = theme.splitterSymbol;
  CLR_CMD_GREEN       = theme.cmdGreen;
  CLR_INPUT_AMBER     = theme.inputAmber;
  CLR_DOT_EMPTY       = theme.dotEmpty;
  CLR_FLIPPER_ARROW   = theme.flipperArrow;
  FLASH_R             = theme.flashR;
  FLASH_G             = theme.flashG;
  FLASH_B             = theme.flashB;
  CLR_PACKET_BG       = theme.packetBg;
  CLR_PACKET_HEX      = theme.packetHex;
  CLR_PACKET_CONTROL  = theme.packetControl;
  CLR_PACKET_SPACE    = theme.packetSpace;
  CLR_PACKET_LOWER    = theme.packetLower;
  CLR_PACKET_UPPER    = theme.packetUpper;
  CLR_PACKET_DIGIT    = theme.packetDigit;
  CLR_PACKET_EXTENDED = theme.packetExtended;
  CLR_PACKET_PUNCT    = theme.packetPunct;
  CLR_BUBBLE_BG       = theme.bubbleBg;
  CLR_BUBBLE_BORDER   = theme.bubbleBorder;
  CLR_BUBBLE_TEXT     = theme.bubbleText;
  CLR_TOOLTIP_BG      = theme.tooltipBg;
  CLR_TOOLTIP_BORDER  = theme.tooltipBorder;
  CLR_TOOLTIP_CMD     = theme.tooltipCmd;
  CLR_TOOLTIP_INPUT   = theme.tooltipInput;
  CLR_TOOLTIP_OUTPUT  = theme.tooltipOutput;
  MACHINE_COLORS      = theme.machineColors;
}

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

/** Format a byte count as a human-readable string (B, KB, MB, GB). */
function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

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
      if (machine.type === MachineType.SPLITTER) {
        const sec = getSplitterSecondary(machine as SplitterMachine);
        if (sec.x === hoverCol && sec.y === hoverRow) {
          this.hoveredMachine = machine;
          break;
        }
      }
    }

    if (this.hoveredMachine && this.hoveredMachine.type === MachineType.COMMAND) {
      this.drawMachineTooltip(this.hoveredMachine);
    } else if (this.hoveredMachine && this.hoveredMachine.type === MachineType.SOURCE) {
      this.drawSourceTooltip(this.hoveredMachine);
    }

    // Placement preview
    if (this.mouseOnCanvas && state.currentMode === 'machine') {
      this.drawPlacementPreview(state, hoverCol, hoverRow);
    }

    // Cursor coordinates label
    if (this.mouseOnCanvas && hoverCol >= 0 && hoverCol < state.gridCols && hoverRow >= 0 && hoverRow < state.gridRows) {
      this.drawCursorCoords(state, hoverCol, hoverRow);
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
      case 'splitter': {
        const sec = getSplitterSecondary({ dir: state.currentDir, x: col, y: row });
        if (sec.x >= 0 && sec.x < state.gridCols && sec.y >= 0 && sec.y < state.gridRows) {
          const sec_cell = state.grid[sec.x]?.[sec.y];
          if (!sec_cell || sec_cell.type === CellType.MACHINE) break;
          this.drawSplitterMachine({ x: col, y: row, dir: state.currentDir } as SplitterMachine);
        }
        break;
      }
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
      case 'packer':
        this.drawMachineBox(col, row, MachineType.PACKER, 'PACK');
        this.drawDirectionArrow(col, row, state.currentDir);
        break;
      case 'unpacker':
        this.drawMachineBox(col, row, MachineType.UNPACKER, 'UNPK');
        break;
      case 'router':
        this.drawMachineBox(col, row, MachineType.ROUTER, 'RTR');
        this.drawDirectionArrow(col, row, state.currentDir);
        break;
      case 'gate':
        this.drawMachineBox(col, row, MachineType.GATE, 'GATE');
        break;
      case 'wireless':
        this.drawMachineBox(col, row, MachineType.WIRELESS, 'W0');
        break;
      case 'replace':
        this.drawMachineBox(col, row, MachineType.REPLACE, 'RPL');
        break;
      case 'math':
        this.drawMachineBox(col, row, MachineType.MATH, '+1');
        break;
      case 'clock':
        this.drawMachineBox(col, row, MachineType.CLOCK, 'CLK');
        break;
      case 'latch':
        this.drawMachineBox(col, row, MachineType.LATCH, 'LAT');
        break;
      case 'merger':
        this.drawMachineBox(col, row, MachineType.MERGER, 'MRG');
        break;
      case 'sevenseg':
        this.drawMachineBox(col, row, MachineType.SEVENSEG, '7SEG');
        break;
    }

    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Cursor coordinates label
  // -------------------------------------------------------------------------

  private drawCursorCoords(_state: GameState, col: number, row: number): void {
    const ctx = this.ctx;
    const label = `${col}, ${row}`;

    ctx.font = '10px Consolas, monospace';
    const metrics = ctx.measureText(label);
    const textW = metrics.width;
    const textH = 10;
    const padX = 3;
    const padY = 2;
    const gap = 2;

    // Position at bottom-right corner of the hovered grid cell, offset outside
    const x = (col + 1) * GRID_SIZE + gap;
    const y = (row + 1) * GRID_SIZE + gap;

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - padX, y - padY, textW + padX * 2, textH + padY * 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y);
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
    const spacing = GRID_SIZE / 3;
    const anim = running ? ((this.animationTime / BELT_ANIM_PERIOD) % 1) * spacing : 0;

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

  private drawSplitterMachine(machine: { x: number; y: number; dir: Direction }): void {
    const sec = getSplitterSecondary(machine);
    const ctx = this.ctx;
    const dir = machine.dir;
    const isHorizontal = dir === Direction.RIGHT || dir === Direction.LEFT;

    // Bounding rect spanning both cells
    const px = gx(Math.min(machine.x, sec.x));
    const py = gy(Math.min(machine.y, sec.y));
    const w = isHorizontal ? GRID_SIZE : GRID_SIZE * 2;
    const h = isHorizontal ? GRID_SIZE * 2 : GRID_SIZE;

    // Background
    ctx.fillStyle = CLR_SPLITTER_BG;
    ctx.fillRect(px + SPLITTER_INSET, py + SPLITTER_INSET,
      w - SPLITTER_INSET * 2, h - SPLITTER_INSET * 2);

    // Border
    ctx.strokeStyle = CLR_SPLITTER_SYMBOL;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + SPLITTER_INSET, py + SPLITTER_INSET,
      w - SPLITTER_INSET * 2, h - SPLITTER_INSET * 2);

    // Y-fork symbol centered in combined area
    const midX = px + w / 2;
    const midY = py + h / 2;
    const len = GRID_SIZE / 3;

    ctx.strokeStyle = CLR_SPLITTER_SYMBOL;
    ctx.lineWidth = SPLITTER_LINE_WIDTH;
    ctx.beginPath();

    switch (dir) {
      case Direction.RIGHT:
        // Input from left, fork to upper-right and lower-right
        ctx.moveTo(midX - len, midY);
        ctx.lineTo(midX, midY);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + len, midY - len);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + len, midY + len);
        break;
      case Direction.LEFT:
        ctx.moveTo(midX + len, midY);
        ctx.lineTo(midX, midY);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX - len, midY - len);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX - len, midY + len);
        break;
      case Direction.DOWN:
        ctx.moveTo(midX, midY - len);
        ctx.lineTo(midX, midY);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX - len, midY + len);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + len, midY + len);
        break;
      case Direction.UP:
        ctx.moveTo(midX, midY + len);
        ctx.lineTo(midX, midY);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX - len, midY - len);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + len, midY - len);
        break;
    }
    ctx.stroke();

    // Label
    ctx.fillStyle = '#ccc';
    ctx.font = FONT_LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPLT', midX, midY + len + 10);
  }

  // -------------------------------------------------------------------------
  // Seven-segment display
  // -------------------------------------------------------------------------

  private drawSevenSeg(machine: SevenSegMachine): void {
    const px = gx(machine.x);
    const py = gy(machine.y);
    const ctx = this.ctx;

    // Black background + white border
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

    // Segment map: standard 7-seg a-g, bitmask per hex digit
    //   a=0x01 (top), b=0x02 (top-right), c=0x04 (bottom-right),
    //   d=0x08 (bottom), e=0x10 (bottom-left), f=0x20 (top-left), g=0x40 (middle)
    const SEGS: Record<string, number> = {
      '0': 0x3F, '1': 0x06, '2': 0x5B, '3': 0x4F,
      '4': 0x66, '5': 0x6D, '6': 0x7D, '7': 0x07,
      '8': 0x7F, '9': 0x6F, 'A': 0x77, 'B': 0x7C,
      'C': 0x39, 'D': 0x5E, 'E': 0x79, 'F': 0x71,
    };

    // Map lastByte to hex digit
    let mask = 0;
    if (machine.lastByte >= 0) {
      const hexStr = machine.lastByte.toString(16).toUpperCase();
      // Show last hex digit
      const digit = hexStr[hexStr.length - 1];
      mask = SEGS[digit] ?? 0;
    }

    // Segment geometry scaled to cell interior
    const inset = 8;
    const sx = px + CELL_INSET + inset;
    const sy = py + CELL_INSET + inset;
    const sw = CELL_INNER - inset * 2;    // segment area width
    const sh = CELL_INNER - inset * 2;    // segment area height
    const hmid = sh / 2;                  // vertical midpoint

    ctx.lineCap = 'round';
    ctx.lineWidth = 3;

    // Draw each segment: lit = red, unlit = very dark gray
    const drawSeg = (bit: number, x1: number, y1: number, x2: number, y2: number) => {
      ctx.strokeStyle = (mask & bit) ? '#ff0000' : '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const m = 2; // margin from corners
    // a: top horizontal
    drawSeg(0x01, sx + m, sy, sx + sw - m, sy);
    // b: top-right vertical
    drawSeg(0x02, sx + sw, sy + m, sx + sw, sy + hmid - m);
    // c: bottom-right vertical
    drawSeg(0x04, sx + sw, sy + hmid + m, sx + sw, sy + sh - m);
    // d: bottom horizontal
    drawSeg(0x08, sx + m, sy + sh, sx + sw - m, sy + sh);
    // e: bottom-left vertical
    drawSeg(0x10, sx, sy + hmid + m, sx, sy + sh - m);
    // f: top-left vertical
    drawSeg(0x20, sx, sy + m, sx, sy + hmid - m);
    // g: middle horizontal
    drawSeg(0x40, sx + m, sy + hmid, sx + sw - m, sy + hmid);
  }

  // -------------------------------------------------------------------------
  // Machine (full, with indicators)
  // -------------------------------------------------------------------------

  private drawMachine(machine: Machine): void {
    // Splitter: draw 2-cell shape and skip standard box
    if (machine.type === MachineType.SPLITTER) {
      this.drawSplitterMachine(machine as SplitterMachine);
      return;
    }

    // Seven-segment display: custom rendering
    if (machine.type === MachineType.SEVENSEG) {
      this.drawSevenSeg(machine as SevenSegMachine);
      return;
    }

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

    // Label (filter/counter/router/replace draw a mini packet instead)
    if (machine.type === MachineType.FILTER) {
      this.drawMiniPacket(cx(machine.x), cy(machine.y), machine.filterByte);
    } else if (machine.type === MachineType.ROUTER) {
      this.drawMiniPacket(cx(machine.x), cy(machine.y), (machine as RouterMachine).routerByte);
    } else if (machine.type === MachineType.REPLACE) {
      const rm = machine as ReplaceMachine;
      this.drawMiniPacket(cx(machine.x) - 8, cy(machine.y), rm.replaceFrom);
      this.drawMiniPacket(cx(machine.x) + 8, cy(machine.y), rm.replaceTo);
    } else if (machine.type === MachineType.COUNTER) {
      this.drawMiniPacket(cx(machine.x), cy(machine.y) - 6, machine.counterTrigger);
      ctx.fillStyle = color.text;
      ctx.font = FONT_PACKET_SMALL;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(machine.counterCount), cx(machine.x), cy(machine.y) + 10);
    } else {
      let label: string;
      switch (machine.type) {
        case MachineType.SOURCE:  label = 'SRC';  break;
        case MachineType.SINK: {
          const sinkName = (machine as SinkMachine).name;
          label = sinkName && sinkName.length > 4 ? sinkName.slice(0, 4) : (sinkName || 'SINK');
          break;
        }
        case MachineType.DISPLAY: label = 'UTF8'; break;
        case MachineType.COMMAND: label = machine.command.split(/\s+/)[0]; break;
        case MachineType.NULL:     label = 'NULL'; break;
        case MachineType.LINEFEED:   label = 'LF';   break;
        case MachineType.FLIPPER:    label = 'FLIP'; break;
        case MachineType.DUPLICATOR: label = 'DUP';  break;
        case MachineType.CONSTANT:   label = 'LOOP'; break;
        case MachineType.DELAY:      label = 'DLY';  break;
        case MachineType.KEYBOARD:   label = 'KEY';  break;
        case MachineType.PACKER:     label = 'PACK'; break;
        case MachineType.UNPACKER:   label = 'UNPK'; break;
        case MachineType.GATE:       label = 'GATE'; break;
        case MachineType.WIRELESS:   label = 'W' + (machine as WirelessMachine).wirelessChannel; break;
        case MachineType.MATH: {
          const mm = machine as MathMachine;
          const opSyms: Record<string, string> = { add: '+', sub: '-', mul: '*', mod: '%', xor: '^', and: '&', or: '|', not: '~' };
          label = (opSyms[mm.mathOp] || mm.mathOp) + mm.mathOperand;
          break;
        }
        case MachineType.CLOCK:      label = 'CLK';  break;
        case MachineType.LATCH:      label = 'LAT';  break;
        case MachineType.MERGER:     label = 'MRG';  break;
      }

      // Flash effect for command/packer machines: white → green over FLASH_DURATION_MS
      const flashTime = machine.type === MachineType.COMMAND
        ? Math.max(machine.lastCommandTime, machine.lastStreamWriteTime)
        : machine.type === MachineType.PACKER
          ? machine.lastCommandTime
          : 0;
      if ((machine.type === MachineType.COMMAND || machine.type === MachineType.PACKER) && flashTime > 0) {
        const elapsed = performance.now() - flashTime;
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

    // Buffer indicator for command machines
    if (machine.type === MachineType.COMMAND) {
      if (machine.stream) {
        this.drawStreamIndicator(px, py, machine);
      } else {
        this.drawBufferDots(px, py, machine);
      }
    }

    // Accumulation dots for packer machines
    if (machine.type === MachineType.PACKER) {
      this.drawPackerDots(px, py, machine);
    }

    // Direction arrow for flipper machines
    if (machine.type === MachineType.FLIPPER) {
      this.drawDirectionArrow(machine.x, machine.y, machine.flipperState as Direction);
    }

    // Direction arrow for packer machines
    if (machine.type === MachineType.PACKER) {
      this.drawDirectionArrow(machine.x, machine.y, machine.packerDir);
    }

    // Direction arrows for router machines (match + else)
    if (machine.type === MachineType.ROUTER) {
      this.drawDirectionArrow(machine.x, machine.y, (machine as RouterMachine).routerMatchDir);
      this.drawDirectionArrow(machine.x, machine.y, (machine as RouterMachine).routerElseDir);
    }
  }

  // -------------------------------------------------------------------------
  // Buffer dots (command machine)
  // -------------------------------------------------------------------------

  private drawBufferDots(px: number, py: number, machine: CommandMachine): void {
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
  // Packer accumulation dots
  // -------------------------------------------------------------------------

  private drawPackerDots(px: number, py: number, machine: PackerMachine): void {
    const ctx = this.ctx;
    const totalWidth = (DOT_COUNT - 1) * DOT_SPACING;
    const startX = px + HALF_GRID - totalWidth / 2;

    const filled = machine.accumulatedBuffer.length % DOT_MOD;

    const botY = py + GRID_SIZE - DOT_Y_INSET;
    for (let i = 0; i < DOT_COUNT; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * DOT_SPACING, botY, DOT_RADIUS, 0, Math.PI * 2);
      if (i < filled) {
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
  // Stream indicator (stream command machines)
  // -------------------------------------------------------------------------

  private drawStreamIndicator(px: number, py: number, machine: CommandMachine): void {
    const ctx = this.ctx;
    const now = performance.now();
    const ANIM_DURATION = 300;
    const BOUNCE_PX = 3;

    // Animate on recent write
    const elapsed = now - machine.lastStreamWriteTime;
    let offsetY = 0;
    if (machine.lastStreamWriteTime > 0 && elapsed < ANIM_DURATION) {
      const t = elapsed / ANIM_DURATION;
      offsetY = Math.sin(t * Math.PI * 2) * BOUNCE_PX;
    }

    const centerX = px + HALF_GRID;
    const botY = py + GRID_SIZE - DOT_Y_INSET + offsetY;

    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = machine.activeJobId ? CLR_INPUT_AMBER : CLR_DOT_EMPTY;
    ctx.fillText('~~', centerX, botY);
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

    const content = packet.content;

    // Multi-character string packet (from PACKER)
    if (content.length > 1) {
      this.drawStringPacket(px, py, content, 1);
      return;
    }

    const code = content.charCodeAt(0);

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

    let display = content;
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

  /** Draw a multi-character string packet (from PACKER). */
  private drawStringPacket(px: number, py: number, content: string, alpha: number): void {
    const ctx = this.ctx;
    const size = PACKET_SIZE / 2;
    const w = size * 2 + 8;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = CLR_PACKET_BG;
    ctx.strokeStyle = CLR_PACKET_EXTENDED;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(px - w / 2, py - size, w, size * 2, PACKET_CORNER_RADIUS);
    ctx.fill();
    ctx.stroke();

    // "STR" label
    ctx.fillStyle = CLR_PACKET_EXTENDED;
    ctx.font = FONT_PACKET_SMALL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STR', px, py - 4);

    // Length underneath
    ctx.fillStyle = CLR_PACKET_HEX;
    ctx.fillText(String(content.length), px, py + 6);

    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Orphaned packet (falling with gravity)
  // -------------------------------------------------------------------------

  private drawOrphanedPacket(op: OrphanedPacket): void {
    const px = op.worldX;
    const py = op.worldY;
    const ctx = this.ctx;

    const content = op.content;

    // Fade out after 2s
    const fadeStart = 2000;
    const fadeDuration = 1000;
    if (op.age > fadeStart) {
      ctx.globalAlpha = Math.max(0, 1 - (op.age - fadeStart) / fadeDuration);
    }

    // Multi-character string packet (from PACKER)
    if (content.length > 1) {
      this.drawStringPacket(px, py, content, ctx.globalAlpha);
      ctx.globalAlpha = 1;
      return;
    }

    const code = content.charCodeAt(0);
    const isMultibyte = code > 127;
    const color = this.packetColor(code);
    const size = PACKET_SIZE / 2;

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

    let display = content;
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

  private drawSpeechBubble(machine: DisplayMachine): void {
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

  private drawMachineTooltip(machine: CommandMachine): void {
    const ctx = this.ctx;
    const mx = cx(machine.x);
    const my = gy(machine.y);

    const cwd = machine.cwd || '/';
    const command = machine.command || 'cat';

    const lines: string[] = [];
    lines.push(`${cwd} $ ${command}`);

    if (machine.stream) {
      lines.push(`> ${formatBytes(machine.streamBytesWritten)} in`);
      lines.push(`< ${formatBytes(machine.bytesRead)} out`);
    } else {
      const inputBuffer = machine.pendingInput || '';
      if (inputBuffer.length > 0) {
        const display = inputBuffer.length > TOOLTIP_BUFFER_TRUNC
          ? inputBuffer.slice(0, TOOLTIP_BUFFER_SLICE) + '...'
          : inputBuffer;
        lines.push(`> ${display.replace(/\n/g, '↵').replace(/\r/g, '')}`);
      } else {
        lines.push('>');
      }
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
  // Source tooltip (source machines)
  // -------------------------------------------------------------------------

  private drawSourceTooltip(machine: SourceMachine): void {
    const ctx = this.ctx;
    const mx = cx(machine.x);
    const my = gy(machine.y);

    const text = machine.sourceText || '';
    const textLines = text.split('\n');
    const maxPreviewLines = 4;
    const previewLines = textLines.slice(0, maxPreviewLines);
    const hasMore = textLines.length > maxPreviewLines;

    const lines: string[] = [];
    for (const line of previewLines) {
      const display = line.length > TOOLTIP_BUFFER_TRUNC
        ? line.slice(0, TOOLTIP_BUFFER_SLICE) + '...'
        : line;
      lines.push(display || '');
    }
    if (hasMore) {
      lines.push(`... +${textLines.length - maxPreviewLines} more lines`);
    }
    if (lines.length === 0) lines.push('(empty)');

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
      const ly = bubbleY + TOOLTIP_PADDING + i * TOOLTIP_LINE_HEIGHT;
      ctx.fillStyle = (hasMore && i === lines.length - 1) ? CLR_TOOLTIP_INPUT : CLR_TOOLTIP_OUTPUT;
      ctx.font = FONT_TOOLTIP;
      ctx.fillText(lines[i], bubbleX + TOOLTIP_PADDING, ly, bubbleWidth - TOOLTIP_PADDING * 2);
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
