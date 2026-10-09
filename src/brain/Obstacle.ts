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
 * Jump only when the body would hit the lower lip, and a leap from this state
 * stays inside the opening for the whole time the shaft overlaps the body.
 */
export function jumpForObstacle(state: FlappyState, radius = BODY_RADIUS) {
  const view = judgeObstacle(state, radius);
  if (state.jumpsLeft === 0 && state.grounded === false) return false;
  if (!view.low || view.high) return false;
  if (state.birdVelocityY <= -70) return false;
  if (state.distanceToPipe < -radius) return false;
  return staysClear(state, true) && !staysClear(state, false);
}

const HOP_COOLDOWN = 0.26;
const SAND = 579;
const LIP = 5;

/**
 * True when a forward roll stays out of the solid while the shaft overlaps the body.
 * Falling onto the lower lip with the center still above it counts as a landing, matching the game.
 */
function staysClear(state: FlappyState, jump: boolean) {
  let y = state.birdY;
  let vy = state.birdVelocityY;
  let distance = state.distanceToPipe;
  let jumps = 0;
  let cooldown = 0;
  let riding = false;
  if (jump) {
    vy = Math.abs(vy) < 1 ? -GROUND_SPEED : -AIR_SPEED;
    jumps = 1;
    cooldown = HOP_COOLDOWN;
  }
  let overlapped = false;
  for (let step = 0; step < 110; step++) {
    const dt = 0.02;
    if (!riding) {
      cooldown -= dt;
      const intoLower = y + BODY_RADIUS - state.gapBottom;
      const intoUpper = state.gapTop - (y - BODY_RADIUS);
      const low = intoLower > 1 && intoLower >= Math.max(0, intoUpper);
      if (jump && low && vy > -70 && jumps < 3 && cooldown <= 0) {
        vy = -AIR_SPEED;
        jumps += 1;
        cooldown = HOP_COOLDOWN;
      }
      vy += GRAVITY * dt;
      y += vy * dt;
      if (y > SAND) { y = SAND; vy = 0; }
    }
    distance -= PIPE_SCROLL * dt;
    const overLip = distance < BODY_RADIUS + LIP && distance > -(state.pipeWidth + LIP + BODY_RADIUS);
    const overShaft = distance < BODY_RADIUS && distance > -(state.pipeWidth + BODY_RADIUS);
    if (riding) {
      if (overShaft) overlapped = true;
      if (!overLip) riding = false;
      else continue;
    }
    if (overLip && vy >= 0 && y < state.gapBottom && y + BODY_RADIUS >= state.gapBottom - 0.5) {
      y = state.gapBottom - BODY_RADIUS;
      vy = 0;
      riding = true;
      if (overShaft) overlapped = true;
      continue;
    }
    if (overShaft) {
      overlapped = true;
      if (y - BODY_RADIUS < state.gapTop || y + BODY_RADIUS > state.gapBottom) return false;
    } else if (overlapped && distance <= -(state.pipeWidth + BODY_RADIUS)) return true;
  }
  return overlapped;
}
