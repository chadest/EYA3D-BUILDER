/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Catmull-Clark Subdivision Surface Generator
 *
 * Mathematical Formulation:
 *
 * Catmull-Clark recursive surface subdivision algorithm:
 * 1. Face Point (F): Average of all face corner vertex positions.
 *    F_j = (1 / k) * sum_{i=1}^k (v_i)
 *
 * 2. Edge Point (E):
 *    Average of edge midpoint M and centroids of adjacent faces F_1, F_2.
 *    E_j = (F_1 + F_2 + v_a + v_b) / 4
 *    With Crease Weight w in [0.0, 1.0]:
 *    E_sharp = (v_a + v_b) / 2
 *    E_final = (1 - w) * E_j + w * E_sharp
 *
 * 3. Vertex Point (V'):
 *    V' = (Q / n) + (2 * R / n) + ((n - 3) * V / n)
 *    where Q = average of face points of adjacent faces,
 *          R = average of midpoints of adjacent edges,
 *          n = vertex valence (number of incident edges).
 */

import * as THREE from 'three';
import { bufferGeometryToHEMesh, heMeshToBufferGeometry } from '../geometry/halfEdge';
import { HEMesh, HEVertex, HEFace, HEEdge } from '../../types/editor';

/**
 * Executes 1 level of Catmull-Clark subdivision on a Three.js BufferGeometry with edge crease weights.
 */
export function subdivideCatmullClark(
  geometry: THREE.BufferGeometry,
  creaseWeight: number = 0.0
): THREE.BufferGeometry {
  const heMesh = bufferGeometryToHEMesh(geometry);
  const { vertices, faces, edges, halfEdges } = heMesh;

  if (faces.length === 0) return geometry;

  // Step 1: Compute Face Points
  const facePoints = new Map<number, THREE.Vector3>();
  for (const face of faces) {
    facePoints.set(face.id, face.center.clone());
  }

  // Step 2: Compute Edge Points
  const edgePoints = new Map<number, THREE.Vector3>();

  for (const edge of edges) {
    const he = edge.halfEdge;
    if (!he) continue;

    const v1 = he.prev ? he.prev.vertex.position : he.vertex.position;
    const v2 = he.vertex.position;
    const edgeMid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);

    let edgePt: THREE.Vector3;

    if (he.twin && he.face && he.twin.face) {
      const f1 = facePoints.get(he.face.id)!;
      const f2 = facePoints.get(he.twin.face.id)!;
      const smoothPt = new THREE.Vector3()
        .addVectors(f1, f2)
        .add(v1)
        .add(v2)
        .multiplyScalar(0.25);

      // Blend smooth point with sharp edge midpoint using creaseWeight
      const w = Math.min(1.0, Math.max(0.0, edge.creaseWeight + creaseWeight));
      edgePt = smoothPt.clone().multiplyScalar(1 - w).add(edgeMid.clone().multiplyScalar(w));
    } else {
      // Boundary edge is sharp
      edgePt = edgeMid;
    }

    edgePoints.set(edge.id, edgePt);
  }

  // Step 3: Compute Updated Vertex Points
  const newVertexPositions = new Map<number, THREE.Vector3>();

  for (const vert of vertices) {
    // Find all incident faces and edges around vertex
    const incidentFaces: HEFace[] = [];
    const incidentEdges: HEEdge[] = [];

    for (const he of halfEdges) {
      if (he.vertex.id === vert.id) {
        if (he.face && !incidentFaces.includes(he.face)) incidentFaces.push(he.face);
        if (he.edge && !incidentEdges.includes(he.edge)) incidentEdges.push(he.edge);
      }
    }

    const n = incidentEdges.length;
    if (n === 0) {
      newVertexPositions.set(vert.id, vert.position.clone());
      continue;
    }

    // Average of adjacent face points (Q)
    const Q = new THREE.Vector3();
    for (const f of incidentFaces) {
      const fp = facePoints.get(f.id);
      if (fp) Q.add(fp);
    }
    if (incidentFaces.length > 0) Q.divideScalar(incidentFaces.length);

    // Average of adjacent edge midpoints (R)
    const R = new THREE.Vector3();
    for (const e of incidentEdges) {
      const ep = edgePoints.get(e.id);
      if (ep) R.add(ep);
    }
    if (incidentEdges.length > 0) R.divideScalar(incidentEdges.length);

    // V' = (Q / n) + (2 * R / n) + ((n - 3) * V / n)
    const smoothPos = Q.clone()
      .add(R.clone().multiplyScalar(2))
      .add(vert.position.clone().multiplyScalar(n - 3))
      .divideScalar(n);

    // Apply crease blend on vertex position if crease weight is active
    const w = Math.min(1.0, Math.max(0.0, creaseWeight));
    const finalPos = smoothPos.clone().multiplyScalar(1 - w).add(vert.position.clone().multiplyScalar(w));

    newVertexPositions.set(vert.id, finalPos);
  }

  // Step 4: Rebuild Subdivided Mesh Faces
  const newPositions: number[] = [];

  for (const face of faces) {
    const fPt = facePoints.get(face.id)!;

    // Triangle corners
    if (!face.halfEdge) continue;

    let curr: typeof face.halfEdge | undefined = face.halfEdge;
    const startHE = curr;

    do {
      if (!curr || !curr.edge || !curr.prev || !curr.prev.edge) break;

      const vPos = newVertexPositions.get(curr.vertex.id)!;
      const ePt1 = edgePoints.get(curr.edge.id)!;
      const ePt2 = edgePoints.get(curr.prev.edge.id)!;

      // Create new sub-quad for each corner: fPt -> ePt1 -> vPos -> ePt2
      // Tri 1: fPt, ePt1, vPos
      newPositions.push(fPt.x, fPt.y, fPt.z, ePt1.x, ePt1.y, ePt1.z, vPos.x, vPos.y, vPos.z);
      // Tri 2: fPt, vPos, ePt2
      newPositions.push(fPt.x, fPt.y, fPt.z, vPos.x, vPos.y, vPos.z, ePt2.x, ePt2.y, ePt2.z);

      curr = curr.next;
    } while (curr && curr !== startHE);
  }

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}
