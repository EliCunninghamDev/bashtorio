import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { SinkMachine } from '../../game/types';
import { emitGameEvent } from '../../events/bus';

export class SinkModal extends BaseModal {
  private machine: SinkMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Sink</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Collects bytes and displays output in the sidebar.</p>
            <div class="form-group">
              <label>Name:</label>
              <input class="sink-name-input modal-input" type="text" placeholder="Sink name">
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
