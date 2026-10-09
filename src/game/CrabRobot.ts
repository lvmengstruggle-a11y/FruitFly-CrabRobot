import { CRAWL_RATE, jumpShape, servoAngles as poseServos, skeleton, stepRush, type LegSkeleton } from './crab/kinematics';

/** Upward speed of a hop that has no ground under the feet. The trained readout still assumes this. */
export const AIR_HOP = -355;
/** First jump off the sand or a pipe. The legs push harder, so the same gravity carries the body higher. */
export const GROUND_LEAP = -600;

/** Sideways body of the jumper crab. A connectome FLAP is a jump, not a wingbeat. */
export class CrabRobot {
  readonly homeX = 112;
  readonly rearX = 36;
  x = 112;
  /** 1 walks toward the pipes. -1 backs away while loom neurons hold. */
  heading = 1;
  /** Shell yaw in radians. Eases toward 0 or π so a retreat turns instead of snapping. */
  facing = 0;
  readonly radius = 15;
  y = 320;
  prevY = 320;
  velocityY = 0;
  /** Normal force from a pipe plane cancels gravity while this is set. */
  grounded = false;
  /** 0–1, how close the next pipe is. The claws rise as it approaches. */
  threat = 0;
  /** 0–1 while the claws are pulling the shell up onto a lip. */
  haul = 0;
  /** 0–1 when a supporting lip is about to slide out from under the feet. */
  brink = 0;
  /** 0–1 while the legs reach for a surface on the way down. */
  plant = 0;
  /** 0–1 while the legs absorb a landing. */
  compress = 0;
  /** -1..1, gap below or above the shell. The eyestalks follow it. */
  look = 0;
  /** 0–1 while the legs are still hooked on a lip that has started to leave. */
  hook = 0;
  /** Scales the landing crouch. Harder falls sink deeper. */
  impact = 1;
  /** 0–1 while loom neurons hold the legs still. */
  pause = 0;
  private jumpT = -1;
  /** Flaps since the feet last left a surface. The fourth is ignored until a landing. */
  private jumps = 0;
  /** How many jumps remain in this flight. A landing restores all three. */
  get jumpsLeft() { return this.grounded ? 3 : Math.max(0, 3 - this.jumps); }
  /** 1 while this jump left the ground, so the legs shove instead of hopping. */
  private launch = 0;
  private time = 0;
  private haulT = -1;
  private haulRise = 0;
  private compressT = -1;

  reset() {
    this.x = this.homeX;
    this.heading = 1;
    this.facing = 0;
    this.y = 320;
    this.prevY = 320;
    this.velocityY = 0;
    this.grounded = false;
    this.threat = 0;
    this.haul = 0;
    this.brink = 0;
    this.plant = 0;
    this.compress = 0;
    this.look = 0;
    this.hook = 0;
    this.impact = 1;
    this.pause = 0;
    this.jumpT = -1;
    this.jumps = 0;
    this.launch = 0;
    this.time = 0;
    this.haulT = -1;
    this.haulRise = 0;
    this.compressT = -1;
  }

  update(dt: number) {
    this.prevY = this.y;
    this.crawlAlong(dt);
    this.face(dt);
    this.time += dt * this.pace();
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      if (this.jumpT > 0.45) this.jumpT = -1;
    }
    if (this.haulT >= 0) {
      this.haulT += dt;
      const u = Math.min(1, this.haulT / 0.28);
      this.haul = 1 - u;
      if (u >= 1) { this.haulT = -1; this.haul = 0; this.haulRise = 0; }
    }
    if (this.compressT >= 0) {
      this.compressT += dt;
      const u = Math.min(1, this.compressT / 0.18);
      this.compress = Math.sin(u * Math.PI);
      if (u >= 1) { this.compressT = -1; this.compress = 0; }
    }
    if (this.grounded) {
      this.velocityY = 0;
      return;
    }
    this.velocityY += 1120 * dt;
    this.y += this.velocityY * dt;
  }

  /** Rest on the sand at the start of a run, with no landing impact. */
  stand(surfaceY: number) {
    this.grounded = true;
    this.y = surfaceY - this.radius;
    this.prevY = this.y;
    this.velocityY = 0;
    this.compressT = -1;
    this.compress = 0;
    this.haulT = -1;
    this.haul = 0;
    this.haulRise = 0;
    this.jumps = 0;
    this.launch = 0;
  }

  /** Plant the feet on a horizontal pipe face. Gravity no longer pulls through it. */
  land(surfaceY: number, hauled = false) {
    const from = this.y;
    const arriving = !this.grounded;
    const rising = hauled && arriving;
    const impactSpeed = Math.max(0, this.velocityY);
    this.grounded = true;
    this.y = surfaceY - this.radius;
    this.velocityY = 0;
    this.hook = 0;
    this.jumps = 0;
    this.launch = 0;
    if (rising && from - this.y > 4) {
      this.haulT = 0;
      this.haulRise = from - this.y;
      this.haul = 1;
    } else if (arriving) {
      this.compressT = 0;
      this.impact = Math.max(0.45, Math.min(1, impactSpeed / 420));
    }
  }

  release() {
    this.grounded = false;
    this.clearHaul();
  }

  /** Walk back from a loom hold, then return to the home line once the nerve releases. */
  private crawlAlong(dt: number) {
    if (!this.grounded || this.jumpT >= 0) {
      if (!this.grounded) this.heading = 1;
      return;
    }
    if (this.pause > 0.15) {
      this.heading = -1;
      this.x = Math.max(this.rearX, this.x - 90 * dt * this.pause);
      return;
    }
    this.heading = 1;
    if (this.x < this.homeX) this.x = Math.min(this.homeX, this.x + 72 * dt);
  }

  /** About a quarter-second to face the other way. */
  private face(dt: number) {
    const target = this.heading < 0 ? Math.PI : 0;
    const blend = 1 - Math.exp(-Math.min(dt, 0.05) * 9);
    this.facing += (target - this.facing) * blend;
  }

  private pace() {
    if (!this.grounded) return 1;
    if (this.heading < 0 || this.x < this.homeX - 0.5) return 1;
    return 1 - this.pause;
  }

  /** Loom descending neurons ask the legs to stop going forward. A jump command clears it. */
  nerve(hold: number) {
    const target = Math.max(0, Math.min(1, hold));
    this.pause = this.pause * 0.35 + target * 0.65;
    if (target === 0 && this.pause < 0.02) this.pause = 0;
  }

  flap() {
    if (!this.grounded && this.jumps >= 3) return false;
    this.pause = 0;
    const fromGround = this.grounded;
    this.jumps += 1;
    this.grounded = false;
    this.launch = fromGround ? 1 : 0;
    this.velocityY = fromGround ? GROUND_LEAP : AIR_HOP;
    this.jumpT = 0;
    this.clearHaul();
    return true;
  }

  private clearHaul() {
    this.haulT = -1;
    this.haul = 0;
    this.haulRise = 0;
    this.compressT = -1;
    this.compress = 0;
    this.plant = 0;
    this.hook = 0;
  }

  skeleton(): LegSkeleton[] {
    const [crawl, air] = this.gait();
    return skeleton(this.jumpT, this.time, crawl, air, this.threat, this.haul, this.brink, this.plant, this.compress * this.impact, this.hook, this.launch, this.pause, this.heading);
  }

  /** All 22 servo angles, in the jumper MJCF joint frame. */
  servoAngles() {
    const [crawl, air] = this.gait();
    return poseServos(this.jumpT, this.time, crawl, air, this.threat, this.haul, this.brink, this.plant, this.compress * this.impact, this.hook, this.launch, this.pause, this.heading);
  }

  /** Sideways rock of a stepping tripod, in pixels. Quieter at a lip. */
  scuttle() {
    const caution = (1 - this.brink * 0.7) * (1 - this.hook) * this.drive();
    const along = this.heading < 0 ? -1 : 1;
    return this.grounded ? Math.sin(this.time * CRAWL_RATE) * 7.5 * caution * stepRush(this.time) * along : 0;
  }

  /** Body lean that follows the same step. At a lip the shell tips back onto the remaining plane. */
  lean() {
    const step = this.grounded ? Math.sin(this.time * CRAWL_RATE) * 0.22 * (1 - this.hook) * this.drive() * stepRush(this.time) : 0;
    return step - (this.brink + this.hook) * 0.16;
  }

  /** Shell lift on each step. Feet stay planted; only the body rises. */
  bob() {
    return this.grounded ? Math.abs(Math.sin(this.time * CRAWL_RATE)) * 3.6 * this.drive() * stepRush(this.time) : 0;
  }

  /** How far the drawing still sits below the lip during a pull-up, in pixels. */
  haulOffset() {
    if (this.haulRise <= 0 || this.haulT < 0) return 0;
    const u = Math.min(1, this.haulT / 0.28);
    const ease = u * u * (3 - 2 * u);
    return this.haulRise * (1 - ease);
  }

  /** Shell drop when a pipe is close. Feet stay where they are. */
  hunker() {
    return this.grounded ? this.threat * 3.2 + this.pause * 1.6 : 0;
  }

  /** Crabs stay level. A jump only tips the shell a little as the legs extend. */
  pitch() {
    if (this.grounded) return 0;
    const fall = Math.max(-0.06, Math.min(0.08, this.velocityY / 4000));
    return fall - jumpShape(this.jumpT).push * (0.1 + 0.08 * this.launch);
  }

  private drive() {
    if (this.heading < 0 || this.x < this.homeX - 0.5) return 1;
    return 1 - this.pause;
  }

  private gait(): [crawl: number, air: number] {
    if (this.grounded) return [this.drive(), 0];
    if (this.jumpT >= 0) return [0, 0];
    return [0, 1];
  }
}
