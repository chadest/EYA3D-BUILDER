/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Constructive Solid Geometry (CSG) Boolean Module
 *
 * Provides real-time CSG boolean operations between 3D solid meshes:
 * 1. Union (Addition) A U B
 * 2. Difference (Subtraction) A \ B
 * 3. Intersection A n B
 */

import * as THREE from 'three';
import { Evaluator, Operation, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { CSGOperation } from '../../types/editor';

const evaluator = new Evaluator();

/**
 * Performs CSG Boolean operation between two meshes and returns resulting Mesh.
 */
export function performCSGOperation(
  meshA: THREE.Mesh,
  meshB: THREE.Mesh,
  operation: CSGOperation
): THREE.Mesh {
  meshA.updateMatrixWorld(true);
  meshB.updateMatrixWorld(true);

  // Prepare CSG Operation nodes
  const opA = new Operation(meshA.geometry, meshA.material);
  opA.matrix.copy(meshA.matrixWorld);

  const opB = new Operation(meshB.geometry, meshB.material);
  opB.matrix.copy(meshB.matrixWorld);

  let opType = ADDITION;
  if (operation === 'subtract') opType = SUBTRACTION;
  if (operation === 'intersect') opType = INTERSECTION;

  // Execute Evaluator CSG calculation: evaluate(a, b, operation)
  const resultCSG = evaluator.evaluate(opA, opB, opType);
  resultCSG.geometry.computeVertexNormals();

  const resultMesh = new THREE.Mesh(
    resultCSG.geometry.clone(),
    Array.isArray(meshA.material) ? meshA.material[0].clone() : meshA.material.clone()
  );

  resultMesh.position.set(0, 0, 0);
  resultMesh.rotation.set(0, 0, 0);
  resultMesh.scale.set(1, 1, 1);
  resultMesh.updateMatrix();

  return resultMesh;
}
