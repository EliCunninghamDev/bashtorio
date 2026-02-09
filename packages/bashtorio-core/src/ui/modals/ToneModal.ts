import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { ToneMachine } from '../../game/types';

export class ToneModal extends BaseModal {
  private machine: ToneMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Tone</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Synthesizer - bytes 1-255 set frequency, 0 silences.</p>
            <div class="form-group">
              <label>Waveform:</label>
              <div class="radio-group tone-waveform">
                <label class="radio-option">
                  <input type="radio" name="tone-waveform" value="sine">
                  <span>Sine</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="tone-waveform" value="square">
                  <span>Square</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="tone-waveform" value="sawtooth">
                  <span>Sawtooth</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="tone-waveform" value="triangle">
                  <span>Triangle</span>
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

  configure(machine: ToneMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>(`.tone-waveform input[value="${machine.waveform}"]`).checked = true;
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.waveform = this.qs<HTMLInputElement>('.tone-waveform input:checked').value as OscillatorType;
    }
    this.hide();
  }
}

customElements.define('bt-tone-modal', ToneModal);
