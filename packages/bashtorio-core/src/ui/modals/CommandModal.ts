import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { CommandMachine } from '../../game/types';

export class CommandModal extends BaseModal {
  private machine: CommandMachine | null = null;

  template() {
    return html`
      <div class="modal-content cmd-modal-content">
        <div class="cmd-terminal">
          <div class="cmd-terminal-header">
            <span class="cmd-terminal-title">Shell Machine</span>
            <div class="cmd-terminal-controls">
              <label class="cmd-autostart-label">
                <input type="checkbox" class="cmd-autostart">
                <span>Auto-run</span>
              </label>
              <label class="cmd-autostart-label">
                <input type="checkbox" class="cmd-stream">
                <span>Stream</span>
              </label>
              <select class="cmd-input-mode modal-select">
                <option value="pipe">Pipe</option>
                <option value="args">Args</option>
              </select>
            </div>
          </div>
          <div class="cmd-terminal-body">
            <div class="cmd-field">
              <label class="cmd-field-label">Command</label>
              <textarea class="cmd-input cmd-command" placeholder="shell command" spellcheck="false" rows="1"></textarea>
            </div>
            <div class="cmd-field" style="margin-top: 8px">
              <label class="cmd-field-label">Working Directory</label>
              <input type="text" class="cmd-input cmd-cwd" placeholder="/" spellcheck="false">
            </div>
          </div>
          <div class="cmd-terminal-footer">
            <button data-cancel>Cancel</button>
            <button data-save>Save</button>
          </div>
        </div>
      </div>
    `;
  }

  protected setup() {
    const streamCheckbox = this.qs<HTMLInputElement>('.cmd-stream');
    const inputModeSelect = this.qs<HTMLSelectElement>('.cmd-input-mode');

    streamCheckbox.addEventListener('change', () => {
      if (streamCheckbox.checked) {
        inputModeSelect.value = 'pipe';
        inputModeSelect.disabled = true;
      } else {
        inputModeSelect.disabled = false;
      }
    });
  }

  configure(machine: CommandMachine) {
    this.machine = machine;

    this.qs<HTMLTextAreaElement>('.cmd-command').value = machine.command;
    this.qs<HTMLInputElement>('.cmd-autostart').checked = machine.autoStart;
    this.qs<HTMLInputElement>('.cmd-stream').checked = machine.stream;
    this.qs<HTMLSelectElement>('.cmd-input-mode').value = machine.inputMode || 'pipe';
    this.qs<HTMLSelectElement>('.cmd-input-mode').disabled = machine.stream;
    this.qs<HTMLInputElement>('.cmd-cwd').value = machine.cwd || '/';

    this.show();
    this.qs<HTMLTextAreaElement>('.cmd-command').focus();
    this.qs<HTMLTextAreaElement>('.cmd-command').select();
  }

  protected save() {
    if (this.machine) {
      this.machine.command = this.qs<HTMLTextAreaElement>('.cmd-command').value.trim() || 'cat';
      this.machine.autoStart = this.qs<HTMLInputElement>('.cmd-autostart').checked;
      this.machine.stream = this.qs<HTMLInputElement>('.cmd-stream').checked;
      this.machine.inputMode = this.qs<HTMLInputElement>('.cmd-stream').checked
        ? 'pipe'
        : this.qs<HTMLSelectElement>('.cmd-input-mode').value as 'pipe' | 'args';
      this.machine.cwd = this.qs<HTMLInputElement>('.cmd-cwd').value.trim() || '/';
    }
    this.hide();
  }

}

customElements.define('bt-command-modal', CommandModal);
