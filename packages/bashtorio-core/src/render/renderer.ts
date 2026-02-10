import { CTRL_NAMES } from '../util/bytes';
import { formatBytes } from '../util/format';
import { type RGB, rgb, lerpRgb, rgbCSS } from '../util/colors';
import {
  GRID_SIZE,
  PACKET_SIZE,
  Direction,
  CellType,
  MachineType,
  type Machine,
  type CommandMachine,
  type SourceMachine,
  type SinkMachine,
  type RouterMachine,
  type ReplaceMachine,
  type MathMachine,
  type WirelessMachine,
  type Packet,
  type SplitterMachine,
  type SevenSegMachine,
  type ClockMachine,
  type GateMachine,
  type LatchMachine,
  type FlipperMachine,
  type DelayMachine,
  type FilterMachine,
  type LinefeedMachine,
  type DuplicatorMachine,
  type KeyboardMachine,
  type UnpackerMachine,
  type ToneMachine,
  type ScreenMachine,
  type PunchCardMachine,
  type BeltCell,
  type CursorMode,
  type OrphanedPacket,
  SINK_DRAIN_SLOTS,
  SINK_DRAIN_MS,
} from '../game/types';
import type { ColorTheme, MachineColor } from '../util/themes';
import type { GameState } from '../game/state';
import { getCell, forEachBelt } from '../game/grid';
import { getSplitterSecondary } from '../game/edit';
import { machines } from '../game/machines';
import * as cam from '../game/camera';
import { now } from '../game/clock';
import { spriteAsset } from '../util/assets';

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

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

function fract(x: number): number { return x - Math.floor(x); }

// Stateless procedural animation helpers (V8-inlineable)
function hashX(i: number): number { return fract(Math.sin(i * 127.1 + i * i * 311.7) * 43758.5453); }
function hashY(i: number): number { return fract(Math.sin(i * 269.5 + i * i * 183.3) * 43758.5453); }

function wanderX(t: number, phase: number): number {
  return Math.sin(t * 1.3 + phase) + Math.sin(t * 0.7 + phase * 2.3) + Math.sin(t * 2.1 + phase * 0.7);
}
function wanderY(t: number, phase: number): number {
  return Math.sin(t * 0.9 + phase) + Math.sin(t * 1.7 + phase * 1.9) + Math.sin(t * 0.5 + phase * 3.1);
}

function vortexX(cx: number, angle: number, radius: number): number {
  return cx + Math.cos(angle) * radius;
}
function vortexY(cy: number, angle: number, radius: number): number {
  return cy + Math.sin(angle) * radius;
}

const WIFI_ARC_RADII = [7, 13, 19] as const;
const WIFI_ARC_START = -Math.PI * 0.75;
const WIFI_ARC_END = -Math.PI * 0.25;

const OUTPUT_DIRS = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP] as const;
const OUTPUT_DX = [1, 0, -1, 0] as const;
const OUTPUT_DY = [0, 1, 0, -1] as const;

const SEVENSEG_BITMASK: Record<string, number> = {
  '0': 0x3F, '1': 0x06, '2': 0x5B, '3': 0x4F,
  '4': 0x66, '5': 0x6D, '6': 0x7D, '7': 0x07,
  '8': 0x7F, '9': 0x6F, 'A': 0x77, 'B': 0x7C,
  'C': 0x39, 'D': 0x5E, 'E': 0x79, 'F': 0x71,
};

const PACKET_CORNER_RADIUS = 4;

const BUBBLE_PADDING = 10;
const BUBBLE_LINE_HEIGHT = 18;
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

const MONO = "'JetBrains Mono', Consolas, monospace";
const FONT_LABEL          = `11px ${MONO}`;
const FONT_PACKET         = `12px ${MONO}`;
const FONT_PACKET_TINY    = `7px ${MONO}`;
const FONT_PACKET_SMALL   = `8px ${MONO}`;
const FONT_TOOLTIP        = `12px ${MONO}`;
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

  [MachineType.FILTER]:     { bg: '#3a3a2a', border: '#7a7a4a', text: '#ccc' },
  [MachineType.COUNTER]:    { bg: '#2a3a5a', border: '#4a6a9a', text: '#ccc' },
  [MachineType.DELAY]:      { bg: '#4a3a3a', border: '#7a5a5a', text: '#ccc' },
  [MachineType.KEYBOARD]:   { bg: '#4a2a5a', border: '#7a4a9a', text: '#ccc' },
  [MachineType.PACKER]:     { bg: '#3a2a4a', border: '#6a4a8a', text: '#ccc' },
  [MachineType.UNPACKER]:   { bg: '#4a2a3a', border: '#8a4a6a', text: '#ccc' },
  [MachineType.ROUTER]:     { bg: '#5a3a2a', border: '#9a6a4a', text: '#ccc' },
  [MachineType.GATE]:       { bg: '#5a2a2a', border: '#8a4a4a', text: '#ccc' },
  [MachineType.WIRELESS]:   { bg: '#000000', border: '#ffffff', text: '#ccc' },
  [MachineType.REPLACE]:    { bg: '#5a5a2a', border: '#8a8a4a', text: '#ccc' },
  [MachineType.MATH]:       { bg: '#2a5a2a', border: '#4a8a4a', text: '#ccc' },
  [MachineType.CLOCK]:      { bg: '#5a2a4a', border: '#8a4a7a', text: '#ccc' },
  [MachineType.LATCH]:      { bg: '#2a3a5a', border: '#4a6a9a', text: '#ccc' },

  [MachineType.SPLITTER]:   { bg: '#3a2a4a', border: '#8a6aaa', text: '#ccc' },
  [MachineType.SEVENSEG]:   { bg: '#000000', border: '#ffffff', text: '#ff0000' },
  [MachineType.DRUM]:       { bg: '#4a3a2a', border: '#aa7744', text: '#ffcc66' },
  [MachineType.TONE]:       { bg: '#3a2a5a', border: '#7a4aaa', text: '#cc99ff' },
  [MachineType.SPEAK]:      { bg: '#2a4a5a', border: '#4a8aaa', text: '#88ddff' },
  [MachineType.SCREEN]:     { bg: '#000000', border: '#ffffff', text: '#ffffff' },
  [MachineType.BYTE]:       { bg: '#2a4a3a', border: '#4a8a6a', text: '#88ffcc' },
  [MachineType.PUNCHCARD]:  { bg: '#4a4a2a', border: '#8a8a4a', text: '#ddcc88' },
};

const WIRELESS_CHANNEL_COLORS = [
  '#ff4444', '#ff8800', '#ffcc00', '#44cc44',
  '#44cccc', '#4488ff', '#aa44ff', '#ff44aa',
];

const WIFI_DIM: RGB = rgb(0x1a, 0x1a, 0x1a);
const WIRELESS_CHANNEL_PACKED: RGB[] = [
  0xff4444, 0xff8800, 0xffcc00, 0x44cc44,
  0x44cccc, 0x4488ff, 0xaa44ff, 0xff44aa,
];

// ---------------------------------------------------------------------------
// Control-character name table (allocated once)
// ---------------------------------------------------------------------------


let CLR_FLIPPER_ARROW    = '#4a9a9a';

let usePhotoTextures = false;
export function setPhotoTextures(enabled: boolean): void { usePhotoTextures = enabled; }

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


/** Clamp n into [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}


// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sprite loading helper
// ---------------------------------------------------------------------------

function loadSprite(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

export interface RendererConfig {
  canvas: HTMLCanvasElement;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hoveredMachine: Machine | null = null;
  /** Mouse position in world pixels (already inverse-camera-transformed). */
  private mouseX = 0;
  private mouseY = 0;
  private mouseOnCanvas = false;
  hoverCol = -1;
  hoverRow = -1;

  private sprites: Map<MachineType, HTMLImageElement>;

  constructor(config: RendererConfig) {
    this.canvas = config.canvas;
    this.ctx = config.canvas.getContext('2d')!;

    const SPRITE_FILES: [MachineType, string][] = [
      [MachineType.COMMAND, 'terminal.png'],
      [MachineType.SINK,    'sink.png'],
      [MachineType.SOURCE,  'tape.png'],
      [MachineType.BYTE,    'floppy.png'],
    ];
    this.sprites = new Map();
    for (const [type, file] of SPRITE_FILES) {
      this.sprites.set(type, loadSprite(spriteAsset(file)));
    }

    window.addEventListener('resize', () => this.handleResize());

    // Track mouse for hover tooltips and previews - store as world coords
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      // Screen → world using effective scale
      this.mouseX = screenX / cam.getScale() + cam.getX();
      this.mouseY = screenY / cam.getScale() + cam.getY();
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

  private getSprite(type: MachineType): HTMLImageElement | undefined {
    if (!usePhotoTextures) return undefined;
    const img = this.sprites.get(type);
    return img?.complete ? img : undefined;
  }

  private drawPreviewSprite(col: number, row: number, type: MachineType, label: string): void {
    const s = this.getSprite(type);
    if (s) this.ctx.drawImage(s, gx(col), gy(row), GRID_SIZE, GRID_SIZE);
    else this.drawMachineBox(col, row, type, label);
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

  handleResize(_state?: GameState): void {
    // Reset backing buffer so intrinsic size doesn't prevent the
    // grid cell (and thus clientWidth/Height) from shrinking.
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    cam.updateCanvasSize(this.canvas.width, this.canvas.height);
  }

  render(state: GameState): void {
    const ctx = this.ctx;

    // Sync canvas size into camera module
    cam.updateCanvasSize(this.canvas.width, this.canvas.height);

    // Clear entire canvas (in screen space, before camera transform)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = CLR_CANVAS_BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply camera transform: world → screen
    const s = cam.getScale();
    ctx.setTransform(s, 0, 0, s, -cam.getX() * s, -cam.getY() * s);

    // Viewport-based grid lines
    const { startCol, endCol, startRow, endRow } = cam.visibleGridRange();

    ctx.strokeStyle = CLR_GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startCol; x <= endCol; x++) {
      const px = gx(x);
      ctx.moveTo(px, gy(startRow));
      ctx.lineTo(px, gy(endRow));
    }
    for (let y = startRow; y <= endRow; y++) {
      const py = gy(y);
      ctx.moveTo(gx(startCol), py);
      ctx.lineTo(gx(endCol), py);
    }
    ctx.stroke();

    // Belts (sparse iteration)
    forEachBelt((x, y, dir) => {
      this.drawBelt(x, y, dir, state.running);
    });

    // Machines
    for (const machine of machines) {
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
    for (const machine of machines) {
      if (machine.type === MachineType.DISPLAY && machine.displayText) {
        this.drawSpeechBubble(machine);
      } else if (machine.type === MachineType.SPEAK && machine.displayText) {
        this.drawSpeechBubble(machine);
      }
    }

    // Hover detection (mouseX/mouseY are already in world coords)
    const hoverCol = Math.floor(this.mouseX / GRID_SIZE);
    const hoverRow = Math.floor(this.mouseY / GRID_SIZE);
    this.hoverCol = this.mouseOnCanvas ? hoverCol : -1;
    this.hoverRow = this.mouseOnCanvas ? hoverRow : -1;
    this.hoveredMachine = null;

    for (const machine of machines) {
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
    if (this.mouseOnCanvas) {
      this.drawCursorCoords(state, hoverCol, hoverRow);
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // -------------------------------------------------------------------------
  // Placement preview
  // -------------------------------------------------------------------------

  private drawPlacementPreview(state: GameState, col: number, row: number): void {
    const cell = getCell(col, row);
    if (cell.type === CellType.MACHINE) return;

    const ctx = this.ctx;
    ctx.globalAlpha = 0.5;

    switch (state.currentPlaceable) {
      case 'belt':
        this.drawBelt(col, row, state.currentDir);
        break;
      case 'splitter': {
        const sec = getSplitterSecondary({ dir: state.currentDir, x: col, y: row });
        const secCell = getCell(sec.x, sec.y);
        if (secCell.type === CellType.MACHINE) break;
        this.drawSplitterMachine({ x: col, y: row, dir: state.currentDir } as SplitterMachine);
        break;
      }
      case 'source':
        this.drawPreviewSprite(col, row, MachineType.SOURCE, 'SRC');
        break;
      case 'command':
        this.drawPreviewSprite(col, row, MachineType.COMMAND, 'SHL');
        break;
      case 'sink':
        this.drawPreviewSprite(col, row, MachineType.SINK, 'SINK');
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
        this.drawWirelessPreview(col, row);
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

      case 'sevenseg':
        this.drawMachineBox(col, row, MachineType.SEVENSEG, '7SEG');
        break;
      case 'drum':
        this.drawMachineBox(col, row, MachineType.DRUM, 'DRUM');
        break;
      case 'tone':
        this.drawMachineBox(col, row, MachineType.TONE, 'SIN');
        break;
      case 'speak':
        this.drawMachineBox(col, row, MachineType.SPEAK, 'TALK');
        break;
      case 'screen':
        this.drawMachineBox(col, row, MachineType.SCREEN, 'SCR');
        break;
      case 'byte':
        this.drawPreviewSprite(col, row, MachineType.BYTE, 'BYTE');
        break;
      case 'punchcard':
        this.drawMachineBox(col, row, MachineType.PUNCHCARD, 'CARD');
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

    ctx.font = `10px ${MONO}`;
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
    const anim = running ? ((now / BELT_ANIM_PERIOD) % 1) * spacing : 0;

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
  // Wireless (wifi symbol)
  // -------------------------------------------------------------------------

  private drawWireless(machine: WirelessMachine): void {
    const px = gx(machine.x);
    const py = gy(machine.y);
    const ctx = this.ctx;
    const color = MACHINE_COLORS[MachineType.WIRELESS];

    // Black background + white frame
    ctx.fillStyle = color.bg;
    ctx.fillRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);
    ctx.strokeStyle = color.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

    const chPacked = WIRELESS_CHANNEL_PACKED[machine.wirelessChannel];
    const litArcs = machine.wifiArc;
    const fade = clamp(1 - (now - machine.lastCommandTime) / 1000, 0, 1);
    const litColor = rgbCSS(lerpRgb(WIFI_DIM, chPacked, fade));
    const dimColor = rgbCSS(WIFI_DIM);

    const mcx = cx(machine.x);
    const dotY = cy(machine.y) + 8;

    ctx.lineCap = 'round';

    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i < litArcs ? litColor : dimColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mcx, dotY, WIFI_ARC_RADII[i], WIFI_ARC_START, WIFI_ARC_END);
      ctx.stroke();
    }

    // Center dot (always channel color)
    ctx.fillStyle = WIRELESS_CHANNEL_COLORS[machine.wirelessChannel];
    ctx.beginPath();
    ctx.arc(mcx, dotY, 2.5, 0, TAU);
    ctx.fill();
  }

  private drawWirelessPreview(col: number, row: number): void {
    const px = gx(col);
    const py = gy(row);
    const ctx = this.ctx;
    const color = MACHINE_COLORS[MachineType.WIRELESS];

    ctx.fillStyle = color.bg;
    ctx.fillRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);
    ctx.strokeStyle = color.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

    const mcx = cx(col);
    const dotY = cy(row) + 8;
    const dimColor = rgbCSS(WIFI_DIM);

    ctx.lineCap = 'round';

    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = dimColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mcx, dotY, WIFI_ARC_RADII[i], WIFI_ARC_START, WIFI_ARC_END);
      ctx.stroke();
    }

    ctx.fillStyle = WIRELESS_CHANNEL_COLORS[0];
    ctx.beginPath();
    ctx.arc(mcx, dotY, 2.5, 0, TAU);
    ctx.fill();
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

    // Map lastByte to 7-seg bitmask via low nibble
    let mask = 0;
    if (machine.lastByte >= 0) {
      const digit = '0123456789ABCDEF'[machine.lastByte & 0xF];
      mask = SEVENSEG_BITMASK[digit] ?? 0;
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
  // Clock face (clock machines)
  // -------------------------------------------------------------------------

  private drawClockFace(machine: ClockMachine): void {
    const ctx = this.ctx;
    const mcx = cx(machine.x);
    const mcy = cy(machine.y);
    const color = MACHINE_COLORS[MachineType.CLOCK];
    const r = CELL_INNER / 2 - 2;
    const start = -HALF_PI; // 12 o'clock

    // Progress arc
    const progress = machine.clock.interval > 0 ? clamp(1 - machine.clock.timeRemaining / machine.clock.interval, 0, 1) : 0;

    ctx.strokeStyle = color.border;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(mcx, mcy, r, start, start + progress * TAU);
    ctx.stroke();

    // Label
    ctx.fillStyle = color.text;
    ctx.font = FONT_LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLK', mcx, mcy);
  }

  // -------------------------------------------------------------------------
  // Tone waveform (animated oscilloscope)
  // -------------------------------------------------------------------------

  private drawToneWaveform(machine: ToneMachine): void {
    const ctx = this.ctx;
    const mcx = cx(machine.x);
    const mcy = cy(machine.y);
    const color = MACHINE_COLORS[MachineType.TONE];

    const waveW = 30;
    const amp = 7;
    const samples = 24;
    const cycles = 2;
    const active = now - machine.lastCommandTime < 2000;
    const phase = active ? now * 0.008 : 0;
    const startX = mcx - waveW / 2;

    ctx.beginPath();
    ctx.strokeStyle = active ? color.text : color.border;
    ctx.lineWidth = active ? 2 : 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * cycles * TAU + phase;
      let v: number;
      switch (machine.waveform) {
        case 'square':   v = Math.sin(t) >= 0 ? 1 : -1; break;
        case 'sawtooth':  v = 2 * ((t / TAU) - Math.floor(t / TAU + 0.5)); break;
        case 'triangle': v = (2 / Math.PI) * Math.asin(Math.sin(t)); break;
        default:          v = Math.sin(t); break;
      }
      const sx = startX + (i / samples) * waveW;
      const sy = mcy - v * amp;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // Screen (monochrome bitmap display)
  // -------------------------------------------------------------------------

  private drawScreen(machine: ScreenMachine): void {
    const px = gx(machine.x);
    const py = gy(machine.y);
    const ctx = this.ctx;
    const res = machine.resolution;
    const bufLen = machine.buffer.length;

    // Black background + white border
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + CELL_INSET + 0.5, py + CELL_INSET + 0.5, CELL_INNER - 1, CELL_INNER - 1);

    // Pixel grid area (inside border with small padding)
    const pad = 3;
    const areaX = px + CELL_INSET + pad;
    const areaY = py + CELL_INSET + pad;
    const areaSize = CELL_INNER - pad * 2;
    const pixelSize = areaSize / res;

    // Render pixels from circular buffer
    ctx.fillStyle = '#ffffff';
    for (let row = 0; row < res; row++) {
      for (let col = 0; col < res; col++) {
        const bitIdx = row * res + col;
        const byteIdx = Math.floor(bitIdx / 8) % bufLen;
        const bitPos = 7 - (bitIdx % 8); // MSB first
        if (machine.buffer[byteIdx] & (1 << bitPos)) {
          ctx.fillRect(
            areaX + col * pixelSize,
            areaY + row * pixelSize,
            pixelSize,
            pixelSize,
          );
        }
      }
    }
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

    // Screen: custom bitmap rendering
    if (machine.type === MachineType.SCREEN) {
      this.drawScreen(machine);
      return;
    }

    // Wireless: custom wifi symbol rendering
    if (machine.type === MachineType.WIRELESS) {
      this.drawWireless(machine as WirelessMachine);
      return;
    }

    const px = gx(machine.x);
    const py = gy(machine.y);
    const ctx = this.ctx;
    const color = MACHINE_COLORS[machine.type];

    const sprite = this.getSprite(machine.type);
    if (sprite) {
      ctx.drawImage(sprite, px, py, GRID_SIZE, GRID_SIZE);
    } else {
      // Colored box fallback
      ctx.fillStyle = color.bg;
      ctx.fillRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);

      ctx.strokeStyle = color.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + CELL_INSET, py + CELL_INSET, CELL_INNER, CELL_INNER);
    }

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
      const elapsed = now - rm.lastActivation;
      rm.animationProgress = rm.lastActivation > 0 && elapsed > 0 ? 1 - Math.exp(-elapsed / 300) : 1;
      const angle = rm.animationProgress * TAU;
      const r = 10;
      const mcx = cx(machine.x);
      const mcy = cy(machine.y);
      this.drawMiniPacket(mcx + Math.cos(angle) * r, mcy + Math.sin(angle) * r, rm.replaceFrom);
      this.drawMiniPacket(mcx + Math.cos(angle + Math.PI) * r, mcy + Math.sin(angle + Math.PI) * r, rm.replaceTo);
    } else if (machine.type === MachineType.COUNTER) {
      this.drawMiniPacket(cx(machine.x), cy(machine.y) - 6, machine.counterTrigger);
      ctx.fillStyle = color.text;
      ctx.font = FONT_PACKET_SMALL;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(machine.counterCount), cx(machine.x), cy(machine.y) + 10);
    } else if (machine.type === MachineType.CLOCK) {
      this.drawClockFace(machine);
    } else if (machine.type === MachineType.TONE) {
      this.drawToneWaveform(machine);
    } else {
      let label: string;
      switch (machine.type) {
        case MachineType.SOURCE:  label = sprite ? '' : 'SRC';  break;
        case MachineType.SINK: {
          if (sprite) { label = ''; break; }
          const sinkName = (machine as SinkMachine).name;
          label = sinkName && sinkName.length > 4 ? sinkName.slice(0, 4) : (sinkName || 'SINK');
          break;
        }
        case MachineType.DISPLAY: label = 'UTF8'; break;
        case MachineType.COMMAND: label = sprite ? '' : machine.command.split(/\s+/)[0]; break;
        case MachineType.NULL:     label = 'NULL'; break;
        case MachineType.LINEFEED:   label = 'LF';   break;
        case MachineType.FLIPPER:    label = 'FLIP'; break;
        case MachineType.DUPLICATOR: label = 'DUP';  break;

        case MachineType.DELAY:      label = 'DLY';  break;
        case MachineType.KEYBOARD:   label = 'KEY';  break;
        case MachineType.PACKER:     label = 'PACK'; break;
        case MachineType.UNPACKER:   label = 'UNPK'; break;
        case MachineType.GATE:       label = 'GATE'; break;
        case MachineType.MATH: {
          const mm = machine as MathMachine;
          const opSyms: Record<string, string> = { add: '+', sub: '-', mul: '*', mod: '%', xor: '^', and: '&', or: '|', not: '~' };
          label = (opSyms[mm.mathOp] || mm.mathOp) + mm.mathOperand;
          break;
        }
        case MachineType.LATCH:      label = 'LAT';  break;
        case MachineType.DRUM:       label = 'DRUM'; break;
        case MachineType.SPEAK:      label = 'TALK'; break;
        case MachineType.BYTE:       label = sprite ? '' : 'BYTE'; break;
        case MachineType.PUNCHCARD:  label = sprite ? '' : 'CARD'; break;

      }

      // Flash effect for command/packer machines: white → green over FLASH_DURATION_MS
      const flashTime = (machine.type === MachineType.COMMAND || machine.type === MachineType.PACKER)
        ? machine.lastCommandTime
        : 0;
      if ((machine.type === MachineType.COMMAND || machine.type === MachineType.PACKER) && flashTime > 0) {
        const elapsed = now - flashTime;
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
      this.drawGenericBufferDots(px, py, machine.accumulatedBuffer.length);
    }

    // Direction arrow for command machines (show output belt direction)
    if (machine.type === MachineType.COMMAND) {
      const outDir = this.findOutputDir(machine.x, machine.y);
      if (outDir !== null) this.drawDirectionArrow(machine.x, machine.y, outDir);
    }

    // Direction arrow for flipper machines + queue depth dots
    if (machine.type === MachineType.FLIPPER) {
      this.drawDirectionArrow(machine.x, machine.y, machine.flipperState as Direction);
      this.drawGenericBufferDots(px, py, (machine as FlipperMachine).outputQueue.length);
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

    // Source: output direction arrow
    if (machine.type === MachineType.SOURCE) {
      const outDir = this.findOutputDir(machine.x, machine.y);
      if (outDir !== null) this.drawDirectionArrow(machine.x, machine.y, outDir);
    }

    // Duplicator: buffer dots
    if (machine.type === MachineType.DUPLICATOR) {
      this.drawGenericBufferDots(px, py, (machine as DuplicatorMachine).outputQueue.length);
    }

    // Delay: wandering mini packets for queued bytes
    if (machine.type === MachineType.DELAY) {
      const dm = machine as DelayMachine;
      const chars = dm.delayQueue.map(q => q.char).join('') + dm.outputQueue.join('');
      this.drawDelayDots(px, py, chars);
    }

    // Keyboard: buffer dots
    if (machine.type === MachineType.KEYBOARD) {
      this.drawGenericBufferDots(px, py, (machine as KeyboardMachine).outputBuffer.length);
    }

    // Unpacker: buffer dots
    if (machine.type === MachineType.UNPACKER) {
      this.drawGenericBufferDots(px, py, (machine as UnpackerMachine).outputBuffer.length);
    }

    // Sink: swirling drain animation
    if (machine.type === MachineType.SINK) {
      this.drawSinkDrain(px, py, machine as SinkMachine);
    }

    // Filter: red strikethrough when in block mode
    if (machine.type === MachineType.FILTER && (machine as FilterMachine).filterMode === 'block') {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const mcx = cx(machine.x);
      const mcy = cy(machine.y);
      ctx.moveTo(mcx - 8, mcy - 8);
      ctx.lineTo(mcx + 8, mcy + 8);
      ctx.stroke();
    }

    // Gate: input arrows, state dot, output arrow, buffer dots
    if (machine.type === MachineType.GATE) {
      const gm = machine as GateMachine;
      this.drawInputArrow(machine.x, machine.y, gm.gateDataDir, CLR_INPUT_AMBER);
      this.drawInputArrow(machine.x, machine.y, gm.gateControlDir, '#4a9a9a');
      // State dot (green=open, red=closed)
      ctx.fillStyle = gm.gateOpen ? '#33ff33' : '#ff3333';
      ctx.beginPath();
      ctx.arc(px + GRID_SIZE - CELL_INSET - 5, py + CELL_INSET + 5, 3, 0, TAU);
      ctx.fill();
      // Output arrow
      const gateOutDir = this.findOutputDir(machine.x, machine.y);
      if (gateOutDir !== null) this.drawDirectionArrow(machine.x, machine.y, gateOutDir);
      this.drawGenericBufferDots(px, py, gm.outputQueue.length);
    }

    // Latch: input arrows, stored dot, output arrow, buffer dots
    if (machine.type === MachineType.LATCH) {
      const lm = machine as LatchMachine;
      this.drawInputArrow(machine.x, machine.y, lm.latchDataDir, CLR_INPUT_AMBER);
      this.drawInputArrow(machine.x, machine.y, lm.latchControlDir, '#4a9a9a');
      // Stored dot (amber=has value, gray=empty)
      ctx.fillStyle = lm.latchStored ? CLR_INPUT_AMBER : CLR_DOT_EMPTY;
      ctx.beginPath();
      ctx.arc(px + GRID_SIZE - CELL_INSET - 5, py + CELL_INSET + 5, 3, 0, TAU);
      ctx.fill();
      // Output arrow
      const latchOutDir = this.findOutputDir(machine.x, machine.y);
      if (latchOutDir !== null) this.drawDirectionArrow(machine.x, machine.y, latchOutDir);
      this.drawGenericBufferDots(px, py, lm.outputQueue.length);
    }

    // Linefeed: timer progress arc
    if (machine.type === MachineType.LINEFEED) {
      const lfm = machine as LinefeedMachine;
      this.drawTimerArc(machine.x, machine.y, lfm.clock.interval, lfm.clock.timeRemaining, MACHINE_COLORS[MachineType.LINEFEED].border);
    }

    // Source: progress arc (fills during gap, drains during release)
    if (machine.type === MachineType.SOURCE) {
      const sm = machine as SourceMachine;
      if (sm.loop && sm.sourceText.length > 0) {
        let progress: number;
        if (sm.gapTimer.timeRemaining > 0 && sm.gapTimer.interval > 0) {
          // Gap phase: arc fills up (0→1)
          progress = clamp(1 - sm.gapTimer.timeRemaining / sm.gapTimer.interval, 0, 1);
        } else {
          // Release phase: arc drains (1→0) as chars are emitted
          progress = clamp(1 - sm.sourcePos / sm.sourceText.length, 0, 1);
        }
        this.drawTimerArc(machine.x, machine.y, 1, 1 - progress, MACHINE_COLORS[MachineType.SOURCE].border);
      }
    }

    // PunchCard: progress arc (same pattern as SOURCE)
    if (machine.type === MachineType.PUNCHCARD) {
      const pc = machine as PunchCardMachine;
      if (pc.loop && pc.cardData.length > 0) {
        let progress: number;
        if (pc.gapTimer.timeRemaining > 0 && pc.gapTimer.interval > 0) {
          progress = clamp(1 - pc.gapTimer.timeRemaining / pc.gapTimer.interval, 0, 1);
        } else {
          progress = clamp(1 - pc.cardPos / pc.cardData.length, 0, 1);
        }
        this.drawTimerArc(machine.x, machine.y, 1, 1 - progress, MACHINE_COLORS[MachineType.PUNCHCARD].border);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Buffer dots (command machine)
  // -------------------------------------------------------------------------

  private drawBufferDots(px: number, py: number, machine: CommandMachine): void {
    const ctx = this.ctx;
    const centerX = px + HALF_GRID;

    // Input bytes (white, top)
    if (machine.bytesIn > 0) {
      ctx.font = FONT_PACKET_TINY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(formatBytes(machine.bytesIn), centerX, py + DOT_Y_INSET);
    }

    // Output bytes (amber, bottom)
    if (machine.bytesOut > 0) {
      ctx.font = FONT_PACKET_TINY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CLR_INPUT_AMBER;
      ctx.fillText(formatBytes(machine.bytesOut), centerX, py + GRID_SIZE - DOT_Y_INSET);
    }
  }

  // -------------------------------------------------------------------------
  // Packer accumulation dots
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Stream indicator (stream command machines)
  // -------------------------------------------------------------------------

  private drawStreamIndicator(px: number, py: number, machine: CommandMachine): void {
    const ctx = this.ctx;
    const centerX = px + HALF_GRID;

    // Input bytes (white, top)
    if (machine.bytesIn > 0) {
      ctx.font = FONT_PACKET_TINY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(formatBytes(machine.bytesIn), centerX, py + DOT_Y_INSET);
    }

    // Output bytes (amber, bottom)
    if (machine.bytesOut > 0) {
      ctx.font = FONT_PACKET_TINY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CLR_INPUT_AMBER;
      ctx.fillText(formatBytes(machine.bytesOut), centerX, py + GRID_SIZE - DOT_Y_INSET);
    }
  }

  // -------------------------------------------------------------------------
  // Generic buffer dots (reusable for any machine with a buffer)
  // -------------------------------------------------------------------------

  private drawGenericBufferDots(px: number, py: number, bufferLength: number): void {
    const ctx = this.ctx;
    const totalWidth = (DOT_COUNT - 1) * DOT_SPACING;
    const startX = px + HALF_GRID - totalWidth / 2;
    const filled = bufferLength % DOT_MOD;
    const botY = py + GRID_SIZE - DOT_Y_INSET;

    for (let i = 0; i < DOT_COUNT; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * DOT_SPACING, botY, DOT_RADIUS, 0, TAU);
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
  // Delay dots — stateless procedural wandering animation
  // -------------------------------------------------------------------------

  private drawDelayDots(px: number, py: number, chars: string): void {
    if (chars.length === 0) return;
    const ctx = this.ctx;
    const t = now / 1000;
    const capped = Math.min(chars.length, 16);

    // Inset area within the cell for mini packets to wander
    const inset = 10;
    const areaW = GRID_SIZE - inset * 2;
    const areaH = GRID_SIZE - inset * 2;
    const baseX = px + inset;
    const baseY = py + inset;

    const amp = 0.07;

    ctx.globalAlpha = 0.85;

    for (let i = 0; i < capped; i++) {
      const hx = hashX(i);
      const hy = hashY(i);
      const ox = wanderX(t, hx * TAU) * amp;
      const oy = wanderY(t, hy * TAU) * amp;

      this.drawMiniPacket(
        baseX + (hx + ox) * areaW,
        baseY + (hy + oy) * areaH,
        chars[i],
        0.4,
      );
    }

    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Sink drain — mini packets spiral inward and fade
  // -------------------------------------------------------------------------

  private drawSinkDrain(px: number, py: number, sink: SinkMachine): void {
    const ring = sink.drainRing;
    if (ring.length === 0) return;

    const ctx = this.ctx;
    const t = now;
    const centerX = px + HALF_GRID;
    const centerY = py + HALF_GRID;
    const maxRadius = HALF_GRID - 6;

    // Reverse-iterate from most recent entry
    let expired = true;
    for (let k = 0; k < ring.length; k++) {
      // Walk backwards from head
      const idx = (sink.drainHead - 1 - k + SINK_DRAIN_SLOTS) % SINK_DRAIN_SLOTS;
      if (idx >= ring.length) continue;
      const entry = ring[idx];
      const elapsed = t - entry.time;
      if (elapsed < 0 || elapsed >= SINK_DRAIN_MS) continue;
      expired = false;

      const linear = elapsed / SINK_DRAIN_MS;
      const progress = linear * linear; // ease-in: slow start, fast finish

      // Spiral: radius shrinks, angle increases
      const radius = maxRadius * (1 - progress);
      const angle = progress * TAU * 2.5 + idx * (TAU / SINK_DRAIN_SLOTS);
      const dx = vortexX(centerX, angle, radius);
      const dy = vortexY(centerY, angle, radius);

      // Fade + shrink near center
      const scale = 0.7 * (1 - progress * 0.7);
      ctx.globalAlpha = 1 - progress * progress;

      this.drawMiniPacket(dx, dy, entry.char, scale);
    }

    ctx.globalAlpha = 1;

    // If every entry has fully played, clear the ring
    if (expired) {
      sink.drainRing = [];
      sink.drainHead = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Input arrow (pointing inward toward cell center)

  // -------------------------------------------------------------------------

  private drawInputArrow(col: number, row: number, fromDir: Direction, color: string): void {
    const ctx = this.ctx;
    const px = gx(col);
    const py = gy(row);
    const centerX = cx(col);
    const centerY = cy(row);
    const s = 4;
    const inset = CELL_INSET + 2;

    ctx.fillStyle = color;
    ctx.beginPath();

    switch (fromDir) {
      case Direction.RIGHT: {
        // Arrow on right edge pointing left (inward)
        const ex = px + GRID_SIZE - inset;
        ctx.moveTo(ex, centerY);
        ctx.lineTo(ex + s, centerY - s);
        ctx.lineTo(ex + s, centerY + s);
        break;
      }
      case Direction.DOWN: {
        const ey = py + GRID_SIZE - inset;
        ctx.moveTo(centerX, ey);
        ctx.lineTo(centerX - s, ey + s);
        ctx.lineTo(centerX + s, ey + s);
        break;
      }
      case Direction.LEFT: {
        const ex = px + inset;
        ctx.moveTo(ex, centerY);
        ctx.lineTo(ex - s, centerY - s);
        ctx.lineTo(ex - s, centerY + s);
        break;
      }
      case Direction.UP: {
        const ey = py + inset;
        ctx.moveTo(centerX, ey);
        ctx.lineTo(centerX - s, ey - s);
        ctx.lineTo(centerX + s, ey - s);
        break;
      }
    }

    ctx.closePath();
    ctx.fill();
  }

  // -------------------------------------------------------------------------
  // Timer arc overlay (progress ring for timer-based machines)
  // -------------------------------------------------------------------------

  private drawTimerArc(col: number, row: number, interval: number, timeRemaining: number, color: string): void {
    const ctx = this.ctx;
    const mcx = cx(col);
    const mcy = cy(row);
    const r = CELL_INNER / 2 - 1;
    const start = -HALF_PI;

    const progress = interval > 0 ? clamp(1 - timeRemaining / interval, 0, 1) : 0;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(mcx, mcy, r, start, start + progress * TAU);
    ctx.stroke();
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

  private drawMiniPacket(px: number, py: number, char: string, scale = 1): void {
    const ctx = this.ctx;
    const code = char.charCodeAt(0);
    const isMultibyte = code > 127;
    const color = this.packetColor(code);
    const size = (PACKET_SIZE / 2 - 2) * scale;

    // Shape background + border
    ctx.fillStyle = CLR_PACKET_BG;
    ctx.strokeStyle = color;
    ctx.lineWidth = scale < 1 ? 1 : 2;

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
      ctx.roundRect(px - size, py - size, size * 2, size * 2, 3 * scale);
      ctx.fill();
      ctx.stroke();
    }

    // Character label
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let display = char;
    if (scale < 0.5) {
      ctx.font = FONT_PACKET_TINY;
      if (code < 32) display = CTRL_NAMES[code];
      else if (code === 32) display = 'SP';
      else if (code === 127) display = '·';
    } else {
      ctx.font = FONT_PACKET;
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
  // Speech bubble (shared multi-line word-wrap renderer)
  // -------------------------------------------------------------------------

  private wrapText(text: string, maxWidth: number): string[] {
    const ctx = this.ctx;
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      const words = paragraph.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) { lines.push(''); continue; }
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = line + ' ' + words[i];
        if (ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = words[i];
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Measure text for a bubble, returning wrapped lines and bubble dimensions. */
  private measureBubble(text: string): { lines: string[]; width: number; height: number } {
    const innerMax = BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2;
    this.ctx.font = FONT_BUBBLE;
    const lines = this.wrapText(text, innerMax);

    let maxLineWidth = 0;
    for (const line of lines) {
      const w = this.ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    return {
      lines,
      width: Math.min(maxLineWidth + BUBBLE_PADDING * 2, BUBBLE_MAX_WIDTH),
      height: lines.length * BUBBLE_LINE_HEIGHT + BUBBLE_PADDING * 2,
    };
  }

  private drawBubbleMeasured(
    col: number, row: number,
    measured: { lines: string[]; width: number; height: number },
    borderColor: string, textColor: string, alpha = 1,
  ): void {
    const ctx = this.ctx;
    const mx = cx(col);
    const my = gy(row);
    const { lines, width: bubbleWidth, height: bubbleHeight } = measured;

    let bubbleX = mx - bubbleWidth / 2;
    let bubbleY = my - bubbleHeight - BUBBLE_GAP;

    const es = cam.getScale();
    const visLeft = cam.getX() + BUBBLE_MARGIN / es;
    const visRight = cam.getX() + this.canvas.width / es - bubbleWidth - BUBBLE_MARGIN / es;
    const visTop = cam.getY() + BUBBLE_MARGIN / es;
    bubbleX = clamp(bubbleX, visLeft, visRight);
    if (bubbleY < visTop) bubbleY = my + GRID_SIZE + BUBBLE_GAP;

    ctx.globalAlpha = alpha;

    // Background
    ctx.fillStyle = CLR_BUBBLE_BG;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, BUBBLE_RADIUS);
    ctx.fill();

    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pointer
    ctx.fillStyle = borderColor;
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

    // Text
    ctx.fillStyle = textColor;
    ctx.font = FONT_BUBBLE;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      const ly = bubbleY + BUBBLE_PADDING + i * BUBBLE_LINE_HEIGHT + BUBBLE_LINE_HEIGHT / 2;
      ctx.fillText(lines[i], bubbleX + BUBBLE_PADDING, ly);
    }

    ctx.globalAlpha = 1;
  }

  private drawSpeechBubble(machine: { x: number; y: number; displayText: string; displayTime: number }): void {
    const age = now - machine.displayTime;

    let alpha = 1;
    if (age > BUBBLE_FADE_START_MS) {
      alpha = 1 - (age - BUBBLE_FADE_START_MS) / BUBBLE_FADE_DURATION_MS;
      if (alpha <= 0) {
        machine.displayText = '';
        return;
      }
    }

    const measured = this.measureBubble(machine.displayText);
    this.drawBubbleMeasured(machine.x, machine.y, measured, CLR_BUBBLE_BORDER, CLR_BUBBLE_TEXT, alpha);
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
    if (cwd !== '/') lines.push(cwd);
    lines.push(`$ ${command}`);

    if (machine.stream) {
      lines.push(machine.shell ? 'streaming...' : 'no shell');
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

    const ttEs = cam.getScale();
    const ttVisLeft = cam.getX() + BUBBLE_MARGIN / ttEs;
    const ttVisRight = cam.getX() + this.canvas.width / ttEs - bubbleWidth - BUBBLE_MARGIN / ttEs;
    const ttVisTop = cam.getY() + BUBBLE_MARGIN / ttEs;
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
    ctx.fillStyle = CLR_TOOLTIP_BORDER;
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

      if (line.startsWith('$')) {
        ctx.fillStyle = CLR_TOOLTIP_CMD;
      } else if (line.startsWith('>')) {
        ctx.fillStyle = CLR_TOOLTIP_INPUT;
      } else if (line.startsWith('<')) {
        ctx.fillStyle = CLR_TOOLTIP_OUTPUT;
      } else {
        ctx.fillStyle = CLR_TOOLTIP_BORDER;  // muted (cwd)
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

    const ttEs = cam.getScale();
    const ttVisLeft = cam.getX() + BUBBLE_MARGIN / ttEs;
    const ttVisRight = cam.getX() + this.canvas.width / ttEs - bubbleWidth - BUBBLE_MARGIN / ttEs;
    const ttVisTop = cam.getY() + BUBBLE_MARGIN / ttEs;
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
    ctx.fillStyle = CLR_TOOLTIP_BORDER;
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
  // Output direction detection (for arrow indicators)
  // -------------------------------------------------------------------------

  private findOutputDir(mx: number, my: number): Direction | null {
    for (let i = 0; i < 4; i++) {
      const cell = getCell(mx + OUTPUT_DX[i], my + OUTPUT_DY[i]);
      if (cell.type === CellType.BELT && (cell as BeltCell).dir === OUTPUT_DIRS[i]) {
        return OUTPUT_DIRS[i];
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Public helpers
  // -------------------------------------------------------------------------

  getGridPosition(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    // Screen → world → grid (using effective scale = fitScale * cam.scale)
    const worldX = screenX / cam.getScale() + cam.getX();
    const worldY = screenY / cam.getScale() + cam.getY();
    const x = Math.floor(worldX / GRID_SIZE);
    const y = Math.floor(worldY / GRID_SIZE);
    return { x, y };
  }
}
