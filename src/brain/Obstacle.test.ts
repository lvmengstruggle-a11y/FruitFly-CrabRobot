import { describe, expect, it } from 'vitest';
import { BODY_RADIUS, judgeObstacle, jumpForObstacle } from './Obstacle';
import { CrabRobot } from '../game/CrabRobot';

const pipe = (birdY: number, velocity: number, distance: number, gapBottom = 410, gapTop = 200) => ({
  birdY, birdVelocityY: velocity, pipeX: 112 + distance, pipeWidth: 72,
  gapTop, gapBottom, gapCenterY: (gapTop + gapBottom) / 2, distanceToPipe: distance
});

describe('obstacle judgment', () => {
  it('uses the crab body radius', () => {
    expect(new CrabRobot().radius).toBe(BODY_RADIUS);
  });

  it('ignores a pipe the body already fits through', () => {
    const view = judgeObstacle(pipe(300, 0, 40, 450, 240));
    expect(view.clear).toBe(true);
    expect(view.threat).toBe(0);
    expect(jumpForObstacle(pipe(300, 0, 40, 450, 240))).toBe(false);
  });

  it('waits while a blocking lip is still far, then jumps as it comes into the leap', () => {
    const far = pipe(579, 0, 400, 500, 290);
    const near = pipe(579, 0, 60, 500, 290);
    expect(judgeObstacle(far).low).toBe(true);
    expect(jumpForObstacle(far)).toBe(false);
    expect(jumpForObstacle(near)).toBe(true);
    expect(jumpForObstacle(pipe(579, -200, 60, 500, 290))).toBe(false);
    expect(jumpForObstacle({ ...pipe(579, 0, 60, 500, 290), jumpsLeft: 0, grounded: false })).toBe(false);
  });

  it('clears a lower lip by jumping on that schedule', () => {
    expect(clears(520)).toBe(true);
    expect(clears(430)).toBe(true);
    expect(clears(340)).toBe(true);
  });
});

/** Sand start, one pipe. Landing on a lip the center is still above matches the game. */
function clears(gapBottom: number) {
  const radius = BODY_RADIUS;
  const gapTop = gapBottom - 210;
  let y = 579;
  let vy = 0;
  let grounded = true;
  let pipeX = 112 + 320;
  for (let step = 0; step < 900; step++) {
    const state = pipe(y, vy, pipeX - 112, gapBottom, gapTop);
    if (jumpForObstacle(state)) {
      vy = grounded ? -600 : -355;
      grounded = false;
    }
    if (!grounded) {
      vy += 1120 * 0.02;
      y += vy * 0.02;
      if (y >= 579) { y = 579; vy = 0; grounded = true; }
    }
    pipeX -= 132 * 0.02;
    const distance = pipeX - 112;
    const overLip = distance < radius + 5 && distance > -(72 + 5 + radius);
    if (overLip && vy >= 0 && y < gapBottom && y + radius >= gapBottom - 0.5) {
      y = gapBottom - radius;
      vy = 0;
      grounded = true;
    }
    const overlaps = distance < radius && distance > -(72 + radius);
    if (overlaps && (y - radius < gapTop || y + radius > gapBottom)) return false;
    if (pipeX + 72 < 112 - radius) return true;
  }
  return false;
}
