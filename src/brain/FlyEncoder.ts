import type { FlappyState, NeuralStimulus } from '../types';
import { judgeObstacle } from './Obstacle';

export class FlyEncoder {
  static encode(state: FlappyState): NeuralStimulus {
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const view = judgeObstacle(state);
    const approach = view.threat;
    const error = state.gapCenterY - state.birdY;
    const vertical = clamp(Math.abs(error) / 240);
    const velocity = clamp(Math.abs(state.birdVelocityY) / 520);
    const blocked = view.clear ? 0 : 1;
    const heading = state.heading ?? 1;
    const grounded = state.grounded ?? false;
    const jumpsLeft = state.jumpsLeft ?? (grounded ? 3 : 2);
    const slip = heading < 0 ? 0.35 : 1;
    return {
      lc4: approach,
      lplc2: view.clear ? 0 : clamp(approach * 0.9 + 0.04),
      /** Seconds until the pipe face. 1 means contact, 0 means more than 1.2 s away. */
      lplc1: blocked * clamp(1 - Math.max(0, view.eta) / 1.2),
      /** How many ground-leap heights the feet still sit below the lower lip. */
      lc6: clamp(view.intoLower / 180),
      /** How many body diameters the shell still sits above the upper lip. */
      lc16: clamp(view.intoUpper / 30),
      lc10Left: error < 0 ? vertical : 0,
      lc10Right: error >= 0 ? vertical : 0,
      upward: state.birdVelocityY < 0 ? velocity : 0,
      downward: state.birdVelocityY >= 0 ? velocity : 0,
      /** Pipe-ward optic flow. Retreat cancels part of the scroll. */
      flowFore: heading < 0 ? 0 : slip,
      flowBack: heading < 0 ? 0.7 : 0,
      /** Wide-field horizontal slip. 1 when the world streams past, lower while backing up. */
      h2: slip,
      /** How centered the opening is on the body. A fitting gap is a full match. */
      lc11: view.clear ? 1 : clamp(1 - Math.abs(error) / 240),
      /** Claw contact stands in for a foot on the ground. */
      claw: grounded ? 1 : 0,
      hops: clamp(jumpsLeft / 3)
    };
  }
}
