/** Freeze the crawl when loom neurons are active and the jump command has not fired. */
export function pauseFromNerve(lc4Rate: number, loomRate: number, jumping: boolean) {
  if (jumping) return 0;
  const nerve = Math.max(0, Math.min(1, Math.max(loomRate, lc4Rate)));
  if (nerve < 0.12) return 0;
  return Math.min(1, (nerve - 0.12) / 0.45);
}
