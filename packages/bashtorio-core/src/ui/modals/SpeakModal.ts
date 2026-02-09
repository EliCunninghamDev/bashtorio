import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { SpeakMachine } from '../../game/types';
import { ByteInput } from '../components/ByteInput';
import { hasVoices } from '../../audio/SpeechEngine';

export class SpeakModal extends BaseModal {
  private machine: SpeakMachine | null = null;
  private delimiterInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Speak</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Text-to-speech - accumulates bytes until delimiter, then speaks.</p>
            <div class="speak-warning" style="display: none; color: #ff6666; margin-bottom: 8px; padding: 6px 8px; border: 1px solid #ff6666; border-radius: 4px; font-size: 12px;">
              No speech voices detected. Install a speech dispatcher (e.g. espeak-ng) and restart your browser.
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Rate:</label>
                <input type="range" class="styled-slider speak-rate" min="0.5" max="2" step="0.1" value="1" />
                <span class="speak-rate-value">1</span>
              </div>
              <div class="form-group">
                <label>Pitch:</label>
                <input type="range" class="styled-slider speak-pitch" min="0.5" max="2" step="0.1" value="1" />
                <span class="speak-pitch-value">1</span>
              </div>
            </div>
            <div class="form-group">
              <label>Delimiter:</label>
              <span class="speak-delimiter-container"></span>
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
    this.delimiterInput = new ByteInput({ value: '\n' });
    this.qs('.speak-delimiter-container').appendChild(this.delimiterInput.el);

    const rateSlider = this.qs<HTMLInputElement>('.speak-rate');
    const rateValue = this.qs<HTMLSpanElement>('.speak-rate-value');
    rateSlider.addEventListener('input', () => {
      rateValue.textContent = rateSlider.value;
    });

    const pitchSlider = this.qs<HTMLInputElement>('.speak-pitch');
    const pitchValue = this.qs<HTMLSpanElement>('.speak-pitch-value');
    pitchSlider.addEventListener('input', () => {
      pitchValue.textContent = pitchSlider.value;
    });
  }

  configure(machine: SpeakMachine) {
    this.machine = machine;
    const rateSlider = this.qs<HTMLInputElement>('.speak-rate');
    rateSlider.value = String(machine.speakRate);
    this.qs<HTMLSpanElement>('.speak-rate-value').textContent = String(machine.speakRate);

    const pitchSlider = this.qs<HTMLInputElement>('.speak-pitch');
    pitchSlider.value = String(machine.speakPitch);
    this.qs<HTMLSpanElement>('.speak-pitch-value').textContent = String(machine.speakPitch);

    this.delimiterInput.setValue(machine.speakDelimiter);
    this.qs<HTMLElement>('.speak-warning').style.display = hasVoices() ? 'none' : 'block';
    this.show();
  }

  protected save() {
    if (this.machine) {
      this.machine.speakRate = parseFloat(this.qs<HTMLInputElement>('.speak-rate').value);
      this.machine.speakPitch = parseFloat(this.qs<HTMLInputElement>('.speak-pitch').value);
      this.machine.speakDelimiter = this.delimiterInput.getValue();
    }
    this.hide();
  }
}

customElements.define('bt-speak-modal', SpeakModal);
