/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Advanced Three.js WebGL Viewport
 */

import React, { useEffect, useRef } from 'react';
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
        if (key === 'g' && transformRef.current) {
          transformRef.current.setMode('translate');
        } else if (key === 'r' && transformRef.current) {
          transformRef.current.setMode('rotate');
        } else if (key === 's' && transformRef.current) {
          transformRef.current.setMode('scale');
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

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. SCENE SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090a0c); // Elegant Dark deep background
    sceneRef.current = scene;

    // 2. CAMERA SETUP
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(4, 3, 5);
    cameraRef.current = camera;

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
    } else if (editorStore.mode === 'object' || editorStore.mode === 'edit') {
      // Raycast Object / Face Selection with X-Ray Multi-Hit Support
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
        // If X-Ray mode is active in Edit mode, allow cycling or picking deeper faces/vertices
        const hitIndex = (editorStore.xRayMode && editorStore.mode === 'edit' && intersects.length > 1) ? 1 : 0;
        const hit = intersects[Math.min(hitIndex, intersects.length - 1)];
        const hitObject = editorStore.objects.find(o => o.mesh === hit.object);

        if (hitObject) {
          editorStore.setSelectedObject(hitObject.id);

          if (editorStore.mode === 'edit' && hit.faceIndex !== undefined) {
            editorStore.toggleSelectionIndex('faces', hit.faceIndex);
          }
        }
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
      className="flex-1 w-full h-full relative cursor-crosshair bg-[#0B0D10] overflow-hidden select-none"
    >
      {/* Top Left Floating Widgets (Orientation Gizmo & Transform Toolbar) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-[14px] select-none pointer-events-auto">
        <ViewOrientationGizmo cameraRef={cameraRef} onSnap={snapCamera} />
        <TransformToolbar />
      </div>

      {/* 2. SelfCAD Bottom-Left Position & Size Floating Inputs */}
      {selObj && selObj.mesh && (
        <div className="absolute bottom-4 left-4 z-10 bg-[#16181C]/90 backdrop-blur border border-[#2D3139] p-2.5 rounded-lg shadow-xl text-xs font-mono space-y-2 text-[#E0E0E0]">
          {/* Position Input Row */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-[#8E9299] w-14">Position</span>
            <div className="flex items-center space-x-1.5">
              <div className="flex items-center bg-[#0F1113] border border-[#2D3139] rounded px-1.5 py-0.5">
                <span className="text-rose-400 font-bold text-[10px] mr-1">X</span>
                <input
                  type="number"
                  step="0.1"
                  value={objPos.x.toFixed(1)}
                  onChange={e => {
                    if (selObj.mesh) {
                      selObj.mesh.position.x = parseFloat(e.target.value) || 0;
                      editorStore.notify();
                    }
                  }}
                  className="w-10 bg-transparent text-white text-[11px] font-mono text-right focus:outline-none"
                />
              </div>
              <div className="flex items-center bg-[#0F1113] border border-[#2D3139] rounded px-1.5 py-0.5">
                <span className="text-emerald-400 font-bold text-[10px] mr-1">Y</span>
                <input
                  type="number"
                  step="0.1"
                  value={objPos.y.toFixed(1)}
                  onChange={e => {
                    if (selObj.mesh) {
                      selObj.mesh.position.y = parseFloat(e.target.value) || 0;
                      editorStore.notify();
                    }
                  }}
                  className="w-10 bg-transparent text-white text-[11px] font-mono text-right focus:outline-none"
                />
              </div>
              <div className="flex items-center bg-[#0F1113] border border-[#2D3139] rounded px-1.5 py-0.5">
                <span className="text-sky-400 font-bold text-[10px] mr-1">Z</span>
                <input
                  type="number"
                  step="0.1"
                  value={objPos.z.toFixed(1)}
                  onChange={e => {
                    if (selObj.mesh) {
                      selObj.mesh.position.z = parseFloat(e.target.value) || 0;
                      editorStore.notify();
                    }
                  }}
                  className="w-10 bg-transparent text-white text-[11px] font-mono text-right focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Size Input Row */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-[#8E9299] w-14">Size</span>
            <div className="flex items-center space-x-1.5">
              <div className="flex items-center bg-[#0F1113] border border-[#2D3139] rounded px-1.5 py-0.5">
                <span className="text-rose-400 font-bold text-[10px] mr-1">X</span>
                <span className="w-10 text-right text-white text-[11px]">{objSize.x.toFixed(1)}</span>
              </div>
              <div className="flex items-center bg-[#0F1113] border border-[#2D3139] rounded px-1.5 py-0.5">
                <span className="text-emerald-400 font-bold text-[10px] mr-1">Y</span>
                <span className="w-10 text-right text-white text-[11px]">{objSize.y.toFixed(1)}</span>
              </div>
              <div className="flex items-center bg-[#0F1113] border border-[#2D3139] rounded px-1.5 py-0.5">
                <span className="text-sky-400 font-bold text-[10px] mr-1">Z</span>
                <span className="w-10 text-right text-white text-[11px]">{objSize.z.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Delete Selected Model Quick Action */}
          <div className="pt-1 border-t border-[#2D3139] flex justify-end">
            <button
              onClick={() => {
                if (selObj) {
                  editorStore.removeObject(selObj.id);
                }
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-[11px] font-sans font-semibold transition-all cursor-pointer shadow-sm"
              title="Supprimer ce modèle (Suppr / Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Supprimer le modèle</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
