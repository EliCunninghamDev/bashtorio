import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { DrumMachine } from '../../game/types';

export class DrumModal extends BaseModal {
  private machine: DrumMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Drum</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Plays a drum sample for each packet received. Packets pass through.</p>
            <div class="form-group">
              <label class="machine-panel-check">
                <input type="checkbox" class="drum-bitmask">
                <span>Bitmask mode</span>
              </label>
              <p class="modal-description">
                <strong>Off:</strong> packet value % 4 selects one sample (kick / snare / hat / tom).<br>
                <strong>On:</strong> bits 0–3 trigger samples simultaneously (bit 0 = kick, 1 = snare, 2 = hat, 3 = tom).
              </p>
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

  configure(machine: DrumMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>('.drum-bitmask').checked = machine.bitmask;
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.bitmask = this.qs<HTMLInputElement>('.drum-bitmask').checked;
    }
    this.hide();
  }
}

customElements.define('bt-drum-modal', DrumModal);
