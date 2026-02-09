import { html } from 'lit-html';
import { BaseModal } from './BaseModal';
import type { CommandMachine } from '../../game/types';

export class CommandModal extends BaseModal {
  private machine: CommandMachine | null = null;

  template() {
    return html`
      <div class="modal-content machine-panel-wrap">
        <div class="machine-panel cmd-terminal">
          <div class="machine-panel-header">
            <span class="machine-panel-title">Shell Machine</span>
            <div class="machine-panel-controls">
              <label class="machine-panel-check">
                <input type="checkbox" class="cmd-autostart">
                <span>Auto-run</span>
              </label>
              <label class="machine-panel-check">
                <input type="checkbox" class="cmd-stream">
                <span>Stream</span>
              </label>
              <div class="radio-group cmd-input-mode">
                <label class="radio-option">
                  <input type="radio" name="cmd-input-mode" value="pipe">
                  <span>Pipe</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="cmd-input-mode" value="args">
                  <span>Args</span>
                </label>
              </div>
            </div>
          </div>
          <div class="machine-panel-body">
            <div class="cmd-field">
              <label class="cmd-field-label">Command</label>
              <textarea class="cmd-input cmd-command" placeholder="shell command" spellcheck="false" rows="1"></textarea>
            </div>
            <div class="cmd-field" style="margin-top: 8px">
              <label class="cmd-field-label">Working Directory</label>
              <input type="text" class="cmd-input cmd-cwd" placeholder="/" spellcheck="false">
            </div>
          </div>
          <div class="machine-panel-footer">
            <button data-cancel>Cancel</button>
            <button data-save>Save</button>
          </div>
        </div>
      </div>
    `;
  }

  protected setup() {
    const streamCheckbox = this.qs<HTMLInputElement>('.cmd-stream');
    const modeGroup = this.qs('.cmd-input-mode');

    streamCheckbox.addEventListener('change', () => {
      const radios = modeGroup.querySelectorAll<HTMLInputElement>('input[type="radio"]');
      if (streamCheckbox.checked) {
        this.qs<HTMLInputElement>('.cmd-input-mode input[value="pipe"]').checked = true;
        radios.forEach(r => r.disabled = true);
      } else {
        radios.forEach(r => r.disabled = false);
      }
    });
  }

  configure(machine: CommandMachine) {
    this.machine = machine;

    this.qs<HTMLTextAreaElement>('.cmd-command').value = machine.command;
    this.qs<HTMLInputElement>('.cmd-autostart').checked = machine.autoStart;
    this.qs<HTMLInputElement>('.cmd-stream').checked = machine.stream;
    this.qs<HTMLInputElement>(`.cmd-input-mode input[value="${machine.inputMode || 'pipe'}"]`).checked = true;
    this.qs('.cmd-input-mode').querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(r => r.disabled = machine.stream);
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
        : (this.qs<HTMLInputElement>('.cmd-input-mode input:checked')?.value || 'pipe') as 'pipe' | 'args';
      this.machine.cwd = this.qs<HTMLInputElement>('.cmd-cwd').value.trim() || '/';
    }
    this.hide();
  }

}

customElements.define('bt-command-modal', CommandModal);
