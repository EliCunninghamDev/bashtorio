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
            <div class="machine-panel-controls">
              <div class="radio-group tone-duty">
                <label class="radio-option">
                  <input type="radio" name="tone-duty" value="0.125">
                  <span>12.5%</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="tone-duty" value="0.25">
                  <span>25%</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="tone-duty" value="0.5">
                  <span>50%</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="tone-duty" value="0.75">
                  <span>75%</span>
                </label>
              </div>
            </div>
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
    this.qs<HTMLInputElement>(`.tone-duty input[value="${machine.dutyCycle}"]`).checked = true;
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.waveform = this.qs<HTMLInputElement>('.tone-waveform input:checked').value as OscillatorType;
      this.machine.dutyCycle = parseFloat(this.qs<HTMLInputElement>('.tone-duty input:checked').value);
    }
    this.hide();
  }
}

customElements.define('bt-tone-modal', ToneModal);
