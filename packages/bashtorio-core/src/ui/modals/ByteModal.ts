import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { ByteMachine } from '../../game/types';
import { HexInput } from '../components/HexInput';

export class ByteModal extends BaseModal {
  private machine: ByteMachine | null = null;
  private hexInput: HexInput | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Byte Source</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Emits raw bytes in a loop. Use the hex editor to enter data.</p>
            <div class="form-row">
              <div class="form-group">
                <label>Release (ms):</label>
                <input type="number" class="byte-interval" min="50" max="10000" step="50" value="500">
              </div>
              <div class="form-group">
                <label>Gap (ms):</label>
                <input type="number" class="byte-gap" min="0" max="60000" step="50" value="0">
              </div>
            </div>
            <div class="form-group">
              <label>Data:</label>
              <div class="byte-hex-container"></div>
            </div>
          </div>
          <div class="machine-panel-footer">
            <button class="byte-upload">Upload File</button>
            <button data-cancel>Cancel</button>
            <button data-save>Save</button>
          </div>
        </div>
      </div>
    `;
  }

  protected setup() {
    this.hexInput = new HexInput();
    this.qs('.byte-hex-container').appendChild(this.hexInput.el);

    this.qs('.byte-upload').addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          this.hexInput!.setBytes(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.readAsArrayBuffer(file);
      };
      fileInput.click();
    });
  }

  configure(machine: ByteMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>('.byte-interval').value = String(machine.clock.interval);
    this.qs<HTMLInputElement>('.byte-gap').value = String(machine.gapTimer.interval);
    this.hexInput!.setBytes(machine.byteData);
    this.show();
    this.hexInput!.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.clock.interval = Math.max(50, parseInt(this.qs<HTMLInputElement>('.byte-interval').value) || 500);
      this.machine.gapTimer.interval = Math.max(0, parseInt(this.qs<HTMLInputElement>('.byte-gap').value) || 0);
      this.machine.byteData = this.hexInput!.getBytes();
      this.machine.bytePos = 0;
    }
    this.hide();
  }
}

customElements.define('bt-byte-modal', ByteModal);
