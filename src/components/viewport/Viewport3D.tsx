/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Advanced Three.js WebGL Viewport
 */

import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { SelectionBox } from 'three/examples/jsm/interactive/SelectionBox.js';
import { SelectionHelper } from 'three/examples/jsm/interactive/SelectionHelper.js';
import { editorStore } from '../../store/EditorStore';
import { createSculptGizmo, SculptCursorGizmo } from '../../core/sculpting/sculptCursorGizmo';
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
import { createTextPrimitiveMesh } from '../../core/primitives/textPrimitive';
import { Trash2, Camera } from 'lucide-react';
import { InteractivePrimitivePopup } from '../ui/InteractivePrimitivePopup';
import { CameraPreviewWidget } from '../ui/CameraPreviewWidget';
import { TransformToolbar } from '../ui/TransformToolbar';
import { NavigationToolbar } from '../ui/NavigationToolbar';
import { AIChatButton } from '../ui/AIChatButton';
import { RealisticRenderPipeline } from '../../core/rendering/renderPipeline';
import { StudioCyclorama } from './StudioCyclorama';
import { physicsEngine } from '../../core/physics/PhysicsEngine';
import { threeOptimizationEngine } from '../../core/optimization/threeOptimizationEngine';
import { CadDrawingEngine } from '../../core/drawing/cadDrawingEngine';
import { SketchEntity, LineSketchEntity, RectSketchEntity, CircleSketchEntity, ArcSketchEntity, SplineSketchEntity, SnapPoint } from '../../types/drawing';
import { SketchOverlayHUD } from '../drawing/SketchOverlayHUD';

// Heavyweight Monaco editor lazy loading
const LazyScriptEditor = lazy(() =>
  import('../ui/ScriptEditor').then(module => ({
    default: module.ScriptEditor,
  }))
);

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
  const orbitRef = controlsRef;
  const transformRef = useRef<TransformControls | null>(null);

  // Visual Helper Objects
  const sculptGizmoRef = useRef<SculptCursorGizmo | null>(null);
  const curveLineRef = useRef<THREE.Line | null>(null);
  const curveHandlesRef = useRef<THREE.Group>(new THREE.Group());
  const selectionGizmoRef = useRef<THREE.Group>(new THREE.Group());
  const latticeWireframeRef = useRef<THREE.LineSegments | null>(null);
  const renderPipelineRef = useRef<RealisticRenderPipeline | null>(null);
  const cycloramaRef = useRef<StudioCyclorama | null>(null);
  const planeRef = useRef<THREE.Mesh | null>(null);
  const xRayWireframeMapRef = useRef<Map<string, THREE.LineSegments>>(new Map());

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

  // Lasso / Box Selection State
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoCurrent, setLassoCurrent] = useState<{ x: number; y: number } | null>(null);
  const isLassoDraggingRef = useRef<boolean>(false);

  // CAD 2D Sketch References & HUD State
  const sketchGroupRef = useRef<THREE.Group>(new THREE.Group());
  const activeDrawPointsRef = useRef<THREE.Vector2[]>([]);
  const filletFirstLineIdRef = useRef<string | null>(null);
  const [cursorScreenPos, setCursorScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [rubberBandInfo, setRubberBandInfo] = useState<{
    length: number;
    angleDeg: number;
    radius?: number;
  } | null>(null);

  // Physics Simulation Interactive Circle Cursor & Dragging State
  const [simulationCursorPos, setSimulationCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [simulationWorldHit, setSimulationWorldHit] = useState<THREE.Vector3 | null>(null);
  const isSimulationGrabbingRef = useRef<boolean>(false);
  const simulationGrabbedObjIdRef = useRef<string | null>(null);
  const simulationGrabPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const simulationGrabOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // Camera 2D Lock / LookAt Sync with EditorStore
  useEffect(() => {
    editorStore.onForce2DCameraLookAt = () => {
      if (!cameraRef.current || !controlsRef.current) return;
      cameraRef.current.position.set(0, 0, 10);
      cameraRef.current.up.set(0, 1, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.enableRotate = false;
      controlsRef.current.update();
    };

    editorStore.onUnlock3DCamera = () => {
      if (!controlsRef.current) return;
      controlsRef.current.enableRotate = true;
      controlsRef.current.update();
    };

    return () => {
      editorStore.onForce2DCameraLookAt = null;
      editorStore.onUnlock3DCamera = null;
    };
  }, []);

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
    if (type === 'text') {
      const mesh = createTextPrimitiveMesh('Text', '#4a90e2');
      mesh.position.set(0, 0.4, 0);
      editorStore.addObject('Texte', mesh);
      return;
    }

    if (type === 'camera') {
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
      const helper = new THREE.CameraHelper(camera);
      // We don't have a direct "mesh" for the camera, so we'll wrap it in a group with a visible helper
      const group = new THREE.Group();
      group.add(camera);
      group.add(helper);
      group.position.set(0, 2, 5);
      editorStore.addObject('Caméra', group as any, 'camera');
      return;
    }

    if (type === 'spotlight' || type === 'pointlight') {
      const light = type === 'spotlight' 
        ? new THREE.SpotLight(0xffffff, 10) 
        : new THREE.PointLight(0xffffff, 10);
      const helper = type === 'spotlight' 
        ? new THREE.SpotLightHelper(light as THREE.SpotLight)
        : new THREE.PointLightHelper(light as THREE.PointLight);
      
      const group = new THREE.Group();
      group.add(light);
      group.add(helper);
      group.position.set(0, 2, 0);
      editorStore.addObject(type === 'spotlight' ? 'Projecteur' : 'Ampoule', group as any, 'light');
      return;
    }

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

    let mesh: THREE.Mesh;

    if (type === 'text') {
      mesh = createTextPrimitiveMesh('Text', '#4a90e2');
      mesh.quaternion.copy(data.alignQuaternion);
      mesh.position.copy(data.anchorPoint);
      mesh.position.y += 0.4; // lift so bottom of plaque sits on ground
    } else {
      const finalGeom = generatePrimitiveGeometry(type, data);
      const finalMat = new THREE.MeshStandardMaterial({
        color: 0x4a90e2,
        roughness: 0.3,
        metalness: 0.1,
        flatShading: editorStore.flatShading,
      });

      mesh = new THREE.Mesh(finalGeom, finalMat);
      mesh.quaternion.copy(data.alignQuaternion);
      mesh.position.copy(data.anchorPoint);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

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
        activeDrawPointsRef.current = [];
        setRubberBandInfo(null);
        filletFirstLineIdRef.current = null;
      }
      if (e.key === 'Enter' && editorStore.mode === 'curve' && activeDrawPointsRef.current.length >= 2) {
        if (editorStore.activeDrawTool === 'SPLINE') {
          editorStore.addSketchEntity({
            id: `spline_${Date.now()}`,
            type: 'SPLINE',
            points: [...activeDrawPointsRef.current],
          });
          activeDrawPointsRef.current = [];
          setRubberBandInfo(null);
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && editorStore.mode === 'curve' && document.activeElement?.tagName !== 'INPUT') {
        if (editorStore.sketchSelectedEntityIds.length > 0) {
          editorStore.deleteSketchEntities(editorStore.sketchSelectedEntityIds);
        }
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
        } else if (key === 'f' && editorStore.mode === 'sculpt') {
          e.preventDefault();
          if (e.shiftKey) {
            sculptGizmoRef.current?.setMode('adjust_strength', undefined, editorStore.sculptSettings.strength);
          } else {
            sculptGizmoRef.current?.setMode('adjust_radius', editorStore.sculptSettings.radius);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = false;
      }
      if (e.key.toLowerCase() === 'f' && sculptGizmoRef.current) {
        sculptGizmoRef.current.setMode('active');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Synchronize callbacks for Zoom In / Zoom Out and Pan Left / Pan Right
  useEffect(() => {
    editorStore.onZoomInCallback = () => handleZoom(0.85);
    editorStore.onZoomOutCallback = () => handleZoom(1.15);
    editorStore.onPanLeftCallback = () => handlePan(-1.0, 0);
    editorStore.onPanRightCallback = () => handlePan(1.0, 0);
    return () => {
      editorStore.onZoomInCallback = null;
      editorStore.onZoomOutCallback = null;
      editorStore.onPanLeftCallback = null;
      editorStore.onPanRightCallback = null;
    };
  }, []);

  // Configure OrbitControls mouse buttons when Pan mode is toggled
  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    if (editorStore.isPanMode) {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    }
  }, [editorStore.isPanMode]);

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

  const handlePan = (distanceX: number, distanceY: number = 0) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    
    const panOffset = new THREE.Vector3()
      .addScaledVector(right, distanceX)
      .addScaledVector(up, distanceY);

    camera.position.add(panOffset);
    controls.target.add(panOffset);
    controls.update();
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
    const workLightGroup = new THREE.Group();
    workLightGroup.name = 'WorkLightGroup';
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    workLightGroup.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    workLightGroup.add(hemiLight);
    scene.add(workLightGroup);
    
    // Track work lights for later toggling
    (scene as any).workLightGroup = workLightGroup;

    // Ensure Sun Light SceneObject exists
    let sunObj = editorStore.objects.find(o => o.name === 'Sun Light');
    if (!sunObj) {
      const sunSettings = editorStore.sunSettings;
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

      const sunLight = new THREE.DirectionalLight(sunSettings.color, sunSettings.intensity);
      sunLight.castShadow = sunSettings.castShadow;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.bias = sunSettings.shadowBias;
      
      // Expand shadow camera frustum to encompass the workspace and cyclorama cleanly
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 150;
      sunLight.shadow.camera.left = -35;
      sunLight.shadow.camera.right = 35;
      sunLight.shadow.camera.top = 35;
      sunLight.shadow.camera.bottom = -35;
      sunLight.shadow.camera.updateProjectionMatrix();

      sunMesh.add(sunLight);
      sunLight.target.position.set(0, -1, 0); // Point downwards relative to sun
      sunMesh.add(sunLight.target);
      
      sunMesh.userData.isSun = true;
      sunMesh.userData.directionalLight = sunLight;
      
      editorStore.addObject('Sun Light', sunMesh);
    }

    // 5. GRID & AXES HELPERS
    const gridHelper = new THREE.GridHelper(20, 20, 0x4a90e2, 0x2d3139);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Initialize Studio Cyclorama Backdrop
    const cyclorama = new StudioCyclorama(editorStore.cycloramaColor);
    scene.add(cyclorama.mesh);
    cycloramaRef.current = cyclorama;

    // Initialize Giant Plane Surface
    const planeGeom = new THREE.PlaneGeometry(120, 120);
    planeGeom.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(editorStore.cycloramaColor),
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeMesh.position.y = -0.01; // Avoid z-fighting with grid helper
    planeMesh.receiveShadow = true;
    planeMesh.visible = false;
    scene.add(planeMesh);
    planeRef.current = planeMesh;

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

    // Disable OrbitControls when dragging transform gizmo & track object transforms
    let initialTransformSnapshot: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 } | null = null;

    transformControls.addEventListener('dragging-changed', event => {
      controls.enabled = !event.value;
      const selObj = editorStore.getSelectedObject();
      const targetMesh = selObj?.mesh || selObj?.camera || selObj?.light;

      if (event.value && targetMesh && editorStore.mode === 'object') {
        initialTransformSnapshot = {
          position: targetMesh.position.clone(),
          rotation: targetMesh.rotation.clone(),
          scale: targetMesh.scale.clone(),
        };
      } else if (!event.value && targetMesh && initialTransformSnapshot && editorStore.mode === 'object') {
        const endTransform = {
          position: targetMesh.position.clone(),
          rotation: targetMesh.rotation.clone(),
          scale: targetMesh.scale.clone(),
        };
        if (
          !initialTransformSnapshot.position.equals(endTransform.position) ||
          !initialTransformSnapshot.rotation.equals(endTransform.rotation) ||
          !initialTransformSnapshot.scale.equals(endTransform.scale)
        ) {
          editorStore.recordTransformChange(selObj!.id, initialTransformSnapshot, endTransform);
        }
        initialTransformSnapshot = null;
      }
    });
    transformControls.addEventListener('mouseDown', () => {
      controls.enabled = false;
    });
    transformControls.addEventListener('mouseUp', () => {
      controls.enabled = true;
    });

    // Capture phase event listener on the canvas to instantly disable OrbitControls/orbitRef when clicking on the transform gizmo arrows
    const onGizmoPointerDown = (e: PointerEvent) => {
      if (transformControls && (transformControls as any).axis) {
        controls.enabled = false;
        if (orbitRef.current) {
          orbitRef.current.enabled = false;
        }
      }
    };

    const onGizmoPointerUp = () => {
      controls.enabled = true;
      if (orbitRef.current) {
        orbitRef.current.enabled = true;
      }
    };

    renderer.domElement.addEventListener('pointerdown', onGizmoPointerDown, { capture: true });
    renderer.domElement.addEventListener('pointerup', onGizmoPointerUp, { capture: true });

    // 8. SCULPT GIZMO & HELPER GROUPS
    const sculptGizmo = createSculptGizmo() as SculptCursorGizmo;
    scene.add(sculptGizmo);
    sculptGizmoRef.current = sculptGizmo;

    scene.add(curveHandlesRef.current);
    scene.add(selectionGizmoRef.current);
    scene.add(editDummyRef.current);
    scene.add(sketchGroupRef.current);

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

    // Apply Initial Optimization Engine Settings
    threeOptimizationEngine.applySettings(
      threeOptimizationEngine.getSettings(),
      scene,
      renderer
    );

    // 9. ANIMATION LOOP
    let animationFrameId: number;
    let lastRenderTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // FPS Limiter Control
      const frameIntervalMs = threeOptimizationEngine.getFrameIntervalMs();
      if (frameIntervalMs > 0) {
        const now = performance.now();
        const elapsed = now - lastRenderTime;
        if (elapsed < frameIntervalMs) {
          return; // Throttled: Skip frame to avoid GPU heating
        }
        lastRenderTime = now - (elapsed % frameIntervalMs);
      }

      if (editorStore.isPhysicsActive) {
        physicsEngine.step();
      }

      // Turntable 360° Animation Preview
      if (editorStore.isTurntableActive && controlsRef.current) {
        controlsRef.current.autoRotate = true;
        controlsRef.current.autoRotateSpeed = 2.5 * (editorStore.turntableSpeed || 1.0);
        controlsRef.current.update();
      } else if (controlsRef.current && controlsRef.current.autoRotate) {
        controlsRef.current.autoRotate = false;
      }

      // Animation Timeline Playback Stepping
      if (editorStore.isAnimationPlaying) {
        const nextFrame = (editorStore.animationCurrentFrame + 1) % (editorStore.animationTotalFrames + 1);
        editorStore.setAnimationFrame(nextFrame);
      }

      // Sync sun position from mesh back to settings if it was moved via gizmo
      const sunObj = editorStore.objects.find(o => o.name === 'Sun Light');
      if (sunObj && sunObj.mesh) {
        const meshPos = sunObj.mesh.position;
        const curPos = editorStore.sunSettings.position;
        if (
          Math.abs(curPos[0] - meshPos.x) > 0.001 ||
          Math.abs(curPos[1] - meshPos.y) > 0.001 ||
          Math.abs(curPos[2] - meshPos.z) > 0.001
        ) {
          editorStore.setSunPosition([meshPos.x, meshPos.y, meshPos.z]);
          threeOptimizationEngine.requestShadowUpdate(rendererRef.current);
        }
      }

      // Handle Render Mode vs Edit Mode (Shadows and Work Lights)
      if (rendererRef.current && sceneRef.current) {
        const isRender = editorStore.isRenderMode;
        const optSettings = threeOptimizationEngine.getSettings();
        rendererRef.current.shadowMap.enabled = isRender;
        rendererRef.current.shadowMap.autoUpdate = isRender && !optSettings.ecoStaticShadows;
        
        const workLights = (sceneRef.current as any).workLightGroup;
        if (workLights) {
          workLights.visible = !isRender;
        }

        // Hide transform controls in render mode completely to clear the screen, EXCEPT for the sun
        if (transformRef.current) {
          if (isRender && transformRef.current.object && !transformRef.current.object.userData.isSun) {
            transformRef.current.detach();
          }
        }
      }

      // Sync scene meshes with store objects and handle X-Ray / Transparent Wireframe Mode (Edition Mode Only)
      const isXRayActive = editorStore.xRayMode && editorStore.mode === 'edit';

      editorStore.objects.forEach(obj => {
        if (obj.mesh) {
          if (!scene.children.includes(obj.mesh)) {
            scene.add(obj.mesh);
            threeOptimizationEngine.applyFrustumCullingToObject(obj.mesh);
          }

          const mat = obj.mesh.material;
          const materials = Array.isArray(mat) ? mat : [mat];

          materials.forEach(m => {
            if (isXRayActive) {
              if (!m.transparent || m.opacity !== 0.4 || m.depthWrite !== false) {
                m.transparent = true;
                m.opacity = 0.4;
                m.depthWrite = false;
                m.needsUpdate = true;
              }
            } else {
              if (m.transparent || m.opacity !== 1.0 || m.depthWrite !== true) {
                m.transparent = false;
                m.opacity = 1.0;
                m.depthWrite = true;
                m.needsUpdate = true;
              }
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
      if (editorStore.mode === 'object') {
        if (selObj && selObj.mesh) {
          if (transformControls.object !== selObj.mesh) {
            transformControls.attach(selObj.mesh);
          }
        } else {
          transformControls.detach();
        }
      } else if (editorStore.mode === 'edit') {
        // In edit mode, TransformControls is attached to editDummyRef.current when sub-elements are selected.
        // It is managed by the visual edit helpers synchronization effect.
        if (transformControls.object && transformControls.object !== editDummyRef.current) {
          transformControls.detach();
        }
      } else {
        transformControls.detach();
      }

      // Update 2D CAD Sketching & Spline Curve Visualization
      if (editorStore.mode === 'curve') {
        // Clear previous sketch objects
        sketchGroupRef.current.clear();

        const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
        const selLineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3 });
        const profileFillMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        // 1. Render closed profile fills (visual feedback for 3D extrusion ready)
        for (const prof of editorStore.sketchProfiles) {
          if (prof.points.length >= 3) {
            const shape = new THREE.Shape();
            shape.moveTo(prof.points[0].x, prof.points[0].y);
            for (let i = 1; i < prof.points.length; i++) {
              shape.lineTo(prof.points[i].x, prof.points[i].y);
            }
            shape.closePath();
            const geom = new THREE.ShapeGeometry(shape);
            const mesh = new THREE.Mesh(geom, profileFillMat);
            mesh.position.z = -0.01;
            sketchGroupRef.current.add(mesh);
          }
        }

        // 2. Render all Sketch Entities
        for (const ent of editorStore.sketchEntities) {
          const isSelected = editorStore.sketchSelectedEntityIds.includes(ent.id);
          const isHovered = editorStore.sketchHoveredEntityId === ent.id;
          const mat = isSelected
            ? selLineMat
            : isHovered
            ? new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2 })
            : lineMat;

          if (ent.type === 'LINE') {
            const geom = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(ent.start.x, ent.start.y, 0.01),
              new THREE.Vector3(ent.end.x, ent.end.y, 0.01),
            ]);
            const line = new THREE.Line(geom, mat);
            sketchGroupRef.current.add(line);

            // Endpoint markers
            [ent.start, ent.end].forEach(p => {
              const dotGeom = new THREE.CircleGeometry(0.04, 8);
              const dotMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
              const dot = new THREE.Mesh(dotGeom, dotMat);
              dot.position.set(p.x, p.y, 0.02);
              sketchGroupRef.current.add(dot);
            });
          } else if (ent.type === 'RECTANGLE') {
            const p1 = ent.start;
            const p2 = new THREE.Vector2(ent.end.x, ent.start.y);
            const p3 = ent.end;
            const p4 = new THREE.Vector2(ent.start.x, ent.end.y);
            const geom = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(p1.x, p1.y, 0.01),
              new THREE.Vector3(p2.x, p2.y, 0.01),
              new THREE.Vector3(p3.x, p3.y, 0.01),
              new THREE.Vector3(p4.x, p4.y, 0.01),
              new THREE.Vector3(p1.x, p1.y, 0.01),
            ]);
            const line = new THREE.Line(geom, mat);
            sketchGroupRef.current.add(line);
          } else if (ent.type === 'CIRCLE') {
            const segs = 48;
            const pts: THREE.Vector3[] = [];
            for (let i = 0; i <= segs; i++) {
              const a = (i / segs) * Math.PI * 2;
              pts.push(
                new THREE.Vector3(
                  ent.center.x + Math.cos(a) * ent.radius,
                  ent.center.y + Math.sin(a) * ent.radius,
                  0.01
                )
              );
            }
            const geom = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(geom, mat);
            sketchGroupRef.current.add(line);

            const centerDot = new THREE.Mesh(
              new THREE.CircleGeometry(0.03, 8),
              new THREE.MeshBasicMaterial({ color: 0x0284c7 })
            );
            centerDot.position.set(ent.center.x, ent.center.y, 0.02);
            sketchGroupRef.current.add(centerDot);
          } else if (ent.type === 'ARC') {
            const segs = 32;
            const pts: THREE.Vector3[] = [];
            let span = ent.endAngle - ent.startAngle;
            if (span <= 0) span += Math.PI * 2;
            for (let i = 0; i <= segs; i++) {
              const a = ent.startAngle + (i / segs) * span;
              pts.push(
                new THREE.Vector3(
                  ent.center.x + Math.cos(a) * ent.radius,
                  ent.center.y + Math.sin(a) * ent.radius,
                  0.01
                )
              );
            }
            const geom = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(geom, mat);
            sketchGroupRef.current.add(line);
          } else if (ent.type === 'SPLINE') {
            if (ent.points.length >= 2) {
              const v3Points = ent.points.map(p => new THREE.Vector3(p.x, p.y, 0.01));
              const curve = new THREE.CatmullRomCurve3(v3Points);
              const pts = curve.getPoints(50);
              const geom = new THREE.BufferGeometry().setFromPoints(pts);
              const line = new THREE.Line(geom, mat);
              sketchGroupRef.current.add(line);
            }
          }
        }

        // 3. Active rubber-band / drawing in progress preview
        const pts = activeDrawPointsRef.current;
        const tool = editorStore.activeDrawTool;

        if (pts.length > 0 && cursorWorldPos) {
          const curV = new THREE.Vector2(cursorWorldPos.x, cursorWorldPos.y);
          if (tool === 'LINE') {
            const pStart = pts[pts.length - 1];
            const g = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(pStart.x, pStart.y, 0.02),
              new THREE.Vector3(curV.x, curV.y, 0.02),
            ]);
            const l = new THREE.Line(
              g,
              new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
            );
            sketchGroupRef.current.add(l);
          } else if (tool === 'RECTANGLE') {
            const p1 = pts[0];
            const p2 = new THREE.Vector2(curV.x, p1.y);
            const p3 = curV;
            const p4 = new THREE.Vector2(p1.x, curV.y);
            const g = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(p1.x, p1.y, 0.02),
              new THREE.Vector3(p2.x, p2.y, 0.02),
              new THREE.Vector3(p3.x, p3.y, 0.02),
              new THREE.Vector3(p4.x, p4.y, 0.02),
              new THREE.Vector3(p1.x, p1.y, 0.02),
            ]);
            const l = new THREE.Line(
              g,
              new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
            );
            sketchGroupRef.current.add(l);
          } else if (tool === 'CIRCLE') {
            const center = pts[0];
            const radius = center.distanceTo(curV);
            const segs = 36;
            const circlePts: THREE.Vector3[] = [];
            for (let i = 0; i <= segs; i++) {
              const a = (i / segs) * Math.PI * 2;
              circlePts.push(
                new THREE.Vector3(
                  center.x + Math.cos(a) * radius,
                  center.y + Math.sin(a) * radius,
                  0.02
                )
              );
            }
            const g = new THREE.BufferGeometry().setFromPoints(circlePts);
            const l = new THREE.Line(
              g,
              new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
            );
            sketchGroupRef.current.add(l);
          } else if (tool === 'SPLINE') {
            const allPts = [...pts, curV].map(p => new THREE.Vector3(p.x, p.y, 0.02));
            if (allPts.length >= 2) {
              const curve = new THREE.CatmullRomCurve3(allPts);
              const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(30));
              const l = new THREE.Line(
                g,
                new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
              );
              sketchGroupRef.current.add(l);
            }
          }
        }

        // 4. Active Snapping Indicator Glyph in 3D scene
        if (editorStore.activeSnapPoint) {
          const snapP = editorStore.activeSnapPoint.position;
          const snapMarker = new THREE.Mesh(
            new THREE.RingGeometry(0.04, 0.07, 16),
            new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
          );
          snapMarker.position.set(snapP.x, snapP.y, 0.03);
          sketchGroupRef.current.add(snapMarker);
        }
      } else {
        sketchGroupRef.current.clear();
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

      // Sync Backdrop type settings
      const type = editorStore.backdropType;

      if (cycloramaRef.current) {
        if (editorStore.isRenderMode && type === 'StudioCyclorama') {
          cycloramaRef.current.setVisible(true);
          cycloramaRef.current.setColor(editorStore.cycloramaColor);
        } else {
          cycloramaRef.current.setVisible(false);
        }
      }

      if (planeRef.current) {
        if (editorStore.isRenderMode && type === 'Plane') {
          planeRef.current.visible = true;
          (planeRef.current.material as THREE.MeshStandardMaterial).color.set(editorStore.cycloramaColor);
        } else {
          planeRef.current.visible = false;
        }
      }

      const isSelectedSun = transformControls.object?.userData?.isSun;

      if (editorStore.isRenderMode) {
        gridHelper.visible = false;
        axesHelper.visible = false;
        // Allow the transform gizmo ONLY for the Sun in Render Mode so we can position it and see shadows update
        transformControls.enabled = isSelectedSun ? true : false;
        transformControls.getHelper().visible = isSelectedSun ? true : false;
        
        // Hide all camera and light helpers
        editorStore.objects.forEach(obj => {
          if (obj.type === 'camera' || obj.type === 'light') {
            obj.mesh?.traverse(child => {
              if (child.type === 'CameraHelper' || child.type.includes('Helper')) {
                child.visible = false;
              }
            });
          }
        });
        
        renderPipeline.enableRenderEnvironment(scene);
        renderPipeline.render(renderer, scene, camera);
      } else {
        gridHelper.visible = editorStore.showGrid;
        axesHelper.visible = true;
        transformControls.enabled = true;
        transformControls.getHelper().visible = true;

        // Restore camera/light helpers
        editorStore.objects.forEach(obj => {
          if (obj.type === 'camera' || obj.type === 'light') {
            obj.mesh?.traverse(child => {
              if (child.type === 'CameraHelper' || child.type.includes('Helper')) {
                child.visible = true;
              }
            });
          }
        });
        
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
        rendererRef.current.domElement.removeEventListener('pointerdown', onGizmoPointerDown, { capture: true });
        rendererRef.current.domElement.removeEventListener('pointerup', onGizmoPointerUp, { capture: true });
        rendererRef.current.domElement.remove();
      }
      if (cycloramaRef.current) {
        cycloramaRef.current.dispose();
        scene.remove(cycloramaRef.current.mesh);
        cycloramaRef.current = null;
      }
      if (planeRef.current) {
        if (planeRef.current.geometry) {
          planeRef.current.geometry.dispose();
        }
        if (planeRef.current.material) {
          const mats = Array.isArray(planeRef.current.material)
            ? planeRef.current.material
            : [planeRef.current.material];
          mats.forEach(m => m.dispose());
        }
        scene.remove(planeRef.current);
        planeRef.current = null;
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

  // Sync Cyclorama and Plane color when cycloramaColor changes
  useEffect(() => {
    if (cycloramaRef.current) {
      cycloramaRef.current.setColor(editorStore.cycloramaColor);
    }
    if (planeRef.current) {
      (planeRef.current.material as THREE.MeshStandardMaterial).color.set(editorStore.cycloramaColor);
    }
  }, [editorStore.cycloramaColor]);

  // Physics Initialization and sync
  useEffect(() => {
    if (editorStore.isPhysicsActive) {
      physicsEngine.init().then(() => {
        physicsEngine.startSimulation(cycloramaRef.current, planeRef.current);
      });
      // Disable transform controls while physics is running
      if (transformRef.current) {
        transformRef.current.detach();
        transformRef.current.enabled = false;
      }
    } else {
      physicsEngine.stopSimulation();
      if (transformRef.current) {
        transformRef.current.enabled = true;
      }
    }
  }, [editorStore.isPhysicsActive]);

  // Sync Interactive Sun and Gizmo visibility with store settings and render mode
  useEffect(() => {
    const sunObj = editorStore.objects.find(o => o.name === 'Sun Light');
    if (sunObj && sunObj.mesh && sunObj.mesh.userData.isSun) {
      const sunMesh = sunObj.mesh;
      const sunLight = sunMesh.userData.directionalLight as THREE.DirectionalLight;
      
      if (sunLight) {
        sunLight.color.set(editorStore.sunSettings.color);
        sunLight.intensity = editorStore.sunSettings.intensity;
        sunLight.castShadow = editorStore.sunSettings.castShadow;
        sunLight.shadow.bias = editorStore.sunSettings.shadowBias;
        
        // Disable the directional light completely in edit mode to avoid edit shadows
        sunLight.visible = editorStore.isRenderMode;
      }
      
      // Update sun mesh visual scale and position based on settings if needed
      // (Position is normally driven by the transform gizmo, but we sync scale and color)
      sunMesh.scale.setScalar(editorStore.sunSettings.scale);
      
      const newPos = new THREE.Vector3(...editorStore.sunSettings.position);
      if (sunMesh.position.distanceTo(newPos) > 0.01) {
        sunMesh.position.copy(newPos);
      }
      
      // Keep store materialProps in sync with sunSettings for UI consistency
      sunObj.materialProps.color = editorStore.sunSettings.color;
      sunObj.materialProps.emissive = editorStore.sunSettings.color;
      sunObj.materialProps.emissiveIntensity = 5.0;
      
      const sunMat = sunMesh.material as THREE.MeshStandardMaterial;
      if (sunMat && sunMat.color && sunMat.emissive) {
        sunMat.color.set(editorStore.sunSettings.color);
        sunMat.emissive.set(editorStore.sunSettings.color);
        sunMat.emissiveIntensity = 5.0;
        sunMat.needsUpdate = true;
      }
    }
  }, [editorStore.sunSettings, editorStore.isRenderMode, editorStore.objects]);

  // Raycasting Mouse Interaction Handler for Selection & Sculpting
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editorStore.isRenderMode) return;
    if (!containerRef.current || !sceneRef.current || !cameraRef.current) return;

    // --- 2D CAD Sketching Real-time Snapping & Rubber Band Updates ---
    if (editorStore.mode === 'curve') {
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      setCursorScreenPos({ x: screenX, y: screenY });

      const mouse = new THREE.Vector2(
        (screenX / rect.width) * 2 - 1,
        -(screenY / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hitPoint = new THREE.Vector3();

      if (raycaster.ray.intersectPlane(planeZ, hitPoint)) {
        const rawPos2D = new THREE.Vector2(hitPoint.x, hitPoint.y);
        const originRef = activeDrawPointsRef.current.length > 0
          ? activeDrawPointsRef.current[activeDrawPointsRef.current.length - 1]
          : undefined;

        const snapPoint = CadDrawingEngine.calculateSnapPoint(
          rawPos2D,
          editorStore.sketchEntities,
          editorStore.sketchSettings,
          originRef
        );

        editorStore.activeSnapPoint = snapPoint;
        setCursorWorldPos({ x: snapPoint.position.x, y: snapPoint.position.y });

        // Hover detection on sketch entities
        let hoveredId: string | null = null;
        for (const ent of editorStore.sketchEntities) {
          if (ent.type === 'LINE') {
            const dist = CadDrawingEngine.pointToSegmentDistance(snapPoint.position, ent.start, ent.end);
            if (dist < 0.2) {
              hoveredId = ent.id;
              break;
            }
          } else if (ent.type === 'CIRCLE') {
            const dist = Math.abs(snapPoint.position.distanceTo(ent.center) - ent.radius);
            if (dist < 0.2) {
              hoveredId = ent.id;
              break;
            }
          }
        }
        editorStore.sketchHoveredEntityId = hoveredId;

        // Calculate rubber band dimensions
        if (activeDrawPointsRef.current.length > 0) {
          const anchor = activeDrawPointsRef.current[activeDrawPointsRef.current.length - 1];
          const dist = anchor.distanceTo(snapPoint.position);
          const angle = (Math.atan2(snapPoint.position.y - anchor.y, snapPoint.position.x - anchor.x) * 180) / Math.PI;
          setRubberBandInfo({
            length: dist,
            angleDeg: (angle + 360) % 360,
            radius: editorStore.activeDrawTool === 'CIRCLE' ? dist : undefined,
          });
        } else {
          setRubberBandInfo(null);
        }
      }
      return;
    }

    if (editorStore.isLassoModeActive && isLassoDraggingRef.current && lassoStart) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLassoCurrent({ x, y });
      return;
    }

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

      if (type === 'text') {
        return; // Text size/geometry is custom/static, not extruded interactively
      }

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

    // 0. Simulation Mode Real-Time Object Displacement with Circle Cursor
    if (editorStore.mode === 'simulation') {
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      setSimulationCursorPos({ x: screenX, y: screenY });

      // Ground plane or grab plane raycast intersection
      const currentPlane = isSimulationGrabbingRef.current ? simulationGrabPlaneRef.current : new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      
      if (raycaster.ray.intersectPlane(currentPlane, hitPoint)) {
        setSimulationWorldHit(hitPoint);

        if (isSimulationGrabbingRef.current && simulationGrabbedObjIdRef.current && editorStore.isPhysicsActive) {
          // Calculate target position in real-time
          const targetPos = hitPoint.clone().add(simulationGrabOffsetRef.current);
          physicsEngine.applySpringForceToObject(
            simulationGrabbedObjIdRef.current,
            targetPos,
            editorStore.simulationSpringStrength,
            6.0
          );
        } else if (editorStore.isPhysicsActive && editorStore.simulationInteractionMode === 'push' && (e.buttons & 1)) {
          // Radial push impulse under circle
          physicsEngine.applyRadialPush(hitPoint, editorStore.simulationBrushRadius, 25.0);
        }
      }

      if (isSimulationGrabbingRef.current && controlsRef.current) {
        controlsRef.current.enabled = false;
      }
      return;
    }

    // 1. Digital Sculpting Raycast
    if (editorStore.mode === 'sculpt' && selObj && selObj.mesh) {
      if (controlsRef.current) controlsRef.current.enabled = !isSculptingRef.current;

      // Check if gizmo is in adjust_radius or adjust_strength interactive mode
      if (sculptGizmoRef.current && (sculptGizmoRef.current.gizmoMode === 'adjust_radius' || sculptGizmoRef.current.gizmoMode === 'adjust_strength')) {
        if (e.movementX !== 0) {
          if (sculptGizmoRef.current.gizmoMode === 'adjust_radius') {
            const deltaR = e.movementX * 0.015;
            editorStore.sculptSettings.radius = Math.max(0.05, Math.min(10.0, editorStore.sculptSettings.radius + deltaR));
          } else {
            const deltaS = e.movementX * 0.008;
            editorStore.sculptSettings.strength = Math.max(0.01, Math.min(1.0, editorStore.sculptSettings.strength + deltaS));
          }
          sculptGizmoRef.current.updateVisuals(
            editorStore.sculptSettings.radius,
            editorStore.sculptSettings.strength,
            editorStore.sculptSettings.falloff
          );
          editorStore.notify();
        }
      }

      const intersects = raycaster.intersectObject(selObj.mesh);

      if (intersects.length > 0) {
        const hit = intersects[0];

        if (sculptGizmoRef.current && hit.face) {
          const hitNormalWorld = hit.face.normal.clone().transformDirection(selObj.mesh.matrixWorld).normalize();
          const r = editorStore.sculptSettings.radius;

          sculptGizmoRef.current.updatePositionAndOrientation(
            hit.point,
            hitNormalWorld,
            selObj.mesh,
            r
          );

          sculptGizmoRef.current.updateVisuals(
            r,
            editorStore.sculptSettings.strength,
            editorStore.sculptSettings.falloff
          );
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
        if (sculptGizmoRef.current) {
          sculptGizmoRef.current.setHovering(false);
          sculptGizmoRef.current.tickOpacity();
        }
      }
    } else {
      if (sculptGizmoRef.current) {
        sculptGizmoRef.current.setHovering(false);
        sculptGizmoRef.current.tickOpacity();
      }
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



  const performSelectionBoxSelect = (minX: number, maxX: number, minY: number, maxY: number) => {
    if (!cameraRef.current || !sceneRef.current || !containerRef.current) return;

    if (editorStore.mode === 'object') {
      const rect = containerRef.current.getBoundingClientRect();
      const selectionBox = new SelectionBox(cameraRef.current, sceneRef.current);
      
      // Calculate NDC coordinates
      const ndcStartX = (minX / rect.width) * 2 - 1;
      const ndcStartY = -(minY / rect.height) * 2 + 1;
      const ndcEndX = (maxX / rect.width) * 2 - 1;
      const ndcEndY = -(maxY / rect.height) * 2 + 1;

      selectionBox.startPoint.set(ndcStartX, ndcStartY, 0.5);
      selectionBox.endPoint.set(ndcEndX, ndcEndY, 0.5);

      const allSelected = selectionBox.select();
      
      const selectedObjIds: string[] = [];
      allSelected.forEach((selectedObject: any) => {
        const found = editorStore.objects.find(o => o.mesh === selectedObject || o.mesh === selectedObject.parent);
        if (found && !selectedObjIds.includes(found.id)) {
          selectedObjIds.push(found.id);
        }
      });

      if (selectedObjIds.length > 0) {
        editorStore.setSelectedObject(selectedObjIds[0]);
      } else {
        editorStore.setSelectedObject(null);
      }
    } else if (editorStore.mode === 'edit') {
      const selObj = editorStore.getSelectedObject();
      const mesh = selObj?.mesh;
      const geom = selObj?.baseGeometry || selObj?.geometryBackup || mesh?.geometry;

      if (!selObj || !mesh || !geom) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clientMinX = rect.left + minX;
      const clientMaxX = rect.left + maxX;
      const clientMinY = rect.top + minY;
      const clientMaxY = rect.top + maxY;

      if (editorStore.selectionLevel === 'vertex') {
        const posAttr = geom.attributes.position;
        const temp = new THREE.Vector3();
        const captured: number[] = [];

        for (let i = 0; i < posAttr.count; i++) {
          temp.fromBufferAttribute(posAttr, i);
          temp.applyMatrix4(mesh.matrixWorld);

          const proj = temp.clone().project(cameraRef.current);
          const screenX = rect.left + (proj.x * 0.5 + 0.5) * rect.width;
          const screenY = rect.top + (-proj.y * 0.5 + 0.5) * rect.height;

          if (screenX >= clientMinX && screenX <= clientMaxX && screenY >= clientMinY && screenY <= clientMaxY) {
            if (proj.z >= -1 && proj.z <= 1) {
              captured.push(i);
            }
          }
        }
        editorStore.selectedIndices.vertices = captured;
        editorStore.notify();
      } else if (editorStore.selectionLevel === 'edge') {
        const edgesList = getEdgesList(geom);
        const captured: number[] = [];

        edgesList.forEach((edge, i) => {
          const v1 = edge[0];
          const v2 = edge[1];

          const temp1 = new THREE.Vector3();
          const temp2 = new THREE.Vector3();
          getVertexPosition(geom, v1, temp1);
          getVertexPosition(geom, v2, temp2);

          const midpoint = new THREE.Vector3().addVectors(temp1, temp2).multiplyScalar(0.5);
          midpoint.applyMatrix4(mesh.matrixWorld);

          const proj = midpoint.clone().project(cameraRef.current!);
          const screenX = rect.left + (proj.x * 0.5 + 0.5) * rect.width;
          const screenY = rect.top + (-proj.y * 0.5 + 0.5) * rect.height;

          if (screenX >= clientMinX && screenX <= clientMaxX && screenY >= clientMinY && screenY <= clientMaxY) {
            if (proj.z >= -1 && proj.z <= 1) {
              captured.push(i);
            }
          }
        });
        editorStore.selectedIndices.edges = captured;
        editorStore.notify();
      } else if (editorStore.selectionLevel === 'face') {
        const faceCount = geom.index ? geom.index.count / 3 : geom.attributes.position.count / 3;
        const captured: number[] = [];

        for (let fIdx = 0; fIdx < faceCount; fIdx++) {
          const indices = getFaceIndices(geom, fIdx);
          const temp1 = new THREE.Vector3();
          const temp2 = new THREE.Vector3();
          const temp3 = new THREE.Vector3();

          getVertexPosition(geom, indices[0], temp1);
          getVertexPosition(geom, indices[1], temp2);
          getVertexPosition(geom, indices[2], temp3);

          const centroid = new THREE.Vector3().add(temp1).add(temp2).add(temp3).divideScalar(3);
          centroid.applyMatrix4(mesh.matrixWorld);

          const proj = centroid.clone().project(cameraRef.current!);
          const screenX = rect.left + (proj.x * 0.5 + 0.5) * rect.width;
          const screenY = rect.top + (-proj.y * 0.5 + 0.5) * rect.height;

          if (screenX >= clientMinX && screenX <= clientMaxX && screenY >= clientMinY && screenY <= clientMaxY) {
            if (proj.z >= -1 && proj.z <= 1) {
              captured.push(fIdx);
            }
          }
        }
        editorStore.selectedIndices.faces = captured;
        editorStore.notify();
      }
      setHelperTrigger(t => t + 1);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only

    // --- 2D CAD Sketching Pointer Down Actions ---
    if (editorStore.mode === 'curve') {
      if (!cursorWorldPos) return;
      const pos2D = new THREE.Vector2(cursorWorldPos.x, cursorWorldPos.y);
      const tool = editorStore.activeDrawTool;

      if (tool === 'LINE') {
        const pts = activeDrawPointsRef.current;
        if (pts.length === 0) {
          activeDrawPointsRef.current = [pos2D];
        } else {
          const startPt = pts[pts.length - 1];
          // Check if snapping to first point of this polyline to close loop
          if (pts.length >= 2 && pos2D.distanceTo(pts[0]) < 0.3) {
            editorStore.addSketchEntity({
              id: `line_${Date.now()}`,
              type: 'LINE',
              start: startPt.clone(),
              end: pts[0].clone(),
            });
            activeDrawPointsRef.current = [];
            setRubberBandInfo(null);
          } else {
            editorStore.addSketchEntity({
              id: `line_${Date.now()}`,
              type: 'LINE',
              start: startPt.clone(),
              end: pos2D.clone(),
            });
            activeDrawPointsRef.current.push(pos2D);
          }
        }
      } else if (tool === 'RECTANGLE') {
        const pts = activeDrawPointsRef.current;
        if (pts.length === 0) {
          activeDrawPointsRef.current = [pos2D];
        } else {
          const p1 = pts[0];
          editorStore.addSketchEntity({
            id: `rect_${Date.now()}`,
            type: 'RECTANGLE',
            start: p1.clone(),
            end: pos2D.clone(),
          });
          activeDrawPointsRef.current = [];
          setRubberBandInfo(null);
        }
      } else if (tool === 'CIRCLE') {
        const pts = activeDrawPointsRef.current;
        if (pts.length === 0) {
          activeDrawPointsRef.current = [pos2D];
        } else {
          const center = pts[0];
          const radius = Math.max(0.1, center.distanceTo(pos2D));
          editorStore.addSketchEntity({
            id: `circle_${Date.now()}`,
            type: 'CIRCLE',
            center: center.clone(),
            radius,
          });
          activeDrawPointsRef.current = [];
          setRubberBandInfo(null);
        }
      } else if (tool === 'ARC') {
        const pts = activeDrawPointsRef.current;
        if (pts.length === 0) {
          activeDrawPointsRef.current = [pos2D]; // Center
        } else if (pts.length === 1) {
          activeDrawPointsRef.current.push(pos2D); // Arc Start
        } else {
          const center = pts[0];
          const pStart = pts[1];
          const radius = center.distanceTo(pStart);
          const startAngle = Math.atan2(pStart.y - center.y, pStart.x - center.x);
          const endAngle = Math.atan2(pos2D.y - center.y, pos2D.x - center.x);
          editorStore.addSketchEntity({
            id: `arc_${Date.now()}`,
            type: 'ARC',
            center: center.clone(),
            radius,
            startAngle,
            endAngle,
          });
          activeDrawPointsRef.current = [];
          setRubberBandInfo(null);
        }
      } else if (tool === 'SPLINE') {
        activeDrawPointsRef.current.push(pos2D);
        if (activeDrawPointsRef.current.length >= 3 && e.detail >= 2) {
          // Double-click to commit spline
          editorStore.addSketchEntity({
            id: `spline_${Date.now()}`,
            type: 'SPLINE',
            points: [...activeDrawPointsRef.current],
          });
          activeDrawPointsRef.current = [];
          setRubberBandInfo(null);
        }
      } else if (tool === 'TRIM') {
        if (editorStore.activeSnapPoint?.entityId) {
          editorStore.trimSketchAt(editorStore.activeSnapPoint.entityId, pos2D);
        }
      } else if (tool === 'EXTEND') {
        if (editorStore.activeSnapPoint?.entityId) {
          editorStore.extendSketchAt(editorStore.activeSnapPoint.entityId, pos2D);
        }
      } else if (tool === 'FILLET') {
        if (!filletFirstLineIdRef.current) {
          if (editorStore.activeSnapPoint?.entityId) {
            filletFirstLineIdRef.current = editorStore.activeSnapPoint.entityId;
          }
        } else {
          if (
            editorStore.activeSnapPoint?.entityId &&
            editorStore.activeSnapPoint.entityId !== filletFirstLineIdRef.current
          ) {
            editorStore.filletSketch(
              filletFirstLineIdRef.current,
              editorStore.activeSnapPoint.entityId,
              editorStore.sketchSettings.filletRadius
            );
          }
          filletFirstLineIdRef.current = null;
        }
      } else if (tool === 'OFFSET') {
        editorStore.offsetSketch(editorStore.sketchSettings.offsetDistance);
      } else if (tool === 'SELECT') {
        if (editorStore.activeSnapPoint?.entityId) {
          const id = editorStore.activeSnapPoint.entityId;
          if (editorStore.sketchSelectedEntityIds.includes(id)) {
            editorStore.sketchSelectedEntityIds = editorStore.sketchSelectedEntityIds.filter(
              i => i !== id
            );
          } else {
            editorStore.sketchSelectedEntityIds.push(id);
          }
          editorStore.notify();
        }
      }
      return;
    }

    if (editorStore.isLassoModeActive) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLassoStart({ x, y });
      setLassoCurrent({ x, y });
      isLassoDraggingRef.current = true;

      // Clear previous selection
      if (editorStore.mode === 'object') {
        editorStore.setSelectedObject(null);
      } else if (editorStore.mode === 'edit') {
        editorStore.clearMeshSelections();
      }

      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
      return;
    }

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

        let previewMesh: THREE.Mesh;
        if (type === 'text') {
          previewMesh = createTextPrimitiveMesh('Text', '#4a90e2');
          const mats = Array.isArray(previewMesh.material) ? previewMesh.material : [previewMesh.material];
          mats.forEach(m => {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.transparent = true;
              m.opacity = 0.75;
            }
          });
        } else {
          const geom = generatePrimitiveGeometry(type, initialParams);
          const mat = new THREE.MeshStandardMaterial({
            color: 0x4a90e2,
            transparent: true,
            opacity: 0.75,
            roughness: 0.3,
            metalness: 0.1,
            side: THREE.DoubleSide,
          });
          previewMesh = new THREE.Mesh(geom, mat);
        }
        previewMesh.quaternion.copy(alignQuaternion);
        previewMesh.position.copy(anchorPoint);
        if (type === 'text') {
          previewMesh.position.y += 0.4;
        }

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

    if (editorStore.mode === 'simulation') {
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
        const hitObject = editorStore.objects.find(o => o.mesh === hit.object || (hit.object.parent && o.mesh === hit.object.parent));
        if (hitObject) {
          editorStore.setSelectedObject(hitObject.id);

          // If in Explode Mode: trigger instant physical fracture and shockwave
          if (editorStore.simulationInteractionMode === 'explode') {
            import('../../core/physics/MeshExplosionEngine').then(({ MeshExplosionEngine }) => {
              MeshExplosionEngine.explodeSolid(hitObject, {
                blastForce: editorStore.simulationExplosionForce,
                chunkCount: editorStore.simulationExplosionChunks,
                epicenter: hit.point
              });
            });
            return;
          }

          simulationGrabbedObjIdRef.current = hitObject.id;
          isSimulationGrabbingRef.current = true;
          editorStore.isPhysicsGrabbing = true;
          editorStore.notify();

          // Create a plane parallel to the camera passing through the hit point
          const camDir = new THREE.Vector3();
          cameraRef.current.getWorldDirection(camDir);
          simulationGrabPlaneRef.current = new THREE.Plane().setFromNormalAndCoplanarPoint(
            camDir.negate(),
            hit.point
          );
          
          if (hitObject.mesh) {
            simulationGrabOffsetRef.current = hitObject.mesh.position.clone().sub(hit.point);
          } else {
            simulationGrabOffsetRef.current.set(0, 0, 0);
          }

          if (controlsRef.current) {
            controlsRef.current.enabled = false;
          }
        }
      } else if (editorStore.simulationInteractionMode === 'push') {
        // If pushing without direct hit, apply impulse directly
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hitPoint)) {
          physicsEngine.applyRadialPush(hitPoint, editorStore.simulationBrushRadius, 30.0);
        }
      }
      return;
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
    if (editorStore.isLassoModeActive && isLassoDraggingRef.current && lassoStart) {
      isLassoDraggingRef.current = false;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Define bounding rectangle in relative coords
        const minX = Math.min(lassoStart.x, x);
        const maxX = Math.max(lassoStart.x, x);
        const minY = Math.min(lassoStart.y, y);
        const maxY = Math.max(lassoStart.y, y);

        performSelectionBoxSelect(minX, maxX, minY, maxY);
      }
      setLassoStart(null);
      setLassoCurrent(null);
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      return;
    }

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

    // Simulation Mode Grab Release
    if (isSimulationGrabbingRef.current) {
      isSimulationGrabbingRef.current = false;
      simulationGrabbedObjIdRef.current = null;
      editorStore.isPhysicsGrabbing = false;
      editorStore.notify();
    }

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

  const getCanvasCursorClass = () => {
    if (editorStore.isPanMode) return 'cursor-grab active:cursor-grabbing';
    if (editorStore.isLassoModeActive) return 'cursor-crosshair';
    if (drawingDataRef.current !== null) return 'cursor-crosshair';

    if (editorStore.mode === 'curve') {
      if (editorStore.activeDrawTool === 'SELECT') return 'cursor-default';
      if (['TRIM', 'EXTEND', 'FILLET', 'OFFSET'].includes(editorStore.activeDrawTool)) return 'cursor-pointer';
      return 'cursor-crosshair';
    }

    if (editorStore.mode === 'sculpt' || editorStore.mode === 'simulation') {
      return 'cursor-none';
    }

    return 'cursor-default';
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoveredFaceIndex(null)}
      className={`flex-1 w-full h-full relative ${getCanvasCursorClass()} bg-[#0B0D10] overflow-hidden select-none`}
    >
      {/* Top Left Floating Widgets (Orientation Gizmo, Transform Toolbar & Navigation Toolbar) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-[14px] select-none pointer-events-auto">
        <ViewOrientationGizmo cameraRef={cameraRef} onSnap={snapCamera} />
        <div className="flex flex-col gap-2 items-center">
          <TransformToolbar />
          <NavigationToolbar />
        </div>
      </div>
      <CameraPreviewWidget />

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
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e] text-slate-400 font-mono text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Chargement de l'environnement de script...</span>
                </div>
              </div>
            }
          >
            <LazyScriptEditor />
          </Suspense>
        </div>
      )}

      {/* 2D CAD Sketch Overlay HUD */}
      {editorStore.mode === 'curve' && (
        <SketchOverlayHUD
          cursorScreenPos={cursorScreenPos}
          cursorWorldPos={cursorWorldPos}
          rubberBandInfo={rubberBandInfo}
        />
      )}

      {/* 3D Lasso/Box Selection Visual Overlay */}
      {lassoStart && lassoCurrent && (
        <div
          style={{
            left: Math.min(lassoStart.x, lassoCurrent.x),
            top: Math.min(lassoStart.y, lassoCurrent.y),
            width: Math.abs(lassoStart.x - lassoCurrent.x),
            height: Math.abs(lassoStart.y - lassoCurrent.y),
            pointerEvents: 'none',
            zIndex: 40,
          }}
          className="border border-blue-500 bg-blue-500/10 absolute rounded"
        />
      )}

      {/* Real-time Physics Simulation Circle Reticle / Cursor */}
      {editorStore.mode === 'simulation' && simulationCursorPos && (
        <div
          style={{
            left: simulationCursorPos.x,
            top: simulationCursorPos.y,
            transform: 'translate(-50%, -50%)',
            width: `${Math.max(24, Math.round(editorStore.simulationBrushRadius * 36))}px`,
            height: `${Math.max(24, Math.round(editorStore.simulationBrushRadius * 36))}px`,
            pointerEvents: 'none',
            zIndex: 45,
          }}
          className={`absolute rounded-full border-2 transition-all flex items-center justify-center ${
            editorStore.isPhysicsGrabbing
              ? 'border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-500/30 scale-105'
              : editorStore.simulationInteractionMode === 'explode'
              ? 'border-rose-500 bg-rose-500/20 shadow-lg shadow-rose-500/30 animate-pulse'
              : editorStore.simulationInteractionMode === 'push'
              ? 'border-sky-400 bg-sky-400/15 shadow-md shadow-sky-500/20'
              : 'border-emerald-400/80 bg-emerald-400/10 shadow-sm'
          }`}
        >
          {/* Inner Target Center Dot / Icon */}
          <div
            className={`w-2 h-2 rounded-full ${
              editorStore.isPhysicsGrabbing
                ? 'bg-amber-400 animate-ping'
                : editorStore.simulationInteractionMode === 'explode'
                ? 'bg-rose-500 scale-125'
                : editorStore.simulationInteractionMode === 'push'
                ? 'bg-sky-400'
                : 'bg-emerald-400'
            }`}
          />
          {/* Action Badge */}
          {editorStore.isPhysicsGrabbing && (
            <div className="absolute -bottom-6 px-2 py-0.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full uppercase tracking-wider whitespace-nowrap shadow-md">
              Déplacement Physique
            </div>
          )}
          {!editorStore.isPhysicsGrabbing && editorStore.simulationInteractionMode === 'explode' && (
            <div className="absolute -bottom-6 px-2 py-0.5 bg-rose-600 text-white font-bold text-[10px] rounded-full uppercase tracking-wider whitespace-nowrap shadow-md flex items-center space-x-1">
              <span>💥 Clic pour Exploser</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
