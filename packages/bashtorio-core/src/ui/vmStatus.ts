import { onGameEvent } from '../events/bus';

const STATUS_TEXT: Record<string, string> = {
  ready: 'VM Ready',
  busy: 'Processing...',
  error: 'VM Error',
};

export class VMStatus extends HTMLElement {
  connectedCallback() {
    this.className = 'vm-status ready';
    this.innerHTML = '<span class="status-dot"></span><span class="status-text">VM Ready</span>';
    onGameEvent('vmStatusChange', ({ status }) => {
      this.className = 'vm-status ' + status;
      const text = this.querySelector('.status-text');
      if (text) text.textContent = STATUS_TEXT[status] ?? status;
    });
  }
}

customElements.define('bt-vm-status', VMStatus);
