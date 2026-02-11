import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { NoiseMachine } from '../../game/types';

export class NoiseModal extends BaseModal {
  private machine: NoiseMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Noise</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">GB noise channel — bytes 1-255 set pitch, 0 silences.</p>
            <div class="form-group">
              <label>LFSR Mode:</label>
              <div class="radio-group noise-mode">
                <label class="radio-option">
                  <input type="radio" name="noise-mode" value="15bit">
                  <span>15-bit (hissy)</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="noise-mode" value="7bit">
                  <span>7-bit (metallic)</span>
                </label>
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

  configure(machine: NoiseMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>(`.noise-mode input[value="${machine.noiseMode}"]`).checked = true;
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.noiseMode = this.qs<HTMLInputElement>('.noise-mode input:checked').value as '15bit' | '7bit';
    }
    this.hide();
  }
}

customElements.define('bt-noise-modal', NoiseModal);
