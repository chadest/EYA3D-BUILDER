/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - High Performance Sculpting Engine & Geometry Versioning
 * Inspired by marmelab/sculpt-3D architecture
 */

import * as THREE from 'three';
import { SculptMode } from '../../types/editor';

export type FalloffType = 'smoothstep' | 'gaussian' | 'linear' | 'constant';

export interface SculptingBrushConfig {
  mode: SculptMode;
  radius: number;
  strength: number;
  invert: boolean;
  falloff: FalloffType;
  symmetryX: boolean;
  symmetryY: boolean;
  symmetryZ: boolean;
}

export interface GeometryHistorySnapshot {
  timestamp: number;
  positions: Float32Array;
  normals: Float32Array;
}

/**
 * Geometry Versioning Manager
 * Prevents race conditions during rapid sculpting operations and tracks history.
 */
export class GeometryVersioning {
  public version: number = 0;
  private historyStack: GeometryHistorySnapshot[] = [];
  private historyIndex: number = -1;
  private maxHistory: number = 30;

  constructor(initialGeometry?: THREE.BufferGeometry) {
    if (initialGeometry) {
      this.pushState(initialGeometry);
    }
  }

  public pushState(geometry: THREE.BufferGeometry): void {
    const posAttr = geometry.attributes.position;
    const normAttr = geometry.attributes.normal;
    if (!posAttr) return;

    // Truncate redo stack if new action happens
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }

    const snapshot: GeometryHistorySnapshot = {
      timestamp: Date.now(),
      positions: new Float32Array(posAttr.array),
      normals: normAttr ? new Float32Array(normAttr.array) : new Float32Array(0),
    };

    this.historyStack.push(snapshot);
    if (this.historyStack.length > this.maxHistory) {
      this.historyStack.shift();
    } else {
      this.historyIndex++;
    }

    this.version++;
  }

  public canUndo(): boolean {
    return this.historyIndex > 0;
  }

  public canRedo(): boolean {
    return this.historyIndex < this.historyStack.length - 1;
  }

  public undo(geometry: THREE.BufferGeometry): boolean {
    if (!this.canUndo()) return false;
    this.historyIndex--;
    this.applySnapshot(geometry, this.historyStack[this.historyIndex]);
    this.version++;
    return true;
  }

  public redo(geometry: THREE.BufferGeometry): boolean {
    if (!this.canRedo()) return false;
    this.historyIndex++;
    this.applySnapshot(geometry, this.historyStack[this.historyIndex]);
    this.version++;
    return true;
  }

  private applySnapshot(geometry: THREE.BufferGeometry, snapshot: GeometryHistorySnapshot): void {
    const posAttr = geometry.attributes.position;
    if (!posAttr) return;

    (posAttr.array as Float32Array).set(snapshot.positions);
    posAttr.needsUpdate = true;

    if (snapshot.normals.length > 0 && geometry.attributes.normal) {
      (geometry.attributes.normal.array as Float32Array).set(snapshot.normals);
      geometry.attributes.normal.needsUpdate = true;
    } else {
      geometry.computeVertexNormals();
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}

/**
 * Spatial Grid Hash for Fast Vertex Proximity Queries (100k+ vertices)
 */
class SpatialGridHash {
  private cellSize: number;
  private grid: Map<string, number[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private getKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cy},${cz}`;
  }

  public build(positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): void {
    this.grid.clear();
    const count = positions.count;
    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const key = this.getKey(x, y, z);
      let cell = this.grid.get(key);
      if (!cell) {
        cell = [];
        this.grid.set(key, cell);
      }
      cell.push(i);
    }
  }

  public getNearbyIndices(center: THREE.Vector3, radius: number): number[] {
    const minX = Math.floor((center.x - radius) / this.cellSize);
    const maxX = Math.floor((center.x + radius) / this.cellSize);
    const minY = Math.floor((center.y - radius) / this.cellSize);
    const maxY = Math.floor((center.y + radius) / this.cellSize);
    const minZ = Math.floor((center.z - radius) / this.cellSize);
    const maxZ = Math.floor((center.z + radius) / this.cellSize);

    const result: number[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${y},${z}`;
          const cell = this.grid.get(key);
          if (cell) {
            for (let i = 0; i < cell.length; i++) {
              result.push(cell[i]);
            }
          }
        }
      }
    }
    return result;
  }
}

/**
 * Primary SculptingEngine Class
 * Manages mesh deformation, brush physics, falloff curves, and symmetry mirroring.
 */
export class SculptingEngine {
  private spatialHash: SpatialGridHash | null = null;
  private lastGeometry: THREE.BufferGeometry | null = null;
  public versioningMap: WeakMap<THREE.BufferGeometry, GeometryVersioning> = new WeakMap();

  public getVersioning(geometry: THREE.BufferGeometry): GeometryVersioning {
    let ver = this.versioningMap.get(geometry);
    if (!ver) {
      ver = new GeometryVersioning(geometry);
      this.versioningMap.set(geometry, ver);
    }
    return ver;
  }

  /**
   * Calculates falloff weight w in [0, 1] based on normalized distance
   */
  public calculateFalloff(distNorm: number, type: FalloffType = 'smoothstep'): number {
    if (distNorm >= 1.0) return 0;
    if (distNorm <= 0.0) return 1;

    switch (type) {
      case 'smoothstep': {
        // (1 - d^2)^2
        const t = 1 - distNorm * distNorm;
        return t * t;
      }
      case 'gaussian': {
        return Math.exp(-distNorm * distNorm * 3.0);
      }
      case 'linear': {
        return 1.0 - distNorm;
      }
      case 'constant': {
        return 1.0;
      }
      default:
        return 1.0 - distNorm;
    }
  }

  /**
   * Performs real-time mesh sculpting stroke deformation
   */
  public applyStroke(
    mesh: THREE.Mesh,
    hitPointLocal: THREE.Vector3,
    hitNormalLocal: THREE.Vector3,
    config: SculptingBrushConfig,
    dragDeltaLocal?: THREE.Vector3
  ): void {
    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const normAttr = geometry.attributes.normal;
    if (!posAttr) return;

    // Update spatial hash index if geometry changed
    if (this.lastGeometry !== geometry) {
      this.lastGeometry = geometry;
      this.spatialHash = new SpatialGridHash(config.radius * 1.5);
      this.spatialHash.build(posAttr);
    }

    const { mode, radius, strength, invert, falloff, symmetryX, symmetryY, symmetryZ } = config;
    const effectiveStrength = invert ? -strength : strength;
    const radiusSq = radius * radius;

    // Gather centers to apply (including symmetry mirrored centers)
    const strokeCenters: { center: THREE.Vector3; normal: THREE.Vector3 }[] = [
      { center: hitPointLocal.clone(), normal: hitNormalLocal.clone() },
    ];

    if (symmetryX) {
      strokeCenters.push({
        center: new THREE.Vector3(-hitPointLocal.x, hitPointLocal.y, hitPointLocal.z),
        normal: new THREE.Vector3(-hitNormalLocal.x, hitNormalLocal.y, hitNormalLocal.z),
      });
    }
    if (symmetryY) {
      strokeCenters.push({
        center: new THREE.Vector3(hitPointLocal.x, -hitPointLocal.y, hitPointLocal.z),
        normal: new THREE.Vector3(hitPointLocal.x, -hitNormalLocal.y, hitNormalLocal.z),
      });
    }
    if (symmetryZ) {
      strokeCenters.push({
        center: new THREE.Vector3(hitPointLocal.x, hitPointLocal.y, -hitPointLocal.z),
        normal: new THREE.Vector3(hitPointLocal.x, hitPointLocal.y, -hitNormalLocal.z),
      });
    }

    const vPos = new THREE.Vector3();
    const vNorm = new THREE.Vector3();
    const count = posAttr.count;

    // Build neighbor map for Smooth / Laplacian if needed
    let neighborMap: Map<number, THREE.Vector3[]> | null = null;
    if (mode === 'smooth') {
      neighborMap = new Map();
      for (let i = 0; i < count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(posAttr, i);
        const b = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
        const c = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);

        if (!neighborMap.has(i)) neighborMap.set(i, []);
        if (!neighborMap.has(i + 1)) neighborMap.set(i + 1, []);
        if (!neighborMap.has(i + 2)) neighborMap.set(i + 2, []);

        neighborMap.get(i)!.push(b, c);
        neighborMap.get(i + 1)!.push(a, c);
        neighborMap.get(i + 2)!.push(a, b);
      }
    }

    // Process each stroke center (primary + symmetry)
    for (const { center, normal } of strokeCenters) {
      let candidateIndices: number[] = [];

      if (this.spatialHash && count > 500) {
        candidateIndices = this.spatialHash.getNearbyIndices(center, radius);
      } else {
        candidateIndices = Array.from({ length: count }, (_, i) => i);
      }

      // Read or initialize mask attribute
      let maskAttr = geometry.attributes.mask as THREE.BufferAttribute | undefined;
      let colAttr = geometry.attributes.color as THREE.BufferAttribute | undefined;

      if (mode === 'mask') {
        if (!maskAttr) {
          maskAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
          geometry.setAttribute('mask', maskAttr);
        }
        if (!colAttr) {
          const cols = new Float32Array(count * 3);
          cols.fill(1.0);
          colAttr = new THREE.BufferAttribute(cols, 3);
          geometry.setAttribute('color', colAttr);
        }
      }

      for (const i of candidateIndices) {
        if (i >= count) continue;
        vPos.fromBufferAttribute(posAttr, i);

        const distSq = vPos.distanceToSquared(center);
        if (distSq > radiusSq) continue;

        const dist = Math.sqrt(distSq);
        const normDist = dist / radius;
        let w = this.calculateFalloff(normDist, falloff) * effectiveStrength;

        // Apply vertex mask weight protection for non-mask modes
        const currentMask = maskAttr ? (maskAttr.array as Float32Array)[i] : 0.0;
        if (mode !== 'mask') {
          w *= (1.0 - currentMask);
        }

        if (normAttr) vNorm.fromBufferAttribute(normAttr, i);

        switch (mode) {
          case 'sculpt': {
            // Displace along hit surface normal
            vPos.addScaledVector(normal, w * 0.12);
            break;
          }

          case 'clay': {
            // Flatten slightly then extrude along plane normal (Clay Strips)
            const planeDist = vPos.clone().sub(center).dot(normal);
            const targetPos = vPos.clone().sub(normal.clone().multiplyScalar(planeDist));
            targetPos.addScaledVector(normal, w * 0.15);
            vPos.lerp(targetPos, Math.min(0.8, Math.abs(w)));
            break;
          }

          case 'inflate': {
            // Displace along vertex's own normal
            vPos.addScaledVector(vNorm, w * 0.12);
            break;
          }

          case 'smooth': {
            // Laplacian smoothing
            const nbrs = neighborMap?.get(i);
            if (nbrs && nbrs.length > 0) {
              const avg = new THREE.Vector3();
              for (const nb of nbrs) avg.add(nb);
              avg.divideScalar(nbrs.length);
              vPos.lerp(avg, Math.min(0.5, Math.abs(w)));
            }
            break;
          }

          case 'flatten': {
            // Projection onto hit plane
            const height = vPos.clone().sub(center).dot(normal);
            vPos.addScaledVector(normal, -height * Math.abs(w));
            break;
          }

          case 'pinch': {
            // Centripetal attraction toward hit center
            const pull = center.clone().sub(vPos);
            vPos.addScaledVector(pull, w * 0.25);
            break;
          }

          case 'grab': {
            // Drag vertices along pointer move vector
            if (dragDeltaLocal) {
              vPos.addScaledVector(dragDeltaLocal, w);
            }
            break;
          }

          case 'snakehook': {
            // Pull vertices along stroke drag delta + expand slightly along normal
            if (dragDeltaLocal) {
              vPos.addScaledVector(dragDeltaLocal, w * 1.5);
              vPos.addScaledVector(vNorm, w * dragDeltaLocal.length() * 0.3);
            }
            break;
          }

          case 'mask': {
            // Painting mask weight [0..1]
            if (maskAttr) {
              const maskArr = maskAttr.array as Float32Array;
              const deltaMask = Math.abs(w) * 0.25;
              const newMask = Math.max(0, Math.min(1.0, invert ? maskArr[i] - deltaMask : maskArr[i] + deltaMask));
              maskArr[i] = newMask;
              maskAttr.needsUpdate = true;

              if (colAttr) {
                const shade = 1.0 - newMask * 0.6;
                colAttr.setXYZ(i, shade, shade * 0.7, shade * 0.7);
                colAttr.needsUpdate = true;
              }
            }
            break;
          }
        }

        posAttr.setXYZ(i, vPos.x, vPos.y, vPos.z);
      }

      if (mode === 'mask' && mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.vertexColors = true;
        mesh.material.needsUpdate = true;
      }
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    // Increment geometry version
    const ver = this.getVersioning(geometry);
    ver.version++;
  }

  /**
   * Adaptive Mesh Tessellation / Subdivide vertices in brush area
   */
  public subdivideBrushArea(geometry: THREE.BufferGeometry, center: THREE.Vector3, radius: number): THREE.BufferGeometry {
    // Re-tessellates triangles in radius by mid-point insertion
    const posAttr = geometry.attributes.position;
    if (!posAttr) return geometry;

    const count = posAttr.count;
    const newPositions: number[] = [];
    const radiusSq = radius * radius;

    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const pC = new THREE.Vector3();

    for (let i = 0; i < count; i += 3) {
      pA.fromBufferAttribute(posAttr, i);
      pB.fromBufferAttribute(posAttr, i + 1);
      pC.fromBufferAttribute(posAttr, i + 2);

      const triCenter = pA.clone().add(pB).add(pC).divideScalar(3);
      if (triCenter.distanceToSquared(center) <= radiusSq) {
        // Subdivide triangle into 4 smaller triangles
        const mAB = pA.clone().add(pB).multiplyScalar(0.5);
        const mBC = pB.clone().add(pC).multiplyScalar(0.5);
        const mCA = pC.clone().add(pA).multiplyScalar(0.5);

        // Tri 1: A, mAB, mCA
        newPositions.push(pA.x, pA.y, pA.z, mAB.x, mAB.y, mAB.z, mCA.x, mCA.y, mCA.z);
        // Tri 2: mAB, B, mBC
        newPositions.push(mAB.x, mAB.y, mAB.z, pB.x, pB.y, pB.z, mBC.x, mBC.y, mBC.z);
        // Tri 3: mCA, mBC, C
        newPositions.push(mCA.x, mCA.y, mCA.z, mBC.x, mBC.y, mBC.z, pC.x, pC.y, pC.z);
        // Tri 4: mAB, mBC, mCA
        newPositions.push(mAB.x, mAB.y, mAB.z, mBC.x, mBC.y, mBC.z, mCA.x, mCA.y, mCA.z);
      } else {
        newPositions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
      }
    }

    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    newGeom.computeVertexNormals();

    // Rebuild spatial grid for new geometry
    this.lastGeometry = newGeom;
    this.spatialHash = new SpatialGridHash(radius * 1.5);
    this.spatialHash.build(newGeom.attributes.position as THREE.BufferAttribute);

    const ver = this.getVersioning(newGeom);
    ver.version++;

    return newGeom;
  }
}

export const sculptingEngine = new SculptingEngine();
