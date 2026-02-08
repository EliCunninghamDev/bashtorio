import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { ConstantMachine } from '../../game/types';

export class ConstantModal extends BaseModal {
  private machine: ConstantMachine | null = null;

  template() {
    return html`
      <div class="modal-content">
        <h3>Constant</h3>
        <p class="modal-description">Loops text forever at a set interval.</p>
        <div class="form-group">
          <label>Text:</label>
          <input type="text" class="const-text" value="hello\\n">
        </div>
        <div class="form-group">
          <label>Interval (ms):</label>
          <input type="number" class="const-interval" min="50" max="10000" step="50" value="500">
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  configure(machine: ConstantMachine) {
    this.machine = machine;
    const displayText = machine.constantText.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    this.qs<HTMLInputElement>('.const-text').value = displayText;
    this.qs<HTMLInputElement>('.const-interval').value = String(machine.emitInterval);
    this.show();
    this.qs<HTMLInputElement>('.const-text').focus();
    this.qs<HTMLInputElement>('.const-text').select();
  }

  protected save() {
    if (this.machine) {
      const raw = this.qs<HTMLInputElement>('.const-text').value;
      const text = raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
      this.machine.constantText = text || 'hello\n';
      this.machine.emitInterval = Math.max(50, parseInt(this.qs<HTMLInputElement>('.const-interval').value) || 500);
    }
    this.hide();
  }
}

customElements.define('bt-constant-modal', ConstantModal);
