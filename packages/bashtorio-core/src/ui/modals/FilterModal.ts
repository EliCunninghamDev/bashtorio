import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { FilterMachine } from '../../game/types';

export class FilterModal extends BaseModal {
  private machine: FilterMachine | null = null;
  private byteInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Filter</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Pass or block a specific packet.</p>
            <div class="form-group filter-byte-input-mount"></div>
            <div class="form-group">
              <label>Mode:</label>
              <div class="radio-group filter-mode">
                <label class="radio-option">
                  <input type="radio" name="filter-mode" value="pass">
                  <span>Pass</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="filter-mode" value="block">
                  <span>Block</span>
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

  protected setup() {
    this.byteInput = new ByteInput({ value: '\n' });
    this.qs('.filter-byte-input-mount').appendChild(this.byteInput.el);
  }

  configure(machine: FilterMachine) {
    this.machine = machine;
    this.byteInput.setValue(machine.filterByte);
    this.qs<HTMLInputElement>(`.filter-mode input[value="${machine.filterMode}"]`).checked = true;
    this.show();
    this.byteInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.filterByte = this.byteInput.getValue() || '\n';
      this.machine.filterMode = this.qs<HTMLInputElement>('.filter-mode input:checked').value as 'pass' | 'block';
    }
    this.hide();
  }
}

customElements.define('bt-filter-modal', FilterModal);
