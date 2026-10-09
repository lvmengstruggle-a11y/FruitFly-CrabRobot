import { PIPE_LIP, Pipe } from './Pipe';

export interface RigidBody { readonly x: number; readonly y: number; readonly radius: number }

export interface FallingBody extends RigidBody {
  readonly prevY: number;
  readonly velocityY: number;
}

/** A slice of the body on the plane is enough; the whole body does not have to be on it. */
const CONTACT = 8;

/** Sand line. The crab walks on it; only the ceiling and the pipe shafts are fatal. */
export function arenaFloor(height: number) {
  return height - 46;
}

export const collided = (body: RigidBody, pipe: Pipe) => {
  if (body.y - body.radius <= 0) return true;
  const overlapsX = body.x + body.radius > pipe.x && body.x - body.radius < pipe.x + pipe.width;
  return overlapsX && (body.y - body.radius < pipe.gapTop || body.y + body.radius > pipe.gapBottom);
};

/** The arena sand, caught from above the same way as a pipe top. */
export function supportFloor(body: FallingBody, height: number): number | null {
  return crossedPlane(body, arenaFloor(height), true) ? arenaFloor(height) : null;
}

/**
 * Top face of the lower pipe, including the cap lip.
 * Returns the surface y when gravity has brought the crab onto that plane from above.
 * A partial overlap supports it; the vertical shaft does not.
 */
export function supportSurface(body: FallingBody, pipe: Pipe): number | null {
  const surface = pipe.gapBottom;
  const left = pipe.x - PIPE_LIP;
  const right = pipe.x + pipe.width + PIPE_LIP;
  const over = body.x + CONTACT > left && body.x - CONTACT < right;
  return crossedPlane(body, surface, over) ? surface : null;
}

/**
 * Feet have entered the top of the lower pipe while the body center is still above it.
 * The separating direction is up onto that plane. A center already inside the solid is not a rest.
 */
export function climbSurface(body: FallingBody, pipe: Pipe): number | null {
  const surface = pipe.gapBottom;
  const overlapsX = body.x + body.radius > pipe.x && body.x - body.radius < pipe.x + pipe.width;
  if (!overlapsX || body.velocityY < 0 || body.y >= surface) return null;
  const bottom = body.y + body.radius;
  if (bottom <= surface) return null;
  if (surface - pipe.gapTop < body.radius * 2 + 8) return null;
  return surface;
}

/** How many pixels of the supporting lip are still under the body. Null when this pipe is not the plane. */
export function edgeSlack(body: RigidBody, pipe: Pipe, surfaceY: number): number | null {
  if (Math.abs(pipe.gapBottom - surfaceY) > 1.5) return null;
  const left = pipe.x - PIPE_LIP;
  const right = pipe.x + pipe.width + PIPE_LIP;
  if (body.x + CONTACT <= left || body.x - CONTACT >= right) return null;
  return Math.min(body.x + CONTACT - left, right - (body.x - CONTACT));
}

function crossedPlane(body: FallingBody, surface: number, over: boolean) {
  if (!over || body.velocityY < 0 || body.prevY >= surface) return false;
  const bottom = body.y + body.radius;
  const prevBottom = body.prevY + body.radius;
  return prevBottom <= surface + 1.25 && bottom >= surface - 0.5;
}
