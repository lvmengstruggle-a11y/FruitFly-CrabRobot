import { describe, expect, it } from 'vitest';
import { pauseFromNerve } from './PauseNerve';

describe('pause nerve', () => {
  it('holds the crab when loom or LC4 neurons fire, and releases on a jump', () => {
    expect(pauseFromNerve(0, 0, false)).toBe(0);
    expect(pauseFromNerve(0.08, 0.05, false)).toBe(0);
    expect(pauseFromNerve(0.8, 0, false)).toBeGreaterThan(0.7);
    expect(pauseFromNerve(0, 0.7, false)).toBeGreaterThan(0.7);
    expect(pauseFromNerve(0.9, 0.9, true)).toBe(0);
  });
});
