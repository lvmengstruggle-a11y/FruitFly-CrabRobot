import { describe, expect, it } from 'vitest';
import { AIR_HOP, GROUND_LEAP } from './CrabRobot';
import { FlappyGame, PIPE_INTERVAL, PIPE_SCROLL } from './FlappyGame';
import { Pipe } from './Pipe';

const SURFACE = 410;

function started() {
  let cause = '';
  const game = new FlappyGame(1, (next) => { cause = next; });
  game.start();
  return { game, cause: () => cause };
}

function dropOnto(game: FlappyGame, pipeX: number) {
  game.pipes = [new Pipe(pipeX, SURFACE - 210, 210)];
  game.crab.release();
  game.crab.y = SURFACE - game.crab.radius - 1;
  game.crab.prevY = game.crab.y;
  game.crab.velocityY = 40;
  game.update(0.02);
}

describe('crawling on a pipe plane', () => {
  it('starts the run standing on the sand', () => {
    const { game } = started();
    const floor = game.height - 46;
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.velocityY).toBe(0);
    expect(game.crab.y).toBeCloseTo(floor - game.crab.radius);
    game.update(0.2);
    expect(game.running).toBe(true);
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.y).toBeCloseTo(floor - game.crab.radius);
  });
  it('leaves a stretch of sand between pipes', () => {
    const gap = PIPE_SCROLL * PIPE_INTERVAL - 72;
    expect(gap).toBeGreaterThan(360);
    expect(PIPE_INTERVAL).toBeGreaterThan(3);
  });
  it('lets gravity plant a partial overlap and then holds the crab on the plane', () => {
    const { game } = started();
    // Contact window is the body center ± 8. The ledge begins 2px inside that window.
    dropOnto(game, game.crab.x + 6);
    expect(game.running).toBe(true);
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.y).toBeCloseTo(SURFACE - game.crab.radius);
    expect(game.crab.velocityY).toBe(0);
    expect(game.crab.pitch()).toBe(0);

    const planted = game.crab.y;
    game.update(0.12);
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.y).toBeCloseTo(planted);
    expect(game.crab.velocityY).toBe(0);
  });

  it('falls as soon as the plane no longer overlaps the body', () => {
    const { game } = started();
    dropOnto(game, 90);
    const planted = game.crab.y;
    game.pipes[0].x = -200;
    game.update(0.02);
    expect(game.running).toBe(true);
    expect(game.crab.grounded).toBe(false);
    expect(game.crab.y).toBeCloseTo(planted);
    const y = game.crab.y;
    game.update(0.05);
    expect(game.crab.velocityY).toBeGreaterThan(0);
    expect(game.crab.y).toBeGreaterThan(y);
  });

  it('turns the shell around instead of snapping', () => {
    const { game } = started();
    for (let i = 0; i < 4; i++) game.nerve(1);
    game.update(0.016);
    expect(game.crab.heading).toBe(-1);
    expect(game.crab.facing).toBeGreaterThan(0.05);
    expect(game.crab.facing).toBeLessThan(Math.PI - 0.4);
    for (let i = 0; i < 20; i++) game.update(0.05);
    expect(game.crab.facing).toBeGreaterThan(Math.PI - 0.2);
    game.flap();
    const turned = game.crab.facing;
    game.update(0.016);
    expect(game.crab.heading).toBe(1);
    expect(game.crab.facing).toBeLessThan(turned);
    expect(game.crab.facing).toBeGreaterThan(1);
  });

  it('backs away while the loom nerve holds, then returns when it releases', () => {
    const { game } = started();
    for (let i = 0; i < 4; i++) game.nerve(1);
    const start = game.crab.x;
    game.update(0.4);
    expect(game.crab.heading).toBe(-1);
    expect(game.crab.x).toBeLessThan(start - 20);
    expect(game.crab.grounded).toBe(true);
    const posed = game.crab.servoAngles().LM_J0_joint;
    game.update(0.2);
    expect(game.crab.servoAngles().LM_J0_joint).not.toBeCloseTo(posed);
    game.update(1.2);
    expect(game.crab.x).toBe(game.crab.rearX);
    for (let i = 0; i < 6; i++) game.nerve(0);
    for (let i = 0; i < 40 && game.crab.x < game.crab.homeX; i++) game.update(0.05);
    expect(game.crab.x).toBeCloseTo(game.crab.homeX);
    expect(game.crab.heading).toBe(1);
  });

  it('does not back away in the air', () => {
    const { game } = started();
    game.flap();
    for (let i = 0; i < 4; i++) game.nerve(1);
    const x = game.crab.x;
    game.update(0.2);
    expect(game.crab.grounded).toBe(false);
    expect(game.crab.x).toBeCloseTo(x);
  });

  it('takes the fourth jump only after the feet are back on the ground', () => {
    const { game } = started();
    const floor = game.height - 46;
    game.flap();
    expect(game.crab.velocityY).toBe(GROUND_LEAP);
    game.flap();
    game.flap();
    expect(game.crab.velocityY).toBe(AIR_HOP);
    game.crab.velocityY = 40;
    game.flap();
    expect(game.crab.grounded).toBe(false);
    expect(game.crab.velocityY).toBe(40);
    game.crab.y = floor - game.crab.radius - 1;
    game.crab.prevY = game.crab.y;
    game.update(0.05);
    expect(game.crab.grounded).toBe(true);
    game.flap();
    expect(game.crab.velocityY).toBe(GROUND_LEAP);
  });

  it('pushes harder with the legs on the first jump off the ground', () => {
    const { game } = started();
    const start = game.crab.y;
    game.flap();
    game.update(0.11);
    const shoved = game.crab.servoAngles().LM_J1_joint;
    while (game.crab.velocityY < 0 && game.running) game.update(0.02);
    const groundHeight = start - game.crab.y;
    game.flap();
    expect(game.crab.velocityY).toBe(AIR_HOP);
    const airStart = game.crab.y;
    game.update(0.11);
    expect(shoved).toBeLessThan(game.crab.servoAngles().LM_J1_joint);
    while (game.crab.velocityY < 0 && game.running) game.update(0.02);
    expect(groundHeight).toBeGreaterThan(airStart - game.crab.y + 40);
  });

  it('jumps off the plane when the connectome flaps', () => {
    const { game } = started();
    dropOnto(game, 90);
    game.flap();
    expect(game.crab.grounded).toBe(false);
    expect(game.crab.velocityY).toBe(GROUND_LEAP);
    const y = game.crab.y;
    game.update(0.04);
    expect(game.crab.grounded).toBe(false);
    expect(game.crab.y).toBeLessThan(y);
  });

  it('walks on the sand instead of dying when gravity reaches the floor', () => {
    const { game } = started();
    const floor = game.height - 46;
    game.pipes = [];
    game.crab.release();
    game.crab.y = floor - game.crab.radius - 1;
    game.crab.prevY = game.crab.y;
    game.crab.velocityY = 40;
    game.update(0.02);
    expect(game.running).toBe(true);
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.y).toBeCloseTo(floor - game.crab.radius);
    expect(game.crab.velocityY).toBe(0);
    game.update(0.1);
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.y).toBeCloseTo(floor - game.crab.radius);
  });

  it('settles onto a lip when the body center is still above it', () => {
    const { game } = started();
    game.pipes = [new Pipe(90, SURFACE - 210, 210)];
    game.crab.release();
    game.crab.y = SURFACE - 2;
    game.crab.prevY = game.crab.y;
    game.crab.velocityY = 40;
    game.update(0.02);
    expect(game.running).toBe(true);
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.y).toBeCloseTo(SURFACE - game.crab.radius);
  });

  it('does not pass through a lip once the body center is inside the solid', () => {
    const { game, cause } = started();
    game.pipes = [new Pipe(90, SURFACE - 210, 210)];
    game.crab.release();
    game.crab.y = SURFACE + 10;
    game.crab.prevY = game.crab.y;
    game.crab.velocityY = 40;
    game.update(0.02);
    expect(game.running).toBe(false);
    expect(game.crab.grounded).toBe(false);
    expect(cause()).toBe('missed');
  });

  it('rocks sideways while a step is on the ground', () => {
    const { game } = started();
    dropOnto(game, 90);
    game.update(0.2);
    expect(Math.abs(game.crab.scuttle())).toBeGreaterThan(1);
    expect(game.crab.lean()).not.toBe(0);
    expect(game.crab.bob()).toBeGreaterThan(1);
  });

  it('raises the claws when a pipe is close', () => {
    const { game } = started();
    game.pipes = [new Pipe(game.crab.x + 40, 180, 210)];
    game.crab.release();
    game.crab.y = 200;
    game.crab.prevY = game.crab.y;
    game.crab.velocityY = -20;
    game.update(0.02);
    expect(game.crab.threat).toBeGreaterThan(0.5);
    const raised = game.crab.servoAngles().LF_J1_joint;
    game.crab.threat = 0;
    expect(raised).toBeGreaterThan(game.crab.servoAngles().LF_J1_joint);
  });

  it('reaches down and shortens its step when the lip is about to leave', () => {
    const { game } = started();
    dropOnto(game, 40);
    expect(game.crab.grounded).toBe(true);
    expect(game.crab.brink).toBeGreaterThan(0.3);
    const reaching = game.crab.servoAngles().LM_J1_joint;
    game.crab.brink = 0;
    expect(reaching).not.toBeCloseTo(game.crab.servoAngles().LM_J1_joint);
  });

  it('puts its legs down when a fall is about to reach the sand', () => {
    const { game } = started();
    const floor = game.height - 46;
    game.pipes = [];
    game.crab.release();
    game.crab.y = floor - game.crab.radius - 30;
    game.crab.prevY = game.crab.y;
    game.crab.velocityY = 80;
    game.update(0.02);
    expect(game.running).toBe(true);
    expect(game.crab.grounded).toBe(false);
    expect(game.crab.plant).toBeGreaterThan(0.4);
    const down = game.crab.servoAngles().LM_J1_joint;
    game.crab.plant = 0;
    expect(down).toBeLessThan(game.crab.servoAngles().LM_J1_joint);
  });

  it('sinks into its legs after the feet meet the sand', () => {
    const { game } = started();
    const floor = game.height - 46;
    game.pipes = [];
    game.crab.release();
    game.crab.y = floor - game.crab.radius - 1;
    game.crab.prevY = game.crab.y;
    game.crab.velocityY = 40;
    game.update(0.02);
    expect(game.crab.grounded).toBe(true);
    game.update(0.06);
    expect(game.crab.compress).toBeGreaterThan(0.4);
  });

  it('holds the claw facing the pipe higher than the trailing claw', () => {
    const { game } = started();
    dropOnto(game, 90);
    game.crab.threat = 1;
    const angles = game.crab.servoAngles();
    expect(angles.LF_J1_joint).toBeGreaterThan(angles.RF_J1_joint + 0.2);
  });

  it('still dies when the shell is too far under the lip to hook it', () => {
    const { game, cause } = started();
    game.pipes = [new Pipe(90, SURFACE - 210, 210)];
    game.crab.release();
    game.crab.y = SURFACE + 70;
    game.crab.prevY = game.crab.y;
    game.crab.velocityY = 20;
    game.update(0.02);
    expect(game.running).toBe(false);
    expect(game.crab.grounded).toBe(false);
    expect(cause()).toBe('missed');
  });
});

describe('pipe numbers', () => {
  it('counts columns from 1 in spawn order', () => {
    const { game } = started();
    expect(game.pipes.map((pipe) => pipe.index)).toEqual([1]);
    game.update(PIPE_INTERVAL);
    expect(game.pipes.map((pipe) => pipe.index)).toEqual([1, 2]);
  });
});
