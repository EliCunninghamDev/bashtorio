import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { DirectionInput } from '../components/DirectionInput';
import type { FlipperMachine } from '../../game/types';

export class FlipperModal extends BaseModal {
  private machine: FlipperMachine | null = null;
  private dirInput!: DirectionInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Flipper</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Rotates output direction clockwise on every received packet.</p>
            <div class="form-group">
              <label>Initial Direction:</label>
              <div class="flipper-dir-mount"></div>
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
    this.dirInput = new DirectionInput({ variant: 'outward' });
    this.qs('.flipper-dir-mount').appendChild(this.dirInput.el);
  }

  configure(machine: FlipperMachine) {
    this.machine = machine;
    this.dirInput.setValue(machine.flipperDir);
    this.show();
    this.dirInput.focus();
  }

  protected save() {
    if (this.machine) {
      const dir = this.dirInput.getValue();
      this.machine.flipperDir = dir;
      this.machine.flipperState = dir;
    }
    this.hide();
  }
}

customElements.define('bt-flipper-modal', FlipperModal);
