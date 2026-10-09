import type { FlappyState } from '../types';
import { jumpForObstacle } from './Obstacle';

/**
 * The obstacle test decides the jump. A confident readout may look 20px sooner,
 * and still will not jump through an opening the body already fits.
 */
export function trainedFlapRequest(state: FlappyState, learned: number, threshold: number) {
  if (learned < threshold) return jumpForObstacle(state);
  return jumpForObstacle({ ...state, distanceToPipe: state.distanceToPipe - 20 });
}

/** Ordinary training starts cautious and reaches the fitted-model threshold after ~1,000 samples. */
export function onlineLearningThreshold(samples: number, trainedThreshold: number) {
  const progress = Math.max(0, Math.min(1, samples / 1000));
  return 0.68 + (trainedThreshold - 0.68) * progress;
}
