/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Parametric & Procedural Modifiers (Array, Mirror, Modifier Stack Pipeline)
 *
 * Mathematical Formulations:
 *
 * 1. Array Modifier:
 *    Generates N instances at linear offsets delta_pos = k * (dx, dy, dz) for k = 0..Count-1:
 *    v_{k, i} = v_i + k * delta_pos
 *
 * 2. Mirror Modifier:
 *    Reflects mesh across axis plane (e.g. X-axis: S_x = [-1 0 0; 0 1 0; 0 0 1]):
 *    v_mirrored = S_axis * v
 *    Winding order is inverted (v_0, v_1, v_2 -> v_0, v_2, v_1) to ensure outward-pointing normals.
 *    Auto-merges vertices where |v_axis| < MergeThreshold.
 */

import * as THREE from 'three';
import {
  ArrayModifierConfig,
  MirrorModifierConfig,
  SubDModifierConfig,
  TwistModifierConfig,
  BendModifierConfig,
  LatticeModifierConfig,
  ModifierConfig,
} from '../../types/editor';
import { subdivideCatmullClark } from '../subd/catmullClark';
import { applyTwist, applyBend } from '../deformation/twistBend';
import { applyLatticeDeformation } from '../deformation/lattice';

/**
 * Applies Array Modifier to BufferGeometry.
 */
export function applyArrayModifier(
  geometry: THREE.BufferGeometry,
  config: ArrayModifierConfig
): THREE.BufferGeometry {
  if (!config.enabled || config.count <= 1) return geometry;

  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  const oldPositions = Array.from(posAttr.array);
  const newPositions: number[] = [];

  const [dx, dy, dz] = config.offset;

  for (let k = 0; k < config.count; k++) {
    const offsetX = k * dx;
    const offsetY = k * dy;
    const offsetZ = k * dz;

    for (let i = 0; i < count; i++) {
      const x = oldPositions[i * 3] + offsetX;
      const y = oldPositions[i * 3 + 1] + offsetY;
      const z = oldPositions[i * 3 + 2] + offsetZ;
      newPositions.push(x, y, z);
    }
  }

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}

/**
 * Applies Mirror Modifier to BufferGeometry across chosen axis with face winding inversion and vertex merging.
 */
export function applyMirrorModifier(
  geometry: THREE.BufferGeometry,
  config: MirrorModifierConfig
): THREE.BufferGeometry {
  if (!config.enabled) return geometry;

  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  const oldPositions = Array.from(posAttr.array);
  const newPositions: number[] = [...oldPositions];

  const scaleX = config.axis === 'x' ? -1 : 1;
  const scaleY = config.axis === 'y' ? -1 : 1;
  const scaleZ = config.axis === 'z' ? -1 : 1;

  // Append mirrored faces with inverted winding order
  for (let i = 0; i < count; i += 3) {
    const p0 = new THREE.Vector3(
      oldPositions[i * 3] * scaleX,
      oldPositions[i * 3 + 1] * scaleY,
      oldPositions[i * 3 + 2] * scaleZ
    );
    const p1 = new THREE.Vector3(
      oldPositions[(i + 1) * 3] * scaleX,
      oldPositions[(i + 1) * 3 + 1] * scaleY,
      oldPositions[(i + 1) * 3 + 2] * scaleZ
    );
    const p2 = new THREE.Vector3(
      oldPositions[(i + 2) * 3] * scaleX,
      oldPositions[(i + 2) * 3 + 1] * scaleY,
      oldPositions[(i + 2) * 3 + 2] * scaleZ
    );

    // Merge vertices on mirror plane if below merge threshold
    const snap = (v: THREE.Vector3) => {
      if (config.mergeVertices) {
        if (config.axis === 'x' && Math.abs(v.x) < config.mergeThreshold) v.x = 0;
        if (config.axis === 'y' && Math.abs(v.y) < config.mergeThreshold) v.y = 0;
        if (config.axis === 'z' && Math.abs(v.z) < config.mergeThreshold) v.z = 0;
      }
    };
    snap(p0);
    snap(p1);
    snap(p2);

    // Swap p1 and p2 for triangle winding reversal
    newPositions.push(p0.x, p0.y, p0.z);
    newPositions.push(p2.x, p2.y, p2.z);
    newPositions.push(p1.x, p1.y, p1.z);
  }

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  resultGeom.computeVertexNormals();
  return resultGeom;
}

/**
 * Executes full Modifier Stack sequentially on source geometry:
 * Pipeline: Input -> Array -> Mirror -> SubD -> Twist -> Bend -> Lattice -> Output
 */
export function processModifierStack(
  sourceGeometry: THREE.BufferGeometry,
  modifiers: ModifierConfig[]
): THREE.BufferGeometry {
  let currentGeom = sourceGeometry.clone();

  for (const mod of modifiers) {
    if (!mod.enabled) continue;

    switch (mod.type) {
      case 'array':
        currentGeom = applyArrayModifier(currentGeom, mod as ArrayModifierConfig);
        break;
      case 'mirror':
        currentGeom = applyMirrorModifier(currentGeom, mod as MirrorModifierConfig);
        break;
      case 'subd': {
        const cfg = mod as SubDModifierConfig;
        for (let lvl = 0; lvl < cfg.levels; lvl++) {
          currentGeom = subdivideCatmullClark(currentGeom, cfg.creaseWeight);
        }
        break;
      }
      case 'twist': {
        const cfg = mod as TwistModifierConfig;
        currentGeom = applyTwist(currentGeom, cfg.angle, cfg.axis);
        break;
      }
      case 'bend': {
        const cfg = mod as BendModifierConfig;
        currentGeom = applyBend(currentGeom, cfg.angle, cfg.axis);
        break;
      }
      case 'lattice': {
        const cfg = mod as LatticeModifierConfig;
        currentGeom = applyLatticeDeformation(currentGeom, cfg.resolution, cfg.points);
        break;
      }
    }
  }

  return currentGeom;
}
