import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { DirectionInput } from '../components/DirectionInput';
import type { GateMachine } from '../../game/types';

export class GateModal extends BaseModal {
  private machine: GateMachine | null = null;
  private dataDirInput!: DirectionInput;
  private controlDirInput!: DirectionInput;

  template() {
    return html`
      <div class="modal-content">
        <h3>Gate</h3>
        <p class="modal-description">Data passes through only when a control signal opens the gate. Gate closes after one byte passes.</p>
        <div class="form-group">
          <label>Data comes FROM:</label>
          <div class="gate-data-dir-mount"></div>
        </div>
        <div class="form-group">
          <label>Control comes FROM:</label>
          <div class="gate-control-dir-mount"></div>
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  protected setup() {
    this.dataDirInput = new DirectionInput({ variant: 'inward' });
    this.qs('.gate-data-dir-mount').appendChild(this.dataDirInput.el);

    this.controlDirInput = new DirectionInput({ variant: 'inward' });
    this.qs('.gate-control-dir-mount').appendChild(this.controlDirInput.el);
  }

  configure(machine: GateMachine) {
    this.machine = machine;
    this.dataDirInput.setValue(machine.gateDataDir);
    this.controlDirInput.setValue(machine.gateControlDir);
    this.show();
    this.dataDirInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.gateDataDir = this.dataDirInput.getValue();
      this.machine.gateControlDir = this.controlDirInput.getValue();
    }
    this.hide();
  }
}

customElements.define('bt-gate-modal', GateModal);
