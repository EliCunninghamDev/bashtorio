import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { DirectionInput } from '../components/DirectionInput';
import type { LatchMachine } from '../../game/types';

export class LatchModal extends BaseModal {
  private machine: LatchMachine | null = null;
  private dataDirInput!: DirectionInput;
  private controlDirInput!: DirectionInput;

  template() {
    return html`
      <div class="modal-content">
        <h3>Latch</h3>
        <p class="modal-description">Stores the last data byte received. Emits stored byte when a control signal arrives.</p>
        <div class="form-group">
          <label>Data comes FROM:</label>
          <div class="latch-data-dir-mount"></div>
        </div>
        <div class="form-group">
          <label>Control comes FROM:</label>
          <div class="latch-control-dir-mount"></div>
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
    this.qs('.latch-data-dir-mount').appendChild(this.dataDirInput.el);

    this.controlDirInput = new DirectionInput({ variant: 'inward' });
    this.qs('.latch-control-dir-mount').appendChild(this.controlDirInput.el);
  }

  configure(machine: LatchMachine) {
    this.machine = machine;
    this.dataDirInput.setValue(machine.latchDataDir);
    this.controlDirInput.setValue(machine.latchControlDir);
    this.show();
    this.dataDirInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.latchDataDir = this.dataDirInput.getValue();
      this.machine.latchControlDir = this.controlDirInput.getValue();
    }
    this.hide();
  }
}

customElements.define('bt-latch-modal', LatchModal);
