/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Runtime bridge between Eya3D Three.js scene state and the Rust/wgpu WASM rendering core.
 */

import * as THREE from 'three';

export interface RustRendererInstance {
  resize(width: number, height: number): void;
  set_clear_color(r: number, g: number, b: number): void;
  set_camera(viewProj: Float32Array, eye: Float32Array): void;
  set_light(dir: Float32Array, color: Float32Array, intensity: number): void;
  upsert_mesh(
    id: string,
    positions: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    indices: Uint32Array,
    modelMatrix: Float32Array,
    colorRgba: Float32Array,
    roughness: number,
    metalness: number
  ): void;
  update_mesh_transform(
    id: string,
    modelMatrix: Float32Array,
    colorRgba: Float32Array,
    roughness: number,
    metalness: number
  ): void;
  remove_mesh(id: string): void;
  render(): void;
  free?(): void;
}

const _viewProj = new THREE.Matrix4();
const _viewProjArr = new Float32Array(16);
const _eyeArr = new Float32Array(3);
const _modelArr = new Float32Array(16);
const _colorArr = new Float32Array(4);
const _lightDirArr = new Float32Array(3);
const _lightColorArr = new Float32Array(3);

export class RustWasmRenderBridge {
  private instance: RustRendererInstance | null = null;
  private uploadedMeshIds = new Set<string>();
  private initialized = false;

  public isReady(): boolean {
    return this.initialized && this.instance !== null;
  }

  /**
   * Attempts to dynamically load the locally compiled wasm-pack artifact from /wasm/eya3d_rust_renderer.js.
   * Returns false gracefully if the WASM bundle has not been compiled yet.
   */
  public async tryInit(canvasId: string): Promise<boolean> {
    if (this.initialized) return this.instance !== null;

    try {
      const base = (import.meta as any).env?.BASE_URL || '/';
      const moduleUrl = `${base.endsWith('/') ? base : `${base}/`}wasm/eya3d_rust_renderer.js`;
      const wasmMod: any = await import(/* @vite-ignore */ moduleUrl);
      if (typeof wasmMod.default === 'function') {
        await wasmMod.default();
      }
      if (typeof wasmMod.EyaRustRenderer?.create === 'function') {
        this.instance = await wasmMod.EyaRustRenderer.create(canvasId);
        this.initialized = true;
        return true;
      }
    } catch {
      // WASM artifact not present; Three.js WebGL/WebGPU pipeline remains active
    }
    this.initialized = true;
    return false;
  }

  public syncCamera(camera: THREE.PerspectiveCamera): void {
    if (!this.instance) return;
    camera.updateMatrixWorld();
    _viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _viewProjArr.set(_viewProj.elements);
    _eyeArr[0] = camera.position.x;
    _eyeArr[1] = camera.position.y;
    _eyeArr[2] = camera.position.z;
    this.instance.set_camera(_viewProjArr, _eyeArr);
  }

  public syncDirectionalLight(dir: THREE.Vector3, color: THREE.Color, intensity: number): void {
    if (!this.instance) return;
    _lightDirArr[0] = dir.x;
    _lightDirArr[1] = dir.y;
    _lightDirArr[2] = dir.z;
    _lightColorArr[0] = color.r;
    _lightColorArr[1] = color.g;
    _lightColorArr[2] = color.b;
    this.instance.set_light(_lightDirArr, _lightColorArr, intensity);
  }

  public syncMesh(id: string, mesh: THREE.Mesh, forceGeometryUpload = false): void {
    if (!this.instance || !mesh.geometry) return;

    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const stdMat = mat as THREE.MeshStandardMaterial | undefined;
    const color = stdMat?.color;
    _colorArr[0] = color ? color.r : 0.29;
    _colorArr[1] = color ? color.g : 0.56;
    _colorArr[2] = color ? color.b : 0.89;
    _colorArr[3] = stdMat?.opacity ?? 1.0;

    const roughness = stdMat?.roughness ?? 0.4;
    const metalness = stdMat?.metalness ?? 0.1;

    mesh.updateMatrixWorld();
    _modelArr.set(mesh.matrixWorld.elements);

    if (!forceGeometryUpload && this.uploadedMeshIds.has(id)) {
      this.instance.update_mesh_transform(id, _modelArr, _colorArr, roughness, metalness);
      return;
    }

    const posAttr = mesh.geometry.getAttribute('position');
    if (!posAttr) return;

    const normAttr = mesh.geometry.getAttribute('normal');
    const uvAttr = mesh.geometry.getAttribute('uv');
    const indexAttr = mesh.geometry.getIndex();

    const positions = new Float32Array(posAttr.array as ArrayLike<number>);
    const normals = normAttr
      ? new Float32Array(normAttr.array as ArrayLike<number>)
      : new Float32Array(positions.length);
    const uvs = uvAttr
      ? new Float32Array(uvAttr.array as ArrayLike<number>)
      : new Float32Array((positions.length / 3) * 2);

    let indices: Uint32Array;
    if (indexAttr) {
      indices = new Uint32Array(indexAttr.array as ArrayLike<number>);
    } else {
      const count = posAttr.count;
      indices = new Uint32Array(count);
      for (let i = 0; i < count; i++) indices[i] = i;
    }

    this.instance.upsert_mesh(
      id,
      positions,
      normals,
      uvs,
      indices,
      _modelArr,
      _colorArr,
      roughness,
      metalness
    );
    this.uploadedMeshIds.add(id);
  }

  public removeMesh(id: string): void {
    if (!this.instance) return;
    this.instance.remove_mesh(id);
    this.uploadedMeshIds.delete(id);
  }

  public resize(width: number, height: number): void {
    this.instance?.resize(width, height);
  }

  public render(): void {
    this.instance?.render();
  }

  public dispose(): void {
    this.instance?.free?.();
    this.instance = null;
    this.uploadedMeshIds.clear();
  }
}
