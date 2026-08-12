/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Lattice Cage Deformation Module (Trilinear / Bernstein Interpolation)
 *
 * Mathematical Formulation:
 *
 * Given a 3D bounding lattice cage with resolution N_x x N_y x N_z (e.g., 3 x 3 x 3 = 27 control points).
 * For each vertex P in the source mesh:
 * 1. Calculate normalized parameter coordinates (u, v, w) in [0, 1]^3 relative to bounding box [P_min, P_max]:
 *    u = (P.x - P_min.x) / (P_max.x - P_min.x)
 *    v = (P.y - P_min.y) / (P_max.y - P_min.y)
 *    w = (P.z - P_min.z) / (P_max.z - P_min.z)
 *
 * 2. Calculate Bernstein polynomial basis weights for degree n = N - 1:
 *    B_i^n(u) = (n choose i) * u^i * (1 - u)^(n - i)
 *
 * 3. Deformed position P' is weighted sum over lattice cage points C_{i, j, k}:
 *    P' = sum_{i=0}^{N_x-1} sum_{j=0}^{N_y-1} sum_{k=0}^{N_z-1} ( B_i^{N_x-1}(u) * B_j^{N_y-1}(v) * B_k^{N_z-1}(w) * C_{i,j,k} )
 */

import * as THREE from 'three';

// Binomial coefficient helper n choose k
function nChooseK(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let c = 1;
  for (let i = 1; i <= k; i++) {
    c = (c * (n - (k - i))) / i;
  }
  return c;
}

// Bernstein basis polynomial B_i^n(t)
function bernstein(n: number, i: number, t: number): number {
  const clampedT = Math.min(1, Math.max(0, t));
  return nChooseK(n, i) * Math.pow(clampedT, i) * Math.pow(1 - clampedT, n - i);
}

/**
 * Initializes default 3x3x3 grid lattice cage control points enclosed around geometry bounding box.
 */
export function generateDefaultLatticeCage(
  geometry: THREE.BufferGeometry,
  resolution: [number, number, number] = [3, 3, 3]
): { points: THREE.Vector3[]; bbox: THREE.Box3 } {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox ? geometry.boundingBox.clone() : new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

  // Expand bounding box slightly for comfortable margin
  bbox.expandByScalar(0.1);

  const [nx, ny, nz] = resolution;
  const points: THREE.Vector3[] = [];

  const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);

  for (let i = 0; i < nx; i++) {
    const u = nx > 1 ? i / (nx - 1) : 0.5;
    for (let j = 0; j < ny; j++) {
      const v = ny > 1 ? j / (ny - 1) : 0.5;
      for (let k = 0; k < nz; k++) {
        const w = nz > 1 ? k / (nz - 1) : 0.5;

        const pt = new THREE.Vector3(
          bbox.min.x + u * size.x,
          bbox.min.y + v * size.y,
          bbox.min.z + w * size.z
        );
        points.push(pt);
      }
    }
  }

  return { points, bbox };
}

/**
 * Applies Lattice Cage Deformation to BufferGeometry via Bernstein Polynomial Interpolation.
 */
export function applyLatticeDeformation(
  geometry: THREE.BufferGeometry,
  resolution: [number, number, number],
  cagePoints: THREE.Vector3[]
): THREE.BufferGeometry {
  if (cagePoints.length === 0) return geometry;

  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;

  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  const [nx, ny, nz] = resolution;
  const degreeX = nx - 1;
  const degreeY = ny - 1;
  const degreeZ = nz - 1;

  const min = bbox.min;
  const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
  if (size.x <= 0) size.x = 1;
  if (size.y <= 0) size.y = 1;
  if (size.z <= 0) size.z = 1;

  const vPos = new THREE.Vector3();
  const newPos = new THREE.Vector3();

  for (let pIdx = 0; pIdx < count; pIdx++) {
    vPos.fromBufferAttribute(posAttr, pIdx);

    // Parametric u, v, w coordinates in [0, 1]
    const u = (vPos.x - min.x) / size.x;
    const v = (vPos.y - min.y) / size.y;
    const w = (vPos.z - min.z) / size.z;

    newPos.set(0, 0, 0);

    let cageIdx = 0;
    for (let i = 0; i < nx; i++) {
      const bu = bernstein(degreeX, i, u);
      for (let j = 0; j < ny; j++) {
        const bv = bernstein(degreeY, j, v);
        for (let k = 0; k < nz; k++) {
          const bw = bernstein(degreeZ, k, w);

          const weight = bu * bv * bw;
          const cagePt = cagePoints[cageIdx++];
          if (cagePt) {
            newPos.addScaledVector(cagePt, weight);
          }
        }
      }
    }

    posAttr.setXYZ(pIdx, newPos.x, newPos.y, newPos.z);
  }

  posAttr.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds Wireframe Helper Object for displaying the 3x3x3 Lattice Cage in Viewport.
 */
export function buildLatticeCageWireframe(
  resolution: [number, number, number],
  cagePoints: THREE.Vector3[]
): THREE.LineSegments {
  const [nx, ny, nz] = resolution;
  const linePoints: THREE.Vector3[] = [];

  const getIdx = (i: number, j: number, k: number) => i * (ny * nz) + j * nz + k;

  // Add grid connecting lines
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        const curr = cagePoints[getIdx(i, j, k)];
        if (!curr) continue;

        // Neighbor along X
        if (i < nx - 1) {
          const nextX = cagePoints[getIdx(i + 1, j, k)];
          if (nextX) linePoints.push(curr.clone(), nextX.clone());
        }
        // Neighbor along Y
        if (j < ny - 1) {
          const nextY = cagePoints[getIdx(i, j + 1, k)];
          if (nextY) linePoints.push(curr.clone(), nextY.clone());
        }
        // Neighbor along Z
        if (k < nz - 1) {
          const nextZ = cagePoints[getIdx(i, j, k + 1)];
          if (nextZ) linePoints.push(curr.clone(), nextZ.clone());
        }
      }
    }
  }

  const geom = new THREE.BufferGeometry().setFromPoints(linePoints);
  const mat = new THREE.LineBasicMaterial({ color: 0xffa000, linewidth: 2 });
  return new THREE.LineSegments(geom, mat);
}
