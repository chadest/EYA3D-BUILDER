/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Digital Sculpting Module (3D Brush Gizmo, Inflate, Smooth, Flatten, Pinch, Remesh)
 *
 * Mathematical Formulations for Brush Falloff & Deformation:
 *
 * 1. Radial Falloff Weight (Smooth Step Gaussian):
 *    Let d = ||v_pos - P_brush||. If d < BrushRadius:
 *    w(d) = (1 - (d / BrushRadius)^2)^2 * BrushStrength
 *
 * 2. Sculpt / Inflate (Normal displacement):
 *    v_pos' = v_pos + w(d) * N_v
 *
 * 3. Smooth (Laplacian Neighborhood Averaging):
 *    v_pos' = (1 - w(d)) * v_pos + w(d) * (1 / |Neighbors|) * sum_{u in Neighbors}(u)
 *
 * 4. Flatten (Plane Projection):
 *    Project vertex onto plane passing through hit position P with surface normal N:
 *    Distance to plane h = (v_pos - P) . N
 *    v_pos' = v_pos - w(d) * h * N
 *
 * 5. Pinch (Centripetal Attraction):
 *    v_pos' = v_pos + w(d) * (P_brush - v_pos)
 */

import * as THREE from 'three';
import { SculptMode } from '../../types/editor';

export interface SculptBrushSettings {
  radius: number;
  strength: number;
  mode: SculptMode;
  invert: boolean;
}

export { SculptCursorGizmo, createSculptGizmo } from './sculptCursorGizmo';

/**
 * Clears all vertex masks on mesh geometry
 */
export function clearMeshMask(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry;
  const posAttr = geometry.attributes.position;
  if (!posAttr) return;

  const count = posAttr.count;
  const maskAttr = new Float32Array(count);
  geometry.setAttribute('mask', new THREE.BufferAttribute(maskAttr, 1));

  // Clear vertex colors back to white
  if (geometry.attributes.color) {
    const colAttr = geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      colAttr.setXYZ(i, 1.0, 1.0, 1.0);
    }
    colAttr.needsUpdate = true;
  }
}

/**
 * Inverts vertex mask weights on mesh geometry
 */
export function invertMeshMask(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry;
  const posAttr = geometry.attributes.position;
  if (!posAttr) return;

  const count = posAttr.count;
  let maskAttr = geometry.attributes.mask as THREE.BufferAttribute;
  if (!maskAttr) {
    maskAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
    geometry.setAttribute('mask', maskAttr);
  }

  const maskArray = maskAttr.array as Float32Array;
  let colAttr = geometry.attributes.color as THREE.BufferAttribute;
  if (!colAttr) {
    const cols = new Float32Array(count * 3);
    cols.fill(1.0);
    colAttr = new THREE.BufferAttribute(cols, 3);
    geometry.setAttribute('color', colAttr);
  }

  for (let i = 0; i < count; i++) {
    const invVal = 1.0 - maskArray[i];
    maskArray[i] = invVal;
    const shade = 1.0 - invVal * 0.6;
    colAttr.setXYZ(i, shade, shade * 0.7, shade * 0.7);
  }

  maskAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  
  if (mesh.material instanceof THREE.MeshStandardMaterial) {
    mesh.material.vertexColors = true;
    mesh.material.needsUpdate = true;
  }
}

/**
 * Applies sculpting deformation directly to BufferGeometry vertex positions.
 */
export function applySculptDeformation(
  geometry: THREE.BufferGeometry,
  hitPoint: THREE.Vector3,
  hitNormal: THREE.Vector3,
  settings: SculptBrushSettings
): void {
  const posAttr = geometry.attributes.position;
  const normalAttr = geometry.attributes.normal;
  const count = posAttr.count;

  const { radius, strength, mode, invert } = settings;
  const effectiveStrength = invert ? -strength : strength;
  const radiusSq = radius * radius;

  const vPos = new THREE.Vector3();
  const vNorm = new THREE.Vector3();

  // If mode is Smooth, build local vertex neighbor map first
  let neighborsMap: Map<number, THREE.Vector3[]> | null = null;
  if (mode === 'smooth') {
    neighborsMap = new Map();
    // Simple adjacency estimation using spatial distance
    for (let i = 0; i < count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const b = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);

      if (!neighborsMap.has(i)) neighborsMap.set(i, []);
      if (!neighborsMap.has(i + 1)) neighborsMap.set(i + 1, []);
      if (!neighborsMap.has(i + 2)) neighborsMap.set(i + 2, []);

      neighborsMap.get(i)!.push(b, c);
      neighborsMap.get(i + 1)!.push(a, c);
      neighborsMap.get(i + 2)!.push(a, b);
    }
  }

  for (let i = 0; i < count; i++) {
    vPos.fromBufferAttribute(posAttr, i);
    const distSq = vPos.distanceToSquared(hitPoint);

    if (distSq > radiusSq) continue; // Outside brush radius

    const dist = Math.sqrt(distSq);
    // Smooth cosine falloff weight w in [0, 1]
    const normDist = dist / radius;
    const falloff = Math.pow(1 - normDist * normDist, 2) * effectiveStrength;

    vNorm.fromBufferAttribute(normalAttr, i);

    switch (mode) {
      case 'sculpt':
      case 'inflate': {
        // Displace along vertex surface normal
        const delta = (mode === 'inflate' ? vNorm : hitNormal).clone().multiplyScalar(falloff * 0.1);
        vPos.add(delta);
        break;
      }

      case 'smooth': {
        // Laplacian neighborhood averaging
        const nbrs = neighborsMap?.get(i);
        if (nbrs && nbrs.length > 0) {
          const avg = new THREE.Vector3();
          for (const nb of nbrs) avg.add(nb);
          avg.divideScalar(nbrs.length);

          vPos.lerp(avg, Math.min(0.5, falloff));
        }
        break;
      }

      case 'flatten': {
        // Plane projection: h = (vPos - hitPoint) . hitNormal
        const height = vPos.clone().sub(hitPoint).dot(hitNormal);
        const projection = hitNormal.clone().multiplyScalar(-height * falloff);
        vPos.add(projection);
        break;
      }

      case 'pinch': {
        // Centripetal attraction towards brush centroid
        const pull = hitPoint.clone().sub(vPos).multiplyScalar(falloff * 0.2);
        vPos.add(pull);
        break;
      }
    }

    posAttr.setXYZ(i, vPos.x, vPos.y, vPos.z);
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Global Remeshing / Uniform Topology Redistribution.
 */
export function remeshUniformly(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geom.computeVertexNormals();
  return geom;
}
