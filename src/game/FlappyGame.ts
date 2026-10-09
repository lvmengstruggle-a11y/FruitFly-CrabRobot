import { CrabRobot } from './CrabRobot'; import { Pipe, PIPE_LIP } from './Pipe'; import { arenaFloor, climbSurface, collided, edgeSlack, supportFloor, supportSurface } from './Collision';
import { SeededRandom } from '../experiment/SeededRandom'; import type { FlappyState } from '../types';

/** Pipes drift left at this speed. Footprints use the same number. */
export const PIPE_SCROLL = 132;
/** Seconds between pipes. At PIPE_SCROLL this leaves a stretch of sand to crawl. */
export const PIPE_INTERVAL = 3.4;

export class FlappyGame {
  readonly width = 480; readonly height = 640; readonly crab = new CrabRobot(); pipes: Pipe[] = [];
  score = 0; elapsed = 0; running = false; private spawnTimer = 0; private pipeCount = 0; private rng: SeededRandom;
  constructor(seed: number, private onDeath: (cause: string) => void) { this.rng = new SeededRandom(seed); this.reset(seed); }
  reset(seed: number) {
    this.rng = new SeededRandom(seed);
    this.crab.reset();
    this.crab.stand(arenaFloor(this.height));
    this.pipes = [];
    this.score = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.pipeCount = 0;
    this.spawn(true);
  }
  start() { this.running = true; }
  stop() { this.running = false; }
  flap() { return this.running && this.crab.flap(); }
  nerve(hold: number) { if (this.running) this.crab.nerve(hold); }
  private spawn(first = false) {
    const gap = 210;
    const x = first ? this.width + 40 : this.width + 90;
    // The lip stays within a three-hop climb from the sand. A higher opening cannot be cleared.
    this.pipes.push(new Pipe(x, this.rng.range(124, this.height - 86 - gap), gap, ++this.pipeCount));
  }
  update(dt: number) {
    if (!this.running) return;
    this.elapsed += dt; this.spawnTimer += dt; this.crab.update(dt);
    if (this.spawnTimer >= PIPE_INTERVAL) { this.spawnTimer -= PIPE_INTERVAL; this.spawn(); }
    let surface: number | null = null;
    for (const pipe of this.pipes) {
      pipe.update(dt, PIPE_SCROLL);
      if (!pipe.scored && pipe.x + pipe.width < this.crab.x) { pipe.scored = true; this.score++; }
      const ledge = supportSurface(this.crab, pipe);
      if (ledge !== null && (surface === null || ledge < surface)) surface = ledge;
    }
    const floor = supportFloor(this.crab, this.height);
    if (floor !== null && (surface === null || floor < surface)) surface = floor;
    const climbing = surface === null;
    if (climbing) {
      for (const pipe of this.pipes) {
        const haul = climbSurface(this.crab, pipe);
        if (haul !== null && (surface === null || haul < surface)) surface = haul;
      }
    }
    if (surface !== null) this.crab.land(surface, climbing);
    else if (this.crab.grounded) this.crab.release();
    this.sense();
    this.crab.brink = this.lipFeel();
    this.crab.plant = this.footReach();
    for (const pipe of this.pipes) {
      if (collided(this.crab, pipe)) { this.running = false; this.onDeath(this.deathCause(pipe)); return; }
    }
    this.pipes = this.pipes.filter((p) => p.x + p.width > -20);
    if (this.crab.y - this.crab.radius <= 0) { this.running = false; this.onDeath('early'); }
    else if (!this.crab.grounded && this.crab.y - this.crab.radius > this.height) { this.running = false; this.onDeath('missed'); }
  }
  private lipFeel() {
    if (!this.crab.grounded) return 0;
    const surfaceY = this.crab.y + this.crab.radius;
    let slack = Number.POSITIVE_INFINITY;
    for (const pipe of this.pipes) {
      const remain = edgeSlack(this.crab, pipe, surfaceY);
      if (remain !== null) slack = Math.min(slack, remain);
    }
    if (!Number.isFinite(slack)) return 0;
    return slack < 28 ? Math.max(0, 1 - slack / 28) : 0;
  }
  private footReach() {
    const crab = this.crab;
    if (crab.grounded || crab.velocityY <= 40) return 0;
    const feet = crab.y + crab.radius;
    let surface = arenaFloor(this.height);
    for (const pipe of this.pipes) {
      const left = pipe.x - PIPE_LIP;
      const right = pipe.x + pipe.width + PIPE_LIP;
      const over = crab.x + 8 > left && crab.x - 8 < right;
      if (over && pipe.gapBottom >= feet - 4 && pipe.gapBottom < surface) surface = pipe.gapBottom;
    }
    const gap = surface - feet;
    return gap < 56 && gap > -4 ? Math.max(0, 1 - gap / 56) : 0;
  }
  private sense() {
    const pipe = this.pipes.find((item) => item.x + item.width >= this.crab.x);
    const distance = pipe ? pipe.x - this.crab.x : 999;
    this.crab.threat = distance > 0 ? Math.max(0, Math.min(1, 1 - distance / 200)) : 0;
    const center = pipe ? (pipe.gapTop + pipe.gapBottom) / 2 : this.crab.y;
    this.crab.look = Math.max(-1, Math.min(1, (center - this.crab.y) / 150));
  }
  private deathCause(pipe: Pipe) { return this.crab.y < pipe.gapTop ? 'panic' : 'missed'; }
  get targetPipe() { return this.pipes.find((p) => p.x + p.width >= this.crab.x) ?? this.pipes[0]; }
  capture(): FlappyState {
    const p = this.targetPipe;
    // birdY is the connectome's sensory interface: the crab body's altitude and climb rate.
    return { birdY: this.crab.y, birdVelocityY: this.crab.velocityY, pipeX: p.x, pipeWidth: p.width,
      gapTop: p.gapTop, gapBottom: p.gapBottom, gapCenterY: (p.gapTop + p.gapBottom) / 2, distanceToPipe: p.x - this.crab.x,
      grounded: this.crab.grounded, jumpsLeft: this.crab.jumpsLeft, heading: this.crab.heading };
  }
}
