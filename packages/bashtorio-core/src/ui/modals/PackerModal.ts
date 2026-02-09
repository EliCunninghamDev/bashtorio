import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { PackerMachine } from '../../game/types';

export class PackerModal extends BaseModal {
  private machine: PackerMachine | null = null;
  private byteInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Packer</span>
            <div class="machine-panel-controls">
              <label class="machine-panel-check">
                <input type="checkbox" class="packer-preserve">
                <span>Preserve delimiter</span>
              </label>
            </div>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Accumulates bytes until delimiter, then emits the buffer as one packet.</p>
            <div class="form-group packer-byte-input-mount"></div>
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
    this.byteInput = new ByteInput({ value: '\n' });
    this.qs('.packer-byte-input-mount').appendChild(this.byteInput.el);
  }

  configure(machine: PackerMachine) {
    this.machine = machine;
    this.byteInput.setValue(machine.packerDelimiter);
    this.qs<HTMLInputElement>('.packer-preserve').checked = machine.preserveDelimiter;
    this.show();
    this.byteInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.packerDelimiter = this.byteInput.getValue() || '\n';
      this.machine.preserveDelimiter = this.qs<HTMLInputElement>('.packer-preserve').checked;
    }
    this.hide();
  }
}

customElements.define('bt-packer-modal', PackerModal);
