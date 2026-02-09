import { html, render } from "lit-html";

export class IngameLogo extends HTMLElement {
    connectedCallback() {
        this.className='bashtorio-ingame-logo';
        render(this.template(), this);
    }

    template() {
        return html`ba<span class="boot-sh">sh</span>torio<span class="boot-terminal-cursor">_</span>`;
    }
}

customElements.define('bt-ingame-logo', IngameLogo);