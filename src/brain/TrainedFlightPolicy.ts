import type { FlappyState, Mode } from '../types';
import { BODY_RADIUS, jumpForObstacle } from './Obstacle';

/** Pixels of pipe travel covering the two-tick decoder and one late worker frame. */
const BASE_LEAD = 12;
/** A confident readout may commit this much sooner, and only while that leap still clears. */
const CONFIDENT_LEAD = 20;

/**
 * The obstacle test decides the jump. A confident readout may commit a little sooner.
 * It still will not jump through an opening the body already fits, and it will not
 * jump from a pose whose flight lands back on the sand.
 */
export function trainedFlapRequest(state: FlappyState, learned: number, threshold: number) {
  return jumpForObstacle(state, BODY_RADIUS, learned >= threshold ? CONFIDENT_LEAD : BASE_LEAD);
}

/** Fast training keeps the fitted threshold. A threshold of 0 would treat every probability as confident. */
export function readoutThreshold(mode: Mode, samples: number, trainedThreshold: number) {
  return mode === 'online' ? onlineLearningThreshold(samples, trainedThreshold) : trainedThreshold;
}

/** Ordinary training starts cautious and reaches the fitted-model threshold after ~1,000 samples. */
export function onlineLearningThreshold(samples: number, trainedThreshold: number) {
  const progress = Math.max(0, Math.min(1, samples / 1000));
  return 0.68 + (trainedThreshold - 0.68) * progress;
}
