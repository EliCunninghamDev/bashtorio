import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { ToneMachine } from '../../game/types';

export class ToneModal extends BaseModal {
  private machine: ToneMachine | null = null;

  template() {
    return html`
      <div class="modal-content">
        <h3>Tone</h3>
        <p class="modal-description">Synthesizer - bytes 1-255 set frequency, 0 silences.</p>
        <div class="form-group">
          <label>Waveform:</label>
          <select class="tone-waveform-select modal-select">
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
          </select>
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  configure(machine: ToneMachine) {
    this.machine = machine;
    this.qs<HTMLSelectElement>('.tone-waveform-select').value = machine.waveform;
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.waveform = this.qs<HTMLSelectElement>('.tone-waveform-select').value as OscillatorType;
    }
    this.hide();
  }
}

customElements.define('bt-tone-modal', ToneModal);
