/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Interactive Primitives Real-time Drawing Engine
 */

import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';

export type InteractivePrimitiveType =
  | 'plane'
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'pyramid'
  | 'star3d'
  | 'text';

export type DrawingStep = 'IDLE' | 'DRAWING_BASE' | 'EXTRUDING_HEIGHT' | 'COMPLETED';

export interface InteractiveDrawingState {
  type: InteractivePrimitiveType;
  step: DrawingStep;
  snapEnabled: boolean;
  snapStep: number; // e.g. 0.25, 0.5, 1.0
  anchorPoint: THREE.Vector3 | null;
  surfaceNormal: THREE.Vector3;
  baseRadius: number;
  baseWidth: number;
  baseDepth: number;
  height: number;
  minorRadius: number; // For torus tube
  starPoints: number; // e.g. 5
}

export function createDefaultDrawingState(): InteractiveDrawingState {
  return {
    type: 'cube',
    step: 'IDLE',
    snapEnabled: true,
    snapStep: 0.5,
    anchorPoint: null,
    surfaceNormal: new THREE.Vector3(0, 1, 0),
    baseRadius: 1,
    baseWidth: 1,
    baseDepth: 1,
    height: 1,
    minorRadius: 0.3,
    starPoints: 5,
  };
}

export function snapValue(val: number, step: number, enabled: boolean): number {
  if (!enabled || step <= 0) return val;
  return Math.round(val / step) * step;
}

export function snapVector3(vec: THREE.Vector3, step: number, enabled: boolean): THREE.Vector3 {
  if (!enabled || step <= 0) return vec.clone();
  return new THREE.Vector3(
    Math.round(vec.x / step) * step,
    Math.round(vec.y / step) * step,
    Math.round(vec.z / step) * step
  );
}

/**
 * Creates a 2D Star Shape for 3D extrusion
 */
export function createStarShape(outerRadius: number, innerRadius: number, points: number = 5): THREE.Shape {
  const shape = new THREE.Shape();
  const totalPoints = points * 2;
  const safeOuter = Math.max(0.1, outerRadius);
  const safeInner = Math.max(0.05, innerRadius);

  for (let i = 0; i < totalPoints; i++) {
    const r = i % 2 === 0 ? safeOuter : safeInner;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

/**
 * Generates geometry for interactive primitive preview/final mesh
 */
export function generatePrimitiveGeometry(
  type: InteractivePrimitiveType,
  params: {
    baseWidth: number;
    baseDepth: number;
    baseRadius: number;
    height: number;
    minorRadius: number;
    starPoints: number;
  }
): THREE.BufferGeometry {
  const safeWidth = Math.max(0.05, params.baseWidth);
  const safeDepth = Math.max(0.05, params.baseDepth);
  const safeRadius = Math.max(0.05, params.baseRadius);
  const safeHeight = Math.abs(params.height) < 0.02 ? 0.02 : params.height;

  switch (type) {
    case 'plane': {
      const geom = new THREE.PlaneGeometry(safeWidth, safeDepth, 8, 8);
      geom.rotateX(-Math.PI / 2);
      return geom;
    }

    case 'cube': {
      const absH = Math.abs(safeHeight);
      const geom = new THREE.BoxGeometry(safeWidth, absH, safeDepth, 4, 4, 4);
      // Offset geometry so base stays at Y=0
      geom.translate(0, (safeHeight >= 0 ? 1 : -1) * (absH / 2), 0);
      return geom;
    }

    case 'sphere': {
      return new THREE.SphereGeometry(safeRadius, 32, 32);
    }

    case 'cylinder': {
      const absH = Math.abs(safeHeight);
      const geom = new THREE.CylinderGeometry(safeRadius, safeRadius, absH, 32, 8);
      geom.translate(0, (safeHeight >= 0 ? 1 : -1) * (absH / 2), 0);
      return geom;
    }

    case 'cone': {
      const absH = Math.abs(safeHeight);
      const geom = new THREE.ConeGeometry(safeRadius, absH, 32, 8);
      geom.translate(0, (safeHeight >= 0 ? 1 : -1) * (absH / 2), 0);
      return geom;
    }

    case 'pyramid': {
      const absH = Math.abs(safeHeight);
      // 4-sided pyramid base using CylinderGeometry with radiusTop: 0 and radialSegments: 4
      const geom = new THREE.CylinderGeometry(0, safeRadius, absH, 4, 4);
      geom.rotateY(Math.PI / 4); // Align sides cleanly
      geom.translate(0, (safeHeight >= 0 ? 1 : -1) * (absH / 2), 0);
      return geom;
    }

    case 'torus': {
      const tubeR = Math.max(0.02, Math.min(params.minorRadius, safeRadius * 0.8));
      return new THREE.TorusGeometry(safeRadius, tubeR, 24, 48);
    }

    case 'star3d': {
      const innerR = safeRadius * 0.4;
      const shape = createStarShape(safeRadius, innerR, params.starPoints || 5);
      const absH = Math.abs(safeHeight);
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: absH,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: Math.min(0.05, safeRadius * 0.05),
        bevelThickness: Math.min(0.05, absH * 0.1),
      };
      const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geom.rotateX(-Math.PI / 2);
      if (safeHeight < 0) {
        geom.translate(0, safeHeight, 0);
      }
      return geom;
    }

    case 'text': {
      // Basic plaque geometry for fallback rendering
      return new THREE.BoxGeometry(1.6, 0.8, 0.08);
    }

    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

export function addDirectPrimitive(type: InteractivePrimitiveType) {
  const geom = generatePrimitiveGeometry(type, {
    baseWidth: 1,
    baseDepth: 1,
    baseRadius: 0.8,
    height: 1,
    minorRadius: 0.25,
    starPoints: 5,
  });
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a90e2,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: editorStore.flatShading,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(0, type === 'plane' ? 0.01 : 0.5, 0);

  editorStore.addObject(`Primitive_${type}`, mesh);
}
