import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { FilterMachine } from '../../game/types';

export class FilterModal extends BaseModal {
  private machine: FilterMachine | null = null;
  private byteInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content">
        <h3>Filter</h3>
        <p class="modal-description">Pass or block a specific byte.</p>
        <div class="form-group filter-byte-input-mount"></div>
        <div class="form-group">
          <label>Mode:</label>
          <select class="filter-mode-select modal-select">
            <option value="pass">Pass (only matching)</option>
            <option value="block">Block (everything except)</option>
          </select>
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
    this.qs('.filter-byte-input-mount').appendChild(this.byteInput.el);
  }

  configure(machine: FilterMachine) {
    this.machine = machine;
    this.byteInput.setValue(machine.filterByte);
    this.qs<HTMLSelectElement>('.filter-mode-select').value = machine.filterMode;
    this.show();
    this.byteInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.filterByte = this.byteInput.getValue() || '\n';
      this.machine.filterMode = this.qs<HTMLSelectElement>('.filter-mode-select').value as 'pass' | 'block';
    }
    this.hide();
  }
}

customElements.define('bt-filter-modal', FilterModal);
