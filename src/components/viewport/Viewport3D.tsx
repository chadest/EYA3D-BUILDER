/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Advanced Three.js WebGL Viewport
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { editorStore } from '../../store/EditorStore';
import { createSculptGizmo } from '../../core/sculpting/sculptBrush';
import { sculptingEngine, SculptingBrushConfig } from '../../core/sculpting/sculptEngine';
import {
  createCatmullRomCurve,
  buildCurveLineMesh,
} from '../../core/splines/splineTool';
import { buildLatticeCageWireframe } from '../../core/deformation/lattice';
import { LatticeModifierConfig } from '../../types/editor';
import {
  InteractivePrimitiveType,
  DrawingStep,
  snapValue,
  snapVector3,
  generatePrimitiveGeometry,
} from '../../core/primitives/interactivePrimitives';
import { Trash2, Camera } from 'lucide-react';
import { InteractivePrimitivePopup } from '../ui/InteractivePrimitivePopup';
import { TransformToolbar } from '../ui/TransformToolbar';
import { NavigationToolbar } from '../ui/NavigationToolbar';
import { AIChatButton } from '../ui/AIChatButton';
import { ScriptEditor } from '../ui/ScriptEditor';
import { RealisticRenderPipeline } from '../../core/rendering/renderPipeline';

// 1. Interactive 3D Coordinate Axis Orientation Gizmo (Matching User Screenshot)
interface ViewOrientationGizmoProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  onSnap: (dir: 'top' | 'front' | 'right' | 'left' | 'back' | 'bottom' | 'iso') => void;
}

const ViewOrientationGizmo: React.FC<ViewOrientationGizmoProps> = ({ cameraRef, onSnap }) => {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    let animId: number;
    const update = () => {
      setTick(t => (t + 1) % 100000);
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  const camera = cameraRef.current;
  if (!camera) return null;

  const cx = 60;
  const cy = 60;
  const radius = 36;

  const rawAxes: {
    id: 'top' | 'bottom' | 'right' | 'left' | 'front' | 'back';
    axis: 'X' | 'Y' | 'Z';
    isPositive: boolean;
    dir: THREE.Vector3;
    color: string;
  }[] = [
    { id: 'right', axis: 'X', isPositive: true, dir: new THREE.Vector3(1, 0, 0), color: '#DC2626' }, // Red
    { id: 'left', axis: 'X', isPositive: false, dir: new THREE.Vector3(-1, 0, 0), color: '#EF4444' },
    { id: 'top', axis: 'Y', isPositive: true, dir: new THREE.Vector3(0, 1, 0), color: '#16A34A' }, // Green
    { id: 'bottom', axis: 'Y', isPositive: false, dir: new THREE.Vector3(0, -1, 0), color: '#22C55E' },
    { id: 'front', axis: 'Z', isPositive: true, dir: new THREE.Vector3(0, 0, 1), color: '#2563EB' }, // Blue
    { id: 'back', axis: 'Z', isPositive: false, dir: new THREE.Vector3(0, 0, -1), color: '#3B82F6' },
  ];

  const matrix = camera.matrixWorldInverse;
  const nodes = rawAxes.map(item => {
    const v = item.dir.clone().transformDirection(matrix);
    return {
      ...item,
      x: cx + v.x * radius,
      y: cy - v.y * radius,
      z: v.z,
    };
  });

  // Sort by depth (z) ascending so background elements render first
  nodes.sort((a, b) => a.z - b.z);

  return (
    <div className="select-none pointer-events-auto bg-[#16181C]/40 backdrop-blur-sm p-2 rounded-2xl border border-[#2D3139]/50 shadow-2xl">
      <svg className="w-28 h-28 overflow-visible" viewBox="0 0 120 120">
        {/* Lines from center to positive axis heads */}
        {nodes.map(node => {
          if (!node.isPositive) return null;
          return (
            <line
              key={`line-${node.axis}`}
              x1={cx}
              y1={cy}
              x2={node.x}
              y2={node.y}
              stroke={node.color}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Center pivot point (Origin) */}
        <circle
          cx={cx}
          cy={cy}
          r="4"
          fill="#0F1113"
          stroke="#4A90E2"
          strokeWidth="1.5"
          className="cursor-pointer hover:scale-125 transition-transform"
          onClick={() => onSnap('iso')}
        >
          <title>Reset Isometric View</title>
        </circle>

        {/* Axis Nodes (Circles + Labels) */}
        {nodes.map(node => {
          if (node.isPositive) {
            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                onClick={() => onSnap(node.id)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="11"
                  fill={node.color}
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="transition-transform group-hover:scale-110 drop-shadow-md"
                />
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fill="#000000"
                  fontSize="11"
                  fontWeight="900"
                  fontFamily="sans-serif"
                  className="pointer-events-none select-none"
                >
                  {node.axis}
                </text>
              </g>
            );
          } else {
            return (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r="7"
                fill={node.color}
                opacity={node.z > 0 ? 0.9 : 0.6}
                className="cursor-pointer hover:scale-125 transition-transform drop-shadow-sm"
                onClick={() => onSnap(node.id)}
              >
                <title>View -{node.axis}</title>
              </circle>
            );
          }
        })}
      </svg>
    </div>
  );
};

// Utility functions for Geometry Manipulation (Vertex, Edge, Face)
const getVertexPosition = (geom: THREE.BufferGeometry, index: number, target: THREE.Vector3) => {
  const posAttr = geom.getAttribute('position');
  if (posAttr) {
    target.fromBufferAttribute(posAttr, index);
  }
};

const setVertexPosition = (geom: THREE.BufferGeometry, index: number, value: THREE.Vector3) => {
  const posAttr = geom.getAttribute('position');
  if (posAttr) {
    posAttr.setXYZ(index, value.x, value.y, value.z);
  }
};

const getFaceIndices = (geom: THREE.BufferGeometry, faceIndex: number): number[] => {
  const indexAttr = geom.index;
  if (indexAttr) {
    return [
      indexAttr.getX(faceIndex * 3),
      indexAttr.getX(faceIndex * 3 + 1),
      indexAttr.getX(faceIndex * 3 + 2)
    ];
  }
  return [faceIndex * 3, faceIndex * 3 + 1, faceIndex * 3 + 2];
};

const getEdgesList = (geom: THREE.BufferGeometry): [number, number][] => {
  const edges: [number, number][] = [];
  const edgeKeys = new Set<string>();
  
  const indexAttr = geom.index;
  const posAttr = geom.getAttribute('position');
  if (!posAttr) return [];
  
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const a = indexAttr.getX(i);
      const b = indexAttr.getX(i + 1);
      const c = indexAttr.getX(i + 2);
      
      const triEdges = [[a, b], [b, c], [c, a]];
      for (const [v1, v2] of triEdges) {
        const minVal = Math.min(v1, v2);
        const maxVal = Math.max(v1, v2);
        const key = `${minVal}_${maxVal}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push([minVal, maxVal]);
        }
      }
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      if (i + 2 >= posAttr.count) break;
      const a = i;
      const b = i + 1;
      const c = i + 2;
      
      const triEdges = [[a, b], [b, c], [c, a]];
      for (const [v1, v2] of triEdges) {
        const minVal = Math.min(v1, v2);
        const maxVal = Math.max(v1, v2);
        const key = `${minVal}_${maxVal}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push([minVal, maxVal]);
        }
      }
    }
  }
  return edges;
};

export const Viewport3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformRef = useRef<TransformControls | null>(null);

  // Visual Helper Objects
  const sculptGizmoRef = useRef<THREE.Mesh | null>(null);
  const curveLineRef = useRef<THREE.Line | null>(null);
  const curveHandlesRef = useRef<THREE.Group>(new THREE.Group());
  const selectionGizmoRef = useRef<THREE.Group>(new THREE.Group());
  const latticeWireframeRef = useRef<THREE.LineSegments | null>(null);
  const renderPipelineRef = useRef<RealisticRenderPipeline | null>(null);
  const xRayWireframeMapRef = useRef<Map<string, THREE.LineSegments>>(new Map());
  const interactiveSunRef = useRef<THREE.DirectionalLight | null>(null);
  const sunGizmoMeshRef = useRef<THREE.Mesh | null>(null);

  const isSculptingRef = useRef<boolean>(false);
  const isShiftPressedRef = useRef<boolean>(false);
  const lastHitPointRef = useRef<THREE.Vector3 | null>(null);

  // Edit Mode Helpers
  const editPointsRef = useRef<THREE.Points | null>(null);
  const editLinesRef = useRef<THREE.LineSegments | null>(null);
  const editFacesHighlightRef = useRef<THREE.Mesh | null>(null);
  const editFaceCentersRef = useRef<THREE.Points | null>(null);
  const editDummyRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const lastDummyPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const isDraggingEditDummy = useRef<boolean>(false);
  const [helperTrigger, setHelperTrigger] = useState(0);
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState<number | null>(null);
  const [, setTick] = useState(0);

  // Interactive Primitive Drawing References
  const previewMeshRef = useRef<THREE.Mesh | null>(null);
  const drawingDataRef = useRef<{
    anchorPoint: THREE.Vector3;
    surfaceNormal: THREE.Vector3;
    alignQuaternion: THREE.Quaternion;
    constructionPlane: THREE.Plane;
    baseWidth: number;
    baseDepth: number;
    baseRadius: number;
    height: number;
    minorRadius: number;
    starPoints: number;
    startClientY: number;
  } | null>(null);

  const handleCancelDrawing = () => {
    if (previewMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(previewMeshRef.current);
      previewMeshRef.current.geometry.dispose();
      if (Array.isArray(previewMeshRef.current.material)) {
        previewMeshRef.current.material.forEach(m => m.dispose());
      } else {
        previewMeshRef.current.material.dispose();
      }
      previewMeshRef.current = null;
    }
    drawingDataRef.current = null;
    editorStore.drawingStep = 'IDLE';
    editorStore.isInteractiveDrawingMode = false;
    editorStore.notify();
    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  useEffect(() => {
    editorStore.onCancelDrawingCallback = handleCancelDrawing;
    return () => {
      editorStore.onCancelDrawingCallback = null;
    };
  }, []);

  const getRayIntersectionOnSceneOrGrid = (mouse: THREE.Vector2) => {
    if (!cameraRef.current || !sceneRef.current) return null;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const validMeshes = editorStore.objects
      .map(o => o.mesh)
      .filter((m): m is THREE.Mesh => Boolean(m && m !== previewMeshRef.current));

    const intersects = raycaster.intersectObjects(validMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point.clone();
      let normal = new THREE.Vector3(0, 1, 0);

      if (hit.face) {
        normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      }

      return { point, normal, hitObject: hit.object };
    }

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundPoint = new THREE.Vector3();
    const hitGround = raycaster.ray.intersectPlane(groundPlane, groundPoint);

    if (hitGround) {
      return { point: groundPoint, normal: new THREE.Vector3(0, 1, 0), hitObject: null };
    }

    return null;
  };

  const handleAddDirectPrimitive = (type: InteractivePrimitiveType) => {
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
  };

  const finalizeInteractivePrimitive = () => {
    if (!previewMeshRef.current || !drawingDataRef.current) return;

    const type = editorStore.drawingPrimitiveType;
    const data = drawingDataRef.current;

    const finalGeom = generatePrimitiveGeometry(type, data);
    const finalMat = new THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      roughness: 0.3,
      metalness: 0.1,
      flatShading: editorStore.flatShading,
    });

    const mesh = new THREE.Mesh(finalGeom, finalMat);
    mesh.quaternion.copy(data.alignQuaternion);
    mesh.position.copy(data.anchorPoint);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    editorStore.addObject(`Interactive_${type}`, mesh);

    if (sceneRef.current) sceneRef.current.remove(previewMeshRef.current);
    previewMeshRef.current.geometry.dispose();
    if (Array.isArray(previewMeshRef.current.material)) {
      previewMeshRef.current.material.forEach(m => m.dispose());
    } else {
      previewMeshRef.current.material.dispose();
    }

    previewMeshRef.current = null;
    drawingDataRef.current = null;

    // Main levée: Relever le mode de dessin après la création pour réactiver la navigation libre
    editorStore.drawingStep = 'IDLE';
    editorStore.isInteractiveDrawingMode = false;
    editorStore.notify();

    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  useEffect(() => {
    // Keyboard Shortcuts for Undo/Redo, Shift Invert, and Blender Transform Shortcuts (G, R, S, X, Y, Z)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = true;
      }
      if (e.key === 'Escape') {
        handleCancelDrawing();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          editorStore.redoGeometry();
        } else {
          editorStore.undoGeometry();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editorStore.redoGeometry();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement?.tagName !== 'INPUT') {
        const key = e.key.toLowerCase();
        if (key === 'g') {
          editorStore.setGizmoMode('translate');
        } else if (key === 'r') {
          editorStore.setGizmoMode('rotate');
        } else if (key === 's') {
          editorStore.setGizmoMode('scale');
        } else if (key === 'x' && transformRef.current) {
          transformRef.current.showX = !transformRef.current.showX;
        } else if (key === 'y' && transformRef.current) {
          transformRef.current.showY = !transformRef.current.showY;
        } else if (key === 'z' && transformRef.current) {
          transformRef.current.showZ = !transformRef.current.showZ;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Synchronize callbacks for Zoom In / Zoom Out
  useEffect(() => {
    editorStore.onZoomInCallback = () => handleZoom(0.85);
    editorStore.onZoomOutCallback = () => handleZoom(1.15);
    return () => {
      editorStore.onZoomInCallback = null;
      editorStore.onZoomOutCallback = null;
    };
  }, []);

  // --- EDIT MODE SUB-SELECTION (VERTEX, EDGE, FACE) AND GIZMO SYSTEM ---
  // Clean up any helper objects from the scene
  const clearHelper = (ref: React.MutableRefObject<any>) => {
    if (ref.current) {
      if (sceneRef.current) sceneRef.current.remove(ref.current);
      if (ref.current.geometry) ref.current.geometry.dispose();
      if (ref.current.material) {
        if (Array.isArray(ref.current.material)) {
          ref.current.material.forEach((m: any) => m.dispose());
        } else {
          ref.current.material.dispose();
        }
      }
      ref.current = null;
    }
  };

  const handleEditDummyTransform = () => {
    const selObj = editorStore.getSelectedObject();
    if (!selObj || !selObj.mesh) return;
    
    const geom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;
    
    // Calculate world delta translation
    const currentPos = editDummyRef.current.position;
    const deltaTranslation = new THREE.Vector3().subVectors(currentPos, lastDummyPosition.current);
    
    // Transform deltaTranslation into local coordinate space of the mesh
    const localDelta = deltaTranslation.clone();
    localDelta.applyQuaternion(selObj.mesh.quaternion.clone().invert());
    localDelta.divide(selObj.mesh.scale);
    
    // Get unique vertices to update
    const vertexIndices = new Set<number>();
    
    if (editorStore.selectionLevel === 'vertex') {
      editorStore.selectedIndices.vertices.forEach(vIdx => vertexIndices.add(vIdx));
    } else if (editorStore.selectionLevel === 'edge') {
      const edgesList = getEdgesList(geom);
      editorStore.selectedIndices.edges.forEach(eIdx => {
        if (eIdx >= 0 && eIdx < edgesList.length) {
          vertexIndices.add(edgesList[eIdx][0]);
          vertexIndices.add(edgesList[eIdx][1]);
        }
      });
    } else if (editorStore.selectionLevel === 'face') {
      editorStore.selectedIndices.faces.forEach(fIdx => {
        const indices = getFaceIndices(geom, fIdx);
        indices.forEach(vIdx => vertexIndices.add(vIdx));
      });
    }
    
    if (vertexIndices.size > 0) {
      const temp = new THREE.Vector3();
      vertexIndices.forEach(vIdx => {
        getVertexPosition(geom, vIdx, temp);
        temp.add(localDelta);
        setVertexPosition(geom, vIdx, temp);
      });
      
      posAttr.needsUpdate = true;
      geom.computeVertexNormals();
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
      
      if (selObj.geometryBackup) {
        selObj.geometryBackup.copy(geom);
      }
      
      // Update the smoothed/subdivided mesh in real-time
      editorStore.reevaluateModifiers(selObj.id);
      
      // Update any wireframe/other visual representations of this object in the scene
      const overlay = xRayWireframeMapRef.current.get(selObj.id);
      if (overlay) {
        overlay.geometry.dispose();
        overlay.geometry = new THREE.WireframeGeometry(geom);
      }
    }
    
    // Re-save last dummy position
    lastDummyPosition.current.copy(currentPos);
    
    // Force recreate visual edit mode helper geometries to match new vertex positions!
    setHelperTrigger(t => t + 1);
  };

  // Synchronize visual edit helpers
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // 1. Clear previous helpers
    clearHelper(editPointsRef);
    clearHelper(editLinesRef);
    clearHelper(editFacesHighlightRef);
    clearHelper(editFaceCentersRef);
    
    const selObj = editorStore.getSelectedObject();
    if (editorStore.mode !== 'edit' || !selObj || !selObj.mesh) {
      if (transformRef.current && transformRef.current.object === editDummyRef.current) {
        transformRef.current.detach();
      }
      return;
    }
    
    const mesh = selObj.mesh;
    const geom = selObj.baseGeometry || selObj.geometryBackup || mesh.geometry;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;
    
    const edgesList = getEdgesList(geom);
    const selectedVerts = new Set(editorStore.selectedIndices.vertices);
    
    // 2. Generate point helper (Vertices) if Vertex level is selected
    if (editorStore.selectionLevel === 'vertex') {
      const vertexCount = posAttr.count;
      const ptsGeom = new THREE.BufferGeometry();
      const ptsPositions = new Float32Array(vertexCount * 3);
      const ptsColors = new Float32Array(vertexCount * 3);
      
      for (let i = 0; i < vertexCount; i++) {
        ptsPositions[i * 3] = posAttr.getX(i);
        ptsPositions[i * 3 + 1] = posAttr.getY(i);
        ptsPositions[i * 3 + 2] = posAttr.getZ(i);
        
        if (selectedVerts.has(i)) {
          // Selected: Orange/Gold (rgb: 0.98, 0.45, 0.08)
          ptsColors[i * 3] = 0.98;
          ptsColors[i * 3 + 1] = 0.45;
          ptsColors[i * 3 + 2] = 0.08;
        } else {
          // Unselected: Blue (rgb: 0.23, 0.51, 0.96)
          ptsColors[i * 3] = 0.23;
          ptsColors[i * 3 + 1] = 0.51;
          ptsColors[i * 3 + 2] = 0.96;
        }
      }
      
      ptsGeom.setAttribute('position', new THREE.BufferAttribute(ptsPositions, 3));
      ptsGeom.setAttribute('color', new THREE.BufferAttribute(ptsColors, 3));
      
      const ptsMat = new THREE.PointsMaterial({
        size: 8,
        sizeAttenuation: false,
        vertexColors: true,
        depthTest: false,
      });
      
      editPointsRef.current = new THREE.Points(ptsGeom, ptsMat);
      editPointsRef.current.position.copy(mesh.position);
      editPointsRef.current.quaternion.copy(mesh.quaternion);
      editPointsRef.current.scale.copy(mesh.scale);
      
      sceneRef.current.add(editPointsRef.current);
    }
    
    // 3. Generate line helper (Edges)
    const linesGeom = new THREE.BufferGeometry();
    const linesPositions = new Float32Array(edgesList.length * 2 * 3);
    const linesColors = new Float32Array(edgesList.length * 2 * 3);
    
    const selectedEdges = new Set(editorStore.selectedIndices.edges);
    
    edgesList.forEach((edge, i) => {
      const v1 = edge[0];
      const v2 = edge[1];
      
      const temp1 = new THREE.Vector3();
      const temp2 = new THREE.Vector3();
      getVertexPosition(geom, v1, temp1);
      getVertexPosition(geom, v2, temp2);
      
      linesPositions[i * 6] = temp1.x;
      linesPositions[i * 6 + 1] = temp1.y;
      linesPositions[i * 6 + 2] = temp1.z;
      
      linesPositions[i * 6 + 3] = temp2.x;
      linesPositions[i * 6 + 4] = temp2.y;
      linesPositions[i * 6 + 5] = temp2.z;
      
      const isSel = selectedEdges.has(i);
      const r = isSel ? 1.0 : 0.28;
      const g = isSel ? 0.95 : 0.33;
      const b = isSel ? 0.0 : 0.41;
      
      linesColors[i * 6] = r;
      linesColors[i * 6 + 1] = g;
      linesColors[i * 6 + 2] = b;
      linesColors[i * 6 + 3] = r;
      linesColors[i * 6 + 4] = g;
      linesColors[i * 6 + 5] = b;
    });
    
    linesGeom.setAttribute('position', new THREE.BufferAttribute(linesPositions, 3));
    linesGeom.setAttribute('color', new THREE.BufferAttribute(linesColors, 3));
    
    const linesMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 2,
      depthTest: false,
    });
    
    editLinesRef.current = new THREE.LineSegments(linesGeom, linesMat);
    editLinesRef.current.position.copy(mesh.position);
    editLinesRef.current.quaternion.copy(mesh.quaternion);
    editLinesRef.current.scale.copy(mesh.scale);
    
    // Only show edges helper when EDGE selection is active
    if (editorStore.selectionLevel === 'edge') {
      sceneRef.current.add(editLinesRef.current);
    }
    
    // 4. Generate faces highlight helper & face centers helper
    const selectedFaces = editorStore.selectedIndices.faces;
    const selectedFacesSet = new Set(selectedFaces);
    
    if (editorStore.selectionLevel === 'face') {
      // Faces highlight: Combine selected faces and hovered face
      const facesToDraw = [...selectedFaces];
      const hoverIndex = hoveredFaceIndex;
      const isHoveredAlreadySelected = hoverIndex !== null && selectedFacesSet.has(hoverIndex);
      
      if (hoverIndex !== null && !isHoveredAlreadySelected) {
        facesToDraw.push(hoverIndex);
      }
      
      if (facesToDraw.length > 0) {
        const facesGeom = new THREE.BufferGeometry();
        const facesPositions = new Float32Array(facesToDraw.length * 3 * 3);
        const facesColors = new Float32Array(facesToDraw.length * 3 * 3);
        
        facesToDraw.forEach((fIdx, i) => {
          const indices = getFaceIndices(geom, fIdx);
          const temp1 = new THREE.Vector3();
          const temp2 = new THREE.Vector3();
          const temp3 = new THREE.Vector3();
          
          getVertexPosition(geom, indices[0], temp1);
          getVertexPosition(geom, indices[1], temp2);
          getVertexPosition(geom, indices[2], temp3);
          
          facesPositions[i * 9] = temp1.x;
          facesPositions[i * 9 + 1] = temp1.y;
          facesPositions[i * 9 + 2] = temp1.z;
          
          facesPositions[i * 9 + 3] = temp2.x;
          facesPositions[i * 9 + 4] = temp2.y;
          facesPositions[i * 9 + 5] = temp2.z;
          
          facesPositions[i * 9 + 6] = temp3.x;
          facesPositions[i * 9 + 7] = temp3.y;
          facesPositions[i * 9 + 8] = temp3.z;
          
          const isSelected = selectedFacesSet.has(fIdx);
          // Selected: Vibrant Orange (rgb: 0.98, 0.45, 0.08)
          // Hovered: Beautiful Light Neon Blue (rgb: 0.0, 0.95, 1.0)
          const r = isSelected ? 0.98 : 0.0;
          const g = isSelected ? 0.45 : 0.95;
          const b = isSelected ? 0.08 : 1.0;
          
          for (let v = 0; v < 3; v++) {
            facesColors[i * 9 + v * 3] = r;
            facesColors[i * 9 + v * 3 + 1] = g;
            facesColors[i * 9 + v * 3 + 2] = b;
          }
        });
        
        facesGeom.setAttribute('position', new THREE.BufferAttribute(facesPositions, 3));
        facesGeom.setAttribute('color', new THREE.BufferAttribute(facesColors, 3));
        
        const facesMat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        
        editFacesHighlightRef.current = new THREE.Mesh(facesGeom, facesMat);
        editFacesHighlightRef.current.position.copy(mesh.position);
        editFacesHighlightRef.current.quaternion.copy(mesh.quaternion);
        editFacesHighlightRef.current.scale.copy(mesh.scale);
        
        sceneRef.current.add(editFacesHighlightRef.current);
      }
      
      // Face center dots (discreet Blender-style 3px dots)
      const faceCount = geom.index ? geom.index.count / 3 : posAttr.count / 3;
      const centersGeom = new THREE.BufferGeometry();
      const centersPositions = new Float32Array(faceCount * 3);
      const centersColors = new Float32Array(faceCount * 3);
      
      for (let fIdx = 0; fIdx < faceCount; fIdx++) {
        const indices = getFaceIndices(geom, fIdx);
        const temp1 = new THREE.Vector3();
        const temp2 = new THREE.Vector3();
        const temp3 = new THREE.Vector3();
        
        getVertexPosition(geom, indices[0], temp1);
        getVertexPosition(geom, indices[1], temp2);
        getVertexPosition(geom, indices[2], temp3);
        
        const centroid = new THREE.Vector3().add(temp1).add(temp2).add(temp3).divideScalar(3);
        centersPositions[fIdx * 3] = centroid.x;
        centersPositions[fIdx * 3 + 1] = centroid.y;
        centersPositions[fIdx * 3 + 2] = centroid.z;
        
        if (selectedFacesSet.has(fIdx)) {
          // Orange/Gold for selected center: rgb(0.98, 0.45, 0.08)
          centersColors[fIdx * 3] = 0.98;
          centersColors[fIdx * 3 + 1] = 0.45;
          centersColors[fIdx * 3 + 2] = 0.08;
        } else {
          // Crisp clean white for unselected center: rgb(1.0, 1.0, 1.0)
          centersColors[fIdx * 3] = 1.0;
          centersColors[fIdx * 3 + 1] = 1.0;
          centersColors[fIdx * 3 + 2] = 1.0;
        }
      }
      
      centersGeom.setAttribute('position', new THREE.BufferAttribute(centersPositions, 3));
      centersGeom.setAttribute('color', new THREE.BufferAttribute(centersColors, 3));
      
      const centersMat = new THREE.PointsMaterial({
        size: 3.5,
        sizeAttenuation: false,
        vertexColors: true,
        depthTest: true, // Prevents dots on back faces from displaying on top of front faces
      });
      
      editFaceCentersRef.current = new THREE.Points(centersGeom, centersMat);
      editFaceCentersRef.current.position.copy(mesh.position);
      editFaceCentersRef.current.quaternion.copy(mesh.quaternion);
      editFaceCentersRef.current.scale.copy(mesh.scale);
      
      sceneRef.current.add(editFaceCentersRef.current);
    }
    
    // 5. Position editDummyRef at centroid and attach transformControls
    let hasSelection = false;
    
    if (editorStore.selectionLevel === 'vertex' && selectedVerts.size > 0) {
      const centroid = new THREE.Vector3();
      const temp = new THREE.Vector3();
      selectedVerts.forEach(vIdx => {
        getVertexPosition(geom, vIdx, temp);
        centroid.add(temp);
      });
      centroid.divideScalar(selectedVerts.size);
      centroid.applyMatrix4(mesh.matrixWorld);
      
      editDummyRef.current.position.copy(centroid);
      editDummyRef.current.quaternion.set(0, 0, 0, 1);
      hasSelection = true;
    } else if (editorStore.selectionLevel === 'edge' && selectedEdges.size > 0) {
      const uniqueVerts = new Set<number>();
      selectedEdges.forEach(eIdx => {
        if (eIdx >= 0 && eIdx < edgesList.length) {
          uniqueVerts.add(edgesList[eIdx][0]);
          uniqueVerts.add(edgesList[eIdx][1]);
        }
      });
      if (uniqueVerts.size > 0) {
        const centroid = new THREE.Vector3();
        const temp = new THREE.Vector3();
        uniqueVerts.forEach(vIdx => {
          getVertexPosition(geom, vIdx, temp);
          centroid.add(temp);
        });
        centroid.divideScalar(uniqueVerts.size);
        centroid.applyMatrix4(mesh.matrixWorld);
        
        editDummyRef.current.position.copy(centroid);
        editDummyRef.current.quaternion.set(0, 0, 0, 1);
        hasSelection = true;
      }
    } else if (editorStore.selectionLevel === 'face' && selectedFacesSet.size > 0) {
      const uniqueVerts = new Set<number>();
      const centroid = new THREE.Vector3();
      const normalSum = new THREE.Vector3();
      const tempA = new THREE.Vector3();
      const tempB = new THREE.Vector3();
      const tempC = new THREE.Vector3();
      
      selectedFacesSet.forEach(fIdx => {
        const indices = getFaceIndices(geom, fIdx);
        indices.forEach(vIdx => uniqueVerts.add(vIdx));
        
        getVertexPosition(geom, indices[0], tempA);
        getVertexPosition(geom, indices[1], tempB);
        getVertexPosition(geom, indices[2], tempC);
        
        const tri = new THREE.Triangle(tempA, tempB, tempC);
        const norm = new THREE.Vector3();
        tri.getNormal(norm);
        normalSum.add(norm);
      });
      
      if (uniqueVerts.size > 0) {
        const temp = new THREE.Vector3();
        uniqueVerts.forEach(vIdx => {
          getVertexPosition(geom, vIdx, temp);
          centroid.add(temp);
        });
        centroid.divideScalar(uniqueVerts.size);
        centroid.applyMatrix4(mesh.matrixWorld);
        
        normalSum.normalize();
        const worldNormal = normalSum.clone().transformDirection(mesh.matrixWorld).normalize();
        
        editDummyRef.current.position.copy(centroid);
        editDummyRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldNormal);
        hasSelection = true;
      }
    }
    
    if (transformRef.current) {
      if (hasSelection) {
        if (transformRef.current.object !== editDummyRef.current) {
          transformRef.current.attach(editDummyRef.current);
        }
        if (editorStore.selectionLevel === 'face') {
          transformRef.current.setSpace('local');
        } else {
          transformRef.current.setSpace('world');
        }
      } else {
        if (transformRef.current.object === editDummyRef.current) {
          transformRef.current.detach();
        }
      }
    }
  }, [
    helperTrigger,
    editorStore.mode,
    editorStore.selectionLevel,
    editorStore.selectedIndices.vertices.length,
    editorStore.selectedIndices.edges.length,
    editorStore.selectedIndices.faces.length,
    editorStore.selectedObjectId,
    hoveredFaceIndex,
  ]);

  // Hook up event listeners on transformControls for editDummy manipulation
  useEffect(() => {
    const transformControls = transformRef.current;
    if (!transformControls) return;
    
    const handleMouseDown = () => {
      if (editorStore.mode === 'edit' && transformControls.object === editDummyRef.current) {
        isDraggingEditDummy.current = true;
        lastDummyPosition.current.copy(editDummyRef.current.position);
        
        const selObj = editorStore.getSelectedObject();
        if (selObj) {
          editorStore.pushGeometryState(selObj.id);
        }
      }
    };
    
    const handleMouseUp = () => {
      if (isDraggingEditDummy.current) {
        isDraggingEditDummy.current = false;
        
        const selObj = editorStore.getSelectedObject();
        if (selObj && selObj.mesh) {
          editorStore.updateGeometryBackup(selObj.id, selObj.mesh.geometry);
          editorStore.notify();
        }
      }
    };
    
    const handleObjectChange = () => {
      if (editorStore.mode === 'edit' && transformControls.object === editDummyRef.current && isDraggingEditDummy.current) {
        handleEditDummyTransform();
      }
    };
    
    transformControls.addEventListener('mouseDown', handleMouseDown);
    transformControls.addEventListener('mouseUp', handleMouseUp);
    transformControls.addEventListener('objectChange', handleObjectChange);
    
    return () => {
      transformControls.removeEventListener('mouseDown', handleMouseDown);
      transformControls.removeEventListener('mouseUp', handleMouseUp);
      transformControls.removeEventListener('objectChange', handleObjectChange);
    };
  }, [transformRef.current, helperTrigger]);

  // Synchronize React state to re-render component and trigger effect on store change
  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const handleZoom = (factor: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    offset.multiplyScalar(factor);
    // Prevent getting too close or too far
    if (offset.length() > 0.1 && offset.length() < 100) {
      camera.position.addVectors(controls.target, offset);
      controls.update();
    }
  };

  // Handle Camera/Plane Locking
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current || !transformRef.current) return;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const transformControls = transformRef.current;

    if (editorStore.isCameraLocked) {
      // 1. Get closest axis view
      const getClosestAxisDir = (cam: THREE.Camera, tgt: THREE.Vector3) => {
        const dir = new THREE.Vector3().subVectors(cam.position, tgt).normalize();
        const axes = [
          { name: 'right', vec: new THREE.Vector3(1, 0, 0) },
          { name: 'left', vec: new THREE.Vector3(-1, 0, 0) },
          { name: 'top', vec: new THREE.Vector3(0, 1, 0) },
          { name: 'bottom', vec: new THREE.Vector3(0, -1, 0) },
          { name: 'front', vec: new THREE.Vector3(0, 0, 1) },
          { name: 'back', vec: new THREE.Vector3(0, 0, -1) }
        ];
        let maxDot = -1;
        let closest = 'front';
        for (const axis of axes) {
          const dot = dir.dot(axis.vec);
          if (dot > maxDot) {
            maxDot = dot;
            closest = axis.name;
          }
        }
        return closest as 'top' | 'front' | 'right' | 'left' | 'back' | 'bottom';
      };

      const closest = getClosestAxisDir(camera, controls.target);
      // 2. Snap camera to that view
      snapCamera(closest);

      // 3. Disable OrbitControls rotation
      controls.enableRotate = false;

      // 4. Restrict TransformControls axes to 2D plane
      if (closest === 'top' || closest === 'bottom') {
        transformControls.showX = true;
        transformControls.showY = false;
        transformControls.showZ = true;
      } else if (closest === 'front' || closest === 'back') {
        transformControls.showX = true;
        transformControls.showY = true;
        transformControls.showZ = false;
      } else { // right or left
        transformControls.showX = false;
        transformControls.showY = true;
        transformControls.showZ = true;
      }
    } else {
      // Unlock rotation and restore all axes
      controls.enableRotate = true;
      transformControls.showX = true;
      transformControls.showY = true;
      transformControls.showZ = true;
    }
  }, [editorStore.isCameraLocked]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. SCENE SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090a0c); // Elegant Dark deep background
    sceneRef.current = scene;
    editorStore.activeThreeScene = scene;

    // 2. CAMERA SETUP
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(4, 3, 5);
    cameraRef.current = camera;
    editorStore.activeThreeCamera = camera;

    // 3. RENDERER SETUP
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    editorStore.activeThreeRenderer = renderer;

    // 4. LIGHTING SYSTEM
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Interactive Sun & Emissive Physical Mesh (Directional Light + Glowing Sphere)
    const sunSettings = editorStore.sunSettings;
    const sunLight = new THREE.DirectionalLight(sunSettings.color, sunSettings.intensity);
    sunLight.position.set(...sunSettings.position);
    sunLight.target.position.set(...sunSettings.target);
    sunLight.castShadow = sunSettings.castShadow;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = sunSettings.shadowBias;
    scene.add(sunLight);
    scene.add(sunLight.target);
    interactiveSunRef.current = sunLight;

    // Physical Sun Mesh with Emissive Material for Real Bloom Glow
    const sunGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const sunMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(sunSettings.color),
      emissive: new THREE.Color(sunSettings.color),
      emissiveIntensity: 5.0,
      roughness: 0.1,
      metalness: 0.1,
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(...sunSettings.position);
    sunMesh.scale.setScalar(sunSettings.scale);
    sunMesh.name = 'InteractiveSunMesh';
    scene.add(sunMesh);
    sunGizmoMeshRef.current = sunMesh;

    const dirLight2 = new THREE.DirectionalLight(0x4a90e2, 0.3);
    dirLight2.position.set(-8, -6, -8);
    scene.add(dirLight2);

    // 5. GRID & AXES HELPERS
    const gridHelper = new THREE.GridHelper(20, 20, 0x4a90e2, 0x2d3139);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(2);
    axesHelper.position.set(-5, 0.01, -5);
    scene.add(axesHelper);

    // 6. ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Restrict looking below floor
    controlsRef.current = controls;

    // 7. TRANSFORM CONTROLS (GIZMO)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.75;
    scene.add(transformControls.getHelper());
    transformRef.current = transformControls;

    // Disable OrbitControls when dragging transform gizmo
    transformControls.addEventListener('dragging-changed', event => {
      controls.enabled = !event.value;
    });
    transformControls.addEventListener('mouseDown', () => {
      controls.enabled = false;
    });
    transformControls.addEventListener('mouseUp', () => {
      controls.enabled = true;
    });

    // 8. SCULPT GIZMO & HELPER GROUPS
    const sculptGizmo = createSculptGizmo();
    scene.add(sculptGizmo);
    sculptGizmoRef.current = sculptGizmo;

    scene.add(curveHandlesRef.current);
    scene.add(selectionGizmoRef.current);
    scene.add(editDummyRef.current);

    // Initialize Realistic Render Pipeline
    const renderPipeline = new RealisticRenderPipeline();
    renderPipeline.init(renderer, scene, camera);
    renderPipelineRef.current = renderPipeline;

    // Add initial cube primitive if empty
    if (editorStore.objects.length === 0) {
      const initGeom = new THREE.BoxGeometry(1.5, 1.5, 1.5, 4, 4, 4);
      const initMat = new THREE.MeshStandardMaterial({
        color: 0x4a90e2,
        roughness: 0.3,
        metalness: 0.1,
      });
      const initMesh = new THREE.Mesh(initGeom, initMat);
      initMesh.castShadow = true;
      initMesh.receiveShadow = true;
      initMesh.position.set(0, 0.75, 0);
      editorStore.addObject('Cube Primitive', initMesh);
    }

    // 9. ANIMATION LOOP
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Sync sun light position with physical sun mesh position
      if (sunGizmoMeshRef.current && interactiveSunRef.current) {
        interactiveSunRef.current.position.copy(sunGizmoMeshRef.current.position);
        // Update store position if dragged
        const curPos = editorStore.sunSettings.position;
        const newPos: [number, number, number] = [
          sunGizmoMeshRef.current.position.x,
          sunGizmoMeshRef.current.position.y,
          sunGizmoMeshRef.current.position.z,
        ];
        if (
          Math.abs(curPos[0] - newPos[0]) > 0.001 ||
          Math.abs(curPos[1] - newPos[1]) > 0.001 ||
          Math.abs(curPos[2] - newPos[2]) > 0.001
        ) {
          editorStore.setSunPosition(newPos);
        }
      }

      // Sync scene meshes with store objects and handle X-Ray / Transparent Wireframe Mode (Edition Mode Only)
      const isXRayActive = editorStore.xRayMode && editorStore.mode === 'edit';

      editorStore.objects.forEach(obj => {
        if (obj.mesh) {
          if (!scene.children.includes(obj.mesh)) {
            scene.add(obj.mesh);
          }

          const mat = obj.mesh.material;
          const materials = Array.isArray(mat) ? mat : [mat];

          materials.forEach(m => {
            if (isXRayActive) {
              m.transparent = true;
              m.opacity = 0.4;
              m.depthWrite = false;
              m.needsUpdate = true;
            } else {
              m.transparent = false;
              m.opacity = 1.0;
              m.depthWrite = true;
              m.needsUpdate = true;
            }
          });

          // Manage X-Ray Wireframe Overlay
          let wireframeOverlay = xRayWireframeMapRef.current.get(obj.id);
          if (isXRayActive) {
            if (!wireframeOverlay) {
              const wireGeom = new THREE.WireframeGeometry(obj.mesh.geometry);
              const wireMat = new THREE.LineBasicMaterial({
                color: 0x38bdf8, // Neon sky blue contrast
                linewidth: 1.5,
                transparent: true,
                opacity: 0.8,
              });
              wireframeOverlay = new THREE.LineSegments(wireGeom, wireMat);
              obj.mesh.add(wireframeOverlay);
              xRayWireframeMapRef.current.set(obj.id, wireframeOverlay);
            } else {
              wireframeOverlay.visible = true;
            }
          } else {
            if (wireframeOverlay) {
              wireframeOverlay.visible = false;
            }
          }
        }
      });

      // Sync selection gizmos & gizmo mode
      if (transformControls.mode !== editorStore.gizmoMode) {
        transformControls.setMode(editorStore.gizmoMode);
      }

      const selObj = editorStore.getSelectedObject();
      if (selObj && selObj.mesh && editorStore.mode === 'object') {
        if (transformControls.object !== selObj.mesh) {
          transformControls.attach(selObj.mesh);
        }
      } else {
        transformControls.detach();
      }

      // Update Spline Curve Visualization
      if (editorStore.mode === 'curve') {
        const curve = createCatmullRomCurve(editorStore.curveControlPoints);
        if (curve) {
          if (curveLineRef.current) scene.remove(curveLineRef.current);
          const lineMesh = buildCurveLineMesh(curve);
          scene.add(lineMesh);
          curveLineRef.current = lineMesh;
        }

        // Render Control Handle spheres
        curveHandlesRef.current.clear();
        editorStore.curveControlPoints.forEach(pt => {
          const sphereGeom = new THREE.SphereGeometry(0.08, 12, 12);
          const sphereMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
          const handle = new THREE.Mesh(sphereGeom, sphereMat);
          handle.position.copy(pt);
          curveHandlesRef.current.add(handle);
        });
      } else {
        if (curveLineRef.current) scene.remove(curveLineRef.current);
        curveHandlesRef.current.clear();
      }

      // Update Lattice Cage Wireframe
      if (selObj && editorStore.mode === 'deform') {
        const latMod = selObj.modifiers.find(m => m.type === 'lattice' && m.enabled) as LatticeModifierConfig | undefined;
        if (latMod && latMod.points) {
          if (latticeWireframeRef.current) scene.remove(latticeWireframeRef.current);
          const latticeWire = buildLatticeCageWireframe(latMod.resolution, latMod.points);
          scene.add(latticeWire);
          latticeWireframeRef.current = latticeWire;
        }
      } else {
        if (latticeWireframeRef.current) scene.remove(latticeWireframeRef.current);
      }

      if (editorStore.isRenderMode) {
        gridHelper.visible = false;
        axesHelper.visible = false;
        transformControls.enabled = false;
        transformControls.getHelper().visible = false;
        renderPipeline.enableRenderEnvironment(scene);
        renderPipeline.render(renderer, scene, camera);
      } else {
        gridHelper.visible = editorStore.showGrid;
        axesHelper.visible = true;
        transformControls.enabled = true;
        transformControls.getHelper().visible = true;
        renderPipeline.disableRenderEnvironment(scene);
        renderer.render(scene, camera);
      }
    };

    animate();

    // 10. RESIZE HANDLER
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      if (renderPipelineRef.current) {
        renderPipelineRef.current.setSize(w, h);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
      editorStore.activeThreeScene = null;
      editorStore.activeThreeCamera = null;
      editorStore.activeThreeRenderer = null;
    };
  }, []);

  // Sync background color when themeMode changes
  useEffect(() => {
    if (sceneRef.current) {
      if (editorStore.themeMode === 'night') {
        sceneRef.current.background = new THREE.Color(0x04060c);
      } else if (editorStore.themeMode === 'light') {
        sceneRef.current.background = new THREE.Color(0xeaecec);
      } else {
        sceneRef.current.background = new THREE.Color(0x090a0c);
      }
    }
  }, [editorStore.themeMode]);

  // Sync Interactive Sun and Gizmo visibility with store settings and render mode
  useEffect(() => {
    if (interactiveSunRef.current) {
      interactiveSunRef.current.color.set(editorStore.sunSettings.color);
      interactiveSunRef.current.intensity = editorStore.sunSettings.intensity;
      interactiveSunRef.current.position.set(...editorStore.sunSettings.position);
      interactiveSunRef.current.castShadow = editorStore.sunSettings.castShadow;
      interactiveSunRef.current.shadow.bias = editorStore.sunSettings.shadowBias;
    }
    if (sunGizmoMeshRef.current) {
      sunGizmoMeshRef.current.position.set(...editorStore.sunSettings.position);
      sunGizmoMeshRef.current.scale.setScalar(editorStore.sunSettings.scale);
      // In render mode, the physical sun mesh remains visible in the sky/scene, but gizmo is hidden or not transformable
      sunGizmoMeshRef.current.visible = true; // Physical solid sun is always visible in scene

      const sunMat = sunGizmoMeshRef.current.material as THREE.MeshStandardMaterial;
      if (sunMat && sunMat.color && sunMat.emissive) {
        sunMat.color.set(editorStore.sunSettings.color);
        sunMat.emissive.set(editorStore.sunSettings.color);
        sunMat.emissiveIntensity = 5.0;
        sunMat.needsUpdate = true;
      }
    }
  }, [editorStore.sunSettings, editorStore.isRenderMode]);

  // Raycasting Mouse Interaction Handler for Selection & Sculpting
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editorStore.isRenderMode) return;
    if (!containerRef.current || !sceneRef.current || !cameraRef.current) return;

    // --- Interactive Primitive Drawing Real-time Updates ---
    if (
      editorStore.isInteractiveDrawingMode &&
      previewMeshRef.current &&
      drawingDataRef.current
    ) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const data = drawingDataRef.current;
      const type = editorStore.drawingPrimitiveType;

      if (editorStore.drawingStep === 'DRAWING_BASE') {
        const intersectionPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(data.constructionPlane, intersectionPoint)) {
          const disp = intersectionPoint.clone().sub(data.anchorPoint);
          const localDisp = disp.clone().applyQuaternion(data.alignQuaternion.clone().invert());

          if (type === 'plane' || type === 'cube') {
            data.baseWidth = Math.max(
              0.1,
              snapValue(Math.abs(localDisp.x) * 2, editorStore.drawingSnapStep, editorStore.drawingSnapEnabled)
            );
            data.baseDepth = Math.max(
              0.1,
              snapValue(Math.abs(localDisp.z) * 2, editorStore.drawingSnapStep, editorStore.drawingSnapEnabled)
            );
          } else {
            data.baseRadius = Math.max(
              0.1,
              snapValue(intersectionPoint.distanceTo(data.anchorPoint), editorStore.drawingSnapStep, editorStore.drawingSnapEnabled)
            );
            data.minorRadius = data.baseRadius * 0.25;
          }

          // Geometry reuse optimization: dispose old geometry and assign updated geometry
          previewMeshRef.current.geometry.dispose();
          previewMeshRef.current.geometry = generatePrimitiveGeometry(type, data);
        }
      } else if (editorStore.drawingStep === 'EXTRUDING_HEIGHT') {
        const dy = (data.startClientY - e.clientY) * 0.03;
        const snappedH = snapValue(dy, editorStore.drawingSnapStep, editorStore.drawingSnapEnabled);
        data.height = Math.abs(snappedH) < 0.1 ? (snappedH >= 0 ? 0.1 : -0.1) : snappedH;

        if (type === 'torus') {
          data.minorRadius = Math.max(
            0.05,
            snapValue(Math.abs(dy), editorStore.drawingSnapStep, editorStore.drawingSnapEnabled)
          );
        }

        // Geometry reuse optimization: dispose old geometry and assign updated geometry
        previewMeshRef.current.geometry.dispose();
        previewMeshRef.current.geometry = generatePrimitiveGeometry(type, data);
      }

      return; // Do not process selection or sculpt raycasts while drawing
    }

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const selObj = editorStore.getSelectedObject();

    // 1. Digital Sculpting Raycast
    if (editorStore.mode === 'sculpt' && selObj && selObj.mesh) {
      if (controlsRef.current) controlsRef.current.enabled = !isSculptingRef.current;

      const intersects = raycaster.intersectObject(selObj.mesh);

      if (intersects.length > 0) {
        const hit = intersects[0];

        if (sculptGizmoRef.current) {
          sculptGizmoRef.current.visible = true;
          sculptGizmoRef.current.position.copy(hit.point);
          const r = editorStore.sculptSettings.radius;
          sculptGizmoRef.current.scale.set(r, r, r);
        }

        if (isSculptingRef.current && hit.face) {
          const inverseMatrix = selObj.mesh.matrixWorld.clone().invert();
          const hitPointLocal = hit.point.clone().applyMatrix4(inverseMatrix);
          const hitNormalWorld = hit.face.normal.clone().transformDirection(selObj.mesh.matrixWorld);
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(selObj.mesh.matrixWorld).invert();
          const hitNormalLocal = hitNormalWorld.clone().applyMatrix3(normalMatrix).normalize();

          let dragDeltaLocal: THREE.Vector3 | undefined = undefined;
          if (lastHitPointRef.current) {
            dragDeltaLocal = hitPointLocal.clone().sub(lastHitPointRef.current);
          }
          lastHitPointRef.current = hitPointLocal.clone();

          const isShift = isShiftPressedRef.current;
          const effectiveMode = isShift ? 'smooth' : editorStore.sculptSettings.mode;

          const config: SculptingBrushConfig = {
            mode: effectiveMode,
            radius: editorStore.sculptSettings.radius,
            strength: editorStore.sculptSettings.strength,
            invert: editorStore.sculptSettings.invert,
            falloff: editorStore.sculptSettings.falloff || 'smoothstep',
            symmetryX: editorStore.sculptSettings.symmetryX || false,
            symmetryY: editorStore.sculptSettings.symmetryY || false,
            symmetryZ: editorStore.sculptSettings.symmetryZ || false,
          };

          // Apply sculpt deformation in real-time via SculptingEngine
          sculptingEngine.applyStroke(
            selObj.mesh,
            hitPointLocal,
            hitNormalLocal,
            config,
            dragDeltaLocal
          );

          editorStore.notify();
        }
      } else {
        if (sculptGizmoRef.current) sculptGizmoRef.current.visible = false;
      }
    } else {
      if (sculptGizmoRef.current) sculptGizmoRef.current.visible = false;
      if (controlsRef.current) controlsRef.current.enabled = true;
      
      // Face Hover Raycasting in Edit Mode
      if (editorStore.mode === 'edit' && editorStore.selectionLevel === 'face' && selObj && selObj.mesh) {
        const cageGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
        const tempMesh = new THREE.Mesh(cageGeom, Array.isArray(selObj.mesh.material) ? selObj.mesh.material[0] : selObj.mesh.material);
        tempMesh.position.copy(selObj.mesh.position);
        tempMesh.quaternion.copy(selObj.mesh.quaternion);
        tempMesh.scale.copy(selObj.mesh.scale);
        tempMesh.updateMatrix();
        tempMesh.updateMatrixWorld(true);

        const intersects = raycaster.intersectObject(tempMesh);
        if (intersects.length > 0 && intersects[0].faceIndex !== undefined) {
          const fIdx = intersects[0].faceIndex;
          if (hoveredFaceIndex !== fIdx) {
            setHoveredFaceIndex(fIdx);
          }
        } else {
          if (hoveredFaceIndex !== null) {
            setHoveredFaceIndex(null);
          }
        }
      } else {
        if (hoveredFaceIndex !== null) {
          setHoveredFaceIndex(null);
        }
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only

    if (transformRef.current && (transformRef.current as any).axis) {
      return; // Clicking on transform gizmo, do not raycast or select underlying objects
    }

    // --- Interactive Primitive Drawing Trigger ---
    if (editorStore.isInteractiveDrawingMode) {
      if (!containerRef.current || !sceneRef.current || !cameraRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      if (editorStore.drawingStep === 'IDLE') {
        const intersection = getRayIntersectionOnSceneOrGrid(mouse);
        if (!intersection) return;

        const anchorPoint = snapVector3(
          intersection.point,
          editorStore.drawingSnapStep,
          editorStore.drawingSnapEnabled
        );
        const surfaceNormal = intersection.normal.clone();

        const alignQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          surfaceNormal
        );

        const constructionPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          surfaceNormal,
          anchorPoint
        );

        const type = editorStore.drawingPrimitiveType;
        const initialParams = {
          baseWidth: 0.1,
          baseDepth: 0.1,
          baseRadius: 0.1,
          height: 0.05,
          minorRadius: 0.02,
          starPoints: 5,
        };

        const geom = generatePrimitiveGeometry(type, initialParams);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4a90e2,
          transparent: true,
          opacity: 0.75,
          roughness: 0.3,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });

        const previewMesh = new THREE.Mesh(geom, mat);
        previewMesh.quaternion.copy(alignQuaternion);
        previewMesh.position.copy(anchorPoint);

        sceneRef.current.add(previewMesh);
        previewMeshRef.current = previewMesh;

        drawingDataRef.current = {
          anchorPoint,
          surfaceNormal,
          alignQuaternion,
          constructionPlane,
          baseWidth: 0.1,
          baseDepth: 0.1,
          baseRadius: 0.1,
          height: 0.05,
          minorRadius: 0.02,
          starPoints: 5,
          startClientY: e.clientY,
        };

        editorStore.drawingStep = 'DRAWING_BASE';
        editorStore.notify();

        if (controlsRef.current) controlsRef.current.enabled = false;
        return;
      }

      if (editorStore.drawingStep === 'EXTRUDING_HEIGHT') {
        finalizeInteractivePrimitive();
        return;
      }
    }

    if (editorStore.mode === 'sculpt') {
      const selObj = editorStore.getSelectedObject();
      if (selObj) {
        isSculptingRef.current = true;
        lastHitPointRef.current = null;
        editorStore.pushGeometryState(selObj.id);
      }
    } else if (editorStore.mode === 'object') {
      // Raycast Object Selection
      if (!sceneRef.current || !cameraRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const meshes = editorStore.objects.map(o => o.mesh!).filter(Boolean);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitObject = editorStore.objects.find(o => o.mesh === hit.object);

        if (hitObject) {
          editorStore.setSelectedObject(hitObject.id);
        }
      }
    } else if (editorStore.mode === 'edit') {
      // Raycast Sub-selection (Vertices, Edges, Faces)
      if (!sceneRef.current || !cameraRef.current || !containerRef.current) return;
      const selObj = editorStore.getSelectedObject();
      if (!selObj || !selObj.mesh) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      if (editorStore.selectionLevel === 'vertex' && editPointsRef.current) {
        raycaster.params.Points.threshold = 0.05;
        const intersects = raycaster.intersectObject(editPointsRef.current);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.index !== undefined) {
            editorStore.toggleSelectionIndex('vertices', hit.index);
            e.stopPropagation();
            return;
          }
        }
        editorStore.clearMeshSelections();
      } else if (editorStore.selectionLevel === 'edge' && editLinesRef.current) {
        raycaster.params.Line.threshold = 0.05;
        const intersects = raycaster.intersectObject(editLinesRef.current);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.index !== undefined) {
            const edgeIdx = Math.floor(hit.index / 2);
            editorStore.toggleSelectionIndex('edges', edgeIdx);
            e.stopPropagation();
            return;
          }
        }
        editorStore.clearMeshSelections();
      } else if (editorStore.selectionLevel === 'face') {
        const cageGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
        const tempMesh = new THREE.Mesh(cageGeom, Array.isArray(selObj.mesh.material) ? selObj.mesh.material[0] : selObj.mesh.material);
        tempMesh.position.copy(selObj.mesh.position);
        tempMesh.quaternion.copy(selObj.mesh.quaternion);
        tempMesh.scale.copy(selObj.mesh.scale);
        tempMesh.updateMatrix();
        tempMesh.updateMatrixWorld(true);

        const intersects = raycaster.intersectObject(tempMesh);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.faceIndex !== undefined) {
            editorStore.toggleSelectionIndex('faces', hit.faceIndex);
            e.stopPropagation();
            return;
          }
        }
        editorStore.clearMeshSelections();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    // --- Interactive Primitive Drawing Transition ---
    if (
      editorStore.isInteractiveDrawingMode &&
      editorStore.drawingStep === 'DRAWING_BASE' &&
      previewMeshRef.current &&
      drawingDataRef.current
    ) {
      const type = editorStore.drawingPrimitiveType;
      if (type === 'plane' || type === 'sphere') {
        finalizeInteractivePrimitive();
      } else {
        editorStore.drawingStep = 'EXTRUDING_HEIGHT';
        drawingDataRef.current.startClientY = e.clientY;
        editorStore.notify();
      }
      return;
    }

    isSculptingRef.current = false;
    lastHitPointRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;

    // Backup sculpt geometry after sculpt stroke finishes
    const selObj = editorStore.getSelectedObject();
    if (editorStore.mode === 'sculpt' && selObj && selObj.mesh) {
      editorStore.updateGeometryBackup(selObj.id, selObj.mesh.geometry);
    }
  };

  const snapCamera = (dir: 'top' | 'front' | 'right' | 'left' | 'back' | 'bottom' | 'iso') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dist = 8;
    switch (dir) {
      case 'top':
        cameraRef.current.position.set(0, dist, 0.001);
        break;
      case 'front':
        cameraRef.current.position.set(0, 0, dist);
        break;
      case 'right':
        cameraRef.current.position.set(dist, 0, 0);
        break;
      case 'left':
        cameraRef.current.position.set(-dist, 0, 0);
        break;
      case 'back':
        cameraRef.current.position.set(0, 0, -dist);
        break;
      case 'bottom':
        cameraRef.current.position.set(0, -dist, 0.001);
        break;
      case 'iso':
        cameraRef.current.position.set(5, 5, 5);
        break;
    }
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const selObj = editorStore.getSelectedObject();
  const objPos = selObj?.mesh ? selObj.mesh.position : new THREE.Vector3(0, 0, 0);
  
  let objSize = new THREE.Vector3(0, 0, 0);
  if (selObj?.mesh) {
    selObj.mesh.geometry.computeBoundingBox();
    if (selObj.mesh.geometry.boundingBox) {
      selObj.mesh.geometry.boundingBox.getSize(objSize);
      objSize.multiply(selObj.mesh.scale);
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoveredFaceIndex(null)}
      className="flex-1 w-full h-full relative cursor-crosshair bg-[#0B0D10] overflow-hidden select-none"
    >
      {/* Top Left Floating Widgets (Orientation Gizmo, Transform Toolbar & Navigation Toolbar) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-[14px] select-none pointer-events-auto">
        <ViewOrientationGizmo cameraRef={cameraRef} onSnap={snapCamera} />
        <div className="flex flex-col gap-2 items-center">
          <TransformToolbar />
          <NavigationToolbar />
        </div>
      </div>

      {/* 2. Low-profile Bottom-Left Coordinates Display */}
      {selObj && selObj.mesh && (
        <div className="absolute bottom-4 left-4 z-10 bg-[#16181C]/80 backdrop-blur border border-[#2D3139]/60 px-3 py-1.5 rounded-md text-[11px] font-mono text-slate-400 select-none shadow-md flex items-center space-x-2">
          <span>x: <strong className="text-rose-400 font-semibold">{objPos.x.toFixed(1)}</strong></span>
          <span className="text-[#2D3139]">|</span>
          <span>y: <strong className="text-emerald-400 font-semibold">{objPos.y.toFixed(1)}</strong></span>
          <span className="text-[#2D3139]">|</span>
          <span>z: <strong className="text-sky-400 font-semibold">{objPos.z.toFixed(1)}</strong></span>
        </div>
      )}

      {/* Floating AI Chat Assistant & Modeling Prompt (Off-White Premium card style) */}
      <AIChatButton />

      {/* Fullscreen Script Editor Overlay */}
      {editorStore.activeMainTab === 'code' && (
        <div className="absolute inset-0 z-50 bg-[#1e1e1e] p-2">
          <ScriptEditor />
        </div>
      )}
    </div>
  );
};
