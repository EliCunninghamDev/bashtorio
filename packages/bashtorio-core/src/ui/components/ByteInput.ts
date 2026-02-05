// ---------------------------------------------------------------------------
// ByteInput – single-byte picker: inline input + popover quick-pick
// ---------------------------------------------------------------------------

export interface ByteInputOptions {
	value?: string;
	onChange?: (byte: string) => void;
}

interface ByteMeta {
	value: string;
	code: number;
	display: string;
	name: string;
	category: 'ctrl' | 'delim';
}

const CONTROL_BYTES: ByteMeta[] = [
	{ value: '\n',   code: 0x0A, display: '\\n',  name: 'Line Feed',       category: 'ctrl' },
	{ value: '\r',   code: 0x0D, display: '\\r',  name: 'Carriage Return', category: 'ctrl' },
	{ value: '\t',   code: 0x09, display: '\\t',  name: 'Tab',             category: 'ctrl' },
	{ value: '\0',   code: 0x00, display: '\\0',  name: 'Null',            category: 'ctrl' },
	{ value: '\x1B', code: 0x1B, display: 'ESC',  name: 'Escape',          category: 'ctrl' },
];

const DELIM_BYTES: ByteMeta[] = [
	{ value: ' ', code: 0x20, display: 'SPC', name: 'Space',     category: 'delim' },
	{ value: ',', code: 0x2C, display: ',',   name: 'Comma',     category: 'delim' },
	{ value: ';', code: 0x3B, display: ';',   name: 'Semicolon', category: 'delim' },
	{ value: '|', code: 0x7C, display: '|',   name: 'Pipe',      category: 'delim' },
	{ value: ':', code: 0x3A, display: ':',   name: 'Colon',     category: 'delim' },
	{ value: '.', code: 0x2E, display: '.',   name: 'Period',    category: 'delim' },
];

const ALL_QUICK: ByteMeta[] = [...CONTROL_BYTES, ...DELIM_BYTES];

// Control-character name table (matches renderer.ts)
const CTRL_NAMES = [
	'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
	'BS',  'TAB', 'LF',  'VT',  'FF',  'CR',  'SO',  'SI',
	'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
	'CAN', 'EM',  'SUB', 'ESC', 'FS',  'GS',  'RS',  'US',
];

// Packet color by char code (matches renderer.ts packetColor())
function packetColor(code: number): string {
	if (code < 32 || code === 127) return '#ff9632';   // control
	if (code === 32)               return '#888888';   // space
	if (code >= 97 && code <= 122) return '#64c8ff';   // lowercase
	if (code >= 65 && code <= 90)  return '#64ffc8';   // uppercase
	if (code >= 48 && code <= 57)  return '#ffff64';   // digit
	if (code > 127)                return '#c896ff';   // extended
	return '#ff96c8';                                  // punctuation
}

/** Try to parse a user-typed string into a single byte. Returns null if invalid. */
function parseInput(raw: string): string | null {
	const s = raw.trim();
	if (s.length === 0) return null;

	// Escape sequences
	if (s === '\\n') return '\n';
	if (s === '\\r') return '\r';
	if (s === '\\t') return '\t';
	if (s === '\\0') return '\0';

	// Hex: 0x00-0xFF
	if (/^0x[0-9a-fA-F]{1,2}$/i.test(s)) {
		const num = parseInt(s.slice(2), 16);
		if (num <= 0xFF) return String.fromCharCode(num);
	}

	// Control-char name (e.g. "LF", "NUL", "ESC")
	const upper = s.toUpperCase();
	const ctrlIdx = CTRL_NAMES.indexOf(upper);
	if (ctrlIdx >= 0) return String.fromCharCode(ctrlIdx);
	if (upper === 'DEL') return String.fromCharCode(127);
	if (upper === 'SP' || upper === 'SPC' || upper === 'SPACE') return ' ';

	// Single printable character
	if (s.length === 1) return s;

	return null;
}

/** Get the input-field display text for a byte value. */
function valueToInputText(char: string): string {
	const code = char.charCodeAt(0);
	const meta = ALL_QUICK.find(m => m.value === char);
	if (meta) return meta.display;
	if (code < 32) return CTRL_NAMES[code];
	if (code === 127) return 'DEL';
	return char;
}

export class ByteInput {
	readonly el: HTMLElement;
	private currentValue: string;
	private onChange: ((byte: string) => void) | undefined;

	private input!: HTMLInputElement;
	private pickerBtn!: HTMLButtonElement;
	private popover!: HTMLElement;
	private buttons: HTMLButtonElement[] = [];
	private popoverOpen = false;

	constructor(options?: ByteInputOptions) {
		this.currentValue = options?.value ?? '\n';
		this.onChange = options?.onChange;
		this.el = this.buildDOM();
		this.syncDisplay();
	}

	getValue(): string {
		return this.currentValue;
	}

	setValue(byte: string): void {
		if (byte.length !== 1) return;
		this.currentValue = byte;
		this.syncDisplay();
	}

	focus(): void {
		this.input?.focus();
		this.input?.select();
	}

	destroy(): void {
		this.closePopover();
		this.el.remove();
	}

	// -----------------------------------------------------------------------
	// DOM
	// -----------------------------------------------------------------------

	private buildDOM(): HTMLElement {
		const root = document.createElement('div');
		root.className = 'byte-input';

		// Inline row: input + picker button
		const row = document.createElement('div');
		row.className = 'byte-input-row';

		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.className = 'byte-input-field';
		this.input.spellcheck = false;
		this.input.autocomplete = 'off';

		this.pickerBtn = document.createElement('button');
		this.pickerBtn.type = 'button';
		this.pickerBtn.className = 'byte-input-picker-btn';
		this.pickerBtn.textContent = '\u25BE'; // ▾
		this.pickerBtn.title = 'Pick from common bytes';

		row.appendChild(this.input);
		row.appendChild(this.pickerBtn);
		root.appendChild(row);

		// Popover (hidden)
		this.popover = document.createElement('div');
		this.popover.className = 'byte-input-popover';
		this.popover.style.display = 'none';
		this.popover.appendChild(this.buildSection('Control', CONTROL_BYTES));
		this.popover.appendChild(this.buildSection('Delimiters', DELIM_BYTES));
		root.appendChild(this.popover);

		// Events
		this.input.addEventListener('focus', () => {
			this.input.select();
		});

		this.input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.commitInput();
			}
		});

		this.input.addEventListener('blur', () => {
			this.commitInput();
		});

		this.pickerBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (this.popoverOpen) {
				this.closePopover();
			} else {
				this.openPopover();
			}
		});

		return root;
	}

	private buildSection(label: string, bytes: ByteMeta[]): HTMLElement {
		const section = document.createElement('div');
		section.className = 'byte-input-section';

		const header = document.createElement('div');
		header.className = 'byte-input-section-label';
		header.textContent = label;
		section.appendChild(header);

		const grid = document.createElement('div');
		grid.className = 'byte-input-grid';

		for (const meta of bytes) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = `byte-btn byte-btn--${meta.category}`;
			btn.dataset.value = meta.value;
			btn.title = `${meta.name} (0x${meta.code.toString(16).toUpperCase().padStart(2, '0')})`;

			// Mimic packet rendering: display label + hex underneath
			const labelSpan = document.createElement('span');
			labelSpan.className = 'byte-btn-label';
			labelSpan.textContent = meta.display;

			const hexSpan = document.createElement('span');
			hexSpan.className = 'byte-btn-hex';
			hexSpan.textContent = meta.code.toString(16).toUpperCase().padStart(2, '0');

			btn.appendChild(labelSpan);
			btn.appendChild(hexSpan);

			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.currentValue = meta.value;
				this.syncDisplay();
				this.closePopover();
				this.onChange?.(this.currentValue);
			});

			grid.appendChild(btn);
			this.buttons.push(btn);
		}

		section.appendChild(grid);
		return section;
	}

	// -----------------------------------------------------------------------
	// Popover open/close
	// -----------------------------------------------------------------------

	private openPopover(): void {
		this.syncButtons();
		this.popover.style.display = '';
		this.popoverOpen = true;
		// Close on outside click (next tick so this click doesn't trigger it)
		requestAnimationFrame(() => {
			document.addEventListener('click', this.outsideClickHandler);
		});
	}

	private closePopover(): void {
		this.popover.style.display = 'none';
		this.popoverOpen = false;
		document.removeEventListener('click', this.outsideClickHandler);
	}

	private outsideClickHandler = (e: MouseEvent) => {
		if (!this.el.contains(e.target as Node)) {
			this.closePopover();
		}
	};

	// -----------------------------------------------------------------------
	// Commit typed value
	// -----------------------------------------------------------------------

	private commitInput(): void {
		const parsed = parseInput(this.input.value);
		if (parsed !== null && parsed !== this.currentValue) {
			this.currentValue = parsed;
			this.syncDisplay();
			this.onChange?.(this.currentValue);
		} else {
			// Reset display to current value if invalid
			this.syncDisplay();
		}
	}

	// -----------------------------------------------------------------------
	// Sync display
	// -----------------------------------------------------------------------

	private syncDisplay(): void {
		const code = this.currentValue.charCodeAt(0);
		const color = packetColor(code);

		this.input.value = valueToInputText(this.currentValue);
		this.input.style.color = color;

		this.syncButtons();
	}

	private syncButtons(): void {
		for (const btn of this.buttons) {
			btn.classList.toggle('byte-btn--selected', btn.dataset.value === this.currentValue);
		}
	}
}
