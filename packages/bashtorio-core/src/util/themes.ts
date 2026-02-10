import { MachineType } from '../game/types';

export interface MachineColor {
	bg: string;
	border: string;
	text: string;
}

export interface ColorTheme {
	id: string;
	name: string;
	// Canvas
	canvasBg: string;
	gridLine: string;
	// Belts
	beltBg: string;
	beltEdge: string;
	beltArrow: string;
	// Splitter
	splitterBg: string;
	splitterSymbol: string;
	// Machine indicators
	cmdGreen: string;
	inputAmber: string;
	dotEmpty: string;
	flipperArrow: string;
	// Flash
	flashR: number;
	flashG: number;
	flashB: number;
	// Packets
	packetBg: string;
	packetHex: string;
	packetControl: string;
	packetSpace: string;
	packetLower: string;
	packetUpper: string;
	packetDigit: string;
	packetExtended: string;
	packetPunct: string;
	// Bubble
	bubbleBg: string;
	bubbleBorder: string;
	bubbleText: string;
	// Tooltip
	tooltipBg: string;
	tooltipBorder: string;
	tooltipCmd: string;
	tooltipInput: string;
	tooltipOutput: string;
	// Machine colors
	machineColors: Record<MachineType, MachineColor>;
	// UI chrome
	uiBg: string;
	uiBgSurface: string;
	uiBgElement: string;
	uiBgInput: string;
	uiBgDeep: string;
	uiBorder: string;
	uiBorderLight: string;
	uiFg: string;
	uiFgSecondary: string;
	uiFgMuted: string;
	uiAccent: string;
	uiAccentGreen: string;
	uiAccentRed: string;
}

// ---------------------------------------------------------------------------
// Color math helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16),
	];
}

function rgbToHex(r: number, g: number, b: number): string {
	return '#' + [r, g, b]
		.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
		.join('');
}

function darken(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lighten(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Generate machine box colors: dark bg, medium border, light text */
function mc(color: string, text = '#ccc'): MachineColor {
	return { bg: darken(color, 0.65), border: darken(color, 0.35), text };
}

/** Light-theme machine box: very light tinted bg, medium border, dark text */
function mcLight(color: string): MachineColor {
	return { bg: lighten(color, 0.82), border: darken(color, 0.1), text: darken(color, 0.4) };
}

// ---------------------------------------------------------------------------
// Palette → full theme
// ---------------------------------------------------------------------------

interface ThemePalette {
	id: string;
	name: string;
	bg: string;
	bg2: string;
	bg3: string;
	border: string;
	fg: string;
	fgDim: string;
	accent: string;
	red: string;
	orange: string;
	yellow: string;
	green: string;
	cyan: string;
	blue: string;
	purple: string;
	pink: string;
}

function fromPalette(p: ThemePalette): ColorTheme {
	const [fr, fg, fb] = hexToRgb(p.green);
	return {
		id: p.id,
		name: p.name,
		canvasBg: p.bg,
		gridLine: p.bg2,
		beltBg: p.bg3,
		beltEdge: p.border,
		beltArrow: p.fgDim,
		splitterBg: darken(p.purple, 0.6),
		splitterSymbol: p.purple,
		cmdGreen: p.green,
		inputAmber: p.orange,
		dotEmpty: darken(p.fg, 0.7),
		flipperArrow: p.cyan,
		flashR: fr,
		flashG: fg,
		flashB: fb,
		packetBg: darken(p.bg, 0.15),
		packetHex: p.fgDim,
		packetControl: p.orange,
		packetSpace: darken(p.fg, 0.4),
		packetLower: p.blue,
		packetUpper: p.green,
		packetDigit: p.yellow,
		packetExtended: p.purple,
		packetPunct: p.pink,
		bubbleBg: p.bg3,
		bubbleBorder: p.accent,
		bubbleText: p.fg,
		tooltipBg: p.bg,
		tooltipBorder: p.fg,
		tooltipCmd: p.green,
		tooltipInput: p.orange,
		tooltipOutput: p.fg,
		machineColors: {
			[MachineType.SOURCE]:     mc(p.green),
			[MachineType.SINK]:       mc(p.red),
			[MachineType.COMMAND]:    { bg: darken(p.bg, 0.3), border: p.fg, text: p.green },
			[MachineType.DISPLAY]:    mc(p.purple),
			[MachineType.NULL]:       { bg: darken(p.fg, 0.8), border: darken(p.fg, 0.6), text: darken(p.fg, 0.4) },
			[MachineType.LINEFEED]:   mc(p.blue),
			[MachineType.FLIPPER]:    mc(p.cyan),
			[MachineType.DUPLICATOR]: mc(p.orange),

			[MachineType.FILTER]:     mc(p.yellow),
			[MachineType.COUNTER]:    mc(p.blue),
			[MachineType.DELAY]:      mc(p.red),
			[MachineType.KEYBOARD]:   mc(p.purple),
			[MachineType.PACKER]:     mc(p.purple),
			[MachineType.UNPACKER]:   mc(p.red),
			[MachineType.ROUTER]:     mc(p.orange),
			[MachineType.GATE]:       mc(p.red),
			[MachineType.WIRELESS]:   { bg: '#000000', border: p.fg, text: '#ccc' },
			[MachineType.REPLACE]:    mc(p.yellow),
			[MachineType.MATH]:       mc(p.green),
			[MachineType.CLOCK]:      mc(p.pink),
			[MachineType.LATCH]:      mc(p.blue),

			[MachineType.SPLITTER]:   mc(p.purple),
			[MachineType.SEVENSEG]:   { bg: '#000000', border: p.fg, text: p.red },
			[MachineType.DRUM]:       mc(p.orange),
			[MachineType.TONE]:       mc(p.purple),
			[MachineType.SPEAK]:      mc(p.cyan),
			[MachineType.SCREEN]:     { bg: '#000000', border: p.fg, text: '#ffffff' },
			[MachineType.BYTE]:       mc(p.cyan),
			[MachineType.PUNCHCARD]:  mc(p.yellow),
		},
		uiBg: p.bg,
		uiBgSurface: p.bg2,
		uiBgElement: p.bg3,
		uiBgInput: darken(p.bg, 0.3),
		uiBgDeep: darken(p.bg, 0.5),
		uiBorder: darken(p.border, 0.3),
		uiBorderLight: p.border,
		uiFg: p.fg,
		uiFgSecondary: darken(p.fg, 0.2),
		uiFgMuted: p.fgDim,
		uiAccent: p.accent,
		uiAccentGreen: darken(p.green, 0.6),
		uiAccentRed: darken(p.red, 0.6),
	};
}

function fromLightPalette(p: ThemePalette): ColorTheme {
	const [fr, fg, fb] = hexToRgb(p.green);
	return {
		id: p.id,
		name: p.name,
		canvasBg: p.bg,
		gridLine: p.bg2,
		beltBg: p.bg3,
		beltEdge: p.border,
		beltArrow: p.fgDim,
		splitterBg: lighten(p.purple, 0.8),
		splitterSymbol: p.purple,
		cmdGreen: darken(p.green, 0.15),
		inputAmber: darken(p.orange, 0.1),
		dotEmpty: lighten(p.fg, 0.6),
		flipperArrow: p.cyan,
		flashR: fr,
		flashG: fg,
		flashB: fb,
		packetBg: darken(p.bg, 0.06),
		packetHex: p.fgDim,
		packetControl: p.orange,
		packetSpace: lighten(p.fg, 0.3),
		packetLower: p.blue,
		packetUpper: darken(p.green, 0.1),
		packetDigit: darken(p.yellow, 0.15),
		packetExtended: p.purple,
		packetPunct: p.pink,
		bubbleBg: p.bg2,
		bubbleBorder: p.accent,
		bubbleText: p.fg,
		tooltipBg: p.bg,
		tooltipBorder: p.border,
		tooltipCmd: darken(p.green, 0.1),
		tooltipInput: p.orange,
		tooltipOutput: p.fg,
		machineColors: {
			[MachineType.SOURCE]:     mcLight(p.green),
			[MachineType.SINK]:       mcLight(p.red),
			[MachineType.COMMAND]:    { bg: p.bg2, border: p.border, text: darken(p.green, 0.1) },
			[MachineType.DISPLAY]:    mcLight(p.purple),
			[MachineType.NULL]:       { bg: lighten(p.fg, 0.85), border: lighten(p.fg, 0.5), text: lighten(p.fg, 0.3) },
			[MachineType.LINEFEED]:   mcLight(p.blue),
			[MachineType.FLIPPER]:    mcLight(p.cyan),
			[MachineType.DUPLICATOR]: mcLight(p.orange),

			[MachineType.FILTER]:     mcLight(p.yellow),
			[MachineType.COUNTER]:    mcLight(p.blue),
			[MachineType.DELAY]:      mcLight(p.red),
			[MachineType.KEYBOARD]:   mcLight(p.purple),
			[MachineType.PACKER]:     mcLight(p.purple),
			[MachineType.UNPACKER]:   mcLight(p.red),
			[MachineType.ROUTER]:     mcLight(p.orange),
			[MachineType.GATE]:       mcLight(p.red),
			[MachineType.WIRELESS]:   { bg: p.bg, border: p.fg, text: p.fg },
			[MachineType.REPLACE]:    mcLight(p.yellow),
			[MachineType.MATH]:       mcLight(p.green),
			[MachineType.CLOCK]:      mcLight(p.pink),
			[MachineType.LATCH]:      mcLight(p.blue),
			[MachineType.SPLITTER]:   mcLight(p.purple),
			[MachineType.SEVENSEG]:   { bg: '#f5f5f5', border: p.fg, text: p.red },
			[MachineType.DRUM]:       mcLight(p.orange),
			[MachineType.TONE]:       mcLight(p.purple),
			[MachineType.SPEAK]:      mcLight(p.cyan),
			[MachineType.SCREEN]:     { bg: '#f5f5f5', border: p.fg, text: '#000000' },
			[MachineType.BYTE]:       mcLight(p.cyan),
			[MachineType.PUNCHCARD]:  mcLight(p.yellow),
		},
		uiBg: p.bg,
		uiBgSurface: p.bg2,
		uiBgElement: p.bg3,
		uiBgInput: darken(p.bg, 0.06),
		uiBgDeep: darken(p.bg, 0.12),
		uiBorder: p.border,
		uiBorderLight: lighten(p.border, 0.3),
		uiFg: p.fg,
		uiFgSecondary: lighten(p.fg, 0.2),
		uiFgMuted: p.fgDim,
		uiAccent: p.accent,
		uiAccentGreen: lighten(p.green, 0.8),
		uiAccentRed: lighten(p.red, 0.8),
	};
}

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

const MIDNIGHT: ColorTheme = {
	id: 'midnight',
	name: 'Midnight',
	canvasBg: '#12121f',
	gridLine: '#1e1e32',
	beltBg: '#2a2a3a',
	beltEdge: '#3a3a4a',
	beltArrow: '#4a4a5a',
	splitterBg: '#3a2a4a',
	splitterSymbol: '#8a6aaa',
	cmdGreen: '#33ff33',
	inputAmber: '#ffaa00',
	dotEmpty: '#333',
	flipperArrow: '#4a9a9a',
	flashR: 0x33, flashG: 0xff, flashB: 0x33,
	packetBg: '#1a1a2a',
	packetHex: '#666',
	packetControl: '#ff9632',
	packetSpace: '#888888',
	packetLower: '#64c8ff',
	packetUpper: '#64ffc8',
	packetDigit: '#ffff64',
	packetExtended: '#c896ff',
	packetPunct: '#ff96c8',
	bubbleBg: '#2a2a4a',
	bubbleBorder: '#6a5acd',
	bubbleText: '#fff',
	tooltipBg: '#0a0a0a',
	tooltipBorder: '#cccccc',
	tooltipCmd: '#33ff33',
	tooltipInput: '#ffaa00',
	tooltipOutput: '#cccccc',
	machineColors: {
		[MachineType.SOURCE]:     { bg: '#2a5a2a', border: '#4a8a4a', text: '#ccc' },
		[MachineType.SINK]:       { bg: '#5a2a2a', border: '#8a4a4a', text: '#ccc' },
		[MachineType.COMMAND]:    { bg: '#0a0a0a', border: '#cccccc', text: '#33ff33' },
		[MachineType.DISPLAY]:    { bg: '#5a3a6a', border: '#8a5a9a', text: '#ccc' },
		[MachineType.NULL]:       { bg: '#2a2a2a', border: '#555555', text: '#888' },
		[MachineType.LINEFEED]:   { bg: '#2a4a5a', border: '#4a8aaa', text: '#ccc' },
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
		[MachineType.BYTE]:       { bg: '#2a4a4a', border: '#4a8a8a', text: '#88ddcc' },
		[MachineType.PUNCHCARD]:  { bg: '#4a4a2a', border: '#8a8a4a', text: '#ddcc88' },
	},
	uiBg: '#1a1a2e',
	uiBgSurface: '#1e1e32',
	uiBgElement: '#2a2a4a',
	uiBgInput: '#12121f',
	uiBgDeep: '#0a0a14',
	uiBorder: '#333333',
	uiBorderLight: '#3a3a5a',
	uiFg: '#eeeeee',
	uiFgSecondary: '#aaaaaa',
	uiFgMuted: '#888888',
	uiAccent: '#00d9ff',
	uiAccentGreen: '#2a4a2a',
	uiAccentRed: '#4a2a2a',
};

const MONOKAI = fromPalette({
	id: 'monokai', name: 'Monokai',
	bg: '#272822', bg2: '#3e3d32', bg3: '#49483e',
	border: '#75715e', fg: '#f8f8f2', fgDim: '#75715e',
	accent: '#a6e22e',
	red: '#f92672', orange: '#fd971f', yellow: '#e6db74',
	green: '#a6e22e', cyan: '#66d9ef', blue: '#66d9ef',
	purple: '#ae81ff', pink: '#f92672',
});

const DRACULA = fromPalette({
	id: 'dracula', name: 'Dracula',
	bg: '#282a36', bg2: '#343746', bg3: '#44475a',
	border: '#6272a4', fg: '#f8f8f2', fgDim: '#6272a4',
	accent: '#bd93f9',
	red: '#ff5555', orange: '#ffb86c', yellow: '#f1fa8c',
	green: '#50fa7b', cyan: '#8be9fd', blue: '#8be9fd',
	purple: '#bd93f9', pink: '#ff79c6',
});

const SOLARIZED_DARK = fromPalette({
	id: 'solarized-dark', name: 'Solarized Dark',
	bg: '#002b36', bg2: '#073642', bg3: '#094050',
	border: '#586e75', fg: '#93a1a1', fgDim: '#586e75',
	accent: '#268bd2',
	red: '#dc322f', orange: '#cb4b16', yellow: '#b58900',
	green: '#859900', cyan: '#2aa198', blue: '#268bd2',
	purple: '#6c71c4', pink: '#d33682',
});

const ONE_DARK = fromPalette({
	id: 'one-dark', name: 'One Dark',
	bg: '#282c34', bg2: '#2c313c', bg3: '#3e4451',
	border: '#4b5263', fg: '#abb2bf', fgDim: '#5c6370',
	accent: '#61afef',
	red: '#e06c75', orange: '#d19a66', yellow: '#e5c07b',
	green: '#98c379', cyan: '#56b6c2', blue: '#61afef',
	purple: '#c678dd', pink: '#e06c75',
});

const NORD = fromPalette({
	id: 'nord', name: 'Nord',
	bg: '#2e3440', bg2: '#3b4252', bg3: '#434c5e',
	border: '#4c566a', fg: '#d8dee9', fgDim: '#4c566a',
	accent: '#88c0d0',
	red: '#bf616a', orange: '#d08770', yellow: '#ebcb8b',
	green: '#a3be8c', cyan: '#88c0d0', blue: '#81a1c1',
	purple: '#b48ead', pink: '#bf616a',
});

const GITHUB_DARK = fromPalette({
	id: 'github-dark', name: 'GitHub Dark',
	bg: '#0d1117', bg2: '#161b22', bg3: '#21262d',
	border: '#30363d', fg: '#c9d1d9', fgDim: '#484f58',
	accent: '#58a6ff',
	red: '#ff7b72', orange: '#ffa657', yellow: '#d29922',
	green: '#3fb950', cyan: '#79c0ff', blue: '#79c0ff',
	purple: '#d2a8ff', pink: '#ff7b72',
});

const VSCODE_DARK = fromPalette({
	id: 'vscode-dark', name: 'VS Code Dark',
	bg: '#1e1e1e', bg2: '#252526', bg3: '#333333',
	border: '#3c3c3c', fg: '#d4d4d4', fgDim: '#808080',
	accent: '#007acc',
	red: '#f44747', orange: '#ce9178', yellow: '#dcdcaa',
	green: '#6a9955', cyan: '#4ec9b0', blue: '#569cd6',
	purple: '#c586c0', pink: '#d16969',
});

const VSCODE_LIGHT = fromLightPalette({
	id: 'vscode-light', name: 'VS Code Light',
	bg: '#ffffff', bg2: '#f3f3f3', bg3: '#e8e8e8',
	border: '#d4d4d4', fg: '#333333', fgDim: '#767676',
	accent: '#007acc',
	red: '#cd3131', orange: '#e36209', yellow: '#d19a66',
	green: '#008000', cyan: '#267f99', blue: '#0451a5',
	purple: '#af00db', pink: '#c2185b',
});

/** Set CSS custom properties on a root element so the UI chrome picks up the theme */
export function applyUITheme(root: HTMLElement, theme: ColorTheme): void {
	const s = root.style;
	s.setProperty('--ui-bg', theme.uiBg);
	s.setProperty('--ui-bg-surface', theme.uiBgSurface);
	s.setProperty('--ui-bg-element', theme.uiBgElement);
	s.setProperty('--ui-bg-input', theme.uiBgInput);
	s.setProperty('--ui-bg-deep', theme.uiBgDeep);
	s.setProperty('--ui-border', theme.uiBorder);
	s.setProperty('--ui-border-light', theme.uiBorderLight);
	s.setProperty('--ui-fg', theme.uiFg);
	s.setProperty('--ui-fg-secondary', theme.uiFgSecondary);
	s.setProperty('--ui-fg-muted', theme.uiFgMuted);
	s.setProperty('--ui-accent', theme.uiAccent);
	s.setProperty('--ui-accent-green', theme.uiAccentGreen);
	s.setProperty('--ui-accent-red', theme.uiAccentRed);
}

export const THEMES: ColorTheme[] = [
	MONOKAI,
	MIDNIGHT,
	DRACULA,
	SOLARIZED_DARK,
	ONE_DARK,
	NORD,
	GITHUB_DARK,
	VSCODE_DARK,
	VSCODE_LIGHT,
];

export const DEFAULT_THEME_ID = 'monokai';

export function getThemeById(id: string): ColorTheme {
	return THEMES.find(t => t.id === id) ?? MIDNIGHT;
}
