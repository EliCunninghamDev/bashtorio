import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { ReplaceMachine } from '../../game/types';

export class ReplaceModal extends BaseModal {
  private machine: ReplaceMachine | null = null;
  private fromInput!: ByteInput;
  private toInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Replace</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Substitutes one byte for another. Non-matching bytes pass through unchanged.</p>
            <div class="form-row">
              <div class="form-group">
                <label>From:</label>
                <div class="replace-from-input-mount"></div>
              </div>
              <div class="form-group">
                <label>To:</label>
                <div class="replace-to-input-mount"></div>
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
    this.fromInput = new ByteInput({ value: 'a' });
    this.toInput = new ByteInput({ value: 'b' });
    this.qs('.replace-from-input-mount').appendChild(this.fromInput.el);
    this.qs('.replace-to-input-mount').appendChild(this.toInput.el);
  }

  configure(machine: ReplaceMachine) {
    this.machine = machine;
    this.fromInput.setValue(machine.replaceFrom);
    this.toInput.setValue(machine.replaceTo);
    this.show();
    this.fromInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.replaceFrom = this.fromInput.getValue() || 'a';
      this.machine.replaceTo = this.toInput.getValue() || 'b';
    }
    this.hide();
  }
}

customElements.define('bt-replace-modal', ReplaceModal);
