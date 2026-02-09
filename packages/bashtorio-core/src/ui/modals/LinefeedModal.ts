import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { LinefeedMachine } from '../../game/types';

export class LinefeedModal extends BaseModal {
  private machine: LinefeedMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Linefeed Emitter</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Set the interval between line feed emissions.</p>
            <div class="form-group">
              <label>Interval (ms):</label>
              <input type="number" class="lf-interval" min="50" max="10000" step="50" value="500">
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

  configure(machine: LinefeedMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>('.lf-interval').value = String(machine.clock.interval);
    this.show();
    this.qs<HTMLInputElement>('.lf-interval').focus();
    this.qs<HTMLInputElement>('.lf-interval').select();
  }

  protected save() {
    if (this.machine) {
      this.machine.clock.interval = Math.max(50, parseInt(this.qs<HTMLInputElement>('.lf-interval').value) || 500);
    }
    this.hide();
  }
}

customElements.define('bt-linefeed-modal', LinefeedModal);
