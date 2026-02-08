import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { PackerMachine } from '../../game/types';

export class PackerModal extends BaseModal {
  private machine: PackerMachine | null = null;
  private byteInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content">
        <h3>Packer</h3>
        <p class="modal-description">Accumulates bytes until delimiter, then emits the buffer as one packet.</p>
        <div class="form-group packer-byte-input-mount"></div>
        <div class="form-group">
          <label><input type="checkbox" class="packer-preserve"> Preserve delimiter in output</label>
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
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
