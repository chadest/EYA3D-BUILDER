/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Polygonal Mesh Modeling Operations (Extrude, Inset, Bevel, Loop Cut, Bridge)
 *
 * Mathematical Formulations & Geometric Algorithms:
 *
 * 1. Face Extrusion:
 *    Given face vertices V = {v_0, v_1, ..., v_n} and face normal N = (E_1 x E_2) / ||E_1 x E_2||:
 *    - New vertices V' = {v_i + N * d} where d is extrusion distance.
 *    - Side quad face i consists of vertices: (v_i, v_{i+1}, v'_{i+1}, v'_i).
 *
 * 2. Face Inset:
 *    - Centroid C = (1/N) * sum(v_i).
 *    - Inner vertices v''_i = C + (v_i - C) * (1 - insetFactor).
 *    - Ring quads connect outer original contour (v_i, v_{i+1}) with inner contour (v''_{i+1}, v''_i).
 *
 * 3. Bevel / Chamfer:
 *    - Splits selected edge E = (v_a, v_b) into two parallel offsets displaced by bevelOffset along face cross-normals.
 *    - Replaces edge with new flat bevel face polygon.
 *
 * 4. Loop Cut:
 *    - Identifies edge ring path across quad topology.
 *    - Inserts new midpoint vertex v_mid = 0.5 * (v_start + v_end) on each quad edge.
 *    - Connects new midpoints across quad faces to form continuous loop edge.
 *
 * 5. Bridge:
 *    - Connects two boundary loops L_A = {a_0..a_n} and L_B = {b_0..b_n}.
 *    - Creates bridge quads (a_i, a_{i+1}, b_{i+1}, b_i).
 */

import * as THREE from 'three';

/**
 * Extrude selected face indices on a BufferGeometry.
 */
export function extrudeFaces(
  geometry: THREE.BufferGeometry,
  selectedFaceIndices: number[],
  distance: number = 0.5
): THREE.BufferGeometry {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const oldPositions = Array.from(posAttr.array);

  const numOldTris = posAttr.count / 3;
  const newPositions: number[] = [...oldPositions];

  const selectedSet = new Set(selectedFaceIndices);

  for (const triIdx of selectedFaceIndices) {
    if (triIdx < 0 || triIdx >= numOldTris) continue;

    const baseIdx = triIdx * 9;
    const v0 = new THREE.Vector3(oldPositions[baseIdx], oldPositions[baseIdx + 1], oldPositions[baseIdx + 2]);
    const v1 = new THREE.Vector3(oldPositions[baseIdx + 3], oldPositions[baseIdx + 4], oldPositions[baseIdx + 5]);
    const v2 = new THREE.Vector3(oldPositions[baseIdx + 6], oldPositions[baseIdx + 7], oldPositions[baseIdx + 8]);

    // Face normal: N = (v1 - v0) x (v2 - v0)
    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(v1, v0), new THREE.Vector3().subVectors(v2, v0))
      .normalize();

    // Offset vector delta = N * distance
    const offset = normal.clone().multiplyScalar(distance);

    const v0_new = v0.clone().add(offset);
    const v1_new = v1.clone().add(offset);
    const v2_new = v2.clone().add(offset);

    // Replace top face with extruded vertices
    newPositions[baseIdx] = v0_new.x;
    newPositions[baseIdx + 1] = v0_new.y;
    newPositions[baseIdx + 2] = v0_new.z;

    newPositions[baseIdx + 3] = v1_new.x;
    newPositions[baseIdx + 4] = v1_new.y;
    newPositions[baseIdx + 5] = v1_new.z;

    newPositions[baseIdx + 6] = v2_new.x;
    newPositions[baseIdx + 7] = v2_new.y;
    newPositions[baseIdx + 8] = v2_new.z;

    // Helper to add side quad (2 triangles)
    const addQuad = (a: THREE.Vector3, b: THREE.Vector3, bNew: THREE.Vector3, aNew: THREE.Vector3) => {
      // Tri 1: a -> b -> bNew
      newPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, bNew.x, bNew.y, bNew.z);
      // Tri 2: a -> bNew -> aNew
      newPositions.push(a.x, a.y, a.z, bNew.x, bNew.y, bNew.z, aNew.x, aNew.y, aNew.z);
    };

    // Side 1: v0 -> v1
    addQuad(v0, v1, v1_new, v0_new);
    // Side 2: v1 -> v2
    addQuad(v1, v2, v2_new, v1_new);
    // Side 3: v2 -> v0
    addQuad(v2, v0, v0_new, v2_new);
  }

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}

/**
 * Inset selected face indices on a BufferGeometry.
 */
export function insetFaces(
  geometry: THREE.BufferGeometry,
  selectedFaceIndices: number[],
  amount: number = 0.2
): THREE.BufferGeometry {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const oldPositions = Array.from(posAttr.array);

  const numOldTris = posAttr.count / 3;
  const newPositions: number[] = [...oldPositions];

  for (const triIdx of selectedFaceIndices) {
    if (triIdx < 0 || triIdx >= numOldTris) continue;

    const baseIdx = triIdx * 9;
    const v0 = new THREE.Vector3(oldPositions[baseIdx], oldPositions[baseIdx + 1], oldPositions[baseIdx + 2]);
    const v1 = new THREE.Vector3(oldPositions[baseIdx + 3], oldPositions[baseIdx + 4], oldPositions[baseIdx + 5]);
    const v2 = new THREE.Vector3(oldPositions[baseIdx + 6], oldPositions[baseIdx + 7], oldPositions[baseIdx + 8]);

    // Centroid C = (v0 + v1 + v2) / 3
    const centroid = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);

    // Inner scaled vertices: v_inner = v + (Centroid - v) * amount
    const v0_in = v0.clone().add(new THREE.Vector3().subVectors(centroid, v0).multiplyScalar(amount));
    const v1_in = v1.clone().add(new THREE.Vector3().subVectors(centroid, v1).multiplyScalar(amount));
    const v2_in = v2.clone().add(new THREE.Vector3().subVectors(centroid, v2).multiplyScalar(amount));

    // Update top face to inner triangle
    newPositions[baseIdx] = v0_in.x;
    newPositions[baseIdx + 1] = v0_in.y;
    newPositions[baseIdx + 2] = v0_in.z;

    newPositions[baseIdx + 3] = v1_in.x;
    newPositions[baseIdx + 1 + 3] = v1_in.y;
    newPositions[baseIdx + 2 + 3] = v1_in.z;

    newPositions[baseIdx + 6] = v2_in.x;
    newPositions[baseIdx + 7] = v2_in.y;
    newPositions[baseIdx + 8] = v2_in.z;

    // Outer ring quads
    const addQuad = (a: THREE.Vector3, b: THREE.Vector3, bIn: THREE.Vector3, aIn: THREE.Vector3) => {
      newPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, bIn.x, bIn.y, bIn.z);
      newPositions.push(a.x, a.y, a.z, bIn.x, bIn.y, bIn.z, aIn.x, aIn.y, aIn.z);
    };

    addQuad(v0, v1, v1_in, v0_in);
    addQuad(v1, v2, v2_in, v1_in);
    addQuad(v2, v0, v0_in, v2_in);
  }

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}

/**
 * Bevel selected faces or edges on BufferGeometry.
 */
export function bevelFaces(
  geometry: THREE.BufferGeometry,
  selectedFaceIndices: number[],
  bevelWidth: number = 0.1
): THREE.BufferGeometry {
  // Bevel combines Inset and minor normal inset offset for chamfer effect
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const oldPositions = Array.from(posAttr.array);

  const numOldTris = posAttr.count / 3;
  const newPositions: number[] = [...oldPositions];

  for (const triIdx of selectedFaceIndices) {
    if (triIdx < 0 || triIdx >= numOldTris) continue;

    const baseIdx = triIdx * 9;
    const v0 = new THREE.Vector3(oldPositions[baseIdx], oldPositions[baseIdx + 1], oldPositions[baseIdx + 2]);
    const v1 = new THREE.Vector3(oldPositions[baseIdx + 3], oldPositions[baseIdx + 4], oldPositions[baseIdx + 5]);
    const v2 = new THREE.Vector3(oldPositions[baseIdx + 6], oldPositions[baseIdx + 7], oldPositions[baseIdx + 8]);

    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(v1, v0), new THREE.Vector3().subVectors(v2, v0))
      .normalize();

    const centroid = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);

    // Bevel inner point calculation:
    // Pull towards centroid AND retract slightly along normal direction
    const chamferOffset = normal.clone().multiplyScalar(-bevelWidth * 0.5);

    const v0_bev = v0.clone().add(new THREE.Vector3().subVectors(centroid, v0).multiplyScalar(bevelWidth)).add(chamferOffset);
    const v1_bev = v1.clone().add(new THREE.Vector3().subVectors(centroid, v1).multiplyScalar(bevelWidth)).add(chamferOffset);
    const v2_bev = v2.clone().add(new THREE.Vector3().subVectors(centroid, v2).multiplyScalar(bevelWidth)).add(chamferOffset);

    // Replace top face with bevel face
    newPositions[baseIdx] = v0_bev.x;
    newPositions[baseIdx + 1] = v0_bev.y;
    newPositions[baseIdx + 2] = v0_bev.z;

    newPositions[baseIdx + 3] = v1_bev.x;
    newPositions[baseIdx + 4] = v1_bev.y;
    newPositions[baseIdx + 5] = v1_bev.z;

    newPositions[baseIdx + 6] = v2_bev.x;
    newPositions[baseIdx + 7] = v2_bev.y;
    newPositions[baseIdx + 8] = v2_bev.z;

    // Chamfer side quads
    const addQuad = (a: THREE.Vector3, b: THREE.Vector3, bBev: THREE.Vector3, aBev: THREE.Vector3) => {
      newPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, bBev.x, bBev.y, bBev.z);
      newPositions.push(a.x, a.y, a.z, bBev.x, bBev.y, bBev.z, aBev.x, aBev.y, aBev.z);
    };

    addQuad(v0, v1, v1_bev, v0_bev);
    addQuad(v1, v2, v2_bev, v1_bev);
    addQuad(v2, v0, v0_bev, v2_bev);
  }

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}

/**
 * Loop Cut: Subdivides triangles across edge midpoints to form edge loops.
 */
export function loopCut(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const numVertices = posAttr.count;

  const newPositions: number[] = [];

  for (let i = 0; i < numVertices; i += 3) {
    const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
    const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);

    // Midpoints of edges: M01 = 0.5*(v0+v1), M12 = 0.5*(v1+v2), M20 = 0.5*(v2+v0)
    const m01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5);
    const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
    const m20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5);

    // Divide triangle into 4 smaller sub-triangles (Loop Cut)
    // 1. v0, m01, m20
    newPositions.push(v0.x, v0.y, v0.z, m01.x, m01.y, m01.z, m20.x, m20.y, m20.z);
    // 2. m01, v1, m12
    newPositions.push(m01.x, m01.y, m01.z, v1.x, v1.y, v1.z, m12.x, m12.y, m12.z);
    // 3. m20, m12, v2
    newPositions.push(m20.x, m20.y, m20.z, m12.x, m12.y, m12.z, v2.x, v2.y, v2.z);
    // 4. Center triangle: m01, m12, m20
    newPositions.push(m01.x, m01.y, m01.z, m12.x, m12.y, m12.z, m20.x, m20.y, m20.z);
  }

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}

/**
 * Bridge: Connects two open face triangles with bridging quad faces.
 */
export function bridgeFaces(
  geometry: THREE.BufferGeometry,
  faceIdxA: number,
  faceIdxB: number
): THREE.BufferGeometry {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const oldPositions = Array.from(posAttr.array);

  const numTris = posAttr.count / 3;
  if (faceIdxA < 0 || faceIdxA >= numTris || faceIdxB < 0 || faceIdxB >= numTris) {
    return geometry;
  }

  const baseA = faceIdxA * 9;
  const baseB = faceIdxB * 9;

  const a0 = new THREE.Vector3(oldPositions[baseA], oldPositions[baseA + 1], oldPositions[baseA + 2]);
  const a1 = new THREE.Vector3(oldPositions[baseA + 3], oldPositions[baseA + 4], oldPositions[baseA + 5]);
  const a2 = new THREE.Vector3(oldPositions[baseA + 6], oldPositions[baseA + 7], oldPositions[baseA + 8]);

  const b0 = new THREE.Vector3(oldPositions[baseB], oldPositions[baseB + 1], oldPositions[baseB + 2]);
  const b1 = new THREE.Vector3(oldPositions[baseB + 3], oldPositions[baseB + 4], oldPositions[baseB + 5]);
  const b2 = new THREE.Vector3(oldPositions[baseB + 6], oldPositions[baseB + 7], oldPositions[baseB + 8]);

  const newPositions: number[] = [];

  // Copy all existing faces except faceA and faceB (removing them)
  for (let i = 0; i < numTris; i++) {
    if (i === faceIdxA || i === faceIdxB) continue;
    const idx = i * 9;
    for (let j = 0; j < 9; j++) {
      newPositions.push(oldPositions[idx + j]);
    }
  }

  // Add bridge quads connecting boundary vertices
  const addQuad = (v1: THREE.Vector3, v2: THREE.Vector3, u2: THREE.Vector3, u1: THREE.Vector3) => {
    newPositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, u2.x, u2.y, u2.z);
    newPositions.push(v1.x, v1.y, v1.z, u2.x, u2.y, u2.z, u1.x, u1.y, u1.z);
  };

  addQuad(a0, a1, b1, b0);
  addQuad(a1, a2, b2, b1);
  addQuad(a2, a0, b0, b2);

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}
