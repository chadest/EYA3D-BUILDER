/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - 3D Measurement & Scaling Types
 */

export type SnapTargetType = 'vertex' | 'edge' | 'face' | 'grid' | 'none';

export type MeasurementUnit = 'm' | 'cm' | 'mm' | 'in' | 'ft' | 'units';

export interface MeasurementPoint {
  position: [number, number, number]; // [x, y, z] world coordinates
  snappedTo: SnapTargetType;
  objectId?: string;
  objectName?: string;
  normal?: [number, number, number];
}

export interface MeasurementItem {
  id: string;
  name?: string;
  start: MeasurementPoint;
  end: MeasurementPoint;
  distance: number; // Euclidean distance in 3D world units (1 unit = 1 meter)
  deltaX: number; // |end.x - start.x|
  deltaY: number; // |end.y - start.y|
  deltaZ: number; // |end.z - start.z|
  color?: string;
  createdDate: number;
  showBreakdown?: boolean;
}

export interface MeasureSnapSettings {
  snapToVertices: boolean;
  snapToEdges: boolean;
  snapToFaces: boolean;
  snapToGrid: boolean;
}
