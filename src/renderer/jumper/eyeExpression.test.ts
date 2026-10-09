import { describe, expect, it } from 'vitest';
import { eyeExpression, type EyeCue } from './eyeExpression';

const calm: EyeCue = {
  lc4: 0, lplc2: 0, lplc1: 0, lc10Left: 0, lc10Right: 0,
  flowFore: 0, flowBack: 0, h2: 0, lc11: 1, dnp01: 0, loom: 0, hold: 0
};

describe('visor eyes', () => {
  it('opens wide when the pipe looms', () => {
    const rest = eyeExpression(calm, 0, 0);
    const scared = eyeExpression({ ...calm, lc11: 0, lc4: 1, lplc2: 1 }, 0, 0);
    expect(scared.open).toBeGreaterThan(rest.open);
  });

  it('squints as contact gets closer and blinks on the jump neuron', () => {
    const open = eyeExpression({ ...calm, lc11: 0, lc4: 1 }, 0, 0).open;
    const near = eyeExpression({ ...calm, lc11: 0, lc4: 1, lplc1: 1 }, 0, 0).open;
    const blink = eyeExpression({ ...calm, lc11: 0, lc4: 1, dnp01: 1 }, 0, 1).open;
    expect(near).toBeLessThan(open);
    expect(blink).toBeLessThan(0.1);
  });

  it('looks toward a high opening and slides with optic flow', () => {
    const up = eyeExpression({ ...calm, lc11: 0, lc10Left: 1 }, 0, 0);
    const down = eyeExpression({ ...calm, lc11: 0, lc10Right: 1 }, 0, 0);
    expect(up.gy).toBeGreaterThan(0.4);
    expect(down.gy).toBeLessThan(-0.4);
    const fore = eyeExpression({ ...calm, lc11: 0, flowFore: 1 }, 0, 0);
    const back = eyeExpression({ ...calm, lc11: 0, flowBack: 1 }, 0, 0);
    expect(fore.gx).toBeGreaterThan(0.2);
    expect(back.gx).toBeLessThan(-0.2);
  });

  it('stares wide and holds still while loom neurons fire', () => {
    const tracking = eyeExpression({ ...calm, lc11: 0, lc10Left: 1, flowFore: 1 }, 0, 0);
    const held = eyeExpression({ ...calm, lc11: 0, lc10Left: 1, flowFore: 1, loom: 1, hold: 1 }, 0, 0);
    expect(held.open).toBeGreaterThan(0.8);
    expect(Math.abs(held.gx)).toBeLessThan(Math.abs(tracking.gx));
    expect(Math.abs(held.gy)).toBeLessThan(Math.abs(tracking.gy));
  });
});
