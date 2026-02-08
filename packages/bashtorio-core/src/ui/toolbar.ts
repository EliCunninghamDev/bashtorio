import { html, render } from 'lit-html';
import type { GameState } from '../game/state';
import { isMuted } from '../audio/SoundSystem';
import { emitGameEvent, onGameEvent } from '../events/bus';
import type { CursorMode } from '../game/types';
import * as cam from '../game/camera';

interface ModeItem { id: CursorMode; icon: string; label: string; key: string }

const MODES: ModeItem[] = [
  { id: 'select', icon: '👆', label: 'Select', key: '1' },
  { id: 'erase', icon: '🗑️', label: 'Erase', key: '2' },
];

export class Toolbar {
  private zoomValue: HTMLElement;
  private speedValue: HTMLElement;
  private runBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private muteBtn: HTMLElement;
  private dirArrow: SVGElement;
  private storagePopout: HTMLElement;
  private storageBtn: HTMLElement;
  private dirRotation: number;
  private dirPrevRotation: number;

  constructor(
    toolbar: HTMLElement,
    systembar: HTMLElement,
    state: GameState,
  ) {
    // --- System bar (top) ---
    render(html`
      <div class="mode-btn-wrapper">
        <button class="action-btn storage-btn">💾 Storage</button>
        <div class="storage-popout" style="display: none;">
          <button class="action-btn save-btn">💾 Save</button>
          <button class="action-btn load-btn">📂 Load</button>
          <button class="action-btn presets-btn">📚 Presets</button>
        </div>
      </div>
      <bt-event-button event="requestCopyLink" btn-class="action-btn" title="Copy factory link" label="🔗"></bt-event-button>
      <bt-event-button event="openSettings" btn-class="action-btn" title="Settings" label="⚙️"></bt-event-button>
      <bt-event-button event="openHelp" btn-class="action-btn" title="How It Works" label="❓"></bt-event-button>
      <bt-event-button event="openManual" btn-class="action-btn" title="Controls Reference" label="📖"></bt-event-button>
      <div class="systembar-spacer"></div>
      <bt-vm-status></bt-vm-status>
      <bt-event-button event="openNetwork" btn-class="action-btn" label="🌐"></bt-event-button>
      <button class="action-btn mute-btn" title="Toggle Sound">${isMuted() ? '🔇' : '🔊'}</button>
    `, systembar);

    // --- Toolbar (bottom) ---
    render(html`
      <div class="toolbar-main">
        <div class="tool-group mode-group">
          ${MODES.map(m => html`
            <button class="mode-btn ${m.id === state.currentMode ? 'active' : ''}" data-mode="${m.id}" title="${m.label} (${m.key})">
              <span class="tool-icon">${m.icon}</span>
              <span class="tool-label">${m.label}</span>
            </button>
          `)}
          <bt-placeable-button></bt-placeable-button>
        </div>
        <div class="tool-group">
          <span class="direction-label">Dir:</span>
          <button class="dir-btn"><svg class="dir-arrow" style="transform: rotate(${state.currentDir * 90}deg)" viewBox="0 0 24 24" width="20" height="20"><path d="M4 12h13m-5-5 6 5-6 5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <span class="hint">[R]</span>
        </div>
        <div class="tool-group">
          <bt-event-button event="zoomOut" btn-class="dir-btn" title="Zoom Out" label="−"></bt-event-button>
          <span class="zoom-value">${Math.round(cam.getScale() * 100)}%</span>
          <bt-event-button event="zoomIn" btn-class="dir-btn" title="Zoom In" label="+"></bt-event-button>
          <bt-event-button event="cameraToFactory" btn-class="dir-btn" title="Recenter on Factory" label="⌖"></bt-event-button>
        </div>
        <div class="tool-group">
          <label>Speed:</label>
          <input type="range" class="speed-slider" min="0.25" max="4" step="0.25" .value="${String(state.timescale)}">
          <span class="speed-value">${state.timescale}x</span>
        </div>
        <div class="tool-group">
          <button class="action-btn run-btn">▶ Run</button>
          <button class="action-btn stop-btn" disabled>⏹ Stop</button>
          <button class="action-btn clear-btn">🗑️ Clear</button>
        </div>
        <div class="tool-group">
          <bt-event-button event="requestKeyboardFocus" btn-class="action-btn" title="Simulation Input (send keystrokes to keyboard machines)" label="⌨️"></bt-event-button>
        </div>
        <div class="tool-group version-info">
          <span>v0.1.0 · <a href="https://elijahcunningham.dev" target="_blank" rel="noopener">Elijah Cunningham</a></span>
          <a href="https://github.com/EliCunninghamDev/bashtorio" target="_blank" rel="noopener" title="GitHub" class="version-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
          <a href="https://discord.gg/pwqcqYFg" target="_blank" rel="noopener" title="Discord" class="version-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.55 3.15A13.2 13.2 0 0010.3 2a9.1 9.1 0 00-.42.85 12.3 12.3 0 00-3.76 0A9.1 9.1 0 005.7 2a13.2 13.2 0 00-3.26 1.15C.36 6.57-.22 9.9.07 13.18A13.4 13.4 0 004.1 15a10 10 0 00.87-1.42 8.6 8.6 0 01-1.37-.66l.33-.26a9.5 9.5 0 008.14 0l.33.26c-.44.26-.9.48-1.37.66.25.5.54.97.87 1.42a13.4 13.4 0 004.03-1.82c.38-3.88-.65-7.17-2.98-10.03zM5.35 11.26c-.84 0-1.54-.79-1.54-1.75s.67-1.76 1.54-1.76 1.55.8 1.54 1.76c0 .96-.68 1.75-1.54 1.75zm5.3 0c-.85 0-1.54-.79-1.54-1.75s.67-1.76 1.54-1.76 1.55.8 1.54 1.76c0 .96-.68 1.75-1.54 1.75z"/></svg>
          </a>
        </div>
      </div>
    `, toolbar);

    // Init child custom elements
    // bt-placeable-button self-initializes in connectedCallback and listens for events

    // Cache DOM refs
    this.zoomValue = toolbar.querySelector('.zoom-value') as HTMLElement;
    this.speedValue = toolbar.querySelector('.speed-value') as HTMLElement;
    this.runBtn = toolbar.querySelector('.run-btn') as HTMLButtonElement;
    this.stopBtn = toolbar.querySelector('.stop-btn') as HTMLButtonElement;
    this.muteBtn = systembar.querySelector('.mute-btn') as HTMLElement;
    this.dirArrow = toolbar.querySelector('.dir-arrow') as SVGElement;
    this.storagePopout = systembar.querySelector('.storage-popout') as HTMLElement;
    this.storageBtn = systembar.querySelector('.storage-btn') as HTMLElement;

    // Direction rotation state
    this.dirRotation = state.currentDir * 90;
    this.dirPrevRotation = this.dirRotation;

    // --- Wire click/input listeners ---

    // Mode buttons (select, erase - Place is handled by bt-placeable-button)
    toolbar.querySelectorAll('.mode-group > .mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as CursorMode;
        emitGameEvent('modeChange', { mode });
      });
    });

    // Direction button
    toolbar.querySelector('.dir-btn')?.addEventListener('click', () => {
      emitGameEvent('rotate');
    });

    // Speed slider
    const speedSlider = toolbar.querySelector('.speed-slider') as HTMLInputElement;
    speedSlider?.addEventListener('input', () => {
      const speed = parseFloat(speedSlider.value);
      emitGameEvent('speedSet', { speed });
    });
    speedSlider?.addEventListener('change', () => speedSlider.blur());

    // Action buttons
    toolbar.querySelector('.run-btn')?.addEventListener('click', () => emitGameEvent('startSimulation'));
    toolbar.querySelector('.stop-btn')?.addEventListener('click', () => emitGameEvent('endSimulation'));
    toolbar.querySelector('.clear-btn')?.addEventListener('click', () => {
      if (confirm('Clear the entire grid? This cannot be undone.')) {
        emitGameEvent('clearAll');
      }
    });

    // Storage popout (in system bar)
    this.storageBtn.addEventListener('click', () => {
      if (this.storagePopout.style.display === 'none') {
        this.showStoragePopout();
      } else {
        this.storagePopout.style.display = 'none';
      }
    });

    // Save/Load/Presets buttons
    systembar.querySelector('.save-btn')?.addEventListener('click', () => {
      this.storagePopout.style.display = 'none';
      emitGameEvent('requestSave');
    });
    systembar.querySelector('.load-btn')?.addEventListener('click', () => {
      this.storagePopout.style.display = 'none';
      emitGameEvent('requestLoad');
    });
    systembar.querySelector('.presets-btn')?.addEventListener('click', () => {
      this.storagePopout.style.display = 'none';
      emitGameEvent('openPresets');
    });

    // Close storage popout on outside click
    document.addEventListener('click', (e) => {
      const wrapper = this.storageBtn.closest('.mode-btn-wrapper');
      if (wrapper && !wrapper.contains(e.target as Node) && this.storagePopout.style.display !== 'none') {
        this.storagePopout.style.display = 'none';
      }
    });

    // Mute button
    this.muteBtn?.addEventListener('click', () => {
      emitGameEvent('muteToggle');
    });

    // --- Subscribe to events for self-updating ---

    onGameEvent('modeChange', ({ mode }) => {
      toolbar.querySelectorAll('.mode-group > .mode-btn').forEach(btn => {
        (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
      });
    });

    onGameEvent('directionChange', ({ dir }) => {
      this.dirRotation = dir * 90;
      while (this.dirRotation < this.dirPrevRotation) this.dirRotation += 360;
      this.dirPrevRotation = this.dirRotation;
      this.dirArrow.style.transform = `rotate(${this.dirRotation}deg)`;
    });

    onGameEvent('simulationStarted', () => {
      this.runBtn.disabled = true;
      this.stopBtn.disabled = false;
    });

    onGameEvent('simulationEnded', () => {
      this.runBtn.disabled = false;
      this.stopBtn.disabled = true;
    });

    // Zoom/speed/mute display updates
    onGameEvent('zoomChanged', ({ scale }) => {
      this.zoomValue.textContent = Math.round(scale * 100) + '%';
    });
    onGameEvent('speedChanged', ({ speed }) => {
      this.speedValue.textContent = speed + 'x';
    });
    onGameEvent('muteChanged', ({ muted }) => {
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
    });
  }

  private showStoragePopout(): void {
    this.storagePopout.style.left = '';
    this.storagePopout.style.transform = '';
    this.storagePopout.style.right = '';
    this.storagePopout.style.display = 'flex';
    const rect = this.storagePopout.getBoundingClientRect();
    const btnRect = this.storageBtn.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    if (rect.right > window.innerWidth) {
      this.storagePopout.style.left = 'auto';
      this.storagePopout.style.right = '0';
      this.storagePopout.style.transform = 'none';
    }
    const popoutRect = this.storagePopout.getBoundingClientRect();
    const arrowLeft = btnCenterX - popoutRect.left;
    this.storagePopout.style.setProperty('--arrow-left', `${arrowLeft}px`);
  }
}
