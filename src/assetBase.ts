/**
 * Where `/brain` and `/jumper` are loaded from.
 * The standalone game keeps the site root. The 7VBot extension points this at
 * the fly page directory so those files are not the desktop pet's `/jumper`.
 */
let base = '/';

export function setAssetBase(next: string) {
  base = next.endsWith('/') ? next : `${next}/`;
}

export function getAssetBase() {
  return base;
}

export function assetUrl(path: string) {
  const clean = path.replace(/^\/+/, '');
  if (base === '/') return `/${clean}`;
  return new URL(clean, base).href;
}
