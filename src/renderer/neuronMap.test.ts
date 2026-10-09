import { describe, expect, it } from 'vitest';
import { layoutNeurons, REGION, REGION_COLOR, regionOf } from './neuronMap';

const NAMES = [
  'ENS', 'ascending_neuron', 'cb_efferent', 'cb_endocrine', 'cb_intrinsic', 'cb_motor', 'cb_sensory', 'cb_sensory_tbc',
  'descending_neuron', 'descending_neuron_tbc', 'efferent_ascending', 'efferent_descending', 'ol_intrinsic', 'ol_sensory',
  'sensory_ascending', 'sensory_ascending_tbc', 'sensory_descending', 'visual_centrifugal', 'visual_projection',
  'visual_projection_tbc', 'vnc_efferent', 'vnc_endocrine', 'vnc_intrinsic', 'vnc_motor', 'vnc_sensory', 'vnc_sensory_tbc', 'vnc_tbc'
];

describe('neuron regions', () => {
  it('keeps each superclass in one anatomical color', () => {
    expect(regionOf('ol_intrinsic')).toBe(REGION.optic);
    expect(regionOf('ol_sensory')).toBe(REGION.optic);
    expect(regionOf('visual_projection')).toBe(REGION.visual);
    expect(regionOf('visual_centrifugal')).toBe(REGION.visual);
    expect(regionOf('cb_intrinsic')).toBe(REGION.central);
    expect(regionOf('descending_neuron')).toBe(REGION.descending);
    expect(regionOf('sensory_descending')).toBe(REGION.descending);
    expect(regionOf('vnc_motor')).toBe(REGION.vnc);
    expect(regionOf('ascending_neuron')).toBe(REGION.ascending);
    expect(regionOf('sensory_ascending')).toBe(REGION.ascending);
    expect(regionOf('ENS')).toBe(REGION.other);
    expect(new Set(NAMES.map(regionOf)).size).toBe(REGION_COLOR.length);
  });

  it('puts the optic lobes on opposite sides and keeps every point inside the map', () => {
    const names = ['ol_intrinsic', 'visual_projection', 'cb_intrinsic'];
    const classes = new Uint8Array([0, 0, 1, 1, 2]);
    const sides = new Uint8Array([1, 2, 1, 2, 0]);
    const layout = layoutNeurons(classes, sides, names);
    expect(layout.ids).toHaveLength(5);
    const left = layout.ids.indexOf(0);
    const right = layout.ids.indexOf(1);
    expect(layout.positions[left * 2]).toBeLessThan(0);
    expect(layout.positions[right * 2]).toBeGreaterThan(0);
    expect(layout.colors[left * 3]).toBeCloseTo(REGION_COLOR[REGION.optic][0]);
    expect(layout.colors[layout.ids.indexOf(2) * 3]).toBeCloseTo(REGION_COLOR[REGION.visual][0]);
    for (let i = 0; i < 5; i++) {
      expect(Math.abs(layout.positions[i * 2])).toBeLessThan(1);
      expect(Math.abs(layout.positions[i * 2 + 1])).toBeLessThan(1);
    }
  });
});
