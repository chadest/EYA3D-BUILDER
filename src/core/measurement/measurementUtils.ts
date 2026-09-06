/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - 3D Measurement & Dimension Utilities
 */

import * as THREE from 'three';
import { MeasurementUnit, SnapTargetType, MeasureSnapSettings, MeasurementPoint } from '../../types/measurement';

/**
 * Formats a raw distance in meters (Three.js world units) according to the chosen display unit.
 */
export function formatDistance(distanceInMeters: number, unit: MeasurementUnit = 'm'): string {
  if (isNaN(distanceInMeters) || distanceInMeters < 0) return '0.000 m';

  switch (unit) {
    case 'cm':
      return `${(distanceInMeters * 100).toFixed(1)} cm`;
    case 'mm':
      return `${(distanceInMeters * 1000).toFixed(0)} mm`;
    case 'in':
      return `${(distanceInMeters * 39.3700787).toFixed(2)} in`;
    case 'ft': {
      const totalInches = distanceInMeters * 39.3700787;
      const feet = Math.floor(totalInches / 12);
      const inches = (totalInches % 12).toFixed(1);
      return `${feet}' ${inches}" (${(distanceInMeters * 3.28084).toFixed(2)} ft)`;
    }
    case 'units':
      return `${distanceInMeters.toFixed(3)} u`;
    case 'm':
    default:
      if (distanceInMeters >= 100) return `${distanceInMeters.toFixed(1)} m`;
      if (distanceInMeters >= 10) return `${distanceInMeters.toFixed(2)} m`;
      return `${distanceInMeters.toFixed(3)} m`;
  }
}

/**
 * Converts a value from a specified unit back to world meters.
 */
export function convertToMeters(value: number, unit: MeasurementUnit): number {
  switch (unit) {
    case 'cm':
      return value / 100;
    case 'mm':
      return value / 1000;
    case 'in':
      return value / 39.3700787;
    case 'ft':
      return value / 3.28084;
    case 'units':
    case 'm':
    default:
      return value;
  }
}

/**
 * Calculates Euclidean 3D distance and component deltas (DeltaX, DeltaY, DeltaZ)
 */
export function calculateMeasureData(p1: THREE.Vector3, p2: THREE.Vector3) {
  const distance = p1.distanceTo(p2);
  const deltaX = Math.abs(p2.x - p1.x);
  const deltaY = Math.abs(p2.y - p1.y);
  const deltaZ = Math.abs(p2.z - p1.z);
  return { distance, deltaX, deltaY, deltaZ };
}

export interface RaycastSnapResult {
  point: THREE.Vector3;
  snappedTo: SnapTargetType;
  objectId?: string;
  objectName?: string;
  normal?: THREE.Vector3;
  distanceFromCamera: number;
}

/**
 * Raycasts the scene with intelligent geometric snapping to vertices, edges, face surfaces, or ground grid.
 */
export function raycastSmartSnap(
  raycaster: THREE.Raycaster,
  candidateObjects: THREE.Object3D[],
  camera: THREE.Camera,
  containerWidth: number,
  containerHeight: number,
  snapSettings: MeasureSnapSettings = {
    snapToVertices: true,
    snapToEdges: true,
    snapToFaces: true,
    snapToGrid: true,
  }
): RaycastSnapResult | null {
  // Collect all valid meshes from candidates (including children of groups/hierarchical FBX models)
  const meshes: THREE.Mesh[] = [];
  candidateObjects.forEach(obj => {
    obj.traverse(child => {
      if ((child as THREE.Mesh).isMesh && child.visible && (child as THREE.Mesh).geometry) {
        meshes.push(child as THREE.Mesh);
      }
    });
  });

  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const hitMesh = hit.object as THREE.Mesh;
    const geometry = hitMesh.geometry;
    const worldMatrix = hitMesh.matrixWorld;

    let snapType: SnapTargetType = 'face';
    let bestPoint = hit.point.clone();
    let hitNormal: THREE.Vector3 | undefined = hit.face ? hit.face.normal.clone().transformDirection(worldMatrix) : undefined;

    // 1. Vertex Snapping Test
    if (snapSettings.snapToVertices && geometry && hit.face) {
      const posAttr = geometry.attributes.position;
      if (posAttr) {
        const vA = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.a).applyMatrix4(worldMatrix);
        const vB = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.b).applyMatrix4(worldMatrix);
        const vC = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.c).applyMatrix4(worldMatrix);

        const distA = hit.point.distanceTo(vA);
        const distB = hit.point.distanceTo(vB);
        const distC = hit.point.distanceTo(vC);

        // Screen-space or world-space threshold
        const hitDistance = hit.distance;
        const vertexThreshold = Math.max(0.08, hitDistance * 0.04);

        if (distA <= distB && distA <= distC && distA < vertexThreshold) {
          bestPoint = vA;
          snapType = 'vertex';
        } else if (distB <= distA && distB <= distC && distB < vertexThreshold) {
          bestPoint = vB;
          snapType = 'vertex';
        } else if (distC <= distA && distC <= distB && distC < vertexThreshold) {
          bestPoint = vC;
          snapType = 'vertex';
        }
      }
    }

    // 2. Edge Snapping Test if not vertex
    if (snapType !== 'vertex' && snapSettings.snapToEdges && geometry && hit.face) {
      const posAttr = geometry.attributes.position;
      if (posAttr) {
        const vA = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.a).applyMatrix4(worldMatrix);
        const vB = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.b).applyMatrix4(worldMatrix);
        const vC = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.c).applyMatrix4(worldMatrix);

        const closestOnEdge = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
          const ab = new THREE.Vector3().subVectors(b, a);
          const lenSq = ab.lengthSq();
          if (lenSq === 0) return a.clone();
          const t = Math.max(0, Math.min(1, new THREE.Vector3().subVectors(p, a).dot(ab) / lenSq));
          return a.clone().add(ab.multiplyScalar(t));
        };

        const pAB = closestOnEdge(hit.point, vA, vB);
        const pBC = closestOnEdge(hit.point, vB, vC);
        const pCA = closestOnEdge(hit.point, vC, vA);

        const dAB = hit.point.distanceTo(pAB);
        const dBC = hit.point.distanceTo(pBC);
        const dCA = hit.point.distanceTo(pCA);

        const edgeThreshold = Math.max(0.05, hit.distance * 0.025);

        if (dAB <= dBC && dAB <= dCA && dAB < edgeThreshold) {
          bestPoint = pAB;
          snapType = 'edge';
        } else if (dBC <= dAB && dBC <= dCA && dBC < edgeThreshold) {
          bestPoint = pBC;
          snapType = 'edge';
        } else if (dCA <= dAB && dCA <= dBC && dCA < edgeThreshold) {
          bestPoint = pCA;
          snapType = 'edge';
        }
      }
    }

    // Find top-level root scene object id/name if attached
    let objectId: string | undefined;
    let objectName: string | undefined = hitMesh.name;
    let curr: THREE.Object3D | null = hitMesh;
    while (curr) {
      if ((curr as any).userData?.sceneObjectId) {
        objectId = (curr as any).userData.sceneObjectId;
        objectName = curr.name || objectName;
        break;
      }
      curr = curr.parent;
    }

    return {
      point: bestPoint,
      snappedTo: snapType,
      objectId,
      objectName: objectName || hitMesh.name || 'Mesh',
      normal: hitNormal,
      distanceFromCamera: hit.distance,
    };
  }

  // 3. Fallback to Ground Grid Snapping
  if (snapSettings.snapToGrid) {
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundHit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, groundHit)) {
      // Snap to 0.5 or 0.1 grid units if within grid area
      const snappedGridX = Math.round(groundHit.x * 2) / 2;
      const snappedGridZ = Math.round(groundHit.z * 2) / 2;
      const gridDist = Math.hypot(groundHit.x - snappedGridX, groundHit.z - snappedGridZ);

      if (gridDist < 0.2) {
        groundHit.x = snappedGridX;
        groundHit.z = snappedGridZ;
      }

      return {
        point: groundHit,
        snappedTo: 'grid',
        objectName: 'Grille / Sol',
        distanceFromCamera: raycaster.ray.origin.distanceTo(groundHit),
      };
    }
  }

  return null;
}
