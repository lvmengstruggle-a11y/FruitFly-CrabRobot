import * as THREE from 'three';

interface PipeSlot {
  label: THREE.Object3D | null;
}

interface Spark {
  sprite: THREE.Sprite;
  born: number;
  life: number;
  ox: number;
  oy: number;
  oz: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

interface Flyer {
  pivot: THREE.Group;
  mats: { opacity: number }[];
  born: number;
  life: number;
  ox: number;
  oz: number;
  spin: number;
}

/** Gold coins on the landing lip, and the burst when a column is cleared. */
export class PipeCoins {
  private coinMap: THREE.CanvasTexture;
  private sparkMap: THREE.CanvasTexture;
  private cap: THREE.BufferGeometry;
  private edge: THREE.BufferGeometry;
  private face: THREE.MeshBasicMaterial;
  private rim: THREE.MeshBasicMaterial;
  private sparks: Spark[] = [];
  private flyers: Flyer[] = [];
  private pool: THREE.Sprite[] = [];
  private taken = new Set<number>();
  private now = 0;

  constructor(private scene: THREE.Scene) {
    this.coinMap = paintCoin();
    this.sparkMap = paintSpark();
    this.cap = coinCap();
    this.edge = coinRim();
    this.face = new THREE.MeshBasicMaterial({ map: this.coinMap, transparent: true, depthWrite: false, side: 2 });
    this.rim = new THREE.MeshBasicMaterial({ color: 0xf6b423, side: 2 });
  }

  begin(score: number, now: number) {
    this.now = now;
    if (score === 0 && (this.taken.size > 0 || this.sparks.length > 0 || this.flyers.length > 0)) this.clear();
  }

  place(view: PipeSlot, x: number, z: number, index: number, scored: boolean) {
    if (index < 1 || scored) {
      if (view.label) view.label.visible = false;
      if (index >= 1 && scored && !this.taken.has(index)) {
        this.taken.add(index);
        this.burst(x, z, view.label ? view.label.rotation.z : 0);
      }
      return;
    }
    if (!view.label) {
      const pivot = new THREE.Group();
      pivot.add(this.mint(this.face, this.rim));
      this.scene.add(pivot);
      view.label = pivot;
    }
    const radius = 0.11;
    view.label.scale.set(radius, radius, radius);
    view.label.rotation.set(0, 0, Math.sin(this.now * 0.0022 + index) * 0.55);
    view.label.position.set(x, 0, z + radius + Math.sin(this.now * 0.003 + index) * 0.008);
    view.label.visible = true;
  }

  update() {
    const keep: Spark[] = [];
    for (const spark of this.sparks) {
      const t = (this.now - spark.born) / spark.life;
      if (t >= 1) {
        spark.sprite.visible = false;
        this.pool.push(spark.sprite);
        continue;
      }
      const rise = t * (1 - t * 0.3);
      spark.sprite.position.set(
        spark.ox + spark.vx * t,
        spark.oy + spark.vy * t,
        spark.oz + spark.vz * rise
      );
      spark.sprite.material.opacity = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      const flash = Math.abs(spark.vx) + Math.abs(spark.vy) < 0.001;
      const s = flash ? 0.05 + t * 0.42 : 0.07 * (1 - t * 0.45);
      spark.sprite.scale.set(s, s, 1);
      spark.sprite.material.rotation = spark.spin + t * 5;
      keep.push(spark);
    }
    this.sparks = keep;
    const flying: Flyer[] = [];
    for (const flyer of this.flyers) {
      const t = (this.now - flyer.born) / flyer.life;
      if (t >= 1) {
        this.scene.remove(flyer.pivot);
        continue;
      }
      const rise = 1 - (1 - t) * (1 - t);
      flyer.pivot.position.set(flyer.ox, 0, flyer.oz + rise * 0.38);
      flyer.pivot.rotation.set(0, 0, flyer.spin + t * 11);
      const span = 0.11 * (1 + rise * 0.28);
      flyer.pivot.scale.set(span, span, span);
      const fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
      for (const mat of flyer.mats) mat.opacity = fade;
      flying.push(flyer);
    }
    this.flyers = flying;
  }

  private burst(x: number, z: number, yaw: number) {
    const face = this.face.clone();
    const rim = this.rim.clone();
    face.opacity = 1;
    rim.opacity = 1;
    const pivot = new THREE.Group();
    pivot.add(this.mint(face, rim));
    const radius = 0.11;
    pivot.scale.set(radius, radius, radius);
    pivot.position.set(x, 0, z + radius);
    this.scene.add(pivot);
    this.flyers.push({
      pivot, mats: [face, rim], born: this.now, life: 680,
      ox: x, oz: z + radius, spin: yaw
    });
    this.sparks.push(this.spark(this.sparkMap, x, 0, z + radius, 0, 0, 0.04, 340, 0));
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      this.sparks.push(this.spark(
        this.sparkMap,
        x, 0, z + radius,
        Math.cos(angle) * 0.26,
        Math.sin(angle) * 0.14,
        0.1 + (i % 3) * 0.06,
        520,
        angle
      ));
    }
  }

  /** Upright coin. The group only yaws, so the disc stays standing. */
  private mint(face: THREE.MeshBasicMaterial, rim: THREE.MeshBasicMaterial) {
    const coin = new THREE.Group();
    const front = new THREE.Mesh(this.cap, face);
    front.position.x = 0.08;
    const back = new THREE.Mesh(this.cap, face);
    back.position.x = -0.08;
    coin.add(front, back, new THREE.Mesh(this.edge, rim));
    return coin;
  }

  private spark(map: THREE.CanvasTexture, ox: number, oy: number, oz: number, vx: number, vy: number, vz: number, life: number, spin: number): Spark {
    const sprite = this.pool.pop() ?? this.make();
    sprite.material.map = map;
    sprite.material.opacity = 1;
    sprite.material.rotation = spin;
    sprite.visible = true;
    sprite.position.set(ox, oy, oz);
    return { sprite, born: this.now, life, ox, oy, oz, vx, vy, vz, spin };
  }

  private make() {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    sprite.center.set(0.5, 0.5);
    this.scene.add(sprite);
    return sprite;
  }

  private clear() {
    this.taken.clear();
    for (const spark of this.sparks) {
      spark.sprite.visible = false;
      this.pool.push(spark.sprite);
    }
    this.sparks = [];
    for (const flyer of this.flyers) this.scene.remove(flyer.pivot);
    this.flyers = [];
  }
}

/** Disc in the YZ plane, standing and facing the crab's front. */
function coinCap() {
  const steps = 32;
  const positions = [0, 0, 0];
  const uvs = [0.5, 0.5];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    positions.push(0, c, s);
    uvs.push(0.5 + c * 0.42, 0.5 + s * 0.42);
  }
  for (let i = 1; i <= steps; i++) indices.push(0, i, i === steps ? 1 : i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function coinRim() {
  const steps = 32;
  const y = 0.08;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    positions.push(y, c, s, -y, c, s);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function coinIconURL() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('coin canvas unavailable');
  const c = 32;
  const radius = 30;
  const rim = ctx.createRadialGradient(c - 8, c - 10, 4, c, c, radius);
  rim.addColorStop(0, '#fff6c4');
  rim.addColorStop(0.55, '#ffc83a');
  rim.addColorStop(1, '#c47a08');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(c - 6, c - 8, 2, c, c, radius * 0.78);
  face.addColorStop(0, '#fff8d8');
  face.addColorStop(1, '#f0a010');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(c, c, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const reach = i % 2 === 0 ? 14 : 6;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const px = c + Math.cos(angle) * reach;
    const py = c + Math.sin(angle) * reach;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff4c2';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e8a020';
  ctx.stroke();
  return canvas.toDataURL();
}

function paintCoin() {
  const texture = new THREE.CanvasTexture(coinCanvas());
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function coinCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('coin canvas unavailable');
  const c = 128;
  const radius = 108;
  const glow = ctx.createRadialGradient(c, c, radius * 0.3, c, c, radius * 1.15);
  glow.addColorStop(0, 'rgba(255, 214, 80, 0.7)');
  glow.addColorStop(1, 'rgba(255, 180, 20, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c, radius * 1.15, 0, Math.PI * 2);
  ctx.fill();
  const rim = ctx.createRadialGradient(c - 28, c - 34, 12, c, c, radius);
  rim.addColorStop(0, '#fff4b0');
  rim.addColorStop(0.42, '#ffd24a');
  rim.addColorStop(0.74, '#f0a20e');
  rim.addColorStop(1, '#b87408');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(c - 18, c - 22, 8, c, c, radius * 0.78);
  face.addColorStop(0, '#fff7c8');
  face.addColorStop(0.5, '#ffcf3d');
  face.addColorStop(1, '#e09410');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(c, c, radius * 0.76, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const reach = i % 2 === 0 ? radius * 0.4 : radius * 0.16;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const px = c + Math.cos(angle) * reach;
    const py = c + 4 + Math.sin(angle) * reach;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const star = ctx.createLinearGradient(c, c - 40, c, c + 48);
  star.addColorStop(0, '#fff8dc');
  star.addColorStop(0.45, '#ffe08a');
  star.addColorStop(1, '#e8a020');
  ctx.fillStyle = star;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f6c14a';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 252, 230, 0.85)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(c, c, radius * 0.86, -2.5, -0.7);
  ctx.stroke();
  return canvas;
}

function paintSpark() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('spark canvas unavailable');
  const c = 32;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const reach = i % 2 === 0 ? 26 : 8;
    const angle = -Math.PI / 2 + i * Math.PI / 4;
    const px = c + Math.cos(angle) * reach;
    const py = c + Math.sin(angle) * reach;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const fill = ctx.createRadialGradient(c, c, 2, c, c, 26);
  fill.addColorStop(0, '#fffce8');
  fill.addColorStop(0.6, '#ffd35b');
  fill.addColorStop(1, 'rgba(255, 176, 32, 0)');
  ctx.fillStyle = fill;
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
