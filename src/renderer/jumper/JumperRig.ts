import * as THREE from 'three';
import { assetUrl } from '../../assetBase';

/** Default robot: jumper-main/assets/jumper/jumper.xml, served at this URL. */
export const JUMPER_MODEL_URL = '/jumper/jumper.xml';

interface PendingMesh {
  parent: THREE.Object3D;
  mesh: string;
  rgba: string;
}

interface Hinge {
  pivot: THREE.Object3D;
  axis: THREE.Vector3;
}

/** Visual kinematic tree of the jumper MJCF. Collision meshes are left out. */
export class JumperRig {
  readonly root = new THREE.Group();
  meshCount = 0;
  private hinges = new Map<string, Hinge>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();

  constructor() {
    this.root.name = 'jumper';
  }

  async load(url?: string) {
    const modelUrl = url || assetUrl('jumper/jumper.xml');
    const xml = await fetch(modelUrl).then((response) => {
      if (!response.ok) throw new Error(`${modelUrl} ${response.status}`);
      return response.text();
    });
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('jumper.xml did not parse');
    const base = new URL(modelUrl, window.location.href);
    const files = new Map<string, string>();
    doc.querySelectorAll('asset mesh').forEach((mesh) => {
      const name = mesh.getAttribute('name');
      const file = mesh.getAttribute('file');
      if (name && file) files.set(name, new URL(file, base).href);
    });
    const pending: PendingMesh[] = [];
    const world = doc.querySelector('worldbody > body');
    if (!world) throw new Error('jumper.xml has no robot body');
    this.buildBody(world, this.root, pending);
    await Promise.all(pending.map((item) => this.attachMesh(item, files)));
    return this;
  }

  pose(angles: Record<string, number>) {
    for (const [name, hinge] of this.hinges) {
      const angle = angles[name];
      if (angle === undefined) continue;
      hinge.pivot.quaternion.setFromAxisAngle(hinge.axis, angle);
    }
  }

  private buildBody(el: Element, parent: THREE.Object3D, pending: PendingMesh[]) {
    const body = new THREE.Group();
    body.name = el.getAttribute('name') ?? '';
    const pos = vec3(el.getAttribute('pos'));
    body.position.set(pos[0], pos[1], pos[2]);
    parent.add(body);
    let frame: THREE.Object3D = body;
    for (const child of elementChildren(el)) {
      if (child.tagName !== 'joint') continue;
      if ((child.getAttribute('type') ?? 'hinge') === 'free') continue;
      const axis = vec3(child.getAttribute('axis'), [0, 0, 1]);
      const pivot = new THREE.Group();
      pivot.name = child.getAttribute('name') ?? '';
      const jointPos = vec3(child.getAttribute('pos'));
      pivot.position.set(jointPos[0], jointPos[1], jointPos[2]);
      frame.add(pivot);
      frame = pivot;
      if (pivot.name) this.hinges.set(pivot.name, { pivot, axis: new THREE.Vector3(axis[0], axis[1], axis[2]).normalize() });
    }
    for (const child of elementChildren(el)) {
      if (child.tagName === 'body') this.buildBody(child, frame, pending);
      else if (child.tagName === 'geom' && child.getAttribute('class') === 'visual' && child.getAttribute('mesh')) {
        pending.push({ parent: frame, mesh: child.getAttribute('mesh') ?? '', rgba: child.getAttribute('rgba') ?? '0.75 0.75 0.75 1' });
      }
    }
  }

  private async attachMesh(item: PendingMesh, files: Map<string, string>) {
    const file = files.get(item.mesh);
    if (!file) return;
    const buffer = await fetch(file).then((response) => {
      if (!response.ok) throw new Error(`${file} ${response.status}`);
      return response.arrayBuffer();
    });
    try {
      const geometry = stlGeometry(buffer);
      const mesh = new THREE.Mesh(geometry, this.material(item.rgba));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = item.mesh;
      item.parent.add(mesh);
      this.meshCount += 1;
    } catch (error) {
      console.warn(item.mesh, error);
    }
  }

  private material(rgba: string) {
    const cached = this.materials.get(rgba);
    if (cached) return cached;
    const [r, g, b, a] = rgba.trim().split(/\s+/).map(Number);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r || 0, g || 0, b || 0),
      roughness: 0.48,
      metalness: 0.18,
      transparent: (a ?? 1) < 1,
      opacity: a ?? 1
    });
    this.materials.set(rgba, material);
    return material;
  }
}

function elementChildren(el: Element) {
  return [...el.children];
}

function vec3(text: string | null, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] {
  if (!text) return fallback;
  const parts = text.trim().split(/\s+/).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Binary STL, the format jumper's visual meshes use. */
function stlGeometry(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  if (84 + count * 50 !== buffer.byteLength) throw new Error('visual mesh is not a binary STL');
  const positions = new Float32Array(count * 9);
  let offset = 84;
  for (let i = 0; i < count; i++) {
    offset += 12;
    for (let v = 0; v < 9; v++) {
      positions[i * 9 + v] = view.getFloat32(offset, true);
      offset += 4;
    }
    offset += 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
