import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { ByteInput } from '../components/ByteInput';
import type { ButtonMachine } from '../../game/types';

const CHANNELS = [
  { value: 0, label: '0', color: '#ff4444' },
  { value: 1, label: '1', color: '#ff8800' },
  { value: 2, label: '2', color: '#ffcc00' },
  { value: 3, label: '3', color: '#44cc44' },
  { value: 4, label: '4', color: '#44cccc' },
  { value: 5, label: '5', color: '#4488ff' },
  { value: 6, label: '6', color: '#aa44ff' },
  { value: 7, label: '7', color: '#ff44aa' },
];

export class ButtonModal extends BaseModal {
  private machine: ButtonMachine | null = null;
  private selectedChannel = 0;
  private byteInput!: ByteInput;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Button</span>
          </div>
          <div class="machine-panel-body">
            <p class="modal-description">Click during simulation to emit a byte onto the output belt.</p>
            <div class="form-group button-byte-input-mount"></div>
            <div class="form-group">
              <label>Color:</label>
              <div class="channel-row">
                ${CHANNELS.map(ch => html`
                  <button class="channel-btn" data-channel="${ch.value}"
                    style="--ch-color: ${ch.color}">${ch.label}</button>
                `)}
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
    this.byteInput = new ByteInput({ value: '1' });
    this.qs('.button-byte-input-mount').appendChild(this.byteInput.el);

    this.querySelectorAll<HTMLButtonElement>('.channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedChannel = parseInt(btn.dataset.channel!);
        this.updateSelection();
      });
    });
  }

  configure(machine: ButtonMachine) {
    this.machine = machine;
    this.selectedChannel = machine.buttonChannel;
    this.byteInput.setValue(machine.buttonByte);
    this.updateSelection();
    this.show();
    this.byteInput.focus();
  }

  private updateSelection() {
    this.querySelectorAll<HTMLButtonElement>('.channel-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.channel!) === this.selectedChannel);
    });
  }

  protected save() {
    if (this.machine) {
      this.machine.buttonByte = this.byteInput.getValue() || '1';
      this.machine.buttonChannel = this.selectedChannel;
    }
    this.hide();
  }
}

customElements.define('bt-button-modal', ButtonModal);
