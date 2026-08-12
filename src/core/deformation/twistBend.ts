/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Deformation Tools: Twist & Bend
 *
 * Mathematical Formulations:
 *
 * 1. Twist Deformation:
 *    Let y in [y_min, y_max] be the local height coordinate along Y-axis.
 *    Normalized height h = (y - y_min) / (y_max - y_min) in [0, 1].
 *    Rotation angle theta(h) = h * totalAngle.
 *    [ x' ]   [ cos(theta)   0   sin(theta) ] [ x ]
 *    [ y' ] = [      0       1        0     ] [ y ]
 *    [ z' ]   [ -sin(theta)  0   cos(theta) ] [ z ]
 *
 * 2. Bend Deformation:
 *    Bends mesh along arc of radius R = Height / Angle:
 *    theta = h * totalAngle
 *    x' = x
 *    y' = (R - z) * sin(theta)
 *    z' = (R - z) * cos(theta) - R
 */

import * as THREE from 'three';

/**
 * Applies Twist progressive rotation around local axis to BufferGeometry.
 */
export function applyTwist(
  geometry: THREE.BufferGeometry,
  angleDegrees: number,
  axis: 'x' | 'y' | 'z' = 'y'
): THREE.BufferGeometry {
  if (Math.abs(angleDegrees) < 0.01) return geometry;

  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;

  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  const minVal = axis === 'x' ? bbox.min.x : axis === 'y' ? bbox.min.y : bbox.min.z;
  const maxVal = axis === 'x' ? bbox.max.x : axis === 'y' ? bbox.max.y : bbox.max.z;
  const height = maxVal - minVal;
  if (height <= 0.0001) return geometry;

  const angleRad = (angleDegrees * Math.PI) / 180;
  const vPos = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    vPos.fromBufferAttribute(posAttr, i);

    const val = axis === 'x' ? vPos.x : axis === 'y' ? vPos.y : vPos.z;
    const h = (val - minVal) / height; // [0, 1]
    const theta = h * angleRad;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    if (axis === 'y') {
      const rx = vPos.x * cosT - vPos.z * sinT;
      const rz = vPos.x * sinT + vPos.z * cosT;
      vPos.x = rx;
      vPos.z = rz;
    } else if (axis === 'x') {
      const ry = vPos.y * cosT - vPos.z * sinT;
      const rz = vPos.y * sinT + vPos.z * cosT;
      vPos.y = ry;
      vPos.z = rz;
    } else {
      const rx = vPos.x * cosT - vPos.y * sinT;
      const ry = vPos.x * sinT + vPos.y * cosT;
      vPos.x = rx;
      vPos.y = ry;
    }

    posAttr.setXYZ(i, vPos.x, vPos.y, vPos.z);
  }

  posAttr.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Applies Bend arc deformation along local height axis.
 */
export function applyBend(
  geometry: THREE.BufferGeometry,
  angleDegrees: number,
  axis: 'x' | 'y' | 'z' = 'y'
): THREE.BufferGeometry {
  if (Math.abs(angleDegrees) < 0.01) return geometry;

  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;

  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  const minVal = axis === 'x' ? bbox.min.x : axis === 'y' ? bbox.min.y : bbox.min.z;
  const maxVal = axis === 'x' ? bbox.max.x : axis === 'y' ? bbox.max.y : bbox.max.z;
  const height = maxVal - minVal;
  if (height <= 0.0001) return geometry;

  const angleRad = (angleDegrees * Math.PI) / 180;
  const radius = height / angleRad;

  const vPos = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    vPos.fromBufferAttribute(posAttr, i);

    const val = axis === 'x' ? vPos.x : axis === 'y' ? vPos.y : vPos.z;
    const h = (val - minVal) / height; // [0, 1]
    const theta = h * angleRad;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    if (axis === 'y') {
      const r = radius - vPos.z;
      vPos.y = r * sinT + minVal;
      vPos.z = radius - r * cosT;
    }

    posAttr.setXYZ(i, vPos.x, vPos.y, vPos.z);
  }

  posAttr.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}
