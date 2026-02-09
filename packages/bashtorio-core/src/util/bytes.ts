// ---------------------------------------------------------------------------
// Shared byte metadata: control-char names, quick-pick lists, display helpers
// ---------------------------------------------------------------------------

export interface ByteMeta {
	value: string;
	code: number;
	display: string;
	name: string;
	category: 'ctrl' | 'delim';
}

export const CTRL_NAMES = [
	'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
	'BS',  'TAB', 'LF',  'VT',  'FF',  'CR',  'SO',  'SI',
	'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
	'CAN', 'EM',  'SUB', 'ESC', 'FS',  'GS',  'RS',  'US',
] as const;

export const CONTROL_BYTES: ByteMeta[] = [
	{ value: '\n',   code: 0x0A, display: 'LF',   name: 'Line Feed',       category: 'ctrl' },
	{ value: '\r',   code: 0x0D, display: 'CR',   name: 'Carriage Return', category: 'ctrl' },
	{ value: '\t',   code: 0x09, display: 'TAB',  name: 'Tab',             category: 'ctrl' },
	{ value: '\0',   code: 0x00, display: 'NUL',  name: 'Null',            category: 'ctrl' },
	{ value: '\x1B', code: 0x1B, display: 'ESC',  name: 'Escape',          category: 'ctrl' },
	{ value: '\x04', code: 0x04, display: 'EOT',  name: 'End of File',     category: 'ctrl' },
];

export const DELIM_BYTES: ByteMeta[] = [
	{ value: ' ', code: 0x20, display: 'SP',  name: 'Space',     category: 'delim' },
	{ value: ',', code: 0x2C, display: ',',   name: 'Comma',     category: 'delim' },
	{ value: ';', code: 0x3B, display: ';',   name: 'Semicolon', category: 'delim' },
	{ value: '|', code: 0x7C, display: '|',   name: 'Pipe',      category: 'delim' },
	{ value: ':', code: 0x3A, display: ':',   name: 'Colon',     category: 'delim' },
	{ value: '.', code: 0x2E, display: '.',   name: 'Period',    category: 'delim' },
];

export const ALL_QUICK: ByteMeta[] = [...CONTROL_BYTES, ...DELIM_BYTES];

export function charDisplay(char: string): string {
	const code = char.charCodeAt(0);
	const meta = ALL_QUICK.find(m => m.value === char);
	if (meta) return meta.display;
	if (code < 32) return CTRL_NAMES[code];
	if (code === 127) return 'DEL';
	return char;
}
