import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { ConstantMachine } from '../../game/types';

export class ConstantModal extends BaseModal {
  private machine: ConstantMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Constant</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Loops text forever at a set interval.</p>
            <div class="form-group">
              <label>Text:</label>
              <input type="text" class="const-text" value="hello\\n">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Release (ms):</label>
                <input type="number" class="const-interval" min="50" max="10000" step="50" value="500">
              </div>
              <div class="form-group">
                <label>Gap (ms):</label>
                <input type="number" class="const-gap" min="0" max="60000" step="50" value="0">
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

  configure(machine: ConstantMachine) {
    this.machine = machine;
    const displayText = machine.constantText.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    this.qs<HTMLInputElement>('.const-text').value = displayText;
    this.qs<HTMLInputElement>('.const-interval').value = String(machine.emitInterval);
    this.qs<HTMLInputElement>('.const-gap').value = String(machine.gapInterval);
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
      this.machine.gapInterval = Math.max(0, parseInt(this.qs<HTMLInputElement>('.const-gap').value) || 0);
    }
    this.hide();
  }
}

customElements.define('bt-constant-modal', ConstantModal);
