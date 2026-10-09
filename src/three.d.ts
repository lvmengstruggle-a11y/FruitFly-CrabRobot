declare module 'three' {
  class Thing {
    constructor(...args: any[]);
    [key: string]: any;
  }
  export class Vector3 extends Thing {}
  export class Color extends Thing {}
  export class Object3D extends Thing {}
  export class Group extends Thing {}
  export class Scene extends Thing {}
  export class PerspectiveCamera extends Thing {}
  export class WebGLRenderer extends Thing {}
  export class DirectionalLight extends Thing {}
  export class HemisphereLight extends Thing {}
  export class Mesh extends Thing {}
  export class PlaneGeometry extends Thing {}
  export class BoxGeometry extends Thing {}
  export class BufferGeometry extends Thing {}
  export class BufferAttribute extends Thing {}
  export class Float32BufferAttribute extends Thing {}
  export class MeshStandardMaterial extends Thing {}
  export class MeshBasicMaterial extends Thing {}
  export class Sprite extends Thing {}
  export class SpriteMaterial extends Thing {}
  export class CanvasTexture extends Thing {}
  export class GridHelper extends Thing {}
  export class Box3 extends Thing {}
  export class Fog extends Thing {}
  export const PCFSoftShadowMap: number;
  export const SRGBColorSpace: string;
  export type Material = Thing;
}
