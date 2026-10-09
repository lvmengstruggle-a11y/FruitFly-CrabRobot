export type Mode = 'pure' | 'online' | 'trained';
export type Decision = 'FLAP' | 'WAIT';
export type AppState = 'BOOT' | 'LOADING_CONNECTOME' | 'READY' | 'RUNNING' | 'PAUSED' | 'DEAD' | 'ERROR';

export interface FlappyState {
  birdY: number; birdVelocityY: number; pipeX: number; pipeWidth: number;
  gapTop: number; gapBottom: number; gapCenterY: number; distanceToPipe: number;
  /** Present on the live crab. The training sim omits them. */
  grounded?: boolean; jumpsLeft?: number; heading?: number;
}
export interface NeuralStimulus {
  lc4: number; lplc2: number; lplc1: number; lc6: number; lc16: number;
  lc10Left: number; lc10Right: number; upward: number; downward: number;
  flowFore: number; flowBack: number; h2: number; lc11: number; claw: number; hops: number;
}
export interface BrainActivity {
  lc4: number; lplc2: number; lplc1: number; lc6: number; lc16: number;
  lc10Left: number; lc10Right: number; upward: number; downward: number;
  flowFore: number; flowBack: number; h2: number; lc11: number; claw: number; hops: number;
  dnp01: number; loom: number; hold: number;
}
export interface BrainResult {
  timestamp: number; decision: Decision; flapProbability?: number; activity: BrainActivity;
  totalSpikes: number; stepTime: number; activityFrame: ArrayBuffer; activityFrameLength: number;
  trainingSamples?: number; trainingLoss?: number; readoutModel?: { weights: number[]; bias: number; threshold: number; features: string[]; mean?: number[]; scale?: number[]; trainingSamples?: number; trainingLoss?: number };
}
export interface BrainManifest {
  neurons: number; connections: number; ln_min: number; weights_mb: number;
  parts: string[]; meta_mb: number; weight_error_mean: number; weight_error_max: number;
}
export interface ExperimentRecord { flyId: number; mode: Mode; score: number; lifetime: number; totalSpikes: number; at: number; }
