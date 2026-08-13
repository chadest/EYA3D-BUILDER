/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CAD 2D Sketching & Drawing Data Structures & Types
 */

import * as THREE from 'three';

export type DrawToolType =
  | 'NONE'
  | 'SELECT'
  | 'LINE'
  | 'RECTANGLE'
  | 'CIRCLE'
  | 'ARC'
  | 'SPLINE'
  | 'TRIM'
  | 'EXTEND'
  | 'FILLET'
  | 'OFFSET'
  | 'DIMENSION';

export type SnapType = 'GRID' | 'ENDPOINT' | 'MIDPOINT' | 'CENTER' | 'INTERSECTION' | 'ORTHO' | 'TANGENT';

export interface SnapPoint {
  position: THREE.Vector2;
  type: SnapType;
  entityId?: string;
  sourceLabel?: string;
  targetNormal?: THREE.Vector2;
}

export type ConstraintType = 'HORIZONTAL' | 'VERTICAL' | 'PARALLEL' | 'PERPENDICULAR' | 'TANGENT' | 'COINCIDENT' | 'EQUAL_LENGTH' | 'FIXED_LENGTH' | 'FIXED_RADIUS' | 'FIXED_ANGLE';

export interface GeometricConstraint {
  id: string;
  type: ConstraintType;
  entityIds: string[];
  value?: number;
}

export interface DimensionLabel {
  id: string;
  entityId: string;
  text: string;
  position: THREE.Vector2;
  value: number;
  unit: string;
  type: 'LENGTH' | 'RADIUS' | 'DIAMETER' | 'ANGLE';
}

export interface BaseSketchEntity {
  id: string;
  selected?: boolean;
  color?: string;
  locked?: boolean;
}

export interface LineSketchEntity extends BaseSketchEntity {
  type: 'LINE';
  start: THREE.Vector2;
  end: THREE.Vector2;
}

export interface RectSketchEntity extends BaseSketchEntity {
  type: 'RECTANGLE';
  start: THREE.Vector2;
  end: THREE.Vector2;
}

export interface CircleSketchEntity extends BaseSketchEntity {
  type: 'CIRCLE';
  center: THREE.Vector2;
  radius: number;
}

export interface ArcSketchEntity extends BaseSketchEntity {
  type: 'ARC';
  center: THREE.Vector2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface SplineSketchEntity extends BaseSketchEntity {
  type: 'SPLINE';
  points: THREE.Vector2[];
}

export type SketchEntity =
  | LineSketchEntity
  | RectSketchEntity
  | CircleSketchEntity
  | ArcSketchEntity
  | SplineSketchEntity;

export interface SketchSettings {
  gridSnapEnabled: boolean;
  gridStep: number;
  objectSnapEnabled: boolean;
  orthoLockEnabled: boolean;
  polarAngleStep: number; // in degrees, e.g. 45 or 90
  showDimensions: boolean;
  showSnapGuides: boolean;
  filletRadius: number;
  offsetDistance: number;
  extrudeHeight: number;
}

export interface ClosedProfile {
  id: string;
  points: THREE.Vector2[];
  entityIds: string[];
  area: number;
  isClockwise: boolean;
}
