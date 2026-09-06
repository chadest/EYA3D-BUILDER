/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - 3D Measurement Visual Line & Marker Renderer
 */

import * as THREE from 'three';
import { MeasurementItem } from '../../types/measurement';

/**
 * Updates a Three.js Group with crisp, high-visibility 3D measurement lines and end markers.
 */
export function update3DMeasurementScene(
  measurementsGroup: THREE.Group,
  measurements: MeasurementItem[],
  liveStart: THREE.Vector3 | null,
  liveHover: THREE.Vector3 | null,
  selectedId: string | null = null
) {
  // Dispose previous children
  while (measurementsGroup.children.length > 0) {
    const child = measurementsGroup.children[0];
    measurementsGroup.remove(child);
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    if ((child as THREE.Mesh).material) {
      const mat = (child as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else mat.dispose();
    }
  }

  const endpointGeom = new THREE.SphereGeometry(0.035, 12, 12);
  const regularMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
  const selectedMat = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false });
  const liveMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false });

  // 1. RENDER SAVED MEASUREMENTS
  for (const m of measurements) {
    const isSelected = selectedId === m.id;
    const p1 = new THREE.Vector3(m.start.position[0], m.start.position[1], m.start.position[2]);
    const p2 = new THREE.Vector3(m.end.position[0], m.end.position[1], m.end.position[2]);

    const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const lineMat = new THREE.LineBasicMaterial({
      color: isSelected ? 0x6ee7b7 : 0x10b981,
      linewidth: 2,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.renderOrder = 998;
    measurementsGroup.add(line);

    // End point spherical nodes
    const m1 = new THREE.Mesh(endpointGeom, isSelected ? selectedMat : regularMat);
    m1.position.copy(p1);
    m1.renderOrder = 999;
    measurementsGroup.add(m1);

    const m2 = new THREE.Mesh(endpointGeom, isSelected ? selectedMat : regularMat);
    m2.position.copy(p2);
    m2.renderOrder = 999;
    measurementsGroup.add(m2);

    // Perpendicular End Ticks for CAD dimension aesthetic
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    let perp = new THREE.Vector3(0, 1, 0).cross(dir);
    if (perp.lengthSq() < 0.01) {
      perp = new THREE.Vector3(1, 0, 0).cross(dir);
    }
    perp.normalize().multiplyScalar(0.08);

    const tick1Geom = new THREE.BufferGeometry().setFromPoints([
      p1.clone().add(perp),
      p1.clone().sub(perp),
    ]);
    const tick2Geom = new THREE.BufferGeometry().setFromPoints([
      p2.clone().add(perp),
      p2.clone().sub(perp),
    ]);

    const tick1 = new THREE.Line(tick1Geom, lineMat);
    tick1.renderOrder = 998;
    const tick2 = new THREE.Line(tick2Geom, lineMat);
    tick2.renderOrder = 998;
    measurementsGroup.add(tick1);
    measurementsGroup.add(tick2);
  }

  // 2. RENDER LIVE IN-PROGRESS MEASURING SEGMENT
  if (liveStart && liveHover) {
    const liveGeom = new THREE.BufferGeometry().setFromPoints([liveStart, liveHover]);
    const liveLineMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.1,
      gapSize: 0.05,
      linewidth: 2,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const liveLine = new THREE.Line(liveGeom, liveLineMat);
    liveLine.computeLineDistances();
    liveLine.renderOrder = 999;
    measurementsGroup.add(liveLine);

    // Start anchor node
    const startMesh = new THREE.Mesh(endpointGeom, liveMat);
    startMesh.position.copy(liveStart);
    startMesh.renderOrder = 999;
    measurementsGroup.add(startMesh);

    // Hover destination node
    const hoverMesh = new THREE.Mesh(endpointGeom, liveMat);
    hoverMesh.position.copy(liveHover);
    hoverMesh.renderOrder = 999;
    measurementsGroup.add(hoverMesh);
  }
}
