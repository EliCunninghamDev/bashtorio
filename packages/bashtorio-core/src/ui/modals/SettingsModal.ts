import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import { THEMES, getThemeById, applyUITheme } from '../../util/themes';
import { applyRendererTheme, setPhotoTextures } from '../../render/renderer';
import { loadSettings, saveSettings, type Settings } from '../../util/settings';
import { setAmbientVolume, setMachineVolume } from '../../audio/SoundSystem';

export class SettingsModal extends BaseModal {
  private settings!: Settings;
  private root: HTMLElement | null = null;

  init(deps: { root: HTMLElement }) {
    this.root = deps.root;
    this.settings = loadSettings();

    // Apply initial theme
    const initialTheme = getThemeById(this.settings.theme);
    applyRendererTheme(initialTheme);
    if (this.root) applyUITheme(this.root, initialTheme);
    document.body.style.background = initialTheme.uiBg;

    // Apply initial photo textures setting
    setPhotoTextures(this.settings.photoTextures);

    // Set initial values
    if (this.isConnected) {
      this.qs<HTMLSelectElement>('.theme-select').value = this.settings.theme;
      const ambientSlider = this.qs<HTMLInputElement>('.ambient-vol-slider');
      const machineSlider = this.qs<HTMLInputElement>('.machine-vol-slider');
      ambientSlider.value = String(this.settings.ambientVolume);
      this.qs<HTMLElement>('.ambient-vol-value').textContent = Math.round(this.settings.ambientVolume * 100) + '%';
      machineSlider.value = String(this.settings.machineVolume);
      this.qs<HTMLElement>('.machine-vol-value').textContent = Math.round(this.settings.machineVolume * 100) + '%';
      this.qs<HTMLInputElement>('.photo-textures-check').checked = this.settings.photoTextures;
    }
  }

  template() {
    // Generate theme options as static HTML since lit-html can handle arrays
    return html`
      <div class="modal-content">
        <h3>Settings</h3>
        <div class="form-group">
          <label>Color Theme:</label>
          <select class="theme-select"></select>
        </div>
        <div class="form-group">
          <label>Ambient Volume: <span class="ambient-vol-value">100%</span></label>
          <input type="range" class="styled-slider ambient-vol-slider" min="0" max="1" step="0.05" value="1">
        </div>
        <div class="form-group">
          <label>Machine Volume: <span class="machine-vol-value">100%</span></label>
          <input type="range" class="styled-slider machine-vol-slider" min="0" max="1" step="0.05" value="1">
        </div>
        <div class="form-group">
          <label class="machine-panel-check">
            <input type="checkbox" class="photo-textures-check" checked>
            <span>Photo Textures (WIP)</span>
          </label>
        </div>
        <div class="modal-buttons">
          <button class="ack-open-btn">Acknowledgements</button>
          <button data-cancel class="primary">Close</button>
        </div>
      </div>
    `;
  }

  protected setup() {
    // Populate theme options
    const themeSelect = this.qs<HTMLSelectElement>('.theme-select');
    themeSelect.innerHTML = THEMES.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    themeSelect.addEventListener('change', () => {
      const themeId = themeSelect.value;
      const theme = getThemeById(themeId);
      applyRendererTheme(theme);
      if (this.root) applyUITheme(this.root, theme);
      document.body.style.background = theme.uiBg;
      this.settings.theme = themeId;
      saveSettings(this.settings);
    });

    this.qs<HTMLInputElement>('.ambient-vol-slider').addEventListener('input', () => {
      const vol = parseFloat(this.qs<HTMLInputElement>('.ambient-vol-slider').value);
      setAmbientVolume(vol);
      this.qs<HTMLElement>('.ambient-vol-value').textContent = Math.round(vol * 100) + '%';
      this.settings.ambientVolume = vol;
      saveSettings(this.settings);
    });

    this.qs<HTMLInputElement>('.machine-vol-slider').addEventListener('input', () => {
      const vol = parseFloat(this.qs<HTMLInputElement>('.machine-vol-slider').value);
      setMachineVolume(vol);
      this.qs<HTMLElement>('.machine-vol-value').textContent = Math.round(vol * 100) + '%';
      this.settings.machineVolume = vol;
      saveSettings(this.settings);
    });

    this.qs<HTMLInputElement>('.photo-textures-check').addEventListener('change', () => {
      const enabled = this.qs<HTMLInputElement>('.photo-textures-check').checked;
      setPhotoTextures(enabled);
      this.settings.photoTextures = enabled;
      saveSettings(this.settings);
    });
  }

  open() {
    this.show();
  }

  /** Called from the outside to open acknowledgements modal */
  get ackOpenBtn(): HTMLElement {
    return this.qs('.ack-open-btn');
  }
}

customElements.define('bt-settings-modal', SettingsModal);
