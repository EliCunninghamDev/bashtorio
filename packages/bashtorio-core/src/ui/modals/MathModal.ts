import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { MathMachine, MathOp } from '../../game/types';

export class MathModal extends BaseModal {
  private machine: MathMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Math</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Apply a byte arithmetic or bitwise operation to each received byte.</p>
            <div class="form-group">
              <label>Operand (0-255):</label>
              <input type="number" class="math-operand" min="0" max="255" step="1" value="1">
            </div>
            <div class="form-group">
              <label>Operation:</label>
              <div class="radio-group radio-group--compact math-op">
                <label class="radio-option"><input type="radio" name="math-op" value="add"><span>+</span></label>
                <label class="radio-option"><input type="radio" name="math-op" value="sub"><span>−</span></label>
                <label class="radio-option"><input type="radio" name="math-op" value="mul"><span>×</span></label>
                <label class="radio-option"><input type="radio" name="math-op" value="mod"><span>%</span></label>
                <label class="radio-option"><input type="radio" name="math-op" value="xor"><span>XOR</span></label>
                <label class="radio-option"><input type="radio" name="math-op" value="and"><span>AND</span></label>
                <label class="radio-option"><input type="radio" name="math-op" value="or"><span>OR</span></label>
                <label class="radio-option"><input type="radio" name="math-op" value="not"><span>NOT</span></label>
              </div>
            </div>
          </div>
          <div class="machine-panel-footer">
            <button data-cancel>Cancel</button>
            <button data-save>Save</button>
          </div>
        </div>
      </div>
    `;
  }

  configure(machine: MathMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>(`.math-op input[value="${machine.mathOp}"]`).checked = true;
    this.qs<HTMLInputElement>('.math-operand').value = String(machine.mathOperand);
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.mathOp = this.qs<HTMLInputElement>('.math-op input:checked').value as MathOp;
      this.machine.mathOperand = Math.max(0, Math.min(255, parseInt(this.qs<HTMLInputElement>('.math-operand').value) || 0));
    }
    this.hide();
  }
}

customElements.define('bt-math-modal', MathModal);
