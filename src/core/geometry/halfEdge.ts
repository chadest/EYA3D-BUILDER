/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Half-Edge Mesh Topology Representation
 *
 * Direct conversion between Three.js BufferGeometry and Half-Edge data structures.
 * Supports vertex/edge/face adjacency queries, normal computation, and reconstruction.
 */

import * as THREE from 'three';
import { HEMesh, HEVertex, HEEdge, HEFace, HEHalfEdge } from '../../types/editor';

/**
 * Converts a Three.js BufferGeometry into a Half-Edge Mesh data structure.
 */
export function bufferGeometryToHEMesh(geometry: THREE.BufferGeometry): HEMesh {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const numVertices = posAttr.count;

  const vertices: HEVertex[] = [];
  const faces: HEFace[] = [];
  const edges: HEEdge[] = [];
  const halfEdges: HEHalfEdge[] = [];

  // Map position vector string -> HEVertex index to merge coincident vertices
  const vertMap = new Map<string, HEVertex>();

  function getOrCreateVertex(v: THREE.Vector3): HEVertex {
    const key = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
    if (vertMap.has(key)) {
      return vertMap.get(key)!;
    }
    const vert: HEVertex = {
      id: vertices.length,
      position: v.clone(),
      creaseWeight: 0,
    };
    vertices.push(vert);
    vertMap.set(key, vert);
    return vert;
  }

  // Edge lookup map: "vMin_vMax" -> HEHalfEdge
  const edgePairMap = new Map<string, HEHalfEdge>();

  let halfEdgeIdCounter = 0;
  let faceIdCounter = 0;
  let edgeIdCounter = 0;

  // Process triangles (every 3 positions = 1 triangle face)
  for (let i = 0; i < numVertices; i += 3) {
    const p1 = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    const p2 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
    const p3 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);

    const v1 = getOrCreateVertex(p1);
    const v2 = getOrCreateVertex(p2);
    const v3 = getOrCreateVertex(p3);

    // Skip degenerate triangles
    if (v1.id === v2.id || v2.id === v3.id || v3.id === v1.id) continue;

    // Face normal & centroid calculation
    // Math: Normal = (v2 - v1) x (v3 - v1) normalized
    const edgeA = new THREE.Vector3().subVectors(v2.position, v1.position);
    const edgeB = new THREE.Vector3().subVectors(v3.position, v1.position);
    const normal = new THREE.Vector3().crossVectors(edgeA, edgeB).normalize();
    const center = new THREE.Vector3()
      .addVectors(v1.position, v2.position)
      .add(v3.position)
      .divideScalar(3);

    const face: HEFace = {
      id: faceIdCounter++,
      normal,
      center,
    };
    faces.push(face);

    // Create 3 half-edges for the triangle
    const he1: HEHalfEdge = { id: halfEdgeIdCounter++, vertex: v2, face };
    const he2: HEHalfEdge = { id: halfEdgeIdCounter++, vertex: v3, face };
    const he3: HEHalfEdge = { id: halfEdgeIdCounter++, vertex: v1, face };

    he1.next = he2;
    he1.prev = he3;
    he2.next = he3;
    he2.prev = he1;
    he3.next = he1;
    he3.prev = he2;

    face.halfEdge = he1;
    v1.halfEdge = he3;
    v2.halfEdge = he1;
    v3.halfEdge = he2;

    const triangleHEs = [
      { he: he1, start: v1, end: v2 },
      { he: he2, start: v2, end: v3 },
      { he: he3, start: v3, end: v1 },
    ];

    for (const item of triangleHEs) {
      halfEdges.push(item.he);
      const startId = item.start.id;
      const endId = item.end.id;

      // Unordered pair key for full edge
      const edgeKey = startId < endId ? `${startId}_${endId}` : `${endId}_${startId}`;
      const twinKey = `${endId}_${startId}`;

      if (edgePairMap.has(twinKey)) {
        // Twin found
        const twinHE = edgePairMap.get(twinKey)!;
        item.he.twin = twinHE;
        twinHE.twin = item.he;

        if (twinHE.edge) {
          item.he.edge = twinHE.edge;
        }
      } else {
        // Create new full Edge
        const fullEdge: HEEdge = {
          id: edgeIdCounter++,
          halfEdge: item.he,
          creaseWeight: 0,
        };
        item.he.edge = fullEdge;
        edges.push(fullEdge);
        edgePairMap.set(`${startId}_${endId}`, item.he);
      }
    }
  }

  return { vertices, edges, faces, halfEdges };
}

/**
 * Reconstructs a Three.js BufferGeometry from a Half-Edge mesh structure.
 */
export function heMeshToBufferGeometry(heMesh: HEMesh): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const face of heMesh.faces) {
    if (!face.halfEdge) continue;

    // Traverse half-edges around face
    const faceVerts: THREE.Vector3[] = [];
    let current: HEHalfEdge | undefined = face.halfEdge;
    const start = current;

    do {
      if (current) {
        faceVerts.push(current.vertex.position);
        current = current.next;
      }
    } while (current && current !== start && faceVerts.length < 100);

    if (faceVerts.length < 3) continue;

    // Face normal: (v1 - v0) x (v2 - v0)
    const n = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(faceVerts[1], faceVerts[0]),
        new THREE.Vector3().subVectors(faceVerts[2], faceVerts[0])
      )
      .normalize();

    // Triangulate n-gon face (Fan triangulation around vertex 0)
    for (let i = 1; i < faceVerts.length - 1; i++) {
      const v0 = faceVerts[0];
      const v1 = faceVerts[i];
      const v2 = faceVerts[i + 1];

      positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  return geometry;
}
