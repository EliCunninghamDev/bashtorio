import { html, render, type TemplateResult } from 'lit-html';
import type { GameState } from '../game/state';
import { emitGameEvent } from '../events/bus';
import type { PlaceableType } from '../game/types';
import { PLACEABLE_COLUMNS } from './placeableButton';

export class MachinePicker extends HTMLElement {
  private state: GameState | null = null;

  connectedCallback() {
    this.className = 'machine-picker';
    this.style.display = 'none';
    render(this.template(), this);
  }

  private template(): TemplateResult {
    return html`
      ${PLACEABLE_COLUMNS.map(col => html`
        <div class="picker-column">
          <span class="picker-column-label">${col.label}</span>
          ${col.items.map(item => html`
            <button class="picker-item" data-placeable="${item.id}" title="${item.label} (${item.key})">
              <span class="picker-icon">${item.icon}</span>
              <span class="picker-label">${item.label}</span>
            </button>
          `)}
        </div>
      `)}
    `;
  }

  init(state: GameState) {
    this.state = state;

    // Picker item click handlers
    this.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        const placeable = (item as HTMLElement).dataset.placeable as PlaceableType;
        emitGameEvent('selectPlaceable', { placeable });
        emitGameEvent('modeChange', { mode: 'machine' });
        this.hide();
      });
    });

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target as Node) && this.style.display !== 'none') {
        this.hide();
      }
    });
  }

  show(x: number, y: number) {
    if (!this.state) return;
    // Update active state
    this.querySelectorAll('.picker-item').forEach(item => {
      (item as HTMLElement).classList.toggle('active',
        (item as HTMLElement).dataset.placeable === this.state!.currentPlaceable);
    });
    // Position at mouse cursor
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
    this.style.display = 'grid';

    // Adjust if off-screen
    const rect = this.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
  }

  hide() {
    this.style.display = 'none';
  }

  toggle(x: number, y: number) {
    if (this.style.display === 'none') {
      this.show(x, y);
    } else {
      this.hide();
    }
  }
}

customElements.define('bt-machine-picker', MachinePicker);
