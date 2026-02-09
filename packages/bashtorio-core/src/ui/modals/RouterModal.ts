import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import { DirectionInput } from '../components/DirectionInput';
import type { RouterMachine } from '../../game/types';

export class RouterModal extends BaseModal {
  private machine: RouterMachine | null = null;
  private byteInput!: ByteInput;
  private matchDirInput!: DirectionInput;
  private elseDirInput!: DirectionInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Router</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Routes bytes by match: matching byte goes to one direction, everything else to another.</p>
            <div class="form-group router-byte-input-mount"></div>
            <div class="form-row">
              <div class="form-group">
                <label>Match Direction:</label>
                <div class="router-match-dir-mount"></div>
              </div>
              <div class="form-group">
                <label>Else Direction:</label>
                <div class="router-else-dir-mount"></div>
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
    this.qs('.router-byte-input-mount').appendChild(this.byteInput.el);

    this.matchDirInput = new DirectionInput({ variant: 'outward' });
    this.qs('.router-match-dir-mount').appendChild(this.matchDirInput.el);

    this.elseDirInput = new DirectionInput({ variant: 'outward' });
    this.qs('.router-else-dir-mount').appendChild(this.elseDirInput.el);
  }

  configure(machine: RouterMachine) {
    this.machine = machine;
    this.byteInput.setValue(machine.routerByte);
    this.matchDirInput.setValue(machine.routerMatchDir);
    this.elseDirInput.setValue(machine.routerElseDir);
    this.show();
    this.byteInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.routerByte = this.byteInput.getValue() || '\n';
      this.machine.routerMatchDir = this.matchDirInput.getValue();
      this.machine.routerElseDir = this.elseDirInput.getValue();
    }
    this.hide();
  }
}

customElements.define('bt-router-modal', RouterModal);
