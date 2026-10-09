import { describe, expect, it } from 'vitest';
import { onlineLearningThreshold, trainedFlapRequest } from './TrainedFlightPolicy';

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

  it('starts a little earlier once the readout is confident', () => {
    const ahead = state(579, 0, 300, 500, 290);
    expect(trainedFlapRequest(ahead, 0.4, 0.42)).toBe(false);
    expect(trainedFlapRequest(ahead, 0.8, 0.42)).toBe(true);
  });

  it('still jumps a close lip when the readout has not learned', () => {
    expect(trainedFlapRequest(state(579, 0, 50, 500, 290), 0, 0.68)).toBe(true);
  });

  it('gradually converges from the ordinary-training threshold to the fast-trained threshold', () => {
    expect(onlineLearningThreshold(0, 0.42)).toBe(0.68);
    expect(onlineLearningThreshold(500, 0.42)).toBeCloseTo(0.55);
    expect(onlineLearningThreshold(1000, 0.42)).toBe(0.42);
  });
});
