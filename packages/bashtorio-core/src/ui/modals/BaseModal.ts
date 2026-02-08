import { render, type TemplateResult } from 'lit-html';
import { onGameEvent } from '../../events/bus';

export abstract class BaseModal extends HTMLElement {
  protected unsubs: (() => void)[] = [];

  connectedCallback() {
    this.className = 'bashtorio-modal';
    this.style.display = 'none';
    render(this.template(), this);
    this.setup();
    this.querySelector('[data-cancel]')?.addEventListener('click', () => this.hide());
    this.querySelector('[data-save]')?.addEventListener('click', () => this.save());
  }

  abstract template(): TemplateResult;
  protected setup(): void {}
  protected save(): void {}

  show() {
    this.style.display = 'flex';
    this.unsubs.push(onGameEvent('editorKeyPress', ({ key }) => {
      if (key === 'Escape') this.hide();
    }));
  }

  hide() {
    this.style.display = 'none';
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
  }

  protected qs<T extends Element>(selector: string): T {
    return this.querySelector(selector) as T;
  }
}
