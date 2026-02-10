import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import * as vm from '../../game/vm';

export class NetworkModal extends BaseModal {

  template() {
    return html`
      <div class="modal-content">
        <h3>Network Settings</h3>
        <p class="modal-description">
          The VM connects to the internet through a public WebSocket relay.
          Public relays provide limited bandwidth — for best results, run a
          private relay locally or in your network. The easiest way is via Docker:
        </p>
        <div class="form-group">
          <label>Run a private relay:</label>
          <code class="relay-docker-cmd">docker run --privileged -p 8080:80 --name relay benjamincburns/jor1k-relay:latest</code>
        </div>
        <div class="form-group">
          <label>Custom relay URL (leave blank for default):</label>
          <input type="text" class="relay-url" placeholder="ws://127.0.0.1:8080/">
        </div>
        <p class="modal-warning">Networking is experimental. Changes require a page reload.</p>
        <div class="network-status">
          <span class="status-dot"></span>
          <span class="status-text"></span>
        </div>
        <div class="modal-buttons">
          <button data-cancel>Close</button>
          <button class="network-reset">Reset to Default</button>
          <button class="network-connect primary">Save & Reload</button>
        </div>
      </div>
    `;
  }

  protected setup() {
    const savedRelay = localStorage.getItem('bashtorio_relay_url') || '';
    this.qs<HTMLInputElement>('.relay-url').value = savedRelay;

    this.qs('.network-connect').addEventListener('click', () => {
      const url = this.qs<HTMLInputElement>('.relay-url').value.trim();
      if (url) {
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          alert('Relay URL must start with ws:// or wss://');
          return;
        }
        localStorage.setItem('bashtorio_relay_url', url);
      } else {
        localStorage.removeItem('bashtorio_relay_url');
      }
      location.reload();
    });

    this.qs('.network-reset').addEventListener('click', () => {
      localStorage.removeItem('bashtorio_relay_url');
      this.qs<HTMLInputElement>('.relay-url').value = '';
      location.reload();
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
    const relay = vm.getNetworkRelay();

    if (relay) {
      dot.classList.add('connected');
      text.textContent = 'Connected to ' + relay;
    } else {
      dot.classList.remove('connected');
      text.textContent = 'Not connected';
    }
  }
}

customElements.define('bt-network-modal', NetworkModal);
