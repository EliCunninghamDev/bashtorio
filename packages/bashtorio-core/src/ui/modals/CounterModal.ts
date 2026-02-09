import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { CounterMachine } from '../../game/types';

export class CounterModal extends BaseModal {
  private machine: CounterMachine | null = null;
  private byteInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Counter</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Counts received bytes. Emits count and resets on trigger byte.</p>
            <div class="form-group counter-byte-input-mount"></div>
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
    this.qs('.counter-byte-input-mount').appendChild(this.byteInput.el);
  }

  configure(machine: CounterMachine) {
    this.machine = machine;
    this.byteInput.setValue(machine.counterTrigger);
    this.show();
    this.byteInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.counterTrigger = this.byteInput.getValue() || '\n';
    }
    this.hide();
  }
}

customElements.define('bt-counter-modal', CounterModal);
