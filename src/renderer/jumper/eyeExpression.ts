/** What the visor eyes do with one step of the fruit-fly visual neurons. */
export interface EyeCue {
  lc4: number;
  lplc2: number;
  lplc1: number;
  lc10Left: number;
  lc10Right: number;
  flowFore: number;
  flowBack: number;
  h2: number;
  lc11: number;
  dnp01: number;
  loom: number;
  hold: number;
}

export interface EyePose {
  /** 0 closed, 1 wide open. */
  open: number;
  /** Pupil shift. +1 is the crab's right, +1 vertical is up. */
  gx: number;
  gy: number;
}

export function eyeExpression(cue: EyeCue, time: number, blink: number): EyePose {
  const alarm = Math.max(cue.lc4, cue.lplc2);
  const stare = Math.max(cue.loom, cue.hold);
  let open = 0.46 + alarm * 0.48 - cue.lplc1 * 0.5;
  if (stare > 0.35) open = Math.max(open, 0.82);
  open *= 1 - Math.min(1, blink) * 0.94;
  const center = clamp01(cue.lc11);
  const track = stare > 0.35 ? 0.12 : 1 - center * 0.7;
  let gx = (cue.flowFore - cue.flowBack) * 0.55 + Math.sin(time * 2.2) * cue.h2 * 0.28;
  let gy = (cue.lc10Left - cue.lc10Right) * 0.85;
  gx *= track;
  gy *= track;
  return { open: clamp(open, 0.04, 1), gx: clamp(gx, -1, 1), gy: clamp(gy, -1, 1) };
}

function clamp01(n: number) {
  return clamp(n, 0, 1);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
