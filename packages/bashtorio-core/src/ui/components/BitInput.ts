// ---------------------------------------------------------------------------
// BitInput – rows of 8 toggleable checkboxes for binary byte editing
// ---------------------------------------------------------------------------

export class BitInput {
  readonly el: HTMLElement;
  private rows: HTMLElement[] = [];
  private onChange: (() => void) | undefined;

  constructor(options?: { onChange?: () => void }) {
    this.onChange = options?.onChange;
    this.el = document.createElement('div');
    this.el.className = 'bit-input';

    // Column headers
    const header = document.createElement('div');
    header.className = 'bit-input-header';
    const weights = [128, 64, 32, 16, 8, 4, 2, 1];
    // Spacer for row number
    const numSpacer = document.createElement('span');
    numSpacer.className = 'bit-input-rownum';
    numSpacer.textContent = '';
    header.appendChild(numSpacer);
    for (const w of weights) {
      const span = document.createElement('span');
      span.textContent = String(w);
      header.appendChild(span);
    }
    // Spacer for value column
    const valSpacer = document.createElement('span');
    valSpacer.className = 'bit-input-value';
    valSpacer.textContent = 'Dec';
    header.appendChild(valSpacer);
    this.el.appendChild(header);

    // Controls (add/remove row)
    const controls = document.createElement('div');
    controls.className = 'bit-input-controls';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.title = 'Add row';
    addBtn.addEventListener('click', () => this.addRow());
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '\u2212';
    removeBtn.title = 'Remove last row';
    removeBtn.addEventListener('click', () => this.removeRow());
    controls.appendChild(addBtn);
    controls.appendChild(removeBtn);
    this.el.appendChild(controls);
  }

  getBytes(): Uint8Array {
    const bytes = new Uint8Array(this.rows.length);
    for (let i = 0; i < this.rows.length; i++) {
      bytes[i] = this.getRowValue(this.rows[i]);
    }
    return bytes;
  }

  setBytes(data: Uint8Array): void {
    // Remove all existing rows
    for (const row of this.rows) row.remove();
    this.rows = [];
    // Add rows for each byte
    for (let i = 0; i < data.length; i++) {
      this.addRow(data[i]);
    }
  }

  private addRow(value = 0): void {
    const row = document.createElement('div');
    row.className = 'bit-input-row';

    // Row number
    const rowNum = document.createElement('span');
    rowNum.className = 'bit-input-rownum';
    rowNum.textContent = String(this.rows.length);
    row.appendChild(rowNum);

    // 8 checkboxes (MSB first)
    for (let bit = 7; bit >= 0; bit--) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = ((value >> bit) & 1) === 1;
      cb.dataset.bit = String(bit);
      cb.addEventListener('change', () => {
        this.updateRowValue(row);
        this.onChange?.();
      });
      row.appendChild(cb);
    }

    // Decimal value
    const valSpan = document.createElement('span');
    valSpan.className = 'bit-input-value';
    valSpan.textContent = String(value);
    row.appendChild(valSpan);

    this.rows.push(row);
    // Insert before controls
    const controls = this.el.querySelector('.bit-input-controls')!;
    this.el.insertBefore(row, controls);
    this.updateRowNumbers();
  }

  private removeRow(): void {
    if (this.rows.length === 0) return;
    const row = this.rows.pop()!;
    row.remove();
    this.updateRowNumbers();
    this.onChange?.();
  }

  private getRowValue(row: HTMLElement): number {
    let value = 0;
    const checkboxes = row.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        value |= (1 << parseInt(cb.dataset.bit!, 10));
      }
    });
    return value;
  }

  private updateRowValue(row: HTMLElement): void {
    const value = this.getRowValue(row);
    const valSpan = row.querySelector('.bit-input-value') as HTMLElement;
    valSpan.textContent = String(value);
  }

  private updateRowNumbers(): void {
    for (let i = 0; i < this.rows.length; i++) {
      const numSpan = this.rows[i].querySelector('.bit-input-rownum') as HTMLElement;
      numSpan.textContent = String(i);
    }
  }
}
