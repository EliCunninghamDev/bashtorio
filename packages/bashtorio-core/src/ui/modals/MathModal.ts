import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { MathMachine, MathOp } from '../../game/types';

export class MathModal extends BaseModal {
  private machine: MathMachine | null = null;

  template() {
    return html`
      <div class="modal-content">
        <h3>Math</h3>
        <p class="modal-description">Apply a byte arithmetic or bitwise operation to each received byte.</p>
        <div class="form-group">
          <label>Operation:</label>
          <select class="math-op modal-select">
            <option value="add">Add (+)</option>
            <option value="sub">Subtract (-)</option>
            <option value="mul">Multiply (*)</option>
            <option value="mod">Modulo (%)</option>
            <option value="xor">XOR (^)</option>
            <option value="and">AND (&amp;)</option>
            <option value="or">OR (|)</option>
            <option value="not">NOT (~)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Operand (0-255):</label>
          <input type="number" class="math-operand" min="0" max="255" step="1" value="1">
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  configure(machine: MathMachine) {
    this.machine = machine;
    this.qs<HTMLSelectElement>('.math-op').value = machine.mathOp;
    this.qs<HTMLInputElement>('.math-operand').value = String(machine.mathOperand);
    this.show();
    this.qs<HTMLSelectElement>('.math-op').focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.mathOp = this.qs<HTMLSelectElement>('.math-op').value as MathOp;
      this.machine.mathOperand = Math.max(0, Math.min(255, parseInt(this.qs<HTMLInputElement>('.math-operand').value) || 0));
    }
    this.hide();
  }
}

customElements.define('bt-math-modal', MathModal);
