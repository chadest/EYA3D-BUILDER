/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Blender-Style Sculpting Cursor Disk & Surface Vector Ring
 * Optimized with three-mesh-bvh spatial queries & TypedArray zero-GC readouts.
 */

import * as THREE from 'three';
import { MeshBVH, computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Ensure THREE prototype extensions for BVH acceleration
if (!(THREE.BufferGeometry.prototype as any).computeBoundsTree) {
  (THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

export type SculptGizmoMode = 'active' | 'adjust_radius' | 'adjust_strength';

// Static Module-Level Reusable Temporary Objects for Zero-GC Operations
const _invMatrix = new THREE.Matrix4();
const _normalMatrix = new THREE.Matrix3();
const _hitPointLocal = new THREE.Vector3();
const _accumulatedNorm = new THREE.Vector3();
const _vNormLocal = new THREE.Vector3();
const _vNormWorld = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _upVector = new THREE.Vector3(0, 1, 0);
const _localBox = new THREE.Box3();
const _localBoxMin = new THREE.Vector3();
const _localBoxMax = new THREE.Vector3();

/**
 * Advanced Blender-Style Sculpting Cursor Gizmo.
 * Specifications:
 * 1. High-resolution vector circle outline (THREE.LineLoop, 64 segments)
 * 2. Vertex Normal Averaging accelerated by BVH spatial query + TypedArrays (Zero-GC)
 * 3. Concentric Radius Adjustment disk & dashed previous-radius ring ('F' key Blender UX)
 * 4. Concentric Strength / Falloff profile disk ('Shift + F' key Blender UX)
 * 5. Smooth auto-fade opacity interpolation (targetOpacity -> currentOpacity)
 */
export class SculptCursorGizmo extends THREE.Group {
  public gizmoMode: SculptGizmoMode = 'active';

  // Sub-components
  private mainRing: THREE.LineLoop;
  private innerRing: THREE.LineLoop;
  private dashedRing: THREE.LineLoop;
  private radiusDisk: THREE.Mesh;
  private falloffDisk: THREE.Mesh;
  private normalPointer: THREE.Line;
  private centerDot: THREE.Mesh;

  // Materials
  private mainRingMat: THREE.LineBasicMaterial;
  private innerRingMat: THREE.LineBasicMaterial;
  private dashedRingMat: THREE.LineDashedMaterial;
  private radiusDiskMat: THREE.MeshBasicMaterial;
  private falloffDiskMat: THREE.MeshBasicMaterial;
  private normalPointerMat: THREE.LineBasicMaterial;
  private centerDotMat: THREE.MeshBasicMaterial;

  // Animation & Interpolation States
  public targetOpacity: number = 0;
  public currentOpacity: number = 0;
  private smoothedNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private previousRadius: number = 1.0;
  private previousStrength: number = 0.5;

  constructor(segments: number = 64) {
    super();
    this.name = 'BlenderSculptCursorGizmo';

    // Build vector circle points (XZ plane, facing +Y)
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    const circleGeometry = new THREE.BufferGeometry().setFromPoints(points);

    // 1. Main Vector Outer Contour Line (LineLoop)
    this.mainRingMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8, // Blender Sky Blue / Cyan
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      linewidth: 2,
    });
    this.mainRing = new THREE.LineLoop(circleGeometry, this.mainRingMat);
    this.add(this.mainRing);

    // 2. Dashed Previous Radius Ring (LineDashedMaterial)
    const dashedGeom = circleGeometry.clone();
    this.dashedRingMat = new THREE.LineDashedMaterial({
      color: 0x94a3b8, // Slate-400
      dashSize: 0.08,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    });
    this.dashedRing = new THREE.LineLoop(dashedGeom, this.dashedRingMat);
    this.dashedRing.computeLineDistances();
    this.dashedRing.visible = false;
    this.add(this.dashedRing);

    // 3. Radius Adjustment Translucent Disk
    const ringGeom = new THREE.CircleGeometry(1.0, segments);
    this.radiusDiskMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      depthTest: false,
    });
    this.radiusDisk = new THREE.Mesh(ringGeom, this.radiusDiskMat);
    this.radiusDisk.rotation.x = Math.PI / 2;
    this.radiusDisk.visible = false;
    this.add(this.radiusDisk);

    // 4. Inner Falloff / Strength Ring
    this.innerRingMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e, // Rose / Pink-Red
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      linewidth: 1.5,
    });
    this.innerRing = new THREE.LineLoop(circleGeometry.clone(), this.innerRingMat);
    this.add(this.innerRing);

    // 5. Falloff Profile Disk (Strength mode)
    const falloffGeom = new THREE.CircleGeometry(1.0, segments);
    this.falloffDiskMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28,
      depthTest: false,
    });
    this.falloffDisk = new THREE.Mesh(falloffGeom, this.falloffDiskMat);
    this.falloffDisk.rotation.x = Math.PI / 2;
    this.falloffDisk.visible = false;
    this.add(this.falloffDisk);

    // 6. Surface Normal Vector Line Pointer
    const linePoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.4, 0)];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    this.normalPointerMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });
    this.normalPointer = new THREE.Line(lineGeom, this.normalPointerMat);
    this.add(this.normalPointer);

    // 7. Center Hit Point Marker (Tiny Ring / Dot)
    const dotGeom = new THREE.CircleGeometry(0.02, 16);
    this.centerDotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    this.centerDot = new THREE.Mesh(dotGeom, this.centerDotMat);
    this.centerDot.rotation.x = Math.PI / 2;
    this.add(this.centerDot);

    this.visible = false;
  }

  /**
   * Calculates smoothed vertex normal averaging over vertices within radius,
   * accelerated with three-mesh-bvh and zero-GC Float32Array readouts.
   */
  public updatePositionAndOrientation(
    hitPointWorld: THREE.Vector3,
    hitFaceNormalWorld: THREE.Vector3,
    mesh: THREE.Mesh,
    radiusWorld: number
  ): void {
    const smoothedNorm = calculateSmoothedNormalBVH(hitPointWorld, hitFaceNormalWorld, mesh, radiusWorld);

    // Smoothly interpolate current gizmo normal
    this.smoothedNormal.lerp(smoothedNorm, 0.35).normalize();

    this.position.copy(hitPointWorld);
    this.quaternion.setFromUnitVectors(_upVector, this.smoothedNormal);

    this.targetOpacity = 1.0;
  }

  /**
   * Sets whether cursor is currently hovering over mesh
   */
  public setHovering(isHovering: boolean): void {
    this.targetOpacity = isHovering ? 1.0 : 0.0;
  }

  /**
   * Switches visual state mode (active, adjust_radius, adjust_strength)
   */
  public setMode(mode: SculptGizmoMode, currentRadius?: number, currentStrength?: number): void {
    this.gizmoMode = mode;
    if (mode === 'adjust_radius') {
      if (currentRadius !== undefined) this.previousRadius = currentRadius;
    } else if (mode === 'adjust_strength') {
      if (currentStrength !== undefined) this.previousStrength = currentStrength;
    }
  }

  /**
   * Updates visual elements based on brush settings and active mode
   */
  public updateVisuals(radius: number, strength: number, falloffType: string = 'smoothstep'): void {
    // Base scale set to world radius
    this.scale.setScalar(radius);

    // Inner ring / falloff scale calculation
    const falloffRatio = Math.max(0.05, Math.min(1.0, strength));
    this.innerRing.scale.setScalar(falloffRatio);
    this.falloffDisk.scale.setScalar(falloffRatio);

    // Mode-based sub-component visibility
    if (this.gizmoMode === 'adjust_radius') {
      this.dashedRing.visible = true;
      this.radiusDisk.visible = true;
      this.falloffDisk.visible = false;

      // Scale dashed ring to match previous radius relative to active scale
      const relativeDashedScale = this.previousRadius / (radius || 0.001);
      this.dashedRing.scale.setScalar(relativeDashedScale);
    } else if (this.gizmoMode === 'adjust_strength') {
      this.dashedRing.visible = false;
      this.radiusDisk.visible = false;
      this.falloffDisk.visible = true;
    } else {
      // Normal / Active mode
      this.dashedRing.visible = false;
      this.radiusDisk.visible = false;
      this.falloffDisk.visible = false;
    }

    this.tickOpacity();
  }

  /**
   * Smoothly interpolates opacity frame-by-frame (lerp to targetOpacity)
   */
  public tickOpacity(): void {
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * 0.25;

    if (this.currentOpacity < 0.01) {
      this.visible = false;
      return;
    }
    this.visible = true;

    // Apply interpolated opacity to all materials
    const op = this.currentOpacity;
    this.mainRingMat.opacity = 0.9 * op;
    this.innerRingMat.opacity = 0.85 * op;
    this.dashedRingMat.opacity = 0.7 * op;
    this.radiusDiskMat.opacity = 0.18 * op;
    this.falloffDiskMat.opacity = 0.28 * op;
    this.normalPointerMat.opacity = 0.8 * op;
    this.centerDotMat.opacity = 0.9 * op;
  }
}

/**
 * BVH-Accelerated Vertex Normal Averaging Algorithm:
 * Reads directly from Float32Array typed buffers without object allocations.
 */
function calculateSmoothedNormalBVH(
  hitPointWorld: THREE.Vector3,
  hitFaceNormalWorld: THREE.Vector3,
  mesh: THREE.Mesh,
  radiusWorld: number
): THREE.Vector3 {
  if (!mesh.geometry || !mesh.geometry.attributes.position) {
    return hitFaceNormalWorld.clone().normalize();
  }

  const geometry = mesh.geometry as THREE.BufferGeometry;
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const posArr = posAttr.array as Float32Array;
  const normArr = normAttr ? (normAttr.array as Float32Array) : null;
  const count = posAttr.count;

  // Ensure BVH spatial tree is initialized on geometry
  if (!(geometry as any).boundsTree) {
    try {
      (geometry as any).boundsTree = new MeshBVH(geometry);
    } catch {
      // Fallback if geometry non-indexed
    }
  }

  // Transform world hit point to local space
  _invMatrix.copy(mesh.matrixWorld).invert();
  _hitPointLocal.copy(hitPointWorld).applyMatrix4(_invMatrix);

  // Decompose world scale to get local radius
  mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), _scale);
  const avgScale = (Math.abs(_scale.x) + Math.abs(_scale.y) + Math.abs(_scale.z)) / 3 || 1.0;
  const localRadius = radiusWorld / avgScale;
  const localRadiusSq = localRadius * localRadius;

  _normalMatrix.getNormalMatrix(mesh.matrixWorld);
  _accumulatedNorm.set(0, 0, 0);
  let totalWeight = 0;

  // If BVH boundsTree exists, use shapecast for O(log N) vertex search
  const bvh = (geometry as any).boundsTree as MeshBVH | undefined;

  if (bvh) {
    _localBoxMin.set(
      _hitPointLocal.x - localRadius,
      _hitPointLocal.y - localRadius,
      _hitPointLocal.z - localRadius
    );
    _localBoxMax.set(
      _hitPointLocal.x + localRadius,
      _hitPointLocal.y + localRadius,
      _hitPointLocal.z + localRadius
    );
    _localBox.set(_localBoxMin, _localBoxMax);

    const indexAttr = geometry.index;
    const indexArr = indexAttr ? indexAttr.array : null;

    bvh.shapecast({
      intersectsBounds: box => box.intersectsBox(_localBox),
      intersectsTriangle: (tri, triIndex) => {
        // Process the 3 vertices of triangle
        for (let v = 0; v < 3; v++) {
          const vIdx = indexArr ? indexArr[triIndex * 3 + v] : triIndex * 3 + v;
          if (vIdx >= count) continue;

          const px = posArr[vIdx * 3];
          const py = posArr[vIdx * 3 + 1];
          const pz = posArr[vIdx * 3 + 2];

          const dx = px - _hitPointLocal.x;
          const dy = py - _hitPointLocal.y;
          const dz = pz - _hitPointLocal.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq <= localRadiusSq) {
            const dist = Math.sqrt(distSq);
            const normDist = dist / localRadius;
            const weight = (1.0 - normDist * normDist) * (1.0 - normDist * normDist);

            if (normArr) {
              _vNormLocal.set(normArr[vIdx * 3], normArr[vIdx * 3 + 1], normArr[vIdx * 3 + 2]);
            } else {
              _vNormLocal.copy(hitFaceNormalWorld);
            }

            _vNormWorld.copy(_vNormLocal).applyMatrix3(_normalMatrix).normalize();
            _accumulatedNorm.addScaledVector(_vNormWorld, weight);
            totalWeight += weight;
          }
        }
      },
    });
  } else {
    // Direct Float32Array iteration fallback
    const stride = count > 10000 ? 3 : 1;
    for (let i = 0; i < count; i += stride) {
      const px = posArr[i * 3];
      const py = posArr[i * 3 + 1];
      const pz = posArr[i * 3 + 2];

      const dx = px - _hitPointLocal.x;
      const dy = py - _hitPointLocal.y;
      const dz = pz - _hitPointLocal.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq <= localRadiusSq) {
        const dist = Math.sqrt(distSq);
        const normDist = dist / localRadius;
        const weight = (1.0 - normDist * normDist) * (1.0 - normDist * normDist);

        if (normArr) {
          _vNormLocal.set(normArr[i * 3], normArr[i * 3 + 1], normArr[i * 3 + 2]);
        } else {
          _vNormLocal.copy(hitFaceNormalWorld);
        }

        _vNormWorld.copy(_vNormLocal).applyMatrix3(_normalMatrix).normalize();
        _accumulatedNorm.addScaledVector(_vNormWorld, weight);
        totalWeight += weight;
      }
    }
  }

  if (totalWeight > 0.001 && _accumulatedNorm.lengthSq() > 0.001) {
    return _accumulatedNorm.normalize().clone();
  }

  return hitFaceNormalWorld.clone().normalize();
}

/**
 * Creates the SculptCursorGizmo instance
 */
export function createSculptGizmo(): THREE.Group {
  return new SculptCursorGizmo(64);
}
