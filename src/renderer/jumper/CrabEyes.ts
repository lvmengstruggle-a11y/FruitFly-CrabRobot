import * as THREE from 'three';
import { eyeExpression, type EyeCue } from './eyeExpression';

const REST: EyeCue = {
  lc4: 0, lplc2: 0, lplc1: 0, lc10Left: 0, lc10Right: 0,
  flowFore: 0, flowBack: 0, h2: 0, lc11: 1, dnp01: 0, loom: 0, hold: 0
};

/** Two glowing eyes on the jumper's front display, driven by the visual neurons. */
export class CrabEyes {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private mesh: THREE.Mesh;
  private blink = 0;
  private armed = false;
  private open = 0.46;
  private gx = 0;
  private gy = 0;

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 176;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('eye canvas unavailable');
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: 2
    });
    this.mesh = new THREE.Mesh(visorSheet(), material);
    this.mesh.name = 'crab-eyes';
    this.mesh.renderOrder = 3;
    this.paint(0.46, 0, 0);
  }

  attach(root: THREE.Object3D) {
    const face = root.getObjectByName('display_module_link') ?? root;
    face.add(this.mesh);
  }

  update(cue: EyeCue = REST, dt = 0, time = 0) {
    if (cue.dnp01 > 0.35 && !this.armed) this.blink = 1;
    this.armed = cue.dnp01 > 0.35;
    this.blink = Math.max(0, this.blink - dt * 7);
    const pose = eyeExpression(cue, time, this.blink);
    const blend = 1 - Math.exp(-Math.min(dt, 0.05) * 10);
    const k = dt > 0 ? blend : 1;
    this.open += (pose.open - this.open) * k;
    this.gx += (pose.gx - this.gx) * k;
    this.gy += (pose.gy - this.gy) * k;
    this.paint(this.open, this.gx, this.gy);
    this.texture.needsUpdate = true;
  }

  private paint(open: number, gx: number, gy: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 512, 176);
    this.eye(ctx, 148, open, gx, gy);
    this.eye(ctx, 364, open, gx, gy);
  }

  private eye(ctx: CanvasRenderingContext2D, x: number, open: number, gx: number, gy: number) {
    const y = 88;
    const rx = 72;
    const ry = 26 + open * 40;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#bffff6';
    ctx.shadowBlur = 28 + open * 22;
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, rx);
    glow.addColorStop(0, `rgba(186, 255, 248, ${0.35 + open * 0.55})`);
    glow.addColorStop(1, 'rgba(80, 220, 210, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx + 16, ry + 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (open < 0.12) {
      ctx.strokeStyle = '#bffff6';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-rx * 0.7, 0);
      ctx.quadraticCurveTo(0, ry * 0.4, rx * 0.7, 0);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#163f44';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    const iris = ctx.createRadialGradient(gx * 8, -gy * 8, 2, gx * 6, -gy * 5, rx * 0.72);
    iris.addColorStop(0, '#f3fffd');
    iris.addColorStop(0.35, '#7ef6ef');
    iris.addColorStop(1, '#1aa8b8');
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.ellipse(gx * 8, -gy * 7, rx * 0.58, ry * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#062226';
    ctx.beginPath();
    ctx.ellipse(gx * 12, -gy * 9, 7 + (1 - open) * 3, 8 * open + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Outer glass of display_module_link, fit to the front-facing STL
 * (x ≈ 0.00078 − 0.721 z − 0.86 y² − 11.2 z²) and lifted 1.7 mm so the
 * eyes sit on the sloped visor instead of a vertical card. Lift is 1.2 mm.
 */
function visorX(y: number, z: number) {
  const y2 = y * y;
  return 0.00078 - 0.7208 * z - 0.8625 * y2 - 11.18 * z * z - 3.577 * y2 * z + 0.0012;
}

function visorSheet() {
  const rows = 8;
  const cols = 7;
  const y0 = -0.048;
  const y1 = 0.048;
  const z0 = -0.013;
  const z1 = 0.007;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1);
    const y = y0 + (y1 - y0) * v;
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const z = z0 + (z1 - z0) * u;
      positions.push(visorX(y, z), y, z);
      uvs.push(v, u);
    }
  }
  const stride = cols;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * stride + c;
      indices.push(i, i + 1, i + stride, i + 1, i + stride + 1, i + stride);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
