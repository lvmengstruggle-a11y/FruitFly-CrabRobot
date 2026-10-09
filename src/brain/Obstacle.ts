import { PIPE_SCROLL } from '../game/FlappyGame';
import type { FlappyState } from '../types';

/** Matches CrabRobot.radius. The opening is judged with this body size. */
export const BODY_RADIUS = 15;
const GRAVITY = 1120;
const GROUND_SPEED = 600;
const AIR_SPEED = 355;

export interface ObstacleView {
  /** The body is below the opening and would meet the lower pipe. */
  low: boolean;
  /** The body is above the opening and would meet the upper pipe. */
  high: boolean;
  /** Neither solid overlaps the body. */
  clear: boolean;
  /** How far the feet still sit below the lower lip, in pixels. */
  intoLower: number;
  /** How far the shell still sits above the upper lip, in pixels. */
  intoUpper: number;
  /** Seconds until the pipe face reaches the body, at the scroll speed. */
  eta: number;
  /** 0 far away, 1 when a blocking pipe is on the body. */
  threat: number;
}

/** A pipe is an obstacle only where the body would touch solid. A fitting opening is not one. */
export function judgeObstacle(state: FlappyState, radius = BODY_RADIUS): ObstacleView {
  const intoLower = Math.max(0, state.birdY + radius - state.gapBottom);
  const intoUpper = Math.max(0, state.gapTop - (state.birdY - radius));
  const low = intoLower > 1 && intoLower >= intoUpper;
  const high = intoUpper > 1 && intoUpper > intoLower;
  const clear = !low && !high;
  const distance = state.distanceToPipe;
  const eta = distance / PIPE_SCROLL;
  const threat = clear ? 0 : Math.max(0, Math.min(1, 1 - Math.max(0, distance) / 300));
  return { low, high, clear, intoLower, intoUpper, eta, threat };
}

/**
 * Jump only when this leap still clears the lip, and waiting `commitLead` pixels
 * would miss it. The lead is the decoder delay, not a permission to jump early
 * from a pose whose flight falls back onto the sand.
 */
export function jumpForObstacle(state: FlappyState, radius = BODY_RADIUS, commitLead = 12) {
  const view = judgeObstacle(state, radius);
  if (state.jumpsLeft === 0 && state.grounded === false) return false;
  if (!view.low || view.high) return false;
  if (state.birdVelocityY <= -70) return false;
  if (state.distanceToPipe < -radius) return false;
  const grounded = state.grounded ?? Math.abs(state.birdVelocityY) < 1;
  if (grounded && state.distanceToPipe > 260) return false;
  if (state.distanceToPipe > 300) return false;
  const sim = toSim(state);
  const memo = new Map<string, boolean>();
  if (!canHop(sim) || !flightClears(applyHop(sim), memo)) return false;
  return !episodeClears({ ...sim, distance: sim.distance - commitLead }, memo);
}

const HOP_COOLDOWN = 0.26;
/** Body-center height when the feet are on the arena sand. */
const SAND = 579;
const STEP = 0.02;
const CONTACT = 8;

interface Sim {
  y: number;
  vy: number;
  distance: number;
  jumpsLeft: number;
  cooldown: number;
  grounded: boolean;
  gapTop: number;
  gapBottom: number;
  pipeWidth: number;
  guard: number;
}

export interface Approach {
  y: number;
  vy: number;
  distance: number;
  grounded: boolean;
  jumpsLeft: number;
  cooldown: number;
  gapTop: number;
  gapBottom: number;
  pipeWidth: number;
}

/** One sand approach, with a lip the live arena can actually spawn. */
export function beginApproach(rand: () => number): Approach {
  const gapTop = 124 + rand() * 220;
  return {
    y: SAND, vy: 0, distance: 300 + rand() * 130, grounded: true, jumpsLeft: 3, cooldown: 0,
    gapTop, gapBottom: gapTop + 210, pipeWidth: 72
  };
}

export function approachState(approach: Approach): FlappyState {
  return {
    birdY: approach.y, birdVelocityY: approach.vy, pipeX: 112 + approach.distance, pipeWidth: approach.pipeWidth,
    gapTop: approach.gapTop, gapBottom: approach.gapBottom, gapCenterY: (approach.gapTop + approach.gapBottom) / 2,
    distanceToPipe: approach.distance, grounded: approach.grounded, jumpsLeft: approach.jumpsLeft
  };
}

/** Apply the teacher's jump, then the same 20 ms the live crab integrates. */
export function tickApproach(approach: Approach, jump: boolean, rand: () => number) {
  let sim = toSim(approachState(approach));
  if (jump && canHop(sim)) sim = applyHop(sim);
  const next = stepSim(sim);
  if (next.end === 'hit' || next.sim.distance < -(approach.pipeWidth + BODY_RADIUS)) {
    Object.assign(approach, beginApproach(rand));
    return;
  }
  approach.y = next.sim.y;
  approach.vy = next.sim.vy;
  approach.distance = next.sim.distance;
  approach.grounded = next.sim.grounded;
  approach.jumpsLeft = next.sim.jumpsLeft;
  approach.cooldown = next.sim.cooldown;
}

function toSim(state: FlappyState): Sim {
  const grounded = state.grounded ?? Math.abs(state.birdVelocityY) < 1;
  return {
    y: state.birdY, vy: grounded ? 0 : state.birdVelocityY, distance: state.distanceToPipe,
    jumpsLeft: state.jumpsLeft ?? (grounded ? 3 : 2), cooldown: 0, grounded,
    gapTop: state.gapTop, gapBottom: state.gapBottom, pipeWidth: state.pipeWidth, guard: 0
  };
}

function token(sim: Sim) {
  return [Math.round(sim.y), Math.round(sim.vy), Math.round(sim.distance), sim.jumpsLeft, sim.grounded ? 1 : 0, Math.max(0, Math.round(sim.cooldown / STEP))].join(':');
}

function blockedLow(sim: Sim) {
  const intoLower = Math.max(0, sim.y + BODY_RADIUS - sim.gapBottom);
  const intoUpper = Math.max(0, sim.gapTop - (sim.y - BODY_RADIUS));
  return intoLower > 1 && intoLower >= intoUpper && !(intoUpper > 1 && intoUpper > intoLower);
}

function canHop(sim: Sim) {
  return sim.jumpsLeft > 0 && sim.cooldown <= 0 && sim.guard <= 180 && sim.distance >= -BODY_RADIUS && (sim.grounded || sim.vy > -70) && blockedLow(sim);
}

function applyHop(sim: Sim): Sim {
  return { ...sim, grounded: false, vy: sim.grounded ? -GROUND_SPEED : -AIR_SPEED, jumpsLeft: sim.jumpsLeft - 1, cooldown: HOP_COOLDOWN };
}

/**
 * True when the latest hop that still reaches the lip — plus the same rule for later hops —
 * gets through the shaft. A committed flight that touches sand first is a miss.
 */
function flightClears(sim: Sim, memo: Map<string, boolean>): boolean {
  return strategyClears(sim, true, memo);
}

/** True when a jump now or on a later step of this approach still clears. */
function episodeClears(sim: Sim, memo: Map<string, boolean>): boolean {
  return strategyClears(sim, false, memo);
}

function strategyClears(sim: Sim, inFlight: boolean, memo: Map<string, boolean>): boolean {
  const key = (inFlight ? 'f' : 'e') + token(sim);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const samples: Sim[] = [];
  let ok = false;
  let cursor = sim;
  for (let guard = 0; guard < 180; guard++) {
    samples.push(cursor);
    const next = stepSim(cursor);
    if (next.end === 'clear') { ok = true; break; }
    if (next.end === 'hit' || (next.end === 'sand' && inFlight)) break;
    cursor = next.sim;
  }
  if (!ok) {
    const reach = 48 + Math.max(0, sim.jumpsLeft) * 78;
    const endDistance = samples.length ? samples[samples.length - 1].distance : sim.distance;
    if (endDistance <= reach) {
      for (let i = samples.length - 1; i >= 0; i--) {
        if (samples[i].distance > reach || !canHop(samples[i])) continue;
        if (strategyClears(applyHop(samples[i]), true, memo)) { ok = true; break; }
      }
    }
  }
  memo.set(key, ok);
  return ok;
}

function stepSim(sim: Sim): { end: 'clear' | 'hit' | 'sand' | 'cont'; sim: Sim } {
  let { y, vy, distance, jumpsLeft, cooldown, grounded } = sim;
  const prevY = y;
  cooldown = Math.max(0, cooldown - STEP);
  if (!grounded) {
    vy += GRAVITY * STEP;
    y += vy * STEP;
  }
  distance -= PIPE_SCROLL * STEP;
  const next = { ...sim, y, vy, distance, jumpsLeft, cooldown, grounded, guard: sim.guard + 1 };
  if (y - BODY_RADIUS <= 0) return { end: 'hit', sim: next };
  const overLip = distance < CONTACT + 5 && distance > -(sim.pipeWidth + 5 + CONTACT);
  const overShaft = distance < BODY_RADIUS && distance > -(sim.pipeWidth + BODY_RADIUS);
  const feet = y + BODY_RADIUS;
  const prevFeet = prevY + BODY_RADIUS;
  if (!grounded && overLip && vy >= 0 && prevY < sim.gapBottom && prevFeet <= sim.gapBottom + 1.25 && feet >= sim.gapBottom - 0.5) {
    next.y = sim.gapBottom - BODY_RADIUS;
    next.vy = 0;
    next.grounded = true;
    next.jumpsLeft = 3;
    next.cooldown = 0;
    return { end: 'clear', sim: next };
  }
  if (!grounded && overShaft && vy >= 0 && y < sim.gapBottom && feet > sim.gapBottom && sim.gapBottom - sim.gapTop >= BODY_RADIUS * 2 + 8) {
    next.y = sim.gapBottom - BODY_RADIUS;
    next.vy = 0;
    next.grounded = true;
    next.jumpsLeft = 3;
    next.cooldown = 0;
    return { end: 'clear', sim: next };
  }
  if (!grounded && y > SAND) {
    next.y = SAND;
    next.vy = 0;
    next.grounded = true;
    next.jumpsLeft = 3;
    next.cooldown = 0;
    if (distance > -(sim.pipeWidth + BODY_RADIUS)) return { end: 'sand', sim: next };
  }
  if (overShaft && (y - BODY_RADIUS < sim.gapTop || y + BODY_RADIUS > sim.gapBottom)) return { end: 'hit', sim: next };
  if (distance <= -(sim.pipeWidth + BODY_RADIUS)) return { end: 'clear', sim: next };
  return { end: 'cont', sim: next };
}
