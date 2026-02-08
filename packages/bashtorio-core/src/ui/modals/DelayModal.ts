import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { DelayMachine } from '../../game/types';

export class DelayModal extends BaseModal {
  private machine: DelayMachine | null = null;

  template() {
    return html`
      <div class="modal-content">
        <h3>Delay</h3>
        <p class="modal-description">Holds packets for a set duration before re-emitting.</p>
        <div class="form-group">
          <label>Delay (ms):</label>
          <input type="number" class="delay-ms" min="50" max="30000" step="50" value="1000">
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  configure(machine: DelayMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>('.delay-ms').value = String(machine.delayMs);
    this.show();
    this.qs<HTMLInputElement>('.delay-ms').focus();
    this.qs<HTMLInputElement>('.delay-ms').select();
  }

  protected save() {
    if (this.machine) {
      this.machine.delayMs = Math.max(50, parseInt(this.qs<HTMLInputElement>('.delay-ms').value) || 1000);
    }
    this.hide();
  }
}

customElements.define('bt-delay-modal', DelayModal);
