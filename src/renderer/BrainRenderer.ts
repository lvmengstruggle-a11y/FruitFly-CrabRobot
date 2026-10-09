import { assetUrl } from '../assetBase';
import { layoutNeurons, NEURONS, REGION_COLOR, type NeuronLayout } from './neuronMap';

const VERTEX = `
attribute vec2 p;
attribute vec3 c;
attribute float a;
varying vec3 vColor;
varying float v;
void main() {
  v = a;
  vColor = c;
  gl_Position = vec4(p, 0.0, 1.0);
  gl_PointSize = 2.6 + a * 5.2;
}`;

const FRAGMENT = `
precision mediump float;
varying vec3 vColor;
varying float v;
void main() {
  if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
  vec3 color = vColor * (0.55 + v * 0.95) + vec3(v * 0.32);
  gl_FragColor = vec4(min(color, vec3(1.0)), 0.62 + v * 0.38);
}`;

export class BrainRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private activityBuffer: WebGLBuffer;
  private activity = new Float32Array(NEURONS);
  private count = NEURONS;
  private ids: Uint32Array | null = null;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = 600;
    canvas.height = 520;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) throw new Error('WebGL is required for the neuron map');
    this.gl = gl;
    this.program = this.make(VERTEX, FRAGMENT);
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.activityBuffer = gl.createBuffer()!;
    this.bindGeometry(this.fallback());
    void this.loadRegions();
  }

  render(source: Uint8Array) {
    const gl = this.gl;
    const n = this.count;
    const srcN = source.length;
    const activity = this.activity;
    if (srcN === n) {
      for (let i = 0; i < n; i++) activity[i] = source[i] / 255;
    } else if (srcN === 0) {
      activity.fill(0);
    } else if (this.ids) {
      for (let i = 0; i < n; i++) {
        const at = Math.min(srcN - 1, Math.floor((this.ids[i] * srcN) / NEURONS));
        activity[i] = source[at] / 255;
      }
    } else {
      for (let i = 0; i < n; i++) activity[i] = source[Math.floor((i * srcN) / n)] / 255;
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.025, 0.045, 0.043, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.activityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, activity.subarray(0, n), gl.DYNAMIC_DRAW);
    const loc = gl.getAttribLocation(this.program, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, n);
  }

  private async loadRegions() {
    try {
      const response = await fetch(assetUrl('brain/meta.bin'));
      if (!response.ok) return;
      const raw = new Uint8Array(await response.arrayBuffer());
      const buffer = raw[0] === 0x1f && raw[1] === 0x8b
        ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
        : raw.buffer;
      const meta = readMeta(buffer);
      this.bindGeometry(layoutNeurons(meta.classes, meta.sides, meta.names));
    } catch {
      /* The single-color disk remains until the connectome meta can be read. */
    }
  }

  private fallback(): NeuronLayout {
    const positions = new Float32Array(NEURONS * 2);
    const colors = new Float32Array(NEURONS * 3);
    const ids = new Uint32Array(NEURONS);
    const [red, green, blue] = REGION_COLOR[2];
    for (let i = 0; i < NEURONS; i++) {
      const t = i * 2.3999632297;
      const r = Math.sqrt((i + 0.5) / NEURONS) * 0.92;
      positions[i * 2] = Math.cos(t) * r * 0.82;
      positions[i * 2 + 1] = Math.sin(t) * r;
      colors[i * 3] = red;
      colors[i * 3 + 1] = green;
      colors[i * 3 + 2] = blue;
      ids[i] = i;
    }
    return { positions, colors, ids };
  }

  private bindGeometry(layout: NeuronLayout) {
    const gl = this.gl;
    gl.useProgram(this.program);
    this.count = layout.ids.length;
    this.ids = layout.ids;
    this.bindStatic('p', layout.positions, 2);
    this.bindStatic('c', layout.colors, 3);
  }

  private bindStatic(name: string, data: Float32Array, size: number) {
    const gl = this.gl;
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  private make(vertex: string, fragment: string) {
    const gl = this.gl;
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    return program;
  }
}

function readMeta(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'FLYM') throw new Error('connectome meta');
  const n = view.getUint32(8, true);
  const len = view.getUint32(12, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 16, len))) as { superclasses: string[] };
  let at = 16 + len + n * 2;
  const classes = new Uint8Array(buffer.slice(at, at + n));
  at += n;
  const sides = new Uint8Array(buffer.slice(at, at + n));
  return { classes, sides, names: head.superclasses };
}
