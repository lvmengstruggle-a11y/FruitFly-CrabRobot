/** Anatomical groups of the MaleCNS superclasses, laid out as a fly nervous system. */

export const NEURONS = 166700;

export const REGION = {
  optic: 0,
  visual: 1,
  central: 2,
  descending: 3,
  vnc: 4,
  ascending: 5,
  other: 6
} as const;

/** Resting color of each region. Activity brightens the same hue. */
export const REGION_COLOR: readonly (readonly [number, number, number])[] = [
  [0.28, 0.78, 0.98],
  [1.0, 0.78, 0.22],
  [0.42, 0.9, 0.62],
  [0.98, 0.38, 0.32],
  [0.7, 0.48, 0.98],
  [0.98, 0.58, 0.28],
  [0.55, 0.58, 0.6]
];

const GOLDEN = 2.399963229728;
const ASPECT = 520 / 600;

export function regionOf(superclass: string): number {
  if (superclass.startsWith('ol_')) return REGION.optic;
  if (superclass.startsWith('visual_')) return REGION.visual;
  if (superclass.startsWith('cb_')) return REGION.central;
  if (superclass.includes('descending')) return REGION.descending;
  if (superclass.startsWith('vnc_')) return REGION.vnc;
  if (superclass.includes('ascending')) return REGION.ascending;
  return REGION.other;
}

export interface NeuronLayout {
  positions: Float32Array;
  colors: Float32Array;
  /** Connectome index of each drawn point, so a subsampled frame still hits the right cell. */
  ids: Uint32Array;
}

interface Disk { cx: number; cy: number; r: number }

export function layoutNeurons(classes: Uint8Array, sides: Uint8Array, names: readonly string[]): NeuronLayout {
  const groups = new Map<string, number[]>();
  const put = (key: string, index: number) => {
    const list = groups.get(key);
    if (list) list.push(index);
    else groups.set(key, [index]);
  };
  for (let i = 0; i < classes.length; i++) {
    const region = regionOf(names[classes[i]] ?? '');
    const side = sides[i] === 2 ? 'R' : 'L';
    if (region === REGION.optic || region === REGION.visual) put(`${region}${side}`, i);
    else put(String(region), i);
  }

  const positions = new Float32Array(classes.length * 2);
  const colors = new Float32Array(classes.length * 3);
  const ids = new Uint32Array(classes.length);
  let cursor = 0;
  const paint = (key: string, region: number, disk: Disk) => {
    const list = groups.get(key);
    if (!list?.length) return;
    cursor = fillDisk(list, region, disk, positions, colors, ids, cursor);
  };

  paint(`${REGION.optic}L`, REGION.optic, { cx: -0.58, cy: 0.46, r: 0.4 });
  paint(`${REGION.optic}R`, REGION.optic, { cx: 0.58, cy: 0.46, r: 0.4 });
  paint(`${REGION.visual}L`, REGION.visual, { cx: -0.3, cy: 0.74, r: 0.18 });
  paint(`${REGION.visual}R`, REGION.visual, { cx: 0.3, cy: 0.74, r: 0.18 });
  paint(String(REGION.central), REGION.central, { cx: 0, cy: 0.02, r: 0.32 });
  paint(String(REGION.descending), REGION.descending, { cx: 0, cy: -0.28, r: 0.16 });
  paint(String(REGION.ascending), REGION.ascending, { cx: 0, cy: -0.46, r: 0.2 });
  paint(String(REGION.vnc), REGION.vnc, { cx: 0, cy: -0.7, r: 0.26 });
  paint(String(REGION.other), REGION.other, { cx: 0, cy: 0.02, r: 0.08 });
  return { positions, colors, ids };
}

function fillDisk(list: number[], region: number, disk: Disk, positions: Float32Array, colors: Float32Array, ids: Uint32Array, cursor: number) {
  const n = list.length;
  const rx = disk.r * ASPECT;
  const [red, green, blue] = REGION_COLOR[region];
  for (let i = 0; i < n; i++) {
    const t = i * GOLDEN;
    const radius = Math.sqrt((i + 0.5) / n);
    const at = cursor++;
    positions[at * 2] = disk.cx + Math.cos(t) * radius * rx;
    positions[at * 2 + 1] = disk.cy + Math.sin(t) * radius * disk.r;
    colors[at * 3] = red;
    colors[at * 3 + 1] = green;
    colors[at * 3 + 2] = blue;
    ids[at] = list[i];
  }
  return cursor;
}
