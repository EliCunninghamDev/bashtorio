import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { SinkMachine } from '../../game/types';
import { emitGameEvent } from '../../events/bus';

export class SinkModal extends BaseModal {
  private machine: SinkMachine | null = null;

  template() {
    return html`
      <div class="modal-content">
        <h3>Sink</h3>
        <p class="modal-description">Collects bytes and displays output in the sidebar.</p>
        <div class="form-group">
          <label>Name:</label>
          <input class="sink-name-input modal-input" type="text" placeholder="Sink name">
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  configure(machine: SinkMachine) {
    this.machine = machine;
    this.qs<HTMLInputElement>('.sink-name-input').value = machine.name;
    this.show();
    this.qs<HTMLInputElement>('.sink-name-input').focus();
    this.qs<HTMLInputElement>('.sink-name-input').select();
  }

  protected save() {
    if (this.machine) {
      const newName = this.qs<HTMLInputElement>('.sink-name-input').value.trim() || `Sink ${this.machine.sinkId}`;
      this.machine.name = newName;
      emitGameEvent('sinkRename', { machine: this.machine });
    }
    this.hide();
  }
}

customElements.define('bt-sink-modal', SinkModal);
