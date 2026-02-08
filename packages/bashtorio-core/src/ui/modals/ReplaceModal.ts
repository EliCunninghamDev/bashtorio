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
      <div class="modal-content">
        <h3>Replace</h3>
        <p class="modal-description">Substitutes one byte for another. Non-matching bytes pass through unchanged.</p>
        <div class="form-group replace-from-input-mount"></div>
        <div class="form-group replace-to-input-mount"></div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
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
