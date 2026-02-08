/**
 * Convert ANSI escape codes to HTML spans with CSS classes
 */

import { escapeHtml } from './format';

interface AnsiState {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  fg: string | null;
  bg: string | null;
}

const COLORS: Record<number, string> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
  90: 'bright-black',
  91: 'bright-red',
  92: 'bright-green',
  93: 'bright-yellow',
  94: 'bright-blue',
  95: 'bright-magenta',
  96: 'bright-cyan',
  97: 'bright-white',
};

const BG_COLORS: Record<number, string> = {
  40: 'black',
  41: 'red',
  42: 'green',
  43: 'yellow',
  44: 'blue',
  45: 'magenta',
  46: 'cyan',
  47: 'white',
  100: 'bright-black',
  101: 'bright-red',
  102: 'bright-green',
  103: 'bright-yellow',
  104: 'bright-blue',
  105: 'bright-magenta',
  106: 'bright-cyan',
  107: 'bright-white',
};

function stateToClasses(state: AnsiState): string {
  const classes: string[] = [];
  if (state.bold) classes.push('ansi-bold');
  if (state.dim) classes.push('ansi-dim');
  if (state.italic) classes.push('ansi-italic');
  if (state.underline) classes.push('ansi-underline');
  if (state.fg) classes.push(`ansi-fg-${state.fg}`);
  if (state.bg) classes.push(`ansi-bg-${state.bg}`);
  return classes.join(' ');
}

function applyCode(state: AnsiState, code: number): void {
  if (code === 0) {
    // Reset
    state.bold = false;
    state.dim = false;
    state.italic = false;
    state.underline = false;
    state.fg = null;
    state.bg = null;
  } else if (code === 1) {
    state.bold = true;
  } else if (code === 2) {
    state.dim = true;
  } else if (code === 3) {
    state.italic = true;
  } else if (code === 4) {
    state.underline = true;
  } else if (code === 22) {
    state.bold = false;
    state.dim = false;
  } else if (code === 23) {
    state.italic = false;
  } else if (code === 24) {
    state.underline = false;
  } else if (code === 39) {
    state.fg = null;
  } else if (code === 49) {
    state.bg = null;
  } else if (COLORS[code]) {
    state.fg = COLORS[code];
  } else if (BG_COLORS[code]) {
    state.bg = BG_COLORS[code];
  }
}

/**
 * Convert a string with ANSI escape codes to HTML
 */
export function ansiToHtml(text: string): string {
  const state: AnsiState = {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    fg: null,
    bg: null,
  };

  // Match ANSI escape sequences: ESC [ ... m
  const ansiRegex = /\x1b\[([0-9;]*)m/g;

  let result = '';
  let lastIndex = 0;
  let match;
  let inSpan = false;

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this escape sequence
    const before = text.slice(lastIndex, match.index);
    if (before) {
      result += escapeHtml(before);
    }

    // Parse and apply the codes
    const codes = match[1].split(';').map(s => parseInt(s, 10) || 0);
    for (const code of codes) {
      applyCode(state, code);
    }

    // Close previous span if open
    if (inSpan) {
      result += '</span>';
      inSpan = false;
    }

    // Open new span if we have any styling
    const classes = stateToClasses(state);
    if (classes) {
      result += `<span class="${classes}">`;
      inSpan = true;
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  const remaining = text.slice(lastIndex);
  if (remaining) {
    result += escapeHtml(remaining);
  }

  // Close any open span
  if (inSpan) {
    result += '</span>';
  }

  return result;
}
