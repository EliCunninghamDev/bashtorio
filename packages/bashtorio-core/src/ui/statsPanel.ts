import { html, render, type TemplateResult } from 'lit-html';
import { onGameEvent } from '../events/bus';
import { formatNumber, formatBytes } from '../util/format';

export class StatsPanel extends HTMLElement {
  private startTime = 0;
  private sinkBytes = 0;
  private commandCount = 0;
  private commandErrors = 0;
  private commandTotalMs = 0;
  private streamWriteBytes = 0;
  private recentSinkBytes: { time: number; count: number }[] = [];

  private els!: {
    uptime: HTMLElement;
    active: HTMLElement;
    sinkBytes: HTMLElement;
    throughput: HTMLElement;
    commands: HTMLElement;
    errors: HTMLElement;
    avgCmd: HTMLElement;
    streamWrites: HTMLElement;
  };

  connectedCallback() {
    render(this.template(), this);
    this.els = {
      uptime: this.querySelector('.stats-uptime') as HTMLElement,
      active: this.querySelector('.stats-active') as HTMLElement,
      sinkBytes: this.querySelector('.stats-sink-bytes') as HTMLElement,
      throughput: this.querySelector('.stats-throughput') as HTMLElement,
      commands: this.querySelector('.stats-commands') as HTMLElement,
      errors: this.querySelector('.stats-errors') as HTMLElement,
      avgCmd: this.querySelector('.stats-avg-cmd') as HTMLElement,
      streamWrites: this.querySelector('.stats-stream-writes') as HTMLElement,
    };
    this.querySelector('.clear-stats-btn')?.addEventListener('click', () => this.reset());

    onGameEvent('simulationStarted', () => this.reset());
    onGameEvent('sinkReceive', (payload) => {
      this.sinkBytes += payload.char.length;
      this.recentSinkBytes.push({ time: performance.now(), count: payload.char.length });
    });
    onGameEvent('commandStart', (payload) => {
      if (!payload.stream) {
        this.commandCount++;
      }
    });
    onGameEvent('commandComplete', (payload) => {
      if (payload.error) this.commandErrors++;
      if (!payload.stream) {
        this.commandTotalMs += payload.durationMs;
      }
    });
    onGameEvent('streamWrite', (payload) => {
      this.streamWriteBytes += payload.bytes;
    });
    onGameEvent('pack', (payload) => {
      this.sinkBytes += payload.length;
      this.recentSinkBytes.push({ time: performance.now(), count: payload.length });
    });
  }

  private template(): TemplateResult {
    return html`
      <div class="panel-header">
        <span>📊 Stats</span>
        <button class="clear-stats-btn">Reset</button>
      </div>
      <div class="stats-body">
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-label">Uptime</span><span class="stat-value stats-uptime">0:00</span></div>
          <div class="stat-item"><span class="stat-label">Active</span><span class="stat-value stats-active">0</span></div>
          <div class="stat-item"><span class="stat-label">Sink bytes</span><span class="stat-value stats-sink-bytes">0</span></div>
          <div class="stat-item"><span class="stat-label">Throughput</span><span class="stat-value stats-throughput">0/s</span></div>
          <div class="stat-item"><span class="stat-label">Commands</span><span class="stat-value stats-commands">0</span></div>
          <div class="stat-item"><span class="stat-label">Errors</span><span class="stat-value stats-errors">0</span></div>
          <div class="stat-item"><span class="stat-label">Avg cmd</span><span class="stat-value stats-avg-cmd">\u2014</span></div>
          <div class="stat-item"><span class="stat-label">Stream writes</span><span class="stat-value stats-stream-writes">0</span></div>
        </div>
      </div>
    `;
  }

  reset(): void {
    this.startTime = performance.now();
    this.sinkBytes = 0;
    this.commandCount = 0;
    this.commandErrors = 0;
    this.commandTotalMs = 0;
    this.streamWriteBytes = 0;
    this.recentSinkBytes = [];
  }

  update(activePackets: number): void {
    const elapsed = performance.now() - this.startTime;
    const totalSec = Math.floor(elapsed / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    this.els.uptime.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    this.els.active.textContent = String(activePackets);
    this.els.sinkBytes.textContent = formatBytes(this.sinkBytes);

    // Throughput: rolling 5s window
    const now = performance.now();
    const windowMs = 5000;
    this.recentSinkBytes = this.recentSinkBytes.filter(e => now - e.time < windowMs);
    const windowBytes = this.recentSinkBytes.reduce((s, e) => s + e.count, 0);
    const windowSec = Math.min((now - this.startTime), windowMs) / 1000;
    const throughput = windowSec > 0 ? windowBytes / windowSec : 0;
    this.els.throughput.textContent = formatBytes(Math.round(throughput)) + '/s';

    this.els.commands.textContent = formatNumber(this.commandCount);
    this.els.errors.textContent = formatNumber(this.commandErrors);
    if (this.commandErrors > 0) {
      this.els.errors.classList.add('stat-error');
    } else {
      this.els.errors.classList.remove('stat-error');
    }

    if (this.commandCount > 0) {
      const avg = Math.round(this.commandTotalMs / this.commandCount);
      this.els.avgCmd.textContent = avg + 'ms';
    } else {
      this.els.avgCmd.textContent = '\u2014';
    }
    this.els.streamWrites.textContent = formatBytes(this.streamWriteBytes);
  }
}

customElements.define('bt-stats-panel', StatsPanel);
