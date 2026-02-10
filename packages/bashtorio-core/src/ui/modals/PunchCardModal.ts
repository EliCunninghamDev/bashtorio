import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { PunchCardMachine } from '../../game/types';
import { BitInput } from '../components/BitInput';

export class PunchCardModal extends BaseModal {
  private machine: PunchCardMachine | null = null;
  private bitInput: BitInput | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Punch Card</span>
            <div class="machine-panel-controls">
              <label class="machine-panel-check">
                <input type="checkbox" class="card-loop">
                <span>Loop</span>
              </label>
            </div>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Toggle bits to define byte data. Each row emits one byte.</p>
            <div class="form-row">
              <div class="form-group">
                <label>Release (ms):</label>
                <input type="number" class="card-interval" min="50" max="10000" step="50" value="500">
              </div>
              <div class="form-group">
                <label>Gap (ms):</label>
                <input type="number" class="card-gap" min="0" max="60000" step="50" value="0">
              </div>
            </div>
            <div class="form-group">
              <label>Data:</label>
              <div class="card-bit-container"></div>
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

  protected setup() {
    this.bitInput = new BitInput();
    this.qs('.card-bit-container').appendChild(this.bitInput.el);
  }

  configure(machine: PunchCardMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>('.card-interval').value = String(machine.clock.interval);
    this.qs<HTMLInputElement>('.card-gap').value = String(machine.gapTimer.interval);
    this.qs<HTMLInputElement>('.card-loop').checked = machine.loop;
    this.bitInput!.setBytes(machine.cardData);
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.clock.interval = Math.max(50, parseInt(this.qs<HTMLInputElement>('.card-interval').value) || 500);
      this.machine.gapTimer.interval = Math.max(0, parseInt(this.qs<HTMLInputElement>('.card-gap').value) || 0);
      this.machine.loop = this.qs<HTMLInputElement>('.card-loop').checked;
      this.machine.cardData = this.bitInput!.getBytes();
      this.machine.cardPos = 0;
    }
    this.hide();
  }
}

customElements.define('bt-punchcard-modal', PunchCardModal);
