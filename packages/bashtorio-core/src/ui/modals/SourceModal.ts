import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { SourceMachine } from '../../game/types';

export class SourceModal extends BaseModal {
  private machine: SourceMachine | null = null;

  template() {
    return html`
      <div class="modal-content">
        <h3>Source</h3>
        <p class="modal-description">Text data emitted one character at a time.</p>
        <div class="form-group">
          <label>Text:</label>
          <textarea class="source-text" rows="6" placeholder="Enter data to emit..."></textarea>
          <div class="source-newline-warn" style="display: none;">&#x26A0; No trailing newline - most Unix tools expect one</div>
        </div>
        <div class="form-group">
          <label>Interval (ms):</label>
          <input type="number" class="source-interval" min="50" max="10000" step="50" value="500">
        </div>
        <div class="modal-buttons">
          <button class="source-upload">Upload File</button>
          <button data-cancel>Cancel</button>
          <button data-save class="primary">Save</button>
        </div>
      </div>
    `;
  }

  protected setup() {
    const textInput = this.qs<HTMLTextAreaElement>('.source-text');
    const warn = this.qs<HTMLElement>('.source-newline-warn');

    textInput.addEventListener('input', () => {
      const text = textInput.value;
      warn.style.display = (text.length > 0 && !text.endsWith('\n')) ? '' : 'none';
    });

    this.qs('.source-upload').addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.txt,.csv,.json,.md,.log,text/*';
      fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          textInput.value = reader.result as string;
          textInput.dispatchEvent(new Event('input'));
        };
        reader.readAsText(file);
      };
      fileInput.click();
    });
  }

  configure(machine: SourceMachine) {
    this.machine = machine;
    const textInput = this.qs<HTMLTextAreaElement>('.source-text');
    textInput.value = machine.sourceText;
    this.qs<HTMLInputElement>('.source-interval').value = String(machine.emitInterval);
    textInput.dispatchEvent(new Event('input')); // trigger newline warn
    this.show();
    textInput.focus();
  }

  protected save() {
    if (this.machine) {
      this.machine.sourceText = this.qs<HTMLTextAreaElement>('.source-text').value;
      this.machine.emitInterval = Math.max(50, parseInt(this.qs<HTMLInputElement>('.source-interval').value) || 500);
    }
    this.hide();
  }

}

customElements.define('bt-source-modal', SourceModal);
