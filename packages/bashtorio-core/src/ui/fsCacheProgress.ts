import { onGameEvent } from '../events/bus';

export class FsCacheProgress extends HTMLElement {
  private bar!: HTMLElement;
  private text!: HTMLElement;

  connectedCallback() {
    this.className = 'fs-cache';
    this.style.display = 'none';
    this.innerHTML = '<span class="fs-cache-label">Filesystem Cache:</span> <span class="fs-cache-text">0%</span><div class="fs-cache-track"><div class="fs-cache-bar"></div></div>';
    this.bar = this.querySelector('.fs-cache-bar') as HTMLElement;
    this.text = this.querySelector('.fs-cache-text') as HTMLElement;

    onGameEvent('fsCacheProgress', ({ loaded, total }) => {
      if (total === 0) return;
      this.style.display = '';
      const pct = Math.round((loaded / total) * 100);
      this.bar.style.width = pct + '%';
      this.text.textContent = pct + '%';
      if (loaded >= total) {
        this.classList.add('done');
        setTimeout(() => { this.style.display = 'none'; }, 2000);
      }
    });
  }
}

customElements.define('bt-fs-cache', FsCacheProgress);
