import * as THREE from 'three';
import { arenaFloor } from '../game/Collision';
import { servoAngles } from '../game/crab/kinematics';
import { FlappyGame } from '../game/FlappyGame';
import { PIPE_LIP } from '../game/Pipe';
import { JumperRig } from './jumper/JumperRig';
import { CrabEyes } from './jumper/CrabEyes';
import type { EyeCue } from './jumper/eyeExpression';
import { coinIconURL, PipeCoins } from './coins/PipeCoins';

/** Pixels of the playfield that correspond to one metre of the jumper model. */
const SCALE = 220;
/** Base height of the standing pose. Matches jumper STAND_Z. */
const STAND_Z = 0.10647;
const LIP = 22;

interface PipeView {
  shaft: THREE.Mesh;
  lip: THREE.Mesh;
  label: THREE.Object3D | null;
}

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rig = new JumperRig();
  private eyes = new CrabEyes();
  private eyeStamp = 0;
  private yaw = new THREE.Group();
  private pitch = new THREE.Group();
  private pipes: PipeView[] = [];
  private coins: PipeCoins;
  private key = new THREE.DirectionalLight(0xfff1d2, 2.4);
  private hud: HTMLElement;
  private status: HTMLElement;
  private looming: HTMLElement;
  private score: HTMLElement;
  private scoreCount: HTMLElement;
  private shownScore = -1;
  private labels = { looming: 'LOOMING', score: 'SCORE', font: '700 12px ui-monospace' };
  private shown?: { game: FlappyGame; cue: EyeCue };
  private focus = new THREE.Vector3();
  private focusLocal = new THREE.Vector3(0, 0, 0.05);
  private eye = new THREE.Vector3();
  private sized = '';
  private zoom = 1;
  private orbitYaw = -1.15;
  private orbitPitch = 0.5;
  private baseDistance = 0.55;
  private dragging = false;
  private pointerX = 0;
  private pointerY = 0;
  private pinch = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x0c2428);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(38, 480 / 640, 0.02, 40);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(-0.02, -1.05, 0.78);
    this.camera.lookAt(0.28, 0, 0.16);
    this.coins = new PipeCoins(this.scene);
    this.scene.background = new THREE.Color(0x0c2428);
    this.scene.fog = new THREE.Fog(0x0c2428, 3.2, 9);
    this.dress();
    this.yaw.add(this.pitch);
    this.pitch.add(this.rig.root);
    this.scene.add(this.yaw);
    this.hud = document.createElement('div');
    this.hud.className = 'game-hud';
    this.looming = document.createElement('b');
    this.status = document.createElement('small');
    this.status.textContent = 'JUMPER';
    const left = document.createElement('div');
    left.append(this.looming, this.status);
    this.score = document.createElement('b');
    this.score.className = 'score-readout';
    const coin = document.createElement('img');
    coin.src = coinIconURL();
    coin.alt = '';
    this.scoreCount = document.createElement('span');
    this.scoreCount.textContent = '0';
    this.score.append(coin, this.scoreCount);
    this.hud.append(left, this.score);
    canvas.parentElement?.append(this.hud);
    this.bindView(canvas);
    this.status.textContent = '加载 jumper…';
    void this.rig.load().then(() => {
      canvas.dataset.model = 'jumper';
      canvas.dataset.meshes = String(this.rig.meshCount);
      this.rig.pose(servoAngles(-1, 0));
      this.eyes.attach(this.rig.root);
      this.eyes.update();
      this.yaw.position.z = STAND_Z;
      this.frameRobot();
      this.status.textContent = this.rig.meshCount ? `jumper · ${this.rig.meshCount}` : 'jumper 模型是空的';
      if (this.shown) this.render(this.shown.game, this.shown.cue);
      else { this.resize(); this.follow(); this.renderer.render(this.scene, this.camera); }
    }).catch((error: unknown) => {
      this.status.textContent = error instanceof Error ? error.message : 'jumper 模型加载失败';
    });
  }

  /** Wheel and pinch zoom. Drag orbits around the crab. */
  private bindView(canvas: HTMLCanvasElement) {
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoom = clamp(this.zoom * Math.exp(-event.deltaY * 0.0016), 0.28, 6);
      this.refresh();
    }, { passive: false });
    canvas.addEventListener('pointerdown', (event) => {
      this.dragging = true;
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      this.orbitYaw -= (event.clientX - this.pointerX) * 0.008;
      this.orbitPitch = clamp(this.orbitPitch + (event.clientY - this.pointerY) * 0.006, 0.18, 1.25);
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.refresh();
    });
    const endDrag = () => { this.dragging = false; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('touchmove', (event) => {
      if (event.touches.length !== 2) { this.pinch = 0; return; }
      event.preventDefault();
      const next = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      if (this.pinch > 0) this.zoom = clamp(this.zoom * next / this.pinch, 0.28, 6);
      this.pinch = next;
      this.refresh();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this.pinch = 0; });
  }

  private refresh() {
    if (this.shown) this.render(this.shown.game, this.shown.cue);
    else { this.resize(); this.follow(); this.renderer.render(this.scene, this.camera); }
  }

  private frameRobot() {
    const box = new THREE.Box3().setFromObject(this.rig.root);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(this.focusLocal);
    this.yaw.worldToLocal(this.focusLocal);
    const span = Math.max(size.x, size.y, size.z);
    if (span > 0) this.baseDistance = span * 2.6;
  }

  setLabels(labels: { looming: string; score: string; font: string }) {
    this.labels = labels;
    this.hud.style.font = labels.font;
  }

  render(game: FlappyGame, cue: EyeCue) {
    this.shown = { game, cue };
    this.resize();
    this.placeRobot(game);
    this.placePipes(game);
    this.eyes.update(cue, this.eyeDt(), game.elapsed);
    this.follow();
    this.looming.textContent = `${this.labels.looming} ${Math.round(cue.lc4 * 100)}%`;
    if (this.shownScore >= 0 && game.score !== this.shownScore) {
      this.score.classList.remove('pop');
      void this.score.offsetWidth;
      this.score.classList.add('pop');
    }
    this.shownScore = game.score;
    this.scoreCount.textContent = String(game.score);
    this.renderer.render(this.scene, this.camera);
  }

  private eyeDt() {
    const now = performance.now();
    const dt = this.eyeStamp ? Math.min(0.05, (now - this.eyeStamp) / 1000) : 0;
    this.eyeStamp = now;
    return dt;
  }

  private dress() {
    this.scene.add(new THREE.HemisphereLight(0xd7fff4, 0x24382e, 1.35));
    this.key.position.set(1.4, -1.8, 2.6);
    this.key.intensity = 3.1;
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 0.2;
    this.key.shadow.camera.far = 8;
    this.key.shadow.camera.left = -2;
    this.key.shadow.camera.right = 2;
    this.key.shadow.camera.top = 2;
    this.key.shadow.camera.bottom = -2;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight(0x70e8b2, 0.55);
    fill.position.set(-1.2, 1.4, 1.1);
    this.scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 8),
      new THREE.MeshStandardMaterial({ color: 0x14261f, roughness: 0.92, metalness: 0 })
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(48, 48, 0x2c463c, 0x1c3029);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.001;
    this.scene.add(grid);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(48, 0.04, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x24382f, roughness: 0.8 })
    );
    rail.position.set(0, 0.72, 0.015);
    const far = rail.clone();
    far.position.y = -0.72;
    this.scene.add(rail, far);
    const shaft = new THREE.BoxGeometry(1, 1, 1);
    shaft.translate(0, 0, 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d8a50, roughness: 0.62, metalness: 0.04 });
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x2d6d40, roughness: 0.5, metalness: 0.05 });
    const piece = (material: THREE.Material) => {
      const mesh = new THREE.Mesh(shaft, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    };
    for (let i = 0; i < 8; i++) this.pipes.push({ shaft: piece(bodyMat), lip: piece(lipMat), label: null });
  }

  private placeRobot(game: FlappyGame) {
    const crab = game.crab;
    const floor = arenaFloor(game.height);
    const x = (crab.x + crab.scuttle() - crab.homeX) / SCALE;
    const z = STAND_Z + (floor - crab.y - crab.radius - crab.haulOffset()) / SCALE;
    this.yaw.position.set(x, 0, z);
    this.yaw.rotation.z = crab.facing;
    this.pitch.rotation.y = crab.pitch() + crab.lean();
    this.rig.pose(crab.servoAngles());
  }

  private placePipes(game: FlappyGame) {
    this.coins.begin(game.score, performance.now());
    const floor = arenaFloor(game.height);
    const ceiling = floor / SCALE;
    const lipH = LIP / SCALE;
    let n = 0;
    for (const pipe of game.pipes) {
      const x = (pipe.x + pipe.width / 2 - game.crab.homeX) / SCALE;
      const width = pipe.width / SCALE;
      const depth = 0.42;
      const bottomH = Math.max(0, (floor - pipe.gapBottom) / SCALE);
      const topBase = (floor - pipe.gapTop) / SCALE;
      const topH = Math.max(0, ceiling - topBase);
      const onLower = bottomH > 0.04;
      this.setPipe(n++, x, width, depth, 0, bottomH, lipH, false, onLower ? pipe.index : 0, pipe.scored);
      this.setPipe(n++, x, width, depth, topBase, topH, lipH, true, onLower ? 0 : pipe.index, pipe.scored);
    }
    for (; n < this.pipes.length; n++) this.hidePipe(this.pipes[n]);
    this.coins.update();
  }

  private hidePipe(view: PipeView) {
    view.shaft.visible = false;
    view.lip.visible = false;
    if (view.label) view.label.visible = false;
  }

  private setPipe(index: number, x: number, width: number, depth: number, base: number, height: number, lipH: number, top: boolean, coin: number, scored: boolean) {
    const view = this.pipes[index];
    if (!view) return;
    const show = height > 0.01;
    view.shaft.visible = show;
    view.lip.visible = show;
    if (!show) { if (view.label) view.label.visible = false; return; }
    view.shaft.position.set(x, 0, base);
    view.shaft.scale.set(width, depth, height);
    const lipBase = top ? base : Math.max(base, base + height - lipH);
    view.lip.position.set(x, 0, lipBase);
    view.lip.scale.set(width + PIPE_LIP * 2 / SCALE, depth + 0.04, Math.min(lipH, height));
    this.coins.place(view, x, top ? base : base + height, coin, scored);
  }

  private follow() {
    const dist = clamp(this.baseDistance / this.zoom, 0.16, 3.4);
    const cp = Math.cos(this.orbitPitch);
    const sp = Math.sin(this.orbitPitch);
    this.focus.copy(this.focusLocal);
    this.yaw.localToWorld(this.focus);
    this.eye.set(
      this.focus.x + dist * cp * Math.cos(this.orbitYaw),
      this.focus.y + dist * cp * Math.sin(this.orbitYaw),
      this.focus.z + dist * sp
    );
    this.camera.position.copy(this.eye);
    this.camera.lookAt(this.focus);
    this.key.position.set(this.focus.x + 0.8, this.focus.y - 0.9, this.focus.z + 1.1);
    this.key.target.position.copy(this.focus);
    this.key.target.updateMatrixWorld();
  }

  private resize() {
    const canvas = this.renderer.domElement;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const mark = `${width}x${height}`;
    if (mark === this.sized) return;
    this.sized = mark;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
