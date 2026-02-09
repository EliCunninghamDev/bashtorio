// ---------------------------------------------------------------------------
// HexInput – interactive hex editor with address column + ASCII sidebar
// ---------------------------------------------------------------------------

export interface HexInputOptions {
  value?: Uint8Array;
  onChange?: (bytes: Uint8Array) => void;
  columns?: number;
}

interface QuickByte {
  label: string;
  value: number;
  title: string;
}

const QUICK_BYTES: QuickByte[] = [
  { label: 'NUL', value: 0x00, title: 'Null \u2013 all bits off (00)' },
  { label: 'FF',  value: 0xFF, title: 'All bits on (FF)' },
  { label: '\\n', value: 0x0A, title: 'Line Feed (0A)' },
  { label: '\\r', value: 0x0D, title: 'Carriage Return (0D)' },
  { label: 'SPC', value: 0x20, title: 'Space (20)' },
  { label: 'EOT', value: 0x04, title: 'End of Transmission (04)' },
  { label: 'ESC', value: 0x1B, title: 'Escape (1B)' },
  { label: '\\t', value: 0x09, title: 'Tab (09)' },
];

const COL_MIN = 4;
const COL_MAX = 64;

export class HexInput {
  readonly el: HTMLElement;
  private data: number[] = [];
  private cursor = 0;
  private pendingNibble: number | null = null;
  private display!: HTMLElement;
  private capture!: HTMLInputElement;
  private colLabel!: HTMLElement;
  private bytesPerRow: number;
  private onChange: ((bytes: Uint8Array) => void) | undefined;

  constructor(options?: HexInputOptions) {
    this.onChange = options?.onChange;
    this.bytesPerRow = options?.columns ?? 16;
    this.el = this.buildDOM();
    if (options?.value) this.setBytes(options.value);
    else this.renderDisplay();
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.data);
  }

  setBytes(data: Uint8Array | string): void {
    if (typeof data === 'string') {
      this.data = [];
      for (let i = 0; i < data.length; i++) {
        this.data.push(data.charCodeAt(i) & 0xFF);
      }
    } else {
      this.data = Array.from(data);
    }
    this.cursor = this.data.length;
    this.pendingNibble = null;
    this.renderDisplay();
  }

  focus(): void {
    this.capture?.focus();
  }

  destroy(): void {
    this.el.remove();
  }

  // -----------------------------------------------------------------------
  // DOM
  // -----------------------------------------------------------------------

  private buildDOM(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'hex-input';

    // Top bar: column width +/- stepper
    const topbar = document.createElement('div');
    topbar.className = 'hex-topbar';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'hex-col-btn';
    minusBtn.textContent = '\u2212';
    minusBtn.title = 'Fewer columns';
    minusBtn.addEventListener('mousedown', (e) => e.preventDefault());
    minusBtn.addEventListener('click', () => {
      if (this.bytesPerRow > COL_MIN) {
        this.bytesPerRow >>= 1;
        this.updateColLabel();
        this.renderDisplay();
      }
    });

    this.colLabel = document.createElement('span');
    this.colLabel.className = 'hex-col-label';
    this.updateColLabel();

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'hex-col-btn';
    plusBtn.textContent = '+';
    plusBtn.title = 'More columns';
    plusBtn.addEventListener('mousedown', (e) => e.preventDefault());
    plusBtn.addEventListener('click', () => {
      if (this.bytesPerRow < COL_MAX) {
        this.bytesPerRow <<= 1;
        this.updateColLabel();
        this.renderDisplay();
      }
    });

    topbar.appendChild(minusBtn);
    topbar.appendChild(this.colLabel);
    topbar.appendChild(plusBtn);
    root.appendChild(topbar);

    // Display area
    this.display = document.createElement('div');
    this.display.className = 'hex-display';
    root.appendChild(this.display);

    // Hidden input for keyboard capture
    this.capture = document.createElement('input');
    this.capture.className = 'hex-capture';
    this.capture.type = 'text';
    this.capture.setAttribute('aria-label', 'Hex editor input');
    root.appendChild(this.capture);

    // Click display → focus capture + position cursor
    this.display.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const cell = target.closest('[data-idx]') as HTMLElement | null;
      if (cell) {
        const idx = parseInt(cell.dataset.idx!, 10);
        this.cursor = Math.min(idx, this.data.length);
        this.pendingNibble = null;
        this.renderDisplay();
      }
      this.capture.focus();
    });

    // Keyboard handling on capture input
    this.capture.addEventListener('keydown', (e) => this.handleKey(e));
    this.capture.addEventListener('input', () => { this.capture.value = ''; });

    this.capture.addEventListener('focus', () => this.display.classList.add('hex-focused'));
    this.capture.addEventListener('blur', () => this.display.classList.remove('hex-focused'));

    // Paste handling
    this.capture.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text') ?? '';
      const hex = text.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
      for (let i = 0; i + 1 < hex.length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        this.data.splice(this.cursor, 0, byte);
        this.cursor++;
      }
      this.pendingNibble = null;
      this.renderDisplay();
      this.onChange?.(this.getBytes());
    });

    // Helper buttons
    const helpers = document.createElement('div');
    helpers.className = 'hex-helpers';
    for (const qb of QUICK_BYTES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hex-quick-btn';
      btn.title = qb.title;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'hex-quick-label';
      labelSpan.textContent = qb.label;
      btn.appendChild(labelSpan);

      const hexStr = qb.value.toString(16).toUpperCase().padStart(2, '0');
      if (hexStr !== qb.label.toUpperCase()) {
        const hexSpan = document.createElement('span');
        hexSpan.className = 'hex-quick-hex';
        hexSpan.textContent = hexStr;
        btn.appendChild(hexSpan);
      }

      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        this.data.splice(this.cursor, 0, qb.value);
        this.cursor++;
        this.pendingNibble = null;
        this.renderDisplay();
        this.capture.focus();
        this.onChange?.(this.getBytes());
      });
      helpers.appendChild(btn);
    }
    root.appendChild(helpers);

    return root;
  }

  private updateColLabel(): void {
    this.colLabel.textContent = String(this.bytesPerRow);
  }

  // -----------------------------------------------------------------------
  // Keyboard
  // -----------------------------------------------------------------------

  private handleKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toLowerCase();

    if (key.length === 1 && '0123456789abcdef'.includes(key)) {
      e.preventDefault();
      const nibbleVal = parseInt(key, 16);
      if (this.pendingNibble === null) {
        this.pendingNibble = nibbleVal;
        this.renderDisplay();
      } else {
        const byte = (this.pendingNibble << 4) | nibbleVal;
        if (this.cursor < this.data.length) {
          this.data[this.cursor] = byte;
        } else {
          this.data.push(byte);
        }
        this.cursor++;
        this.pendingNibble = null;
        this.renderDisplay();
        this.onChange?.(this.getBytes());
      }
      return;
    }

    switch (e.key) {
      case 'Backspace':
        e.preventDefault();
        if (this.pendingNibble !== null) {
          this.pendingNibble = null;
        } else if (this.cursor > 0) {
          this.cursor--;
          this.data.splice(this.cursor, 1);
          this.onChange?.(this.getBytes());
        }
        this.renderDisplay();
        break;

      case 'Delete':
        e.preventDefault();
        if (this.pendingNibble !== null) {
          this.pendingNibble = null;
        } else if (this.cursor < this.data.length) {
          this.data.splice(this.cursor, 1);
          this.onChange?.(this.getBytes());
        }
        this.renderDisplay();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this.pendingNibble = null;
        if (this.cursor > 0) this.cursor--;
        this.renderDisplay();
        break;

      case 'ArrowRight':
        e.preventDefault();
        this.pendingNibble = null;
        if (this.cursor < this.data.length) this.cursor++;
        this.renderDisplay();
        break;

      case 'Home':
        e.preventDefault();
        this.pendingNibble = null;
        this.cursor = 0;
        this.renderDisplay();
        break;

      case 'End':
        e.preventDefault();
        this.pendingNibble = null;
        this.cursor = this.data.length;
        this.renderDisplay();
        break;

      case 'Escape':
        this.capture.blur();
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Render hex dump
  // -----------------------------------------------------------------------

  private renderDisplay(): void {
    this.display.innerHTML = '';

    const bpr = this.bytesPerRow;
    const totalPositions = this.data.length + 1;
    const rowCount = Math.max(1, Math.ceil(totalPositions / bpr));

    for (let r = 0; r < rowCount; r++) {
      const rowStart = r * bpr;
      const row = document.createElement('div');
      row.className = 'hex-row';

      // Address
      const addr = document.createElement('span');
      addr.className = 'hex-addr';
      addr.textContent = rowStart.toString(16).toUpperCase().padStart(4, '0');
      row.appendChild(addr);

      // Hex bytes
      const bytes = document.createElement('span');
      bytes.className = 'hex-bytes';
      for (let j = 0; j < bpr; j++) {
        const byteIdx = rowStart + j;
        const cell = document.createElement('span');
        cell.className = 'hex-cell';
        cell.dataset.idx = String(byteIdx);

        if (byteIdx === this.cursor && this.pendingNibble !== null) {
          cell.textContent = this.pendingNibble.toString(16) + '\u2581';
          cell.classList.add('hex-pending');
        } else if (byteIdx === this.cursor && byteIdx >= this.data.length) {
          cell.textContent = '\u2581\u2581';
          cell.classList.add('hex-cursor');
        } else if (byteIdx < this.data.length) {
          cell.textContent = this.data[byteIdx].toString(16).padStart(2, '0');
          if (byteIdx === this.cursor) cell.classList.add('hex-cursor');
        } else {
          cell.textContent = '  ';
          cell.classList.add('hex-empty');
        }

        if (j === bpr / 2 && bpr > 4) cell.classList.add('hex-mid');

        bytes.appendChild(cell);
      }
      row.appendChild(bytes);

      // ASCII
      const ascii = document.createElement('span');
      ascii.className = 'hex-ascii';
      let asciiText = '\u2502';
      for (let j = 0; j < bpr; j++) {
        const byteIdx = rowStart + j;
        if (byteIdx < this.data.length) {
          const b = this.data[byteIdx];
          asciiText += (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '\u00B7';
        } else {
          asciiText += ' ';
        }
      }
      asciiText += '\u2502';
      ascii.textContent = asciiText;
      row.appendChild(ascii);

      this.display.appendChild(row);
    }

    // Scroll cursor into view within the display container
    const cursorEl = this.display.querySelector('.hex-cursor, .hex-pending') as HTMLElement | null;
    if (cursorEl) {
      const top = cursorEl.offsetTop - this.display.offsetTop;
      const bottom = top + cursorEl.offsetHeight;
      if (top < this.display.scrollTop) {
        this.display.scrollTop = top;
      } else if (bottom > this.display.scrollTop + this.display.clientHeight) {
        this.display.scrollTop = bottom - this.display.clientHeight;
      }
    }
  }
}
