import { describe, expect, it } from 'vitest';
import { spikeColumn, spikeMeans } from './SpikeField';

describe('spikeColumn', () => {
  it('keeps a quiet frame dark', () => {
    expect([...spikeColumn(new Uint8Array(8192), 8)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('puts a spike in the row that owns that neuron', () => {
    const frame = new Uint8Array(800);
    frame[0] = 200;
    frame[799] = 40;
    const column = spikeColumn(frame, 4);
    expect(column[0]).toBe(200);
    expect(column[1]).toBe(0);
    expect(column[3]).toBe(40);
  });

  it('stays dark when the frame has no neurons', () => {
    expect([...spikeColumn(new Uint8Array(0), 4)]).toEqual([0, 0, 0, 0]);
  });

  it('returns nothing when there are no rows', () => {
    expect(spikeColumn(new Uint8Array(4), 0)).toHaveLength(0);
  });

  it('averages a band so one spike still lifts that row', () => {
    const frame = new Uint8Array(400);
    frame[10] = 200;
    const means = spikeMeans(frame, 4);
    expect(means[0]).toBeGreaterThan(means[1]);
    expect(means[1]).toBe(0);
  });
});
