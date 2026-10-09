/** Cap overhang drawn past each side of the shaft. The top of this lip is a walkable plane. */
export const PIPE_LIP = 5;

export class Pipe {
  readonly width = 72; scored = false;
  constructor(public x: number, public gapTop: number, public gapHeight = 190, public readonly index = 0) {}
  get gapBottom() { return this.gapTop + this.gapHeight; }
  update(dt: number, speed: number) { this.x -= speed * dt; }
}
