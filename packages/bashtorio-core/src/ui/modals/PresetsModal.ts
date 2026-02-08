import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { PRESETS } from '../../util/presets';
import { emitGameEvent } from '../../events/bus';

export class PresetsModal extends BaseModal {
  template() {
    return html`
      <div class="modal-content presets-modal-content">
        <h3>Load Preset</h3>
        <p class="modal-description">
          Select a preset to load. This will replace your current layout.
        </p>
        <div class="presets-list"></div>
        <div class="modal-buttons">
          <button data-cancel>Cancel</button>
        </div>
      </div>
    `;
  }

  protected setup() {
    const list = this.qs<HTMLElement>('.presets-list');
    list.innerHTML = PRESETS.map(preset => `
      <div class="preset-item" data-preset-id="${preset.id}">
        <div class="preset-name">${preset.name}</div>
        <div class="preset-description">${preset.description}</div>
      </div>
    `).join('');

    list.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.preset-item') as HTMLElement;
      if (!item) return;
      const presetId = item.dataset.presetId;
      if (!presetId) return;
      emitGameEvent('loadPresetByName', { id: presetId });
      this.hide();
    });
  }

  open() {
    this.show();
  }
}

customElements.define('bt-presets-modal', PresetsModal);
