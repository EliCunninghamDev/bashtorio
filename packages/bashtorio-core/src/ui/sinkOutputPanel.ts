import { html, render, type TemplateResult } from 'lit-html';
import { onGameEvent } from '../events/bus';
import { ansiToHtml } from '../util/ansi';
import { MachineType } from '../game/types';

export class SinkOutputPanel extends HTMLElement {
  private outputSinks!: HTMLElement;
  private readonly elements = new Map<number, HTMLPreElement>();

  connectedCallback() {
    render(this.template(), this);
    this.outputSinks = this.querySelector('.output-sinks') as HTMLElement;
    this.querySelector('.clear-output-btn')?.addEventListener('click', () => this.clearAll());

    onGameEvent('simulationStarted', () => this.clearContents());
    onGameEvent('sinkOutput', ({ sink, content }) => {
      this.appendOutput(sink.sinkId, content, sink.name);
    });
    onGameEvent('machineDelete', ({ machine }) => {
      if (machine.type === MachineType.SINK) {
        this.removeSink(machine.sinkId);
      }
    });
    onGameEvent('sinkRename', ({ machine }) => this.updateLabel(machine.sinkId, machine.name));
    onGameEvent('saveLoaded', () => this.clearAll());
  }

  private template(): TemplateResult {
    return html`
      <div class="panel-header">
        <span>📋 Output</span>
        <button class="clear-output-btn">Clear</button>
      </div>
      <div class="output-sinks"></div>
    `;
  }

  /** Get or create the output <pre> for a given sink id. */
  getOrCreate(sinkId: number, name?: string): HTMLPreElement {
    let el = this.elements.get(sinkId);
    if (!el) {
      const section = document.createElement('div');
      section.className = 'sink-section';
      section.dataset.sinkId = String(sinkId);

      const label = document.createElement('div');
      label.className = 'sink-label';
      label.textContent = name || `Sink ${sinkId}`;

      el = document.createElement('pre');
      el.className = 'sink-output';
      el.dataset.raw = '';

      section.appendChild(label);
      section.appendChild(el);
      this.outputSinks.appendChild(section);
      this.elements.set(sinkId, el);
    }
    return el;
  }

  /** Append output content to a sink, rendering ANSI codes. */
  appendOutput(sinkId: number, content: string, name?: string): void {
    const el = this.getOrCreate(sinkId, name);
    const raw = (el.dataset.raw || '') + content;
    el.dataset.raw = raw;
    el.innerHTML = ansiToHtml(raw);
    el.scrollTop = el.scrollHeight;
  }

  /** Remove a single sink's output section (e.g. when the machine is deleted). */
  removeSink(sinkId: number): void {
    const el = this.elements.get(sinkId);
    if (el) {
      el.closest('.sink-section')?.remove();
      this.elements.delete(sinkId);
    }
  }

  /** Update the displayed label for a sink. */
  updateLabel(sinkId: number, name: string): void {
    const el = this.elements.get(sinkId);
    if (el) {
      const label = el.closest('.sink-section')?.querySelector('.sink-label');
      if (label) label.textContent = name;
    }
  }

  /** Clear the text content of all sinks but keep the sections. */
  private clearContents(): void {
    for (const el of this.elements.values()) {
      el.dataset.raw = '';
      el.innerHTML = '';
    }
  }

  /** Remove all sink sections entirely. */
  clearAll(): void {
    this.outputSinks.innerHTML = '';
    this.elements.clear();
  }
}

customElements.define('bt-sink-output', SinkOutputPanel);
