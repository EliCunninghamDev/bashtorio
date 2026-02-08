import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import * as vm from '../../game/vm';

export class NetworkModal extends BaseModal {
  private systembar: HTMLElement | null = null;

  init(deps: { systembar: HTMLElement }) {
    this.systembar = deps.systembar;
  }

  template() {
    return html`
      <div class="modal-content">
        <h3>Network Settings</h3>
        <p class="modal-description">
          Connect to a WebSocket relay to enable internet access in the VM.
          Run your own relay locally for security.
        </p>
        <div class="form-group">
          <label>Run the relay:</label>
          <code class="relay-docker-cmd">docker run --privileged -p 8080:80 --name relay benjamincburns/jor1k-relay:latest</code>
        </div>
        <div class="form-group">
          <label>Relay URL:</label>
          <input type="text" class="relay-url" placeholder="ws://127.0.0.1:8080/">
        </div>
        <p class="modal-warning">Networking is experimental. No warranty is provided. Use at your own risk.</p>
        <div class="network-status">
          <span class="status-dot"></span>
          <span class="status-text">Not connected</span>
        </div>
        <div class="modal-buttons">
          <button data-cancel>Close</button>
          <button class="network-connect primary">Connect</button>
        </div>
      </div>
    `;
  }

  protected setup() {
    const savedRelay = localStorage.getItem('bashtorio_relay_url') || '';
    this.qs<HTMLInputElement>('.relay-url').value = savedRelay;

    this.qs('.network-connect').addEventListener('click', () => {
      const url = this.qs<HTMLInputElement>('.relay-url').value.trim();
      if (vm.getNetworkRelay() && !url) {
        localStorage.removeItem('bashtorio_relay_url');
        location.reload();
      } else if (url) {
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          alert('Relay URL must start with ws:// or wss://');
          return;
        }
        localStorage.setItem('bashtorio_relay_url', url);
        location.reload();
      } else {
        localStorage.removeItem('bashtorio_relay_url');
        this.updateNetworkUI();
      }
    });
  }

  open() {
    this.updateNetworkUI();
    this.show();
    this.qs<HTMLInputElement>('.relay-url').focus();
  }

  updateNetworkUI() {
    const dot = this.qs<HTMLElement>('.status-dot');
    const text = this.qs<HTMLElement>('.status-text');
    const connectBtn = this.qs<HTMLButtonElement>('.network-connect');
    const networkBtn = this.systembar?.querySelector('.network-btn') as HTMLElement | null;
    const savedRelay = localStorage.getItem('bashtorio_relay_url') || '';

    if (vm.getNetworkRelay()) {
      dot.classList.add('connected');
      text.textContent = 'Connected to ' + vm.getNetworkRelay();
      connectBtn.textContent = 'Disconnect';
      networkBtn?.classList.add('connected');
    } else if (savedRelay) {
      dot.classList.remove('connected');
      text.textContent = 'Will connect on next reload';
      connectBtn.textContent = 'Save & Reload';
      networkBtn?.classList.remove('connected');
    } else {
      dot.classList.remove('connected');
      text.textContent = 'Not connected';
      connectBtn.textContent = 'Connect';
      networkBtn?.classList.remove('connected');
    }
  }
}

customElements.define('bt-network-modal', NetworkModal);
