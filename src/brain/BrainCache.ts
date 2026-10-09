const CACHE = 'fly-connectome-v1';
async function openCache() {
  try {
    return await caches.open(CACHE);
  } catch {
    return undefined;
  }
}
export async function cachedFetch(url: string, onNetwork?: () => void) {
  const cache = await openCache();
  const hit = cache ? await cache.match(url) : undefined;
  if (hit) return hit;
  onNetwork?.(); const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  if (cache) {
    try { await cache.put(url, response.clone()); } catch { /* file:// has no Cache storage */ }
  }
  return response;
}
export async function clearBrainCache() { await caches.delete(CACHE); }
