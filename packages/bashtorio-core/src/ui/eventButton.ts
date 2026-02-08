import { emitGameEvent, type GameEvent, type GameEventMap } from '../events/bus';

/** Events that take no payload - the only events EventButton can fire. */
type VoidGameEvent = { [E in GameEvent]: GameEventMap[E] extends undefined ? E : never }[GameEvent];

/**
 * `<bt-event-button>` - a button that fires a no-payload game event on click.
 *
 * Attributes:
 *   event     - GameEvent name (must be a void event)
 *   btn-class - CSS classes forwarded to the inner <button>
 *   title     - forwarded to the inner <button>
 *   label     - text content of the inner <button>
 */
export class EventButton extends HTMLElement {
  connectedCallback() {
    this.style.display = 'contents';
    const event = this.getAttribute('event') as VoidGameEvent | null;
    if (!event) return;

    const btn = document.createElement('button');
    const btnClass = this.getAttribute('btn-class');
    if (btnClass) btn.className = btnClass;
    const title = this.getAttribute('title');
    if (title) btn.title = title;
    const label = this.getAttribute('label');
    if (label) btn.textContent = label;
    if (this.hasAttribute('disabled')) btn.disabled = true;

    this.appendChild(btn);
    btn.addEventListener('click', () => emitGameEvent(event));
  }
}

customElements.define('bt-event-button', EventButton);
