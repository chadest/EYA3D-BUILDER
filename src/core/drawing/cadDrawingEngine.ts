/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CAD 2D Drawing & Sketching Engine
 * Implements high-precision geometric computations, snapping, trimming, fillet, offset & 3D extrusion.
 */

import * as THREE from 'three';
import {
  SketchEntity,
  LineSketchEntity,
  RectSketchEntity,
  CircleSketchEntity,
  ArcSketchEntity,
  SplineSketchEntity,
  SnapPoint,
  SnapType,
  SketchSettings,
  ClosedProfile,
  DimensionLabel,
} from '../../types/drawing';

export class CadDrawingEngine {
  /**
   * Distance between a point and a 2D line segment
   */
  public static pointToSegmentDistance(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2): number {
    const l2 = a.distanceToSquared(b);
    if (l2 === 0) return p.distanceTo(a);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = new THREE.Vector2(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
    return p.distanceTo(proj);
  }

  /**
   * Find snapping point based on active filters (Object Snap, Grid Snap, Ortho)
   */
  public static calculateSnapPoint(
    rawPos: THREE.Vector2,
    entities: SketchEntity[],
    settings: SketchSettings,
    originReference?: THREE.Vector2
  ): SnapPoint {
    const snapDistanceThreshold = 0.35; // World units threshold for snapping

    // 1. Orthogonal / Polar Lock constraint relative to originReference (e.g. start of a line)
    let currentPos = rawPos.clone();
    let orthoSnapped = false;
    let orthoNormal: THREE.Vector2 | undefined;

    if (settings.orthoLockEnabled && originReference) {
      const delta = currentPos.clone().sub(originReference);
      const angle = Math.atan2(delta.y, delta.x);
      const stepRad = (settings.polarAngleStep * Math.PI) / 180;
      const snappedAngle = Math.round(angle / stepRad) * stepRad;
      const length = delta.length();

      currentPos.set(
        originReference.x + Math.cos(snappedAngle) * length,
        originReference.y + Math.sin(snappedAngle) * length
      );
      orthoSnapped = true;
      orthoNormal = new THREE.Vector2(Math.cos(snappedAngle), Math.sin(snappedAngle));
    }

    // 2. Object Snapping (EndPoints, MidPoints, Centers, Intersections)
    if (settings.objectSnapEnabled) {
      const candidateSnaps: SnapPoint[] = [];

      for (const ent of entities) {
        if (ent.type === 'LINE') {
          // Endpoints
          candidateSnaps.push({ position: ent.start.clone(), type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Extrémité' });
          candidateSnaps.push({ position: ent.end.clone(), type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Extrémité' });
          // Midpoint
          const mid = ent.start.clone().add(ent.end).multiplyScalar(0.5);
          candidateSnaps.push({ position: mid, type: 'MIDPOINT', entityId: ent.id, sourceLabel: 'Milieu' });
        } else if (ent.type === 'RECTANGLE') {
          const corners = [
            ent.start.clone(),
            new THREE.Vector2(ent.end.x, ent.start.y),
            ent.end.clone(),
            new THREE.Vector2(ent.start.x, ent.end.y),
          ];
          corners.forEach(c => candidateSnaps.push({ position: c, type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Coin' }));
          // Midpoints of 4 edges
          for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];
            candidateSnaps.push({ position: p1.clone().add(p2).multiplyScalar(0.5), type: 'MIDPOINT', entityId: ent.id, sourceLabel: 'Milieu' });
          }
          // Center of rect
          candidateSnaps.push({ position: ent.start.clone().add(ent.end).multiplyScalar(0.5), type: 'CENTER', entityId: ent.id, sourceLabel: 'Centre' });
        } else if (ent.type === 'CIRCLE') {
          candidateSnaps.push({ position: ent.center.clone(), type: 'CENTER', entityId: ent.id, sourceLabel: 'Centre' });
          // Quadrants (0, 90, 180, 270 deg)
          candidateSnaps.push({ position: new THREE.Vector2(ent.center.x + ent.radius, ent.center.y), type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Quadrant' });
          candidateSnaps.push({ position: new THREE.Vector2(ent.center.x - ent.radius, ent.center.y), type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Quadrant' });
          candidateSnaps.push({ position: new THREE.Vector2(ent.center.x, ent.center.y + ent.radius), type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Quadrant' });
          candidateSnaps.push({ position: new THREE.Vector2(ent.center.x, ent.center.y - ent.radius), type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Quadrant' });
        } else if (ent.type === 'ARC') {
          candidateSnaps.push({ position: ent.center.clone(), type: 'CENTER', entityId: ent.id, sourceLabel: 'Centre' });
          const pStart = new THREE.Vector2(
            ent.center.x + Math.cos(ent.startAngle) * ent.radius,
            ent.center.y + Math.sin(ent.startAngle) * ent.radius
          );
          const pEnd = new THREE.Vector2(
            ent.center.x + Math.cos(ent.endAngle) * ent.radius,
            ent.center.y + Math.sin(ent.endAngle) * ent.radius
          );
          candidateSnaps.push({ position: pStart, type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Début Arc' });
          candidateSnaps.push({ position: pEnd, type: 'ENDPOINT', entityId: ent.id, sourceLabel: 'Fin Arc' });
        } else if (ent.type === 'SPLINE') {
          ent.points.forEach((p, idx) => {
            candidateSnaps.push({
              position: p.clone(),
              type: 'ENDPOINT',
              entityId: ent.id,
              sourceLabel: idx === 0 || idx === ent.points.length - 1 ? 'Extrémité Spline' : 'Nœud Spline',
            });
          });
        }
      }

      // Check for Intersections between line entities
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const e1 = entities[i];
          const e2 = entities[j];
          if (e1.type === 'LINE' && e2.type === 'LINE') {
            const inter = this.getLineIntersection(e1.start, e1.end, e2.start, e2.end);
            if (inter) {
              candidateSnaps.push({
                position: inter,
                type: 'INTERSECTION',
                entityId: `${e1.id}_${e2.id}`,
                sourceLabel: 'Intersection',
              });
            }
          }
        }
      }

      // Find closest snap point
      let closestSnap: SnapPoint | null = null;
      let minDistance = snapDistanceThreshold;

      for (const snap of candidateSnaps) {
        const d = snap.position.distanceTo(currentPos);
        if (d < minDistance) {
          minDistance = d;
          closestSnap = snap;
        }
      }

      if (closestSnap) {
        return closestSnap;
      }
    }

    // 3. Grid Snapping
    if (settings.gridSnapEnabled) {
      const step = settings.gridStep > 0 ? settings.gridStep : 0.5;
      const gx = Math.round(currentPos.x / step) * step;
      const gy = Math.round(currentPos.y / step) * step;
      const gridPos = new THREE.Vector2(gx, gy);

      return {
        position: gridPos,
        type: 'GRID',
        sourceLabel: `Grille (${step.toFixed(1)})`,
      };
    }

    if (orthoSnapped) {
      return {
        position: currentPos,
        type: 'ORTHO',
        targetNormal: orthoNormal,
        sourceLabel: 'Guide Orthogonal',
      };
    }

    return {
      position: currentPos,
      type: 'GRID',
      sourceLabel: 'Libre',
    };
  }

  /**
   * 2D Line-Line Segment Intersection Calculation
   */
  public static getLineIntersection(
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    p3: THREE.Vector2,
    p4: THREE.Vector2
  ): THREE.Vector2 | null {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-6) return null; // Parallel or collinear

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return new THREE.Vector2(x1 + ua * (x2 - x1), y1 + ua * (y2 - y1));
    }
    return null;
  }

  /**
   * Trim Tool: Trim a line segment at its closest intersection with other entities.
   */
  public static trimEntity(
    clickedEntityId: string,
    clickPos: THREE.Vector2,
    entities: SketchEntity[]
  ): SketchEntity[] {
    const target = entities.find(e => e.id === clickedEntityId);
    if (!target || target.type !== 'LINE') return entities;

    // Find all intersections along this target line
    const intersections: { point: THREE.Vector2; t: number }[] = [];
    for (const ent of entities) {
      if (ent.id === target.id) continue;
      if (ent.type === 'LINE') {
        const inter = this.getLineIntersection(target.start, target.end, ent.start, ent.end);
        if (inter) {
          const t = target.start.distanceTo(inter) / target.start.distanceTo(target.end);
          intersections.push({ point: inter, t });
        }
      }
    }

    if (intersections.length === 0) {
      // No intersections: remove the whole segment
      return entities.filter(e => e.id !== clickedEntityId);
    }

    intersections.sort((a, b) => a.t - b.t);

    // Compute click parameter t
    const lineLen = target.start.distanceTo(target.end);
    const clickT = target.start.distanceTo(clickPos) / lineLen;

    // Points along the line: 0, t1, t2, ..., 1
    const segments: { start: THREE.Vector2; end: THREE.Vector2; t0: number; t1: number }[] = [];
    let prevPt = target.start;
    let prevT = 0;

    for (const item of intersections) {
      if (item.t > prevT + 1e-4) {
        segments.push({ start: prevPt, end: item.point, t0: prevT, t1: item.t });
      }
      prevPt = item.point;
      prevT = item.t;
    }
    if (1 > prevT + 1e-4) {
      segments.push({ start: prevPt, end: target.end, t0: prevT, t1: 1 });
    }

    // Keep all segments EXCEPT the one that contains clickT
    const keptSegments = segments.filter(seg => clickT < seg.t0 || clickT > seg.t1);

    const newEntities: SketchEntity[] = entities.filter(e => e.id !== clickedEntityId);
    keptSegments.forEach((seg, idx) => {
      newEntities.push({
        id: `line_trim_${Date.now()}_${idx}`,
        type: 'LINE',
        start: seg.start.clone(),
        end: seg.end.clone(),
      });
    });

    return newEntities;
  }

  /**
   * Extend Tool: Extend line to the closest intersecting boundary
   */
  public static extendEntity(
    clickedEntityId: string,
    clickPos: THREE.Vector2,
    entities: SketchEntity[]
  ): SketchEntity[] {
    const target = entities.find(e => e.id === clickedEntityId);
    if (!target || target.type !== 'LINE') return entities;

    const dStart = target.start.distanceTo(clickPos);
    const dEnd = target.end.distanceTo(clickPos);
    const extendFromEnd = dEnd <= dStart;

    const dir = extendFromEnd
      ? target.end.clone().sub(target.start).normalize()
      : target.start.clone().sub(target.end).normalize();

    const origin = extendFromEnd ? target.end : target.start;
    const rayEnd = origin.clone().add(dir.clone().multiplyScalar(100)); // Cast forward 100 units

    let closestInter: THREE.Vector2 | null = null;
    let minDistance = Infinity;

    for (const ent of entities) {
      if (ent.id === target.id) continue;
      if (ent.type === 'LINE') {
        const inter = this.getLineIntersection(origin, rayEnd, ent.start, ent.end);
        if (inter) {
          const d = origin.distanceTo(inter);
          if (d > 1e-3 && d < minDistance) {
            minDistance = d;
            closestInter = inter;
          }
        }
      }
    }

    if (!closestInter) return entities;

    return entities.map(e => {
      if (e.id !== clickedEntityId) return e;
      const line = e as LineSketchEntity;
      return {
        ...line,
        start: extendFromEnd ? line.start : closestInter!.clone(),
        end: extendFromEnd ? closestInter!.clone() : line.end,
      };
    });
  }

  /**
   * Fillet Tool: Insert a rounded corner arc of radius R between two connected line segments
   */
  public static filletCorners(
    lineAId: string,
    lineBId: string,
    radius: number,
    entities: SketchEntity[]
  ): SketchEntity[] {
    const lineA = entities.find(e => e.id === lineAId) as LineSketchEntity | undefined;
    const lineB = entities.find(e => e.id === lineBId) as LineSketchEntity | undefined;
    if (!lineA || !lineB || lineA.type !== 'LINE' || lineB.type !== 'LINE') return entities;

    // Find shared vertex (corner)
    let corner: THREE.Vector2 | null = null;
    let pA: THREE.Vector2 | null = null;
    let pB: THREE.Vector2 | null = null;

    if (lineA.start.distanceTo(lineB.start) < 0.1) {
      corner = lineA.start; pA = lineA.end; pB = lineB.end;
    } else if (lineA.start.distanceTo(lineB.end) < 0.1) {
      corner = lineA.start; pA = lineA.end; pB = lineB.start;
    } else if (lineA.end.distanceTo(lineB.start) < 0.1) {
      corner = lineA.end; pA = lineA.start; pB = lineB.end;
    } else if (lineA.end.distanceTo(lineB.end) < 0.1) {
      corner = lineA.end; pA = lineA.start; pB = lineB.start;
    }

    if (!corner || !pA || !pB) return entities;

    const vA = pA.clone().sub(corner).normalize();
    const vB = pB.clone().sub(corner).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, vA.dot(vB))));
    if (angle < 0.05 || Math.abs(angle - Math.PI) < 0.05) return entities; // Collinear

    const tangentDist = radius / Math.tan(angle / 2);
    if (tangentDist > pA.distanceTo(corner) || tangentDist > pB.distanceTo(corner)) {
      return entities; // Radius too large for segment
    }

    const tA = corner.clone().add(vA.clone().multiplyScalar(tangentDist));
    const tB = corner.clone().add(vB.clone().multiplyScalar(tangentDist));

    // Bisector vector
    const bisector = vA.clone().add(vB).normalize();
    const centerDist = radius / Math.sin(angle / 2);
    const arcCenter = corner.clone().add(bisector.clone().multiplyScalar(centerDist));

    const startAngle = Math.atan2(tA.y - arcCenter.y, tA.x - arcCenter.x);
    const endAngle = Math.atan2(tB.y - arcCenter.y, tB.x - arcCenter.x);

    const newArc: ArcSketchEntity = {
      id: `arc_fillet_${Date.now()}`,
      type: 'ARC',
      center: arcCenter,
      radius,
      startAngle,
      endAngle,
    };

    // Shorten lineA and lineB to trim at tA and tB
    const updatedEntities = entities.map(e => {
      if (e.id === lineA.id) {
        const isStart = lineA.start.distanceTo(corner!) < 0.1;
        return {
          ...lineA,
          start: isStart ? tA : lineA.start,
          end: isStart ? lineA.end : tA,
        };
      }
      if (e.id === lineB.id) {
        const isStart = lineB.start.distanceTo(corner!) < 0.1;
        return {
          ...lineB,
          start: isStart ? tB : lineB.start,
          end: isStart ? lineB.end : tB,
        };
      }
      return e;
    });

    updatedEntities.push(newArc);
    return updatedEntities;
  }

  /**
   * Offset Tool: Offset a set of lines by distance D
   */
  public static offsetEntities(entities: SketchEntity[], distance: number): SketchEntity[] {
    const newEntities: SketchEntity[] = [];

    for (const ent of entities) {
      if (ent.type === 'LINE') {
        const dir = ent.end.clone().sub(ent.start).normalize();
        const normal = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(distance);
        newEntities.push({
          id: `line_offset_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'LINE',
          start: ent.start.clone().add(normal),
          end: ent.end.clone().add(normal),
        });
      } else if (ent.type === 'CIRCLE') {
        const newR = Math.max(0.1, ent.radius + distance);
        newEntities.push({
          id: `circle_offset_${Date.now()}`,
          type: 'CIRCLE',
          center: ent.center.clone(),
          radius: newR,
        });
      } else if (ent.type === 'RECTANGLE') {
        const sign = distance >= 0 ? 1 : -1;
        const absD = Math.abs(distance);
        const minX = Math.min(ent.start.x, ent.end.x) - sign * absD;
        const maxX = Math.max(ent.start.x, ent.end.x) + sign * absD;
        const minY = Math.min(ent.start.y, ent.end.y) - sign * absD;
        const maxY = Math.max(ent.start.y, ent.end.y) + sign * absD;
        newEntities.push({
          id: `rect_offset_${Date.now()}`,
          type: 'RECTANGLE',
          start: new THREE.Vector2(minX, minY),
          end: new THREE.Vector2(maxX, maxY),
        });
      }
    }

    return [...entities, ...newEntities];
  }

  /**
   * Detect Closed Profiles / Loops in 2D Sketch for 3D Extrusion
   */
  public static detectClosedProfiles(entities: SketchEntity[]): ClosedProfile[] {
    const profiles: ClosedProfile[] = [];
    const nodeTolerance = 0.15;

    // 1. Circles & Rectangles are intrinsically closed
    for (const ent of entities) {
      if (ent.type === 'CIRCLE') {
        const pts: THREE.Vector2[] = [];
        const segs = 32;
        for (let i = 0; i < segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          pts.push(new THREE.Vector2(ent.center.x + Math.cos(a) * ent.radius, ent.center.y + Math.sin(a) * ent.radius));
        }
        profiles.push({
          id: `profile_circle_${ent.id}`,
          points: pts,
          entityIds: [ent.id],
          area: Math.PI * ent.radius * ent.radius,
          isClockwise: false,
        });
      } else if (ent.type === 'RECTANGLE') {
        const p1 = ent.start.clone();
        const p2 = new THREE.Vector2(ent.end.x, ent.start.y);
        const p3 = ent.end.clone();
        const p4 = new THREE.Vector2(ent.start.x, ent.end.y);
        const w = Math.abs(ent.end.x - ent.start.x);
        const h = Math.abs(ent.end.y - ent.start.y);
        profiles.push({
          id: `profile_rect_${ent.id}`,
          points: [p1, p2, p3, p4],
          entityIds: [ent.id],
          area: w * h,
          isClockwise: false,
        });
      }
    }

    // 2. Line Segment loop detection
    const lines = entities.filter((e): e is LineSketchEntity => e.type === 'LINE');
    if (lines.length >= 3) {
      // Build adjacency
      const visited = new Set<string>();

      for (let startLine of lines) {
        if (visited.has(startLine.id)) continue;

        const pathPoints: THREE.Vector2[] = [startLine.start.clone(), startLine.end.clone()];
        const pathLineIds: string[] = [startLine.id];
        let currentEnd = startLine.end;
        let isClosed = false;

        for (let step = 0; step < lines.length; step++) {
          // Find connecting next line
          const nextLine = lines.find(
            l =>
              !pathLineIds.includes(l.id) &&
              (l.start.distanceTo(currentEnd) < nodeTolerance || l.end.distanceTo(currentEnd) < nodeTolerance)
          );

          if (!nextLine) {
            // Check if currentEnd is close to start of the first line
            if (currentEnd.distanceTo(startLine.start) < nodeTolerance && pathLineIds.length >= 3) {
              isClosed = true;
            }
            break;
          }

          pathLineIds.push(nextLine.id);
          if (nextLine.start.distanceTo(currentEnd) < nodeTolerance) {
            pathPoints.push(nextLine.end.clone());
            currentEnd = nextLine.end;
          } else {
            pathPoints.push(nextLine.start.clone());
            currentEnd = nextLine.start;
          }

          if (currentEnd.distanceTo(startLine.start) < nodeTolerance && pathLineIds.length >= 3) {
            isClosed = true;
            break;
          }
        }

        if (isClosed && pathPoints.length >= 3) {
          pathLineIds.forEach(id => visited.add(id));
          // Calculate polygon area via Shoelace formula
          let area = 0;
          for (let i = 0; i < pathPoints.length; i++) {
            const j = (i + 1) % pathPoints.length;
            area += pathPoints[i].x * pathPoints[j].y;
            area -= pathPoints[j].x * pathPoints[i].y;
          }
          area = Math.abs(area) * 0.5;

          profiles.push({
            id: `profile_loop_${Date.now()}_${profiles.length}`,
            points: pathPoints,
            entityIds: pathLineIds,
            area,
            isClockwise: false,
          });
        }
      }
    }

    return profiles;
  }

  /**
   * Convert 2D Closed Profile into 3D Extruded Mesh Geometry
   */
  public static create3DExtrusionFromProfile(
    profile: ClosedProfile,
    extrudeDepth: number = 1.0,
    bevelEnabled: boolean = true
  ): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const pts = profile.points;
    if (pts.length < 3) return new THREE.BoxGeometry(1, 1, 1);

    shape.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i].x, pts[i].y);
    }
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: extrudeDepth,
      bevelEnabled,
      bevelThickness: Math.min(0.08, extrudeDepth * 0.1),
      bevelSize: Math.min(0.08, extrudeDepth * 0.1),
      bevelSegments: 3,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.computeVertexNormals();
    return geom;
  }

  /**
   * Convert 2D Closed Profile into 360-degree Lathe Revolution Geometry
   */
  public static create3DLatheFromProfile(
    profile: ClosedProfile,
    segments: number = 32
  ): THREE.BufferGeometry {
    const points2D = profile.points.map(p => new THREE.Vector2(Math.abs(p.x), p.y));
    points2D.sort((a, b) => a.y - b.y);

    const latheGeom = new THREE.LatheGeometry(points2D, segments, 0, Math.PI * 2);
    latheGeom.computeVertexNormals();
    return latheGeom;
  }

  /**
   * Generate Dimension Labels for sketch visualization
   */
  public static computeDimensionLabels(entities: SketchEntity[]): DimensionLabel[] {
    const labels: DimensionLabel[] = [];

    for (const ent of entities) {
      if (ent.type === 'LINE') {
        const len = ent.start.distanceTo(ent.end);
        const mid = ent.start.clone().add(ent.end).multiplyScalar(0.5);
        labels.push({
          id: `dim_${ent.id}`,
          entityId: ent.id,
          text: `${len.toFixed(2)} mm`,
          position: mid,
          value: len,
          unit: 'mm',
          type: 'LENGTH',
        });
      } else if (ent.type === 'CIRCLE') {
        labels.push({
          id: `dim_${ent.id}`,
          entityId: ent.id,
          text: `R ${ent.radius.toFixed(2)} mm`,
          position: new THREE.Vector2(ent.center.x + ent.radius * 0.7, ent.center.y + ent.radius * 0.7),
          value: ent.radius,
          unit: 'mm',
          type: 'RADIUS',
        });
      } else if (ent.type === 'RECTANGLE') {
        const w = Math.abs(ent.end.x - ent.start.x);
        const h = Math.abs(ent.end.y - ent.start.y);
        const topMid = new THREE.Vector2((ent.start.x + ent.end.x) / 2, Math.max(ent.start.y, ent.end.y) + 0.2);
        const rightMid = new THREE.Vector2(Math.max(ent.start.x, ent.end.x) + 0.2, (ent.start.y + ent.end.y) / 2);
        labels.push({
          id: `dim_w_${ent.id}`,
          entityId: ent.id,
          text: `W: ${w.toFixed(2)}`,
          position: topMid,
          value: w,
          unit: 'mm',
          type: 'LENGTH',
        });
        labels.push({
          id: `dim_h_${ent.id}`,
          entityId: ent.id,
          text: `H: ${h.toFixed(2)}`,
          position: rightMid,
          value: h,
          unit: 'mm',
          type: 'LENGTH',
        });
      }
    }

    return labels;
  }

  public static applyFillet(
    lineAId: string,
    lineBId: string,
    radius: number,
    entities: SketchEntity[]
  ): SketchEntity[] {
    return this.filletCorners(lineAId, lineBId, radius, entities);
  }

  public static extrudeSketch(
    entities: SketchEntity[],
    depth: number = 1.0
  ): THREE.BufferGeometry | null {
    const profiles = this.detectClosedProfiles(entities);
    if (profiles.length > 0) {
      return this.create3DExtrusionFromProfile(profiles[0], depth);
    }
    const shapes: THREE.Shape[] = [];
    for (const ent of entities) {
      if (ent.type === 'CIRCLE') {
        const s = new THREE.Shape();
        s.absarc(ent.center.x, ent.center.y, ent.radius, 0, Math.PI * 2, false);
        shapes.push(s);
      } else if (ent.type === 'RECTANGLE') {
        const s = new THREE.Shape();
        const minX = Math.min(ent.start.x, ent.end.x);
        const maxX = Math.max(ent.start.x, ent.end.x);
        const minY = Math.min(ent.start.y, ent.end.y);
        const maxY = Math.max(ent.start.y, ent.end.y);
        s.moveTo(minX, minY);
        s.lineTo(maxX, minY);
        s.lineTo(maxX, maxY);
        s.lineTo(minX, maxY);
        s.closePath();
        shapes.push(s);
      }
    }
    if (shapes.length > 0) {
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 3,
      };
      const geom = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
      geom.computeVertexNormals();
      return geom;
    }
    return null;
  }
}
