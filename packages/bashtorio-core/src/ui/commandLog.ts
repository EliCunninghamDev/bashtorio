import { html, render, type TemplateResult } from 'lit-html';
import { onGameEvent } from '../events/bus';
import { escapeHtml, truncate } from '../util/format';

export class CommandLog extends HTMLElement {
  private cmdlogEntries!: HTMLElement;
  private streamEntries!: HTMLElement;
  private readonly cmdlogMap = new Map<string, HTMLElement>();
  private readonly streamMap = new Map<string, HTMLElement>();
  private autoScroll = true;

  connectedCallback() {
    render(this.template(), this);
    this.cmdlogEntries = this.querySelector('.cmdlog-entries') as HTMLElement;
    this.streamEntries = this.querySelector('.stream-entries') as HTMLElement;

    // Auto-scroll toggle
    const autoScrollBtn = this.querySelector('.cmdlog-autoscroll-btn') as HTMLElement;
    autoScrollBtn.addEventListener('click', () => {
      this.autoScroll = !this.autoScroll;
      autoScrollBtn.classList.toggle('active', this.autoScroll);
      this.cmdlogEntries.classList.toggle('scrollable', !this.autoScroll);
      if (this.autoScroll) {
        this.cmdlogEntries.scrollTop = this.cmdlogEntries.scrollHeight;
      }
    });

    // Clear buttons
    this.querySelector('.clear-cmdlog-btn')?.addEventListener('click', () => this.clearCmdlog());
    this.querySelector('.clear-streams-btn')?.addEventListener('click', () => this.clearStreams());

    onGameEvent('simulationStarted', () => {
      this.clearCmdlog();
      this.clearStreams();
    });

    onGameEvent('commandStart', (payload) => {
      const isStream = !!payload.stream;
      const entry = document.createElement('div');
      entry.className = isStream ? 'stream-entry stream-entry--running' : 'cmdlog-entry cmdlog-entry--running';
      const inputClean = payload.input.replace(/\n/g, ' ').trim();
      let cmdLine: string;
      if (!inputClean) {
        cmdLine = truncate(`$ ${payload.command}`, 60);
      } else if (payload.inputMode === 'args') {
        cmdLine = truncate(`$ ${payload.command} ${inputClean}`, 60);
      } else {
        cmdLine = truncate(`$ echo "${inputClean}" | ${payload.command}`, 60);
      }

      if (isStream) {
        entry.innerHTML =
          `<div class="stream-cmd"><span class="stream-cmd-text">${escapeHtml(cmdLine)}</span><span class="stream-status">running</span></div>`;
        this.streamEntries.appendChild(entry);
        this.streamMap.set(payload.machineId, entry);
      } else {
        entry.innerHTML =
          `<div class="cmdlog-cmd"><span class="cmdlog-cmd-text">${escapeHtml(cmdLine)}</span><span class="cmdlog-status">...</span></div>`;
        this.cmdlogEntries.appendChild(entry);
        this.scrollToBottom();
        this.cmdlogMap.set(payload.machineId, entry);
      }
    });

    onGameEvent('commandComplete', (payload) => {
      if (payload.stream) {
        const entry = this.streamMap.get(payload.machineId);
        if (!entry) return;
        entry.classList.remove('stream-entry--running');
        if (payload.error) entry.classList.add('stream-entry--error');
        const statusEl = entry.querySelector('.stream-status') as HTMLElement;
        if (statusEl) {
          const icon = payload.error ? '\u2717' : '\u2713';
          statusEl.textContent = payload.error ? `error ${icon}` : `done ${icon}`;
        }
      } else {
        const entry = this.cmdlogMap.get(payload.machineId);
        if (!entry) return;
        entry.classList.remove('cmdlog-entry--running');
        if (payload.error) entry.classList.add('cmdlog-entry--error');
        const statusEl = entry.querySelector('.cmdlog-status') as HTMLElement;
        if (statusEl) {
          const ms = Math.round(payload.durationMs);
          const icon = payload.error ? '\u2717' : '\u2713';
          statusEl.textContent = `${ms}ms ${icon}`;
        }
        const outputText = truncate(payload.output, 60);
        if (outputText) {
          const ioEl = document.createElement('div');
          ioEl.className = 'cmdlog-io';
          ioEl.textContent = '\u2192 ' + outputText;
          entry.appendChild(ioEl);
        }
        this.scrollToBottom();
        this.cmdlogMap.delete(payload.machineId);
      }
    });
  }

  private template(): TemplateResult {
    return html`
      <div class="bashtorio-streams">
        <div class="panel-header">
          <span>📡 Streams</span>
          <button class="clear-streams-btn">Clear</button>
        </div>
        <div class="stream-entries"></div>
      </div>
      <div class="bashtorio-cmdlog">
        <div class="panel-header">
          <span>🖥️ Command Log</span>
          <div class="panel-header-actions">
            <button class="cmdlog-autoscroll-btn active" title="Auto-scroll">▼</button>
            <button class="clear-cmdlog-btn">Clear</button>
          </div>
        </div>
        <div class="cmdlog-entries"></div>
      </div>
    `;
  }

  private clearCmdlog(): void {
    this.cmdlogEntries.innerHTML = '';
    this.cmdlogMap.clear();
  }

  private clearStreams(): void {
    this.streamEntries.innerHTML = '';
    this.streamMap.clear();
  }

  private scrollToBottom(): void {
    if (this.autoScroll) {
      this.cmdlogEntries.scrollTop = this.cmdlogEntries.scrollHeight;
    }
  }
}

customElements.define('bt-command-log', CommandLog);
