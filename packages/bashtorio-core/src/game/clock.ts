export let now = 0;
export let delta = 0;

export function tick(): void {
  const t = performance.now();
  delta = now > 0 ? t - now : 0;
  now = t;
}

export class EmitTimer {
  interval: number;
  timeRemaining: number;

  constructor(interval: number) {
    this.interval = interval;
    this.timeRemaining = interval;
  }

  advance(dt: number): void {
    this.timeRemaining -= dt;
  }

  shouldTick(): boolean {
    return this.timeRemaining < 0;
  }

  reset(): void {
    this.timeRemaining = this.interval;
  }

  start(advance: number = 0): void {
    this.timeRemaining = this.interval - advance;
  }
}
