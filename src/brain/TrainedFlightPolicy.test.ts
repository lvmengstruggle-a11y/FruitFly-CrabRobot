import { describe, expect, it } from 'vitest';
import { FlyDecoder } from './FlyDecoder';
import { beginApproach, jumpForObstacle, tickApproach } from './Obstacle';
import { onlineLearningThreshold, readoutThreshold, trainedFlapRequest } from './TrainedFlightPolicy';
import { FlappyGame } from '../game/FlappyGame';
import type { FlappyState } from '../types';

const state = (birdY: number, birdVelocityY: number, distance = 70, gapBottom = 410, gapTop = 200) => ({
  birdY, birdVelocityY, pipeX: 112 + distance, pipeWidth: 72,
  gapTop, gapBottom, gapCenterY: (gapTop + gapBottom) / 2, distanceToPipe: distance
});

describe('trainedFlapRequest', () => {
  it('never flaps when the body already fits, even with a saturated readout', () => {
    expect(trainedFlapRequest(state(300, 20, 40, 450, 240), 1, 0.42)).toBe(false);
  });

  it('never flaps while already climbing fast', () => {
    expect(trainedFlapRequest(state(579, -200, 50, 500, 290), 1, 0.42)).toBe(false);
  });

  it('commits a little sooner once the readout is confident, without leaping while the pipe is still far', () => {
    expect(trainedFlapRequest(state(579, 0, 400, 500, 290), 1, 0.42)).toBe(false);
    const cautious = firstCommit(0.4, 0.42);
    const confident = firstCommit(0.8, 0.42);
    expect(confident).toBeGreaterThan(cautious);
    expect(confident - cautious).toBeLessThanOrEqual(16);
  });

  it('does not treat a saturated readout as a jump from a pose that falls back onto the sand', () => {
    expect(trainedFlapRequest(state(579, 0, 321, 537, 327), 1, 0)).toBe(false);
  });

  it('still jumps a close lip when the readout has not learned', () => {
    expect(trainedFlapRequest(state(579, 0, 50, 500, 290), 0, 0.68)).toBe(true);
  });

  it('gradually converges from the ordinary-training threshold to the fast-trained threshold', () => {
    expect(onlineLearningThreshold(0, 0.42)).toBe(0.68);
    expect(onlineLearningThreshold(500, 0.42)).toBeCloseTo(0.55);
    expect(onlineLearningThreshold(1000, 0.42)).toBe(0.42);
  });

  it('keeps the fitted threshold after fast training', () => {
    expect(readoutThreshold('trained', 0, 0.42)).toBe(0.42);
    expect(readoutThreshold('online', 0, 0.42)).toBe(0.68);
  });
});

function firstCommit(learned: number, threshold: number) {
  for (let distance = 420; distance >= 20; distance -= 2) {
    if (trainedFlapRequest(state(579, 0, distance, 500, 290), learned, threshold)) return distance;
  }
  return -1;
}

function survive(seed: number, policy: (state: FlappyState) => boolean) {
  let cause = '';
  const game = new FlappyGame(seed, (next) => { cause = next; });
  game.start();
  const decide = new FlyDecoder(2, 260);
  let elapsed = 0;
  for (let step = 0; step < 900 && game.running && game.score < 1; step++) {
    game.update(0.02);
    elapsed += 0.02;
    if (!game.running) break;
    const flap = decide.decide(elapsed * 1000, policy(game.capture())) === 'FLAP';
    if (flap) game.flap();
  }
  return { score: game.score, cause, elapsed };
}

describe('fast-trained flight', () => {
  it('clears pipes after a confident readout instead of dying on the first lip', () => {
    let teacher = 0;
    let confident = 0;
    for (let seed = 1; seed <= 6; seed++) {
      teacher += survive(seed, (state) => jumpForObstacle(state)).score;
      confident += survive(seed, (state) => trainedFlapRequest(state, 1, 0.42)).score;
    }
    expect(teacher).toBeGreaterThan(0);
    expect(confident).toBeGreaterThan(0);
  });

  it('leaps from the sand in the fast-training rollout', () => {
    const approach = beginApproach(() => 0);
    expect(approach.grounded).toBe(true);
    expect(approach.y).toBe(579);
    tickApproach(approach, true, () => 0);
    expect(approach.grounded).toBe(false);
    expect(approach.vy).toBeLessThan(-500);
  });
});
