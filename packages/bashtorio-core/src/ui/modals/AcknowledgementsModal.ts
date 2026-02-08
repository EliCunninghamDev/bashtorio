import { html, render } from 'lit-html';
import { BaseModal } from './BaseModal';

interface AckPackage {
  name: string;
  version: string;
  license: string;
  author?: string;
  url?: string;
}

export class AcknowledgementsModal extends BaseModal {
  private packages: AckPackage[] = [];

  init(deps: { data: AckPackage[] }) {
    this.packages = deps.data;
    // Re-render with actual data
    if (this.isConnected) {
      render(this.template(), this);
      // Re-wire close handler on new DOM
      this.querySelector('[data-cancel]')?.addEventListener('click', () => this.hide());
    }
  }

  template() {
    return html`
      <div class="modal-content ack-modal-content">
        <h3>Acknowledgements</h3>
        <div class="acknowledgements-list">
          ${this.packages.map(pkg => html`
            <div class="ack-item">
              <div class="ack-item-header">
                <span class="ack-name">${pkg.name} <span class="ack-version">v${pkg.version}</span></span>
                <span class="ack-license">${pkg.license}</span>
              </div>
              <div class="ack-item-meta">
                ${pkg.author ? html`<span class="ack-author">${pkg.author}</span>` : ''}
                ${pkg.url ? html`${pkg.author ? ' · ' : ''}<a class="ack-url" href="${pkg.url}" target="_blank" rel="noopener">${pkg.url.replace(/^https?:\/\//, '')}</a>` : ''}
              </div>
            </div>
          `)}
        </div>
        <div class="ack-footer">
          <span>${this.packages.length} packages · ${new Set(this.packages.map(p => p.license).filter(Boolean)).size} unique licenses</span>
          <button data-cancel class="primary">Close</button>
        </div>
      </div>
    `;
  }

  open() {
    this.show();
  }
}

customElements.define('bt-acknowledgements-modal', AcknowledgementsModal);
