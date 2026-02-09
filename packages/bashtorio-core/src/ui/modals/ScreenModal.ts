import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { ScreenMachine, ScreenResolution } from '../../game/types';

export class ScreenModal extends BaseModal {
  private machine: ScreenMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Screen</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Monochrome bitmap display. Bytes are rendered as pixels (MSB first).</p>
            <div class="form-group">
              <label>Resolution:</label>
              <div class="radio-group screen-resolution">
                <label class="radio-option">
                  <input type="radio" name="screen-res" value="8">
                  <span>8×8</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="screen-res" value="16">
                  <span>16×16</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="screen-res" value="32">
                  <span>32×32</span>
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

  configure(machine: ScreenMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>(`.screen-resolution input[value="${machine.resolution}"]`).checked = true;
    this.show();
  }

  protected save() {
    if (this.machine) {
      const newRes = Number(this.qs<HTMLInputElement>('.screen-resolution input:checked').value) as ScreenResolution;
      if (newRes !== this.machine.resolution) {
        const bufSize = (newRes * newRes) / 8;
        this.machine.resolution = newRes;
        this.machine.buffer = new Uint8Array(bufSize);
        this.machine.writePos = 0;
      }
    }
    this.hide();
  }
}

customElements.define('bt-screen-modal', ScreenModal);
