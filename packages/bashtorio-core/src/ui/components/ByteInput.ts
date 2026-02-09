// ---------------------------------------------------------------------------
// ByteInput – single-byte picker: hex nibble entry + key capture, side by side
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
	{ value: '\n',   code: 0x0A, display: 'LF',   name: 'Line Feed',       category: 'ctrl' },
	{ value: '\r',   code: 0x0D, display: 'CR',   name: 'Carriage Return', category: 'ctrl' },
	{ value: '\t',   code: 0x09, display: 'TAB',  name: 'Tab',             category: 'ctrl' },
	{ value: '\0',   code: 0x00, display: 'NUL',  name: 'Null',            category: 'ctrl' },
	{ value: '\x1B', code: 0x1B, display: 'ESC',  name: 'Escape',          category: 'ctrl' },
];

const DELIM_BYTES: ByteMeta[] = [
	{ value: ' ', code: 0x20, display: 'SP',  name: 'Space',     category: 'delim' },
	{ value: ',', code: 0x2C, display: ',',   name: 'Comma',     category: 'delim' },
	{ value: ';', code: 0x3B, display: ';',   name: 'Semicolon', category: 'delim' },
	{ value: '|', code: 0x7C, display: '|',   name: 'Pipe',      category: 'delim' },
	{ value: ':', code: 0x3A, display: ':',   name: 'Colon',     category: 'delim' },
	{ value: '.', code: 0x2E, display: '.',   name: 'Period',    category: 'delim' },
];

const ALL_QUICK: ByteMeta[] = [...CONTROL_BYTES, ...DELIM_BYTES];

const CTRL_NAMES = [
	'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
	'BS',  'TAB', 'LF',  'VT',  'FF',  'CR',  'SO',  'SI',
	'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
	'CAN', 'EM',  'SUB', 'ESC', 'FS',  'GS',  'RS',  'US',
];

function charDisplay(char: string): string {
	const code = char.charCodeAt(0);
	const meta = ALL_QUICK.find(m => m.value === char);
	if (meta) return meta.display;
	if (code < 32) return CTRL_NAMES[code];
	if (code === 127) return 'DEL';
	return char;
}

function packetColor(code: number): string {
	if (code < 32 || code === 127) return '#ff9632';
	if (code === 32)               return '#888888';
	if (code >= 97 && code <= 122) return '#64c8ff';
	if (code >= 65 && code <= 90)  return '#64ffc8';
	if (code >= 48 && code <= 57)  return '#ffff64';
	if (code > 127)                return '#c896ff';
	return '#ff96c8';
}

export class ByteInput {
	readonly el: HTMLElement;
	private currentValue: string;
	private onChange: ((byte: string) => void) | undefined;

	// Hex side
	private hexHi!: HTMLElement;
	private hexLo!: HTMLElement;
	private hexCapture!: HTMLInputElement;
	private pendingNibble: number | null = null;

	// Key side
	private keyDisplay!: HTMLElement;
	private keyCapture!: HTMLInputElement;

	// Quick picks popover
	private buttons: HTMLButtonElement[] = [];
	private popover!: HTMLElement;

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
		this.pendingNibble = null;
		this.syncDisplay();
	}

	focus(): void {
		this.hexCapture?.focus();
	}

	destroy(): void {
		this.el.remove();
	}

	// -----------------------------------------------------------------------
	// DOM
	// -----------------------------------------------------------------------

	private buildDOM(): HTMLElement {
		const root = document.createElement('div');
		root.className = 'byte-input';

		// Two-column entry
		const duo = document.createElement('div');
		duo.className = 'byte-input-duo';

		// --- Hex column ---
		const hexCol = document.createElement('div');
		hexCol.className = 'byte-input-col byte-input-hex-col';

		const hexLabel = document.createElement('span');
		hexLabel.className = 'byte-input-col-label';
		hexLabel.textContent = 'HEX';

		const hexCells = document.createElement('div');
		hexCells.className = 'byte-input-hex-cells';

		this.hexHi = document.createElement('span');
		this.hexHi.className = 'byte-input-nibble';
		this.hexLo = document.createElement('span');
		this.hexLo.className = 'byte-input-nibble';

		hexCells.appendChild(this.hexHi);
		hexCells.appendChild(this.hexLo);

		this.hexCapture = document.createElement('input');
		this.hexCapture.className = 'byte-input-capture';
		this.hexCapture.type = 'text';
		this.hexCapture.setAttribute('aria-label', 'Hex byte input');

		hexCol.appendChild(hexLabel);
		hexCol.appendChild(hexCells);
		hexCol.appendChild(this.hexCapture);

		hexCells.addEventListener('mousedown', (e) => {
			e.preventDefault();
			this.hexCapture.focus();
		});

		this.hexCapture.addEventListener('keydown', (e) => this.handleHexKey(e));
		this.hexCapture.addEventListener('input', () => { this.hexCapture.value = ''; });
		this.hexCapture.addEventListener('focus', () => hexCol.classList.add('byte-input-col--focused'));
		this.hexCapture.addEventListener('blur', () => {
			hexCol.classList.remove('byte-input-col--focused');
			this.pendingNibble = null;
			this.syncDisplay();
		});

		// --- Key column ---
		const keyCol = document.createElement('div');
		keyCol.className = 'byte-input-col byte-input-key-col';

		const keyLabel = document.createElement('span');
		keyLabel.className = 'byte-input-col-label';
		keyLabel.textContent = 'KEY';

		this.keyDisplay = document.createElement('div');
		this.keyDisplay.className = 'byte-input-key-display';

		this.keyCapture = document.createElement('input');
		this.keyCapture.className = 'byte-input-capture';
		this.keyCapture.type = 'text';
		this.keyCapture.setAttribute('aria-label', 'Key byte input');

		keyCol.appendChild(keyLabel);
		keyCol.appendChild(this.keyDisplay);
		keyCol.appendChild(this.keyCapture);

		this.keyDisplay.addEventListener('mousedown', (e) => {
			e.preventDefault();
			this.keyCapture.focus();
		});

		this.keyCapture.addEventListener('keydown', (e) => this.handleKeyPress(e));
		this.keyCapture.addEventListener('input', () => { this.keyCapture.value = ''; });
		this.keyCapture.addEventListener('focus', () => keyCol.classList.add('byte-input-col--focused'));
		this.keyCapture.addEventListener('blur', () => keyCol.classList.remove('byte-input-col--focused'));

		duo.appendChild(hexCol);
		duo.appendChild(keyCol);

		// Popover toggle button
		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'byte-input-popover-toggle';
		toggle.title = 'Special characters';
		toggle.textContent = '☰';
		toggle.popoverTargetAction = 'toggle';

		duo.appendChild(toggle);
		root.appendChild(duo);

		// Quick-pick popover
		this.popover = document.createElement('div');
		this.popover.className = 'byte-input-popover';
		this.popover.popover = 'auto';
		toggle.popoverTargetElement = this.popover;

		for (const meta of ALL_QUICK) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = `byte-btn byte-btn--${meta.category}`;
			btn.dataset.value = meta.value;
			btn.title = `${meta.name} (0x${meta.code.toString(16).toUpperCase().padStart(2, '0')})`;

			const labelSpan = document.createElement('span');
			labelSpan.className = 'byte-btn-label';
			labelSpan.textContent = meta.display;

			const hexSpan = document.createElement('span');
			hexSpan.className = 'byte-btn-hex';
			hexSpan.textContent = meta.code.toString(16).toUpperCase().padStart(2, '0');

			btn.appendChild(labelSpan);
			btn.appendChild(hexSpan);

			btn.addEventListener('mousedown', (e) => e.preventDefault());
			btn.addEventListener('click', () => {
				this.currentValue = meta.value;
				this.pendingNibble = null;
				this.syncDisplay();
				this.onChange?.(this.currentValue);
				this.popover.hidePopover();
			});

			this.popover.appendChild(btn);
			this.buttons.push(btn);
		}
		root.appendChild(this.popover);

		return root;
	}

	// -----------------------------------------------------------------------
	// Hex nibble input
	// -----------------------------------------------------------------------

	private handleHexKey(e: KeyboardEvent): void {
		if (e.ctrlKey || e.metaKey || e.altKey) return;

		const key = e.key.toLowerCase();

		if (key.length === 1 && '0123456789abcdef'.includes(key)) {
			e.preventDefault();
			const nibbleVal = parseInt(key, 16);
			if (this.pendingNibble === null) {
				this.pendingNibble = nibbleVal;
				this.syncDisplay();
			} else {
				const byte = (this.pendingNibble << 4) | nibbleVal;
				this.currentValue = String.fromCharCode(byte);
				this.pendingNibble = null;
				this.syncDisplay();
				this.onChange?.(this.currentValue);
			}
			return;
		}

		if (e.key === 'Backspace' || e.key === 'Escape') {
			e.preventDefault();
			this.pendingNibble = null;
			this.syncDisplay();
		}
	}

	// -----------------------------------------------------------------------
	// Key press input
	// -----------------------------------------------------------------------

	private handleKeyPress(e: KeyboardEvent): void {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === 'Tab' || e.key === 'Escape') return;

		// Single character keys
		if (e.key.length === 1) {
			e.preventDefault();
			this.currentValue = e.key;
			this.pendingNibble = null;
			this.syncDisplay();
			this.onChange?.(this.currentValue);
			return;
		}

		// Named keys
		if (e.key === 'Enter') {
			e.preventDefault();
			this.currentValue = '\n';
			this.pendingNibble = null;
			this.syncDisplay();
			this.onChange?.(this.currentValue);
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			this.currentValue = '\b';
			this.pendingNibble = null;
			this.syncDisplay();
			this.onChange?.(this.currentValue);
		}
	}

	// -----------------------------------------------------------------------
	// Sync display
	// -----------------------------------------------------------------------

	private syncDisplay(): void {
		const code = this.currentValue.charCodeAt(0);
		const color = packetColor(code);
		const hi = (code >> 4) & 0xF;
		const lo = code & 0xF;

		// Hex nibbles
		if (this.pendingNibble !== null) {
			this.hexHi.textContent = this.pendingNibble.toString(16).toUpperCase();
			this.hexHi.style.color = color;
			this.hexLo.textContent = '\u2581';
			this.hexLo.style.color = '';
			this.hexLo.classList.add('byte-input-nibble--cursor');
			this.hexHi.classList.remove('byte-input-nibble--cursor');
		} else {
			this.hexHi.textContent = hi.toString(16).toUpperCase();
			this.hexLo.textContent = lo.toString(16).toUpperCase();
			this.hexHi.style.color = color;
			this.hexLo.style.color = color;
			this.hexHi.classList.remove('byte-input-nibble--cursor');
			this.hexLo.classList.remove('byte-input-nibble--cursor');
		}

		// Key display
		this.keyDisplay.textContent = charDisplay(this.currentValue);
		this.keyDisplay.style.color = color;

		// Quick-pick buttons
		for (const btn of this.buttons) {
			btn.classList.toggle('byte-btn--selected', btn.dataset.value === this.currentValue);
		}
	}
}
