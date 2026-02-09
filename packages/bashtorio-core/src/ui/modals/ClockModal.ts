import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { ClockMachine } from '../../game/types';

export class ClockModal extends BaseModal {
  private machine: ClockMachine | null = null;
  private byteInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Clock</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Emits a byte at regular intervals. Ignores input.</p>
            <div class="form-group clock-byte-input-mount"></div>
            <div class="form-group">
              <label>Interval (ms):</label>
              <input type="number" class="clock-interval" min="50" max="30000" step="50" value="1000">
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
    this.byteInput = new ByteInput({ value: '*' });
    this.qs('.clock-byte-input-mount').appendChild(this.byteInput.el);
  }

  configure(machine: ClockMachine) {
    this.machine = machine;
    this.byteInput.setValue(machine.clockByte);
    this.qs<HTMLInputElement>('.clock-interval').value = String(machine.clock.interval);
    this.show();
    this.byteInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.clockByte = this.byteInput.getValue() || '*';
      this.machine.clock.interval = Math.max(50, parseInt(this.qs<HTMLInputElement>('.clock-interval').value) || 1000);
    }
    this.hide();
  }
}

customElements.define('bt-clock-modal', ClockModal);
