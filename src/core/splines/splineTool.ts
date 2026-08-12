/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Splines & NURBS Module (Curve Drafting, Lathe Revolution, Sweep / Loft)
 *
 * Mathematical Formulations:
 *
 * 1. Catmull-Rom Curve 3D Interpolation:
 *    P(t) = 0.5 * [ (2 P_1) + (-P_0 + P_2) t + (2 P_0 - 5 P_1 + 4 P_2 - P_3) t^2 + (-P_0 + 3 P_1 - 3 P_2 + P_3) t^3 ]
 *
 * 2. Lathe Revolution:
 *    Rotates 2D curve points (x_i, y_i) around Y-axis by angle theta in [0, 2pi]:
 *    (X, Y, Z) = (x_i * cos(theta), y_i, x_i * sin(theta))
 *
 * 3. Sweep / Loft (Extrude along Path):
 *    Extrudes 2D cross-section shape S along 3D space curve C(t) with Frenet-Serret frame alignment:
 *    Tangents T(t), Normals N(t), Binormals B(t) = T(t) x N(t).
 */

import * as THREE from 'three';

/**
 * Creates a smooth 3D curve object from control points.
 */
export function createCatmullRomCurve(controlPoints: THREE.Vector3[]): THREE.CatmullRomCurve3 | null {
  if (controlPoints.length < 2) return null;
  return new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5);
}

/**
 * Generates a visual Line mesh representing the 3D Spline Curve.
 */
export function buildCurveLineMesh(curve: THREE.CatmullRomCurve3, segments: number = 64): THREE.Line {
  const points = curve.getPoints(segments);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 3 });
  return new THREE.Line(geometry, material);
}

/**
 * Generates a 360-degree Lathe Revolution mesh geometry from curve control points.
 */
export function createLatheFromCurve(
  points: THREE.Vector3[],
  segments: number = 32,
  phiLength: number = Math.PI * 2
): THREE.BufferGeometry {
  if (points.length < 2) {
    return new THREE.CylinderGeometry(1, 1, 2, 32);
  }

  // Convert 3D points into 2D Vector2 array for Lathe (X -> radius, Y -> height)
  const points2D = points.map(p => new THREE.Vector2(Math.abs(p.x), p.y));

  // Sort by Y ascending for clean manifold lathe topology
  points2D.sort((a, b) => a.y - b.y);

  const latheGeom = new THREE.LatheGeometry(points2D, segments, 0, phiLength);
  latheGeom.computeVertexNormals();
  return latheGeom;
}

/**
 * Extrudes a closed 2D shape along a 3D Spline trajectory (Sweep/Loft).
 */
export function createSweepMeshFromCurve(
  curve: THREE.CatmullRomCurve3,
  radius: number = 0.3,
  radialSegments: number = 16,
  tubularSegments: number = 64
): THREE.BufferGeometry {
  const tubeGeom = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  tubeGeom.computeVertexNormals();
  return tubeGeom;
}

/**
 * Extrudes a custom 2D shape (e.g. star, polygon, rectangle) along 3D path curve.
 */
export function createExtrudeAlongPath(
  pathCurve: THREE.CatmullRomCurve3,
  shape2D?: THREE.Shape,
  steps: number = 64
): THREE.BufferGeometry {
  // Default shape: Rounded star/polygon if not specified
  let shape = shape2D;
  if (!shape) {
    shape = new THREE.Shape();
    const radius = 0.4;
    const sides = 6;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
  }

  const extrudeSettings = {
    steps,
    bevelEnabled: false,
    extrudePath: pathCurve,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.computeVertexNormals();
  return geom;
}
