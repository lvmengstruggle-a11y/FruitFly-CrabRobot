/** Sagittal pose of the jumper crab, taken from its URDF and HOME stance.
 *
 * Joint origins, axes and ranges match `jumper-main/assets/jumper/urdf/jumper/urdf/jumper.urdf`.
 * LM_J0's URDF lower bound is written `0.75`, which excludes the calibrated HOME;
 * the mirror of RM_J0 and the MJCF both use `-0.75`, and that is the limit used here.
 * The standing pose is `tasks/jumper/common/constants.py` HOME.
 * A jump crouches, then extends the hips, then returns home.
 * On the ground the legs run jumper.tetrapod: three pairs take turns in the air
 * ({LF,RR}, then {LM,RM}, then {LR,RF}) while the other four feet stay down.
 * Swing feet step toward the claws. Turning around yaws the shell 180°,
 * and the joints keep that same gait.
 */

export type Vec3 = readonly [number, number, number];

export interface LegSkeleton {
  name: string;
  kind: 'claw' | 'leg';
  links: Vec3[];
  finger?: Vec3[];
}

interface JointDef {
  offset: Vec3;
  axis: Vec3;
  home: number;
  min: number;
  max: number;
}

interface LegDef {
  name: string;
  kind: 'claw' | 'leg';
  joints: JointDef[];
  tip: Vec3;
  finger?: { offset: Vec3; axis: Vec3; home: number; min: number; max: number; tip: Vec3 };
}

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

const LEGS: LegDef[] = [
  {
    name: 'LF', kind: 'claw',
    joints: [
      hinge([0.050676, 0.061001, 0.0107], Z, -0.5507, -2.75, 0.7),
      hinge([0, 0.0064, -0.03116], Y, -1.0658, -4.75, 1.4),
      hinge([0.0009, 0.04787, 0.000111], X, -0.4408, -2.2, 1.65),
      hinge([-0.0012, 0.05, 0], X, -1.374, -2.1, 1.65)
    ],
    tip: [-0.007402, 0.141546, -0.000588],
    finger: { offset: [0.0021, 0.037275, -0.011472], axis: X, home: 0, min: -1.6, max: 0.1, tip: [-0.0022, 0.106219, -0.003277] }
  },
  {
    name: 'RF', kind: 'claw',
    joints: [
      hinge([0.050676, -0.060999, 0.0107], Z, 0.5524, -0.7, 2.75),
      hinge([0, -0.0064, -0.03116], Y, -1.066, -4.75, 1.4),
      hinge([-0.0009, -0.04787, 0.000111], X, 0.4414, -1.65, 2.1),
      hinge([0.0012, -0.05, 0], X, 1.4173, -1.65, 2.1)
    ],
    tip: [-0.008803, -0.141546, -0.000588],
    finger: { offset: [-0.0021, -0.037275, -0.011472], axis: X, home: 0, min: -0.1, max: 1.6, tip: [0.0014, -0.106219, -0.003277] }
  },
  leg('LM', [-0.007324, 0.066501, 0.00745], [0.0011, 0.05613, -0.02493], [-0.0012, 0.05, 0], [0.000789, 0.120917, 0.00624], [0.0012, 0.5356, -1.8271], [[-0.75, 1], [-2.4, 1.5], [-2.4, 1.8]]),
  leg('RM', [-0.007324, -0.066499, 0.00745], [-0.0011, -0.05613, -0.02493], [0.0012, -0.05, 0], [-0.000789, -0.120917, 0.00624], [-0.0012, -0.5376, 1.8313], [[-1, 0.75], [-1.5, 2.4], [-1.8, 2.4]]),
  leg('LR', [-0.065324, 0.055501, 0.00745], [0.0011, 0.05613, -0.02493], [-0.0012, 0.05, 0], [0.000789, 0.120917, 0.00624], [0.6313, 0.5534, -1.8648], [[-0.6, 2.75], [-2.4, 1.6], [-2.4, 1.8]]),
  leg('RR', [-0.065324, -0.055499, 0.00745], [-0.0011, -0.05613, -0.02493], [0.0012, -0.05, 0], [-0.000789, -0.120917, 0.00624], [-0.6326, -0.5548, 1.8678], [[-2.75, 0.6], [-1.6, 2.4], [-1.8, 2.4]])
];

function hinge(offset: Vec3, axis: Vec3, home: number, min: number, max: number): JointDef {
  return { offset, axis, home, min, max };
}

function leg(name: string, hip: Vec3, thigh: Vec3, calf: Vec3, foot: Vec3, home: readonly [number, number, number], range: readonly (readonly [number, number])[]): LegDef {
  return {
    name, kind: 'leg',
    joints: [
      hinge(hip, Z, home[0], range[0][0], range[0][1]),
      hinge(thigh, X, home[1], range[1][0], range[1][1]),
      hinge(calf, X, home[2], range[2][0], range[2][1])
    ],
    tip: foot
  };
}

/** jumper.tetrapod pairs, as a fraction of the cycle when that pair starts to swing. */
const TETRAPOD_SLOT: Record<string, number> = {
  LF: 0, RR: 0,
  LM: 1 / 3, RM: 1 / 3,
  LR: 2 / 3, RF: 2 / 3
};

/** One pair airborne, four feet down. `yaw` runs from -1 (foot back) to +1 (foot forward). */
function tetrapod(name: string, time: number) {
  const cycle = ((time * CRAWL_RATE) / (2 * Math.PI) % 1 + 1) % 1;
  const local = (cycle - TETRAPOD_SLOT[name] + 1) % 1;
  const swinging = local < 1 / 3;
  const lift = swinging ? Math.sin(Math.PI * local * 3) : 0;
  const yaw = swinging ? -1 + local * 6 : 1 - (local - 1 / 3) * 3;
  return { lift, yaw, slot: TETRAPOD_SLOT[name] };
}

export function stepRush(time: number) {
  const wave = (Math.sin(time * 3.1) + 1) / 2;
  return 0.4 + 0.6 * wave * wave;
}

/** Shared step clock so the shell and the legs crawl together. About 1.6 Hz, under the 3.125 Hz tripod clock so the mesh can still be read. */
export const CRAWL_RATE = 10;

function bump(t: number, center: number, width: number) {
  const u = (t - center) / width;
  return Math.exp(-u * u);
}

export function jumpShape(t: number) {
  if (t < 0) return { crouch: 0, push: 0 };
  return { crouch: bump(t, 0.045, 0.028), push: bump(t, 0.11, 0.035) };
}

/** The 22 servo names, in the same order as `jumper.xml` actuators. */
export const SERVO_JOINTS = [
  'LF_J0_joint', 'LF_J1_joint', 'LF_J2_joint', 'LF_J3_joint', 'LF_J4_joint',
  'RF_J0_joint', 'RF_J1_joint', 'RF_J2_joint', 'RF_J3_joint', 'RF_J4_joint',
  'LM_J0_joint', 'LM_J1_joint', 'LM_J2_joint',
  'RM_J0_joint', 'RM_J1_joint', 'RM_J2_joint',
  'LR_J0_joint', 'LR_J1_joint', 'LR_J2_joint',
  'RR_J0_joint', 'RR_J1_joint', 'RR_J2_joint'
] as const;

const SERVO_NAMES: Record<string, readonly string[]> = {
  LF: SERVO_JOINTS.slice(0, 5),
  RF: SERVO_JOINTS.slice(5, 10),
  LM: SERVO_JOINTS.slice(10, 13),
  RM: SERVO_JOINTS.slice(13, 16),
  LR: SERVO_JOINTS.slice(16, 19),
  RR: SERVO_JOINTS.slice(19, 22)
};

export function skeleton(jumpT: number, time = 0, crawl = 0, air = 0, threat = 0, haul = 0, brink = 0, plant = 0, compress = 0, hook = 0, launch = 0, pause = 0, heading = 1): LegSkeleton[] {
  const { crouch, push, settle } = phase(jumpT, launch);
  return LEGS.map((leg) => poseLeg(leg, crouch, push, time, settle, crawl, air, threat, haul, brink, plant, compress, hook, pause, heading));
}

/** Absolute angle of every servo. The mesh rig poses the CAD links with this. */
export function servoAngles(jumpT: number, time = 0, crawl = 0, air = 0, threat = 0, haul = 0, brink = 0, plant = 0, compress = 0, hook = 0, launch = 0, pause = 0, heading = 1): Record<string, number> {
  const { crouch, push, settle } = phase(jumpT, launch);
  const angles: Record<string, number> = {};
  for (const leg of LEGS) {
    const q = clip(commanded(leg, crouch, push, time, settle, crawl, air, threat, haul, brink, plant, compress, hook, pause, heading), leg);
    const names = SERVO_NAMES[leg.name];
    for (let i = 0; i < names.length; i++) angles[names[i]] = q[i];
  }
  return angles;
}

function phase(jumpT: number, launch = 0) {
  const shape = jumpShape(jumpT);
  const loaded = 1 + 0.85 * launch;
  return {
    crouch: shape.crouch * (1 + 0.35 * launch),
    push: shape.push * loaded,
    settle: 1 - Math.max(shape.crouch, shape.push)
  };
}

export function footOf(links: Vec3[]): Vec3 {
  return links[links.length - 1];
}

function poseLeg(leg: LegDef, crouch: number, push: number, time: number, settle: number, crawl: number, air: number, threat: number, haul: number, brink: number, plant: number, compress: number, hook: number, pause: number, heading: number): LegSkeleton {
  const q = clip(commanded(leg, crouch, push, time, settle, crawl, air, threat, haul, brink, plant, compress, hook, pause, heading), leg);
  let frame = identity();
  const links: Vec3[] = [];
  for (let i = 0; i < leg.joints.length; i++) {
    frame = advance(frame, leg.joints[i].offset, leg.joints[i].axis, q[i]);
    links.push(frame.p);
  }
  links.push(add(frame.p, mul(frame.R, leg.tip)));
  let finger: Vec3[] | undefined;
  if (leg.finger) {
    const palm = advance(identityTo(leg, q), leg.finger.offset, leg.finger.axis, q[q.length - 1]);
    finger = [links[links.length - 2], palm.p, add(palm.p, mul(palm.R, leg.finger.tip))];
  }
  return { name: leg.name, kind: leg.kind, links, finger };
}

/** How far a non-jump motion may travel. Jump crouch and push keep their own scale. */
const MOTION = 0.48;

function commanded(leg: LegDef, crouch: number, push: number, time: number, settle: number, crawl: number, air: number, threat: number, haul: number, brink: number, plant: number, compress: number, hook: number, pause: number, heading: number): number[] {
  const q = leg.joints.map((joint) => joint.home);
  const gait = tetrapod(leg.name, time);
  const tuck = air * (1 - plant);
  const idle = Math.sin(time * 6 + gait.slot * Math.PI * 2) * 0.04 * settle * (1 - crawl) * (1 - tuck) * (1 - pause);
  // Retreat yaws the shell 180°. Both facings walk toward the claws, so the joints do not reverse.
  const step = crawl * (1 - 0.75 * brink) * (1 - haul) * (1 - 0.85 * compress) * (1 - hook) * stepRush(time) * (heading === 0 ? 0 : 1);
  const lift = gait.lift * 0.7 * step;
  // Positive Z yaw sends a left foot toward -X and a right foot toward +X. Forward is +X, the claws.
  const yawSign = leg.name.startsWith('L') ? -1 : 1;
  const swing = yawSign * gait.yaw * 0.28 * step;
  const extend = 0.4 * plant;
  if (leg.kind === 'leg') {
    const sign = Math.sign(leg.joints[2].home) || 1;
    const reach = (0.28 * brink + 0.32 * haul + 0.4 * hook) * MOTION;
    q[0] += swing + (0.1 * brink + 0.12 * hook) * MOTION;
    q[1] += sign * (-0.22 * crouch + 0.5 * push - lift - 0.32 * tuck * MOTION + reach + extend * MOTION - 0.2 * compress * MOTION) + idle;
    q[2] += sign * (-0.2 * crouch - lift * 0.55 - 0.18 * tuck * MOTION + reach * 0.4 + extend * 0.22 - 0.12 * compress * MOTION) + idle * 0.6;
    return q;
  }
  const side = leg.name.startsWith('L') ? 1 : -1;
  const lead = leg.name === 'LF' ? 1 : 0;
  const pinch = Math.sin(time * 16) * 0.28 * threat;
  q[0] += side * (0.08 * crouch + MOTION * (0.22 * crawl + 0.2 * tuck + 0.28 * threat + 0.22 * haul + 0.16 * plant + 0.18 * hook)) + swing * 0.6;
  q[1] += -0.28 * crouch + 0.85 * push + MOTION * (0.28 * crawl + 0.32 * tuck + 0.45 * threat + 0.5 * haul + gait.lift * 0.35 * step - 0.16 * compress - 0.45 * hook + 0.24 * lead * (crawl + threat));
  q[2] += -side * 0.12 * crouch;
  q[3] += -side * (0.16 * crouch - 0.28 * push + MOTION * 0.12 * crawl);
  q.push((leg.finger?.home ?? 0) - side * (0.12 * crouch + MOTION * (0.12 * crawl + 0.45 * threat + 0.16 * haul)) + gait.yaw * 0.08 * step + pinch);
  return q;
}

function clip(q: number[], leg: LegDef) {
  for (let i = 0; i < leg.joints.length; i++) q[i] = Math.min(leg.joints[i].max, Math.max(leg.joints[i].min, q[i]));
  if (leg.finger && q.length > leg.joints.length) {
    const i = q.length - 1;
    q[i] = Math.min(leg.finger.max, Math.max(leg.finger.min, q[i]));
  }
  return q;
}

function identityTo(leg: LegDef, q: number[]) {
  let frame = identity();
  for (let i = 0; i < leg.joints.length; i++) frame = advance(frame, leg.joints[i].offset, leg.joints[i].axis, q[i]);
  return frame;
}

interface Frame { p: Vec3; R: number[] }

function identity(): Frame {
  return { p: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
}

function advance(frame: Frame, offset: Vec3, axis: Vec3, angle: number): Frame {
  return { p: add(frame.p, mul(frame.R, offset)), R: mulMat(frame.R, rotMat(axis, angle)) };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function mul(R: number[], v: Vec3): Vec3 {
  return [
    R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
    R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
    R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
  ];
}

function mulMat(a: number[], b: number[]) {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return out;
}

function rotMat(axis: Vec3, angle: number) {
  const [x, y, z] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c
  ];
}
