import { html, render } from 'lit-html';
import { emitGameEvent, onGameEvent } from '../events/bus';
import type { PlaceableType } from '../game/types';

export interface PlaceableItem { id: PlaceableType; icon: string; label: string; key: string }
export interface PlaceableColumn { label: string; items: PlaceableItem[] }

export const PLACEABLE_COLUMNS: PlaceableColumn[] = [
  { label: 'Route', items: [
    { id: 'belt', icon: '➡️', label: 'Belt', key: 'Q' },
    { id: 'splitter', icon: '⑂', label: 'Split', key: 'W' },
    { id: 'flipper', icon: '🔀', label: 'Flip', key: 'V' },
    { id: 'duplicator', icon: '📋', label: 'Dup', key: 'D' },
    { id: 'router', icon: '🔀', label: 'Route', key: 'H' },
    { id: 'gate', icon: '🚧', label: 'Gate', key: 'I' },
    { id: 'wireless', icon: '📡', label: 'Radio', key: 'J' },

  ]},
  { label: 'Source', items: [
    { id: 'source', icon: '📤', label: 'SRC', key: 'E' },

    { id: 'keyboard', icon: '⌨️', label: 'Key', key: 'K' },
    { id: 'linefeed', icon: '↵', label: 'LF', key: 'C' },
    { id: 'clock', icon: '🕐', label: 'Clock', key: 'O' },
    { id: 'byte', icon: '🔢', label: 'Byte', key: '' },
    { id: 'punchcard', icon: '🎴', label: 'Card', key: 'T' },
  ]},
  { label: 'Process', items: [
    { id: 'command', icon: '🖥️', label: 'Shell', key: 'F' },
    { id: 'filter', icon: '🚦', label: 'Filter', key: 'G' },
    { id: 'counter', icon: '🔢', label: 'Count', key: 'N' },
    { id: 'delay', icon: '⏱️', label: 'Delay', key: 'B' },
    { id: 'packer', icon: '📦', label: 'Pack', key: 'P' },
    { id: 'unpacker', icon: '📭', label: 'Unpack', key: 'U' },
    { id: 'replace', icon: '🔄', label: 'Repl', key: 'L' },
    { id: 'math', icon: '🧮', label: 'Math', key: 'M' },
    { id: 'latch', icon: '🔒', label: 'Latch', key: 'Y' },
  ]},
  { label: 'Output', items: [
    { id: 'sink', icon: '📥', label: 'Sink', key: 'S' },
    { id: 'display', icon: '💬', label: 'UTF8', key: 'A' },
    { id: 'null', icon: '🕳️', label: 'Null', key: 'X' },
    { id: 'sevenseg', icon: '🔢', label: '7Seg', key: 'Z' },
    { id: 'drum', icon: '🥁', label: 'Drum', key: 'E' },
    { id: 'tone', icon: '🔊', label: 'Tone', key: '' },
    { id: 'speak', icon: '🗣️', label: 'Talk', key: '' },
    { id: 'screen', icon: '🖥️', label: 'Screen', key: '' },
  ]},
];

export const ALL_PLACEABLES = PLACEABLE_COLUMNS.flatMap(c => c.items);

export class PlaceableButton extends HTMLElement {
  private popout!: HTMLElement;
  private placeBtn!: HTMLElement;
  private placeIcon!: HTMLElement;
  private placeLabel!: HTMLElement;
  private active = false;

  connectedCallback() {
    this.className = 'mode-btn-wrapper';

    render(html`
      <button class="mode-btn" data-mode="machine" title="Place (3)">
        <span class="tool-icon placeable-icon"></span>
        <span class="tool-label placeable-label">Place</span>
      </button>
      <div class="placeable-popout" style="display: none;">
        ${PLACEABLE_COLUMNS.map(col => html`
          <div class="popout-column">
            <span class="popout-column-label">${col.label}</span>
            ${col.items.map(p => html`
              <button class="placeable-btn" data-placeable="${p.id}" title="${p.label} (${p.key})">
                <span class="tool-icon">${p.icon}</span>
                <span class="tool-label">${p.label}</span>
              </button>
            `)}
          </div>
        `)}
      </div>
    `, this);

    this.popout = this.querySelector('.placeable-popout') as HTMLElement;
    this.placeBtn = this.querySelector('.mode-btn[data-mode="machine"]') as HTMLElement;
    this.placeIcon = this.placeBtn.querySelector('.placeable-icon') as HTMLElement;
    this.placeLabel = this.placeBtn.querySelector('.placeable-label') as HTMLElement;

    // Mode button click: toggle popout or switch to machine mode
    this.placeBtn.addEventListener('click', () => {
      if (this.active) {
        if (this.popout.style.display === 'none') {
          this.showPopout();
        } else {
          this.popout.style.display = 'none';
        }
      } else {
        emitGameEvent('modeChange', { mode: 'machine' });
        this.showPopout();
      }
    });

    // Placeable item clicks
    this.querySelectorAll('.placeable-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const placeable = (btn as HTMLElement).dataset.placeable as PlaceableType;
        emitGameEvent('selectPlaceable', { placeable });
        this.popout.style.display = 'none';
      });
    });

    // --- Event subscriptions ---

    onGameEvent('modeChange', ({ mode }) => {
      this.active = mode === 'machine';
      this.placeBtn.classList.toggle('active', this.active);
      if (!this.active) {
        this.popout.style.display = 'none';
      }
    });

    onGameEvent('selectPlaceable', ({ placeable }) => {
      this.updateFace(placeable);
    });

    onGameEvent('placeableChange', ({ placeable }) => {
      this.updateFace(placeable);
    });

    onGameEvent('simulationStarted', () => {
      this.popout.style.display = 'none';
    });
  }

  private updateFace(placeable: PlaceableType): void {
    this.querySelectorAll('.placeable-btn').forEach(btn => {
      (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.placeable === placeable);
    });
    const activeBtn = this.querySelector(`.placeable-btn[data-placeable="${placeable}"]`);
    const icon = activeBtn?.querySelector('.tool-icon')?.textContent || '';
    const label = activeBtn?.querySelector('.tool-label')?.textContent || 'Place';
    if (this.placeIcon) this.placeIcon.textContent = icon;
    if (this.placeLabel) this.placeLabel.textContent = label;
  }

  private showPopout(): void {
    this.popout.style.left = '';
    this.popout.style.transform = '';
    this.popout.style.right = '';
    this.popout.style.display = 'flex';
    const rect = this.popout.getBoundingClientRect();
    const btnRect = this.placeBtn.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    if (rect.left < 0) {
      this.popout.style.left = '0';
      this.popout.style.transform = 'none';
    } else if (rect.right > window.innerWidth) {
      this.popout.style.left = 'auto';
      this.popout.style.right = '0';
      this.popout.style.transform = 'none';
    }
    const popoutRect = this.popout.getBoundingClientRect();
    const arrowLeft = btnCenterX - popoutRect.left;
    this.popout.style.setProperty('--arrow-left', `${arrowLeft}px`);
  }
}

customElements.define('bt-placeable-button', PlaceableButton);
