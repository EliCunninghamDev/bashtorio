import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { WirelessMachine } from '../../game/types';

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

export class WirelessModal extends BaseModal {
  private machine: WirelessMachine | null = null;
  private selected = 0;

  template() {
    return html`
      <div class="modal-content">
        <h3>Wireless</h3>
        <p class="modal-description">Broadcasts received bytes to all other wireless machines on the same channel.</p>
        <div class="form-group">
          <label>Channel:</label>
          <div class="channel-row">
            ${CHANNELS.map(ch => html`
              <button class="channel-btn" data-channel="${ch.value}"
                style="--ch-color: ${ch.color}">${ch.label}</button>
            `)}
          </div>
        </div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  protected setup() {
    this.querySelectorAll<HTMLButtonElement>('.channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selected = parseInt(btn.dataset.channel!);
        this.updateSelection();
      });
    });
  }

  configure(machine: WirelessMachine) {
    this.machine = machine;
    this.selected = machine.wirelessChannel;
    this.updateSelection();
    this.show();
  }

  private updateSelection() {
    this.querySelectorAll<HTMLButtonElement>('.channel-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.channel!) === this.selected);
    });
  }

  protected save() {
    if (this.machine) {
      this.machine.wirelessChannel = this.selected;
    }
    this.hide();
  }
}

customElements.define('bt-wireless-modal', WirelessModal);
