/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Data Structures & Types
 */

import * as THREE from 'three';

// Selection modes for mesh editing
export type SelectionLevel = 'object' | 'vertex' | 'edge' | 'face';

// Global application modes
export type EditorMode =
  | 'object'       // Object selection, transform, modifiers
  | 'edit'         // Polygonal Mesh Modeling (Extrude, Inset, Bevel, Loop Cut, Bridge)
  | 'sculpt'       // Digital Sculpting (Push/Pull, Smooth, Flatten, Pinch)
  | 'curve'        // Splines & NURBS (Curve placement, Lathe, Sweep/Loft)
  | 'csg'          // Boolean operations (Union, Difference, Intersection)
  | 'parametric'   // Modifiers (Array, Mirror, SubD)
  | 'deform';      // Twist, Bend, Lattice Cage

// Sculpting Brush Modes
export type SculptMode = 'sculpt' | 'clay' | 'inflate' | 'smooth' | 'flatten' | 'pinch' | 'grab';

// CSG Boolean Operations
type CSGOperation = 'union' | 'subtract' | 'intersect';
export type { CSGOperation };

// Modifier Stack Types
export type ModifierType = 'subd' | 'array' | 'mirror' | 'twist' | 'bend' | 'lattice';

export interface SubDModifierConfig {
  id: string;
  type: 'subd';
  enabled: boolean;
  levels: number; // 1-3
  creaseWeight: number; // 0.0 to 1.0
}

export interface ArrayModifierConfig {
  id: string;
  type: 'array';
  enabled: boolean;
  count: number;
  offset: [number, number, number];
  relativeOffset: boolean;
}

export interface MirrorModifierConfig {
  id: string;
  type: 'mirror';
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  mergeVertices: boolean;
  mergeThreshold: number;
}

export interface TwistModifierConfig {
  id: string;
  type: 'twist';
  enabled: boolean;
  angle: number; // In degrees or radians
  axis: 'x' | 'y' | 'z';
}

export interface BendModifierConfig {
  id: string;
  type: 'bend';
  enabled: boolean;
  angle: number;
  axis: 'x' | 'y' | 'z';
}

export interface LatticeModifierConfig {
  id: string;
  type: 'lattice';
  enabled: boolean;
  resolution: [number, number, number]; // e.g. [3, 3, 3]
  points: THREE.Vector3[]; // Control points displacement
}

export type ModifierConfig =
  | SubDModifierConfig
  | ArrayModifierConfig
  | MirrorModifierConfig
  | TwistModifierConfig
  | BendModifierConfig
  | LatticeModifierConfig;

// Object Data in Scene
export interface SceneObject {
  id: string;
  name: string;
  visible: boolean;
  wireframe: boolean;
  type: 'mesh' | 'curve' | 'group';
  mesh?: THREE.Mesh;
  geometryBackup?: THREE.BufferGeometry; // Original geometry before modifiers
  modifiers: ModifierConfig[];
  materialProps: {
    color: string;
    roughness: number;
    metalness: number;
    flatShading: boolean;
  };
}

// Spline Control Point
export interface CurveControlPoint {
  id: string;
  position: THREE.Vector3;
}

// Half-Edge Topological Data Structure Interfaces
export interface HEVertex {
  id: number;
  position: THREE.Vector3;
  halfEdge?: HEHalfEdge;
  creaseWeight?: number;
}

export interface HEFace {
  id: number;
  halfEdge?: HEHalfEdge;
  normal: THREE.Vector3;
  center: THREE.Vector3;
}

export interface HEEdge {
  id: number;
  halfEdge?: HEHalfEdge;
  creaseWeight: number; // 0.0 to 1.0 for SubD sharp edges
}

export interface HEHalfEdge {
  id: number;
  vertex: HEVertex;       // Target vertex of half-edge
  face?: HEFace;          // Face to which this half-edge belongs
  edge?: HEEdge;          // Associated full edge
  next?: HEHalfEdge;      // Next half-edge in face perimeter
  prev?: HEHalfEdge;      // Previous half-edge in face perimeter
  twin?: HEHalfEdge;      // Opposite half-edge
}

// Half-Edge Mesh Structure
export interface HEMesh {
  vertices: HEVertex[];
  edges: HEEdge[];
  faces: HEFace[];
  halfEdges: HEHalfEdge[];
}
