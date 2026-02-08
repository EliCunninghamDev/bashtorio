export let now = 0;
export let delta = 0;

export function tick(): void {
  const t = performance.now();
  delta = now > 0 ? t - now : 0;
  now = t;
}
