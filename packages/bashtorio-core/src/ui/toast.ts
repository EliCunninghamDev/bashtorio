import { onGameEvent } from '../events/bus';

export class Toast extends HTMLElement {
  private timeout: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    this.className = 'bashtorio-toast';
    this.style.display = 'none';
    onGameEvent('toast', ({ message }) => this.show(message));
  }

  /** Show a toast that auto-hides after a delay. */
  show(message: string, durationMs = 2500): void {
    this.textContent = message;
    this.style.display = 'block';
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.style.display = 'none';
    }, durationMs);
  }

  /** Show a toast that stays visible until manually hidden. */
  showPersistent(message: string): void {
    this.textContent = message;
    this.style.display = 'block';
    if (this.timeout) { clearTimeout(this.timeout); this.timeout = null; }
  }

  /** Hide the toast immediately. */
  hide(): void {
    this.style.display = 'none';
    if (this.timeout) { clearTimeout(this.timeout); this.timeout = null; }
  }
}

customElements.define('bt-toast', Toast);
