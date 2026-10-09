/** Peak in each row. Used to keep a single spike from disappearing into the average. */
export function spikeColumn(frame: Uint8Array, rows: number): Uint8Array {
  const out = new Uint8Array(rows);
  const n = frame.length;
  if (n === 0 || rows <= 0) return out;
  for (let r = 0; r < rows; r++) {
    const start = Math.floor((r * n) / rows);
    const end = Math.max(start + 1, Math.floor(((r + 1) * n) / rows));
    let peak = 0;
    for (let i = start; i < end && i < n; i++) if (frame[i] > peak) peak = frame[i];
    out[r] = peak;
  }
  return out;
}

/** Mean activity in each band, so a quiet population still leaves a visible trace. */
export function spikeMeans(frame: Uint8Array, rows: number): Float32Array {
  const out = new Float32Array(rows);
  const n = frame.length;
  if (n === 0 || rows <= 0) return out;
  for (let r = 0; r < rows; r++) {
    const start = Math.floor((r * n) / rows);
    const end = Math.max(start + 1, Math.floor(((r + 1) * n) / rows));
    let sum = 0;
    for (let i = start; i < end && i < n; i++) sum += frame[i];
    out[r] = sum / (end - start);
  }
  return out;
}

const BANDS = 48;
const BG = [7, 17, 15] as const;
const MINT = [112, 232, 178] as const;

export class SpikeField {
  private ctx: CanvasRenderingContext2D;
  private image: ImageData | null = null;
  private primed = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('spike field');
    this.ctx = ctx;
  }

  push(frame: Uint8Array) {
    const cssW = Math.max(1, this.canvas.clientWidth);
    const cssH = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (!this.image || this.image.width !== w || this.image.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.image = this.ctx.createImageData(w, h);
      this.primed = false;
    }
    const column = this.column(frame);
    const level = column.reduce((sum, v) => sum + v, 0) / column.length;
    if (!this.primed) {
      this.stamp(column, 0, this.image.width);
      if (level > 0.35) this.primed = true;
    } else {
      this.shift(2);
      this.stamp(column, Math.max(0, this.image.width - 2), this.image.width);
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  private column(frame: Uint8Array) {
    const mean = spikeMeans(frame, BANDS);
    const peak = spikeColumn(frame, BANDS);
    const out = new Float32Array(BANDS);
    for (let i = 0; i < BANDS; i++) {
      const wash = Math.pow(Math.min(1, mean[i] / 255), 0.45);
      const spike = peak[i] > 200 ? 0.55 : peak[i] / 255 * 0.25;
      out[i] = Math.min(1, wash * 0.72 + spike);
    }
    return out;
  }

  private stamp(column: Float32Array, x0: number, x1: number) {
    const image = this.image!;
    const { width: w, height: h, data } = image;
    const stride = w * 4;
    for (let band = 0; band < BANDS; band++) {
      const y0 = Math.floor((band * h) / BANDS);
      const y1 = Math.floor(((band + 1) * h) / BANDS);
      const v = column[band];
      const r = BG[0] + (MINT[0] - BG[0]) * v;
      const g = BG[1] + (MINT[1] - BG[1]) * v;
      const b = BG[2] + (MINT[2] - BG[2]) * v;
      for (let y = y0; y < y1; y++) {
        const row = y * stride;
        const gap = y === y1 - 1;
        for (let x = x0; x < x1; x++) {
          const i = row + x * 4;
          data[i] = gap ? BG[0] : r;
          data[i + 1] = gap ? BG[1] : g;
          data[i + 2] = gap ? BG[2] : b;
          data[i + 3] = 255;
        }
      }
    }
  }

  private shift(dx: number) {
    const data = this.image!.data;
    const stride = this.image!.width * 4;
    const h = this.image!.height;
    for (let y = 0; y < h; y++) {
      const start = y * stride;
      data.copyWithin(start, start + dx * 4, start + stride);
    }
  }
}
