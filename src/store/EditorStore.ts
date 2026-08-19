/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Central Application State Manager (EditorState)
 */

import * as THREE from 'three';
import {
  EditorMode,
  SelectionLevel,
  SceneObject,
  ModifierConfig,
  SculptMode,
  CSGOperation,
} from '../types/editor';
import {
  DrawToolType,
  SketchEntity,
  SketchSettings,
  ClosedProfile,
  SnapPoint,
} from '../types/drawing';
import { CadDrawingEngine } from '../core/drawing/cadDrawingEngine';
import { InteractivePrimitiveType } from '../core/primitives/interactivePrimitives';
import { SculptBrushSettings } from '../core/sculpting/sculptBrush';
import { sculptingEngine, FalloffType } from '../core/sculpting/sculptEngine';
import { processModifierStack } from '../core/parametric/modifiers';
import {
  extrudeFaces,
  insetFaces,
  bevelFaces,
} from '../core/geometry/polygonOps';
import {
  commandHistory,
  AddObjectCommand,
  RemoveObjectCommand,
  GeometryChangeCommand,
  TransformCommand,
  ModifierChangeCommand,
  CompositeCommand,
  Command,
} from '../core/history/commandHistory';

type StateListener = () => void;

export interface ExtendedSculptBrushSettings extends SculptBrushSettings {
  falloff: FalloffType;
  symmetryX: boolean;
  symmetryY: boolean;
  symmetryZ: boolean;
}

class EditorStore {
  // State variables
  public mode: EditorMode = 'object';
  public selectionLevel: SelectionLevel = 'object';
  public activeTool: string = 'select';

  // Active object and selection
  public objects: SceneObject[] = [];
  public selectedObjectId: string | null = null;
  public selectedIndices = {
    vertices: [] as number[],
    edges: [] as number[],
    faces: [] as number[],
  };

  // Sculpting Settings
  public sculptSettings: ExtendedSculptBrushSettings = {
    radius: 0.8,
    strength: 0.5,
    mode: 'sculpt',
    invert: false,
    falloff: 'smoothstep',
    symmetryX: false,
    symmetryY: false,
    symmetryZ: false,
  };

  // Spline / NURBS Curve control points
  public curveControlPoints: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(2, 0.5, 0),
    new THREE.Vector3(3, 2, 0),
  ];

  // 2D CAD Sketching & Drawing State
  public activeDrawTool: DrawToolType = 'LINE';
  public sketchEntities: SketchEntity[] = [];
  public sketchSettings: SketchSettings = {
    gridSnapEnabled: true,
    gridStep: 0.5,
    objectSnapEnabled: true,
    orthoLockEnabled: false,
    polarAngleStep: 90,
    showDimensions: true,
    showSnapGuides: true,
    filletRadius: 0.5,
    offsetDistance: 0.5,
    extrudeHeight: 1.0,
  };
  public sketchProfiles: ClosedProfile[] = [];
  public activeSnapPoint: SnapPoint | null = null;
  public sketchHoveredEntityId: string | null = null;
  public sketchSelectedEntityIds: string[] = [];
  public isDrawingLocked2D: boolean = false;
  public onForce2DCameraLookAt: (() => void) | null = null;
  public onUnlock3DCamera: (() => void) | null = null;

  // CSG Selections
  public csgPrimaryId: string | null = null;
  public csgSecondaryId: string | null = null;
  public csgOperation: CSGOperation = 'subtract';

  // Tool parameter presets
  public extrudeDistance: number = 0.5;
  public insetAmount: number = 0.2;
  public bevelWidth: number = 0.1;
  public twistAngle: number = 180;
  public bendAngle: number = 90;
  public latheSegments: number = 32;

  // Viewport & Theme Settings
  public showGrid: boolean = true;
  public showWireframe: boolean = false;
  public showShadows: boolean = true;
  public flatShading: boolean = false;
  public themeMode: 'dark' | 'night' | 'light' = 'dark';
  public isRenderMode: boolean = false;
  public xRayMode: boolean = false;
  public isPropertyPanelOpen: boolean = true;
  public isLassoModeActive: boolean = false;
  public isSettingsModalOpen: boolean = false;
  public settingsInitialTab: 'optimization' | 'languages' | 'themes' | 'shortcuts' = 'optimization';
  public activeMainTab: 'preview' | 'code' = 'preview';
  public activeThreeScene: THREE.Scene | null = null;
  public activeThreeCamera: THREE.PerspectiveCamera | null = null;
  public activeThreeRenderer: THREE.WebGLRenderer | null = null;

  // Anti-Freeze Emergency Rescue State & Visual Alert
  public antiFreezeAlert: {
    isOpen: boolean;
    info: {
      timestamp: number;
      lagDurationMs: number;
      thresholdMs: number;
      freedGeometries: number;
      freedTextures: number;
      degradedOptions: string[];
    } | null;
  } = {
    isOpen: false,
    info: null,
  };

  public triggerAntiFreezeRescue(info: {
    timestamp: number;
    lagDurationMs: number;
    thresholdMs: number;
    freedGeometries: number;
    freedTextures: number;
    degradedOptions: string[];
  }): void {
    this.antiFreezeAlert = {
      isOpen: true,
      info,
    };
    this.notify();
  }

  public dismissAntiFreezeAlert(): void {
    this.antiFreezeAlert.isOpen = false;
    this.notify();
  }

  public restoreGraphicsAfterRescue(): void {
    if (this.activeThreeRenderer) {
      this.activeThreeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (this.activeThreeRenderer.shadowMap) {
        this.activeThreeRenderer.shadowMap.autoUpdate = true;
        this.activeThreeRenderer.shadowMap.needsUpdate = true;
      }
    }
    this.antiFreezeAlert.isOpen = false;
    this.notify();
  }

  public openSettings(tab: 'optimization' | 'languages' | 'themes' | 'shortcuts' = 'optimization'): void {
    this.settingsInitialTab = tab;
    this.isSettingsModalOpen = true;
    this.notify();
  }

  public closeSettings(): void {
    this.isSettingsModalOpen = false;
    this.notify();
  }

  public setLassoModeActive(active: boolean): void {
    this.isLassoModeActive = active;
    this.notify();
  }

  // MCP Agent Config
  public mcpAgentModeEnabled: boolean = false;
  public mcpServerUrl: string = 'ws://localhost:9222';
  public mcpApiKey: string = '';

  public setMcpAgentModeEnabled(enabled: boolean): void {
    this.mcpAgentModeEnabled = enabled;
    this.notify();
  }

  public setMcpServerUrl(url: string): void {
    this.mcpServerUrl = url;
    this.notify();
  }

  public setMcpApiKey(key: string): void {
    this.mcpApiKey = key;
    this.notify();
  }

  public setMainTab(tab: 'preview' | 'code'): void {
    this.activeMainTab = tab;
    this.notify();
  }

  public togglePropertyPanel(): void {
    this.isPropertyPanelOpen = !this.isPropertyPanelOpen;
    this.notify();
  }

  // Snapping & Transform Engine
  public snapToGrid: boolean = false;
  public snapTranslationStep: number = 0.5;
  public gizmoMode: 'translate' | 'rotate' | 'scale' = 'translate';
  public isCameraLocked: boolean = false;

  public get editSelectionMode(): 'VERTEX' | 'EDGE' | 'FACE' {
    if (this.selectionLevel === 'vertex') return 'VERTEX';
    if (this.selectionLevel === 'edge') return 'EDGE';
    return 'FACE';
  }

  public set editSelectionMode(mode: 'VERTEX' | 'EDGE' | 'FACE') {
    if (mode === 'VERTEX') this.setSelectionLevel('vertex');
    else if (mode === 'EDGE') this.setSelectionLevel('edge');
    else if (mode === 'FACE') this.setSelectionLevel('face');
  }

  public get selectedElements(): number[] {
    if (this.selectionLevel === 'vertex') return this.selectedIndices.vertices;
    if (this.selectionLevel === 'edge') return this.selectedIndices.edges;
    return this.selectedIndices.faces;
  }

  public set selectedElements(elements: number[]) {
    if (this.selectionLevel === 'vertex') {
      this.selectedIndices.vertices = elements;
    } else if (this.selectionLevel === 'edge') {
      this.selectedIndices.edges = elements;
    } else {
      this.selectedIndices.faces = elements;
    }
    this.notify();
  }

  public setEditSelectionMode(mode: 'VERTEX' | 'EDGE' | 'FACE'): void {
    this.editSelectionMode = mode;
  }

  public setSelectedElements(elements: number[]): void {
    this.selectedElements = elements;
  }

  public setSnapToGrid(enabled: boolean): void {
    this.snapToGrid = enabled;
    this.notify();
  }

  public setSnapTranslationStep(step: number): void {
    this.snapTranslationStep = step;
    this.notify();
  }

  public setGizmoMode(mode: 'translate' | 'rotate' | 'scale'): void {
    this.checkOtherToggle();
    this.gizmoMode = mode;
    this.notify();
  }

  public setCameraLocked(locked: boolean): void {
    this.isCameraLocked = locked;
    this.notify();
  }

  // Sun Settings for Render Mode
  public sunSettings = {
    position: [10, 20, 10] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
    color: '#ffffff',
    intensity: 3.0,
    scale: 1.0,
    castShadow: true,
    shadowBias: -0.0005,
  };

  public setSunPosition(position: [number, number, number]): void {
    this.sunSettings.position = position;
    this.notify();
  }

  public setSunColor(color: string): void {
    this.sunSettings.color = color;
    this.notify();
  }

  public setSunIntensity(intensity: number): void {
    this.sunSettings.intensity = intensity;
    this.notify();
  }

  public setSunScale(scale: number): void {
    this.sunSettings.scale = scale;
    this.notify();
  }

  // Physics Settings & Interactive Simulation
  public isPhysicsActive: boolean = false;
  public physicsInitialTransforms: Record<string, { position: THREE.Vector3, rotation: THREE.Euler }> = {};
  public simulationInteractionMode: 'grab' | 'push' | 'explode' = 'grab';
  public simulationBrushRadius: number = 1.0;
  public simulationSpringStrength: number = 30.0;
  public simulationExplosionForce: number = 40.0;
  public simulationExplosionChunks: number = 16;
  public isPhysicsGrabbing: boolean = false;

  public setSimulationInteractionMode(mode: 'grab' | 'push' | 'explode'): void {
    this.simulationInteractionMode = mode;
    this.notify();
  }

  public setSimulationBrushRadius(radius: number): void {
    this.simulationBrushRadius = Math.max(0.2, Math.min(5.0, radius));
    this.notify();
  }

  public setSimulationSpringStrength(strength: number): void {
    this.simulationSpringStrength = Math.max(5.0, Math.min(100.0, strength));
    this.notify();
  }

  public setSimulationExplosionForce(force: number): void {
    this.simulationExplosionForce = Math.max(10.0, Math.min(150.0, force));
    this.notify();
  }

  public setSimulationExplosionChunks(chunks: number): void {
    this.simulationExplosionChunks = Math.max(4, Math.min(48, Math.round(chunks)));
    this.notify();
  }

  public explodeSelectedSolid(epicenter?: THREE.Vector3): void {
    const selObj = this.getSelectedObject();
    if (!selObj || !selObj.mesh) return;

    // Dynamically import MeshExplosionEngine to perform shatter
    import('../core/physics/MeshExplosionEngine').then(({ MeshExplosionEngine }) => {
      MeshExplosionEngine.explodeSolid(selObj, {
        blastForce: this.simulationExplosionForce,
        chunkCount: this.simulationExplosionChunks,
        epicenter: epicenter || selObj.mesh!.position.clone()
      });
    });
  }

  public togglePhysics(): void {
    if (!this.isPhysicsActive) {
      // Snapshot initial transforms
      this.physicsInitialTransforms = {};
      this.objects.forEach(obj => {
        if (obj.mesh) {
          this.physicsInitialTransforms[obj.id] = {
            position: obj.mesh.position.clone(),
            rotation: obj.mesh.rotation.clone(),
          };
        }
      });
      this.isPhysicsActive = true;
    } else {
      this.isPhysicsActive = false;
    }
    this.notify();
  }

  public resetPhysics(): void {
    this.isPhysicsActive = false;
    
    // Restore transforms
    this.objects.forEach(obj => {
      if (obj.mesh && this.physicsInitialTransforms[obj.id]) {
        const initial = this.physicsInitialTransforms[obj.id];
        obj.mesh.position.copy(initial.position);
        obj.mesh.rotation.copy(initial.rotation);
      }
    });
    
    // Clear snapshot
    this.physicsInitialTransforms = {};
    this.notify();
  }

  // Animation State & Controls
  public isAnimationPlaying: boolean = false;
  public animationCurrentFrame: number = 0;
  public animationTotalFrames: number = 120;
  public animationFps: number = 30;
  public isTurntableActive: boolean = false;
  public turntableSpeed: number = 1.0;
  public keyframes: Record<number, Record<string, { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }>> = {};

  public toggleAnimationPlay(): void {
    this.isAnimationPlaying = !this.isAnimationPlaying;
    this.notify();
  }

  public setAnimationFrame(frame: number): void {
    this.animationCurrentFrame = Math.max(0, Math.min(frame, this.animationTotalFrames));
    this.notify();
  }

  public toggleTurntable(): void {
    this.isTurntableActive = !this.isTurntableActive;
    this.notify();
  }

  public addKeyframeForSelected(): void {
    const sel = this.getSelectedObject();
    if (!sel || !sel.mesh) return;
    if (!this.keyframes[this.animationCurrentFrame]) {
      this.keyframes[this.animationCurrentFrame] = {};
    }
    this.keyframes[this.animationCurrentFrame][sel.id] = {
      position: [sel.mesh.position.x, sel.mesh.position.y, sel.mesh.position.z],
      rotation: [sel.mesh.rotation.x, sel.mesh.rotation.y, sel.mesh.rotation.z],
      scale: [sel.mesh.scale.x, sel.mesh.scale.y, sel.mesh.scale.z],
    };
    this.notify();
  }

  // Cyclorama Settings for Render Mode
  public cycloramaColor: string = '#1e293b';
  public backdropType: 'StudioCyclorama' | 'Plane' | 'None' = 'StudioCyclorama';

  public setCycloramaColor(color: string): void {
    this.cycloramaColor = color;
    this.notify();
  }

  public setBackdropType(type: 'StudioCyclorama' | 'Plane' | 'None'): void {
    this.backdropType = type;
    this.notify();
  }

  public setSunAngleTime(progress: number): void {
    // progress from 0 to 1 representing time of day arc
    const radius = 25;
    const angle = progress * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const y = Math.max(2, Math.cos(angle) * radius + 5);
    const z = Math.cos(angle) * 10;
    this.sunSettings.position = [x, y, z];
    this.notify();
  }

  public setThemeMode(mode: 'dark' | 'night' | 'light'): void {
    this.themeMode = mode;
    this.notify();
  }

  public toggleThemeMode(): void {
    if (this.themeMode === 'dark') this.themeMode = 'night';
    else if (this.themeMode === 'night') this.themeMode = 'light';
    else this.themeMode = 'dark';
    this.notify();
  }

  public toggleRenderMode(): void {
    this.isRenderMode = !this.isRenderMode;
    this.notify();
  }

  public setRenderMode(enabled: boolean): void {
    this.isRenderMode = enabled;
    this.notify();
  }

  public clearCache(): void {
    // Clear temporary renderer caches, geometry caches, or reset render pipeline state
    console.log('[EditorStore] Cache cleared.');
    this.notify();
  }

  private checkOtherToggle(): void {
    if (this.isRenderMode) {
      this.isRenderMode = false;
      this.clearCache();
    }
  }

  public toggleXRayMode(): void {
    this.checkOtherToggle();
    this.xRayMode = !this.xRayMode;
    this.notify();
  }

  public setXRayMode(enabled: boolean): void {
    this.checkOtherToggle();
    this.xRayMode = enabled;
    this.notify();
  }

  public toggleWireframe(): void {
    this.checkOtherToggle();
    this.showWireframe = !this.showWireframe;
    this.notify();
  }

  public toggleGrid(): void {
    this.checkOtherToggle();
    this.showGrid = !this.showGrid;
    this.notify();
  }

  public toggleShadows(): void {
    this.checkOtherToggle();
    this.showShadows = !this.showShadows;
    this.notify();
  }

  // Interactive Primitive Drawing State
  public isInteractiveDrawingMode: boolean = false;
  public isPrimitivePopupOpen: boolean = false;
  public drawingPrimitiveType: InteractivePrimitiveType = 'cube';
  public drawingSnapEnabled: boolean = true;
  public drawingSnapStep: number = 0.5;
  public drawingStep: 'IDLE' | 'DRAWING_BASE' | 'EXTRUDING_HEIGHT' | 'COMPLETED' = 'IDLE';
  public onCancelDrawingCallback: (() => void) | null = null;
  public onZoomInCallback: (() => void) | null = null;
  public onZoomOutCallback: (() => void) | null = null;
  public isPanMode: boolean = false;
  public onPanLeftCallback: (() => void) | null = null;
  public onPanRightCallback: (() => void) | null = null;

  public togglePanMode(): void {
    this.isPanMode = !this.isPanMode;
    this.notify();
  }

  public cancelInteractiveDrawing(): void {
    if (this.onCancelDrawingCallback) {
      this.onCancelDrawingCallback();
    } else {
      this.drawingStep = 'IDLE';
      this.isInteractiveDrawingMode = false;
      this.notify();
    }
  }

  // Undo/Redo Stacks
  private historyStack: string[] = [];
  private historyIndex: number = -1;

  // React Event Listeners
  private listeners: Set<StateListener> = new Set();

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify(): void {
    this.listeners.forEach(fn => fn());
  }

  // --- Actions ---

  public setMode(newMode: EditorMode): void {
    this.checkOtherToggle();
    const prevMode = this.mode;
    this.mode = newMode;
    if (newMode === 'edit') {
      if (this.selectionLevel === 'object') this.selectionLevel = 'face';
    } else if (newMode === 'sculpt') {
      this.activeTool = 'sculpt';
    } else if (newMode === 'curve') {
      this.activeTool = 'drawCurve';
      // Lock Camera to orthogonal 2D face view for Drawing CAD
      this.isDrawingLocked2D = true;
      if (this.onForce2DCameraLookAt) {
        this.onForce2DCameraLookAt();
      }
    }

    if (prevMode === 'curve' && newMode !== 'curve') {
      this.isDrawingLocked2D = false;
      if (this.onUnlock3DCamera) {
        this.onUnlock3DCamera();
      }
    }

    this.notify();
  }

  // --- CAD 2D Sketching Actions ---
  public setActiveDrawTool(tool: DrawToolType): void {
    this.activeDrawTool = tool;
    this.notify();
  }

  public setDrawingLocked2D(locked: boolean): void {
    this.isDrawingLocked2D = locked;
    if (locked && this.onForce2DCameraLookAt) {
      this.onForce2DCameraLookAt();
    } else if (!locked && this.onUnlock3DCamera) {
      this.onUnlock3DCamera();
    }
    this.notify();
  }

  public updateSketchSettings(settings: Partial<SketchSettings>): void {
    this.sketchSettings = { ...this.sketchSettings, ...settings };
    this.notify();
  }

  public addSketchEntity(entity: SketchEntity): void {
    this.sketchEntities.push(entity);
    this.recomputeSketchProfiles();
    this.notify();
  }

  public removeSketchEntity(id: string): void {
    this.sketchEntities = this.sketchEntities.filter(e => e.id !== id);
    this.sketchSelectedEntityIds = this.sketchSelectedEntityIds.filter(selId => selId !== id);
    this.recomputeSketchProfiles();
    this.notify();
  }

  public deleteSketchEntities(ids: string[]): void {
    this.sketchEntities = this.sketchEntities.filter(e => !ids.includes(e.id));
    this.sketchSelectedEntityIds = this.sketchSelectedEntityIds.filter(selId => !ids.includes(selId));
    this.recomputeSketchProfiles();
    this.notify();
  }

  public clearSketch(): void {
    this.sketchEntities = [];
    this.sketchProfiles = [];
    this.sketchSelectedEntityIds = [];
    this.sketchHoveredEntityId = null;
    this.notify();
  }

  public recomputeSketchProfiles(): void {
    this.sketchProfiles = CadDrawingEngine.detectClosedProfiles(this.sketchEntities);
  }

  public trimSketchAt(entityId: string, clickPos: THREE.Vector2): void {
    this.sketchEntities = CadDrawingEngine.trimEntity(entityId, clickPos, this.sketchEntities);
    this.recomputeSketchProfiles();
    this.notify();
  }

  public extendSketchAt(entityId: string, clickPos: THREE.Vector2): void {
    this.sketchEntities = CadDrawingEngine.extendEntity(entityId, clickPos, this.sketchEntities);
    this.recomputeSketchProfiles();
    this.notify();
  }

  public filletSketch(lineAId: string, lineBId: string, radius: number): void {
    this.sketchEntities = CadDrawingEngine.filletCorners(lineAId, lineBId, radius, this.sketchEntities);
    this.recomputeSketchProfiles();
    this.notify();
  }

  public offsetSketch(distance: number): void {
    this.sketchEntities = CadDrawingEngine.offsetEntities(this.sketchEntities, distance);
    this.recomputeSketchProfiles();
    this.notify();
  }

  public extrudeSketchTo3D(height: number = 1.0): SceneObject | null {
    this.recomputeSketchProfiles();
    if (this.sketchProfiles.length === 0) {
      alert('Aucun profil fermé détecté. Dessinez une boucle fermée (ex: rectangle, cercle, ou polyligne fermée) pour extruder.');
      return null;
    }

    const primaryProfile = this.sketchProfiles[0];
    const geom = CadDrawingEngine.create3DExtrusionFromProfile(primaryProfile, height);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      roughness: 0.3,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(0, 0, 0);

    const newObj = this.addObject(`Extrusion_${Date.now().toString().slice(-4)}`, mesh);
    return newObj;
  }

  public latheSketchTo3D(segments: number = 32): SceneObject | null {
    this.recomputeSketchProfiles();
    if (this.sketchProfiles.length === 0) {
      // If no closed profile, we can also lathe open lines
      const pts: THREE.Vector3[] = [];
      this.sketchEntities.forEach(ent => {
        if (ent.type === 'LINE') {
          pts.push(new THREE.Vector3(ent.start.x, ent.start.y, 0));
          pts.push(new THREE.Vector3(ent.end.x, ent.end.y, 0));
        } else if (ent.type === 'SPLINE') {
          ent.points.forEach(p => pts.push(new THREE.Vector3(p.x, p.y, 0)));
        }
      });

      if (pts.length < 2) {
        alert('Veuillez dessiner au moins une ligne ou une courbe pour créer une révolution 360°.');
        return null;
      }

      this.curveControlPoints = pts;
      const geom = CadDrawingEngine.create3DLatheFromProfile({
        id: 'lathe_open',
        points: pts.map(p => new THREE.Vector2(p.x, p.y)),
        entityIds: [],
        area: 0,
        isClockwise: false,
      }, segments);
      const mat = new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.3 });
      const mesh = new THREE.Mesh(geom, mat);
      const newObj = this.addObject(`Révolution_Lathe_${Date.now().toString().slice(-4)}`, mesh);
      return newObj;
    }

    const primaryProfile = this.sketchProfiles[0];
    const geom = CadDrawingEngine.create3DLatheFromProfile(primaryProfile, segments);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.3 });
    const mesh = new THREE.Mesh(geom, mat);
    const newObj = this.addObject(`Révolution_${Date.now().toString().slice(-4)}`, mesh);
    return newObj;
  }

  public setSelectionLevel(level: SelectionLevel): void {
    this.checkOtherToggle();
    this.selectionLevel = level;
    this.clearMeshSelections();
    this.notify();
  }

  public setActiveTool(tool: string): void {
    this.checkOtherToggle();
    this.activeTool = tool;
    this.notify();
  }

  public setSelectedObject(id: string | null): void {
    this.selectedObjectId = id;
    this.clearMeshSelections();
    this.notify();
  }

  public clearMeshSelections(): void {
    this.selectedIndices = { vertices: [], edges: [], faces: [] };
    this.notify();
  }

  public toggleSelectionIndex(type: 'vertices' | 'edges' | 'faces', idx: number): void {
    const list = this.selectedIndices[type];
    const pos = list.indexOf(idx);
    if (pos >= 0) {
      list.splice(pos, 1);
    } else {
      list.push(idx);
    }
    this.notify();
  }

  public getSelectedObject(): SceneObject | null {
    if (!this.selectedObjectId) return null;
    return this.objects.find(o => o.id === this.selectedObjectId) || null;
  }

  // Pending snapshots for geometry operations
  private pendingGeometrySnapshots: Map<string, THREE.BufferGeometry> = new Map();

  public addObject(
    name: string,
    object: THREE.Object3D,
    type: 'mesh' | 'curve' | 'group' | 'camera' | 'light' = 'mesh',
    skipHistory: boolean = false
  ): SceneObject {
    const obj: SceneObject = {
      id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      visible: true,
      wireframe: this.showWireframe,
      type,
      modifiers: [],
      materialProps: {
        color: '#ffffff',
        roughness: 0.5,
        metalness: 0.0,
        emissive: '#000000',
        emissiveIntensity: 0,
        flatShading: this.flatShading,
      },
    };

    if (object instanceof THREE.Mesh) {
      obj.mesh = object;
      obj.geometryBackup = object.geometry.clone();
      obj.baseGeometry = object.geometry.clone();
      obj.materialProps.color = object.userData.colorValue || '#3b82f6';
      
      if (object.userData.isText) {
          obj.textProps = {
            textString: object.userData.textValue || 'Eya3D',
            height: object.userData.height !== undefined ? object.userData.height : 0.2,
            size: object.userData.size !== undefined ? object.userData.size : 1,
          };
      }
    } else if (object instanceof THREE.PerspectiveCamera) {
      obj.camera = object;
    } else if (object instanceof THREE.Light) {
      obj.light = object;
    } else {
      // Assume group or container
      obj.mesh = object as any;
    }

    object.userData.id = obj.id;
    this.objects.push(obj);
    if (this.activeThreeScene && object.parent !== this.activeThreeScene) {
      this.activeThreeScene.add(object);
    }
    this.selectedObjectId = obj.id;

    if (!skipHistory) {
      commandHistory.recordAndExecute(new AddObjectCommand(obj, this, `Placement: ${obj.name}`), true);
    }

    this.notify();
    return obj;
  }

  public removeObject(id: string, skipHistory: boolean = false): void {
    const targetObj = this.objects.find(o => o.id === id);
    if (!targetObj) return;

    if (!skipHistory) {
      commandHistory.recordAndExecute(new RemoveObjectCommand(targetObj, this, `Suppression: ${targetObj.name}`), false);
    } else {
      const targetMesh = targetObj.mesh || targetObj.camera || targetObj.light;
      if (targetMesh && targetMesh.parent) {
        targetMesh.parent.remove(targetMesh);
      }
      if (targetObj.mesh) {
        if (targetObj.mesh.geometry) {
          targetObj.mesh.geometry.dispose();
        }
        const mats = Array.isArray(targetObj.mesh.material) ? targetObj.mesh.material : [targetObj.mesh.material];
        mats.forEach(mat => {
          if (mat) {
            const standardMat = mat as THREE.MeshStandardMaterial;
            if (standardMat.map) standardMat.map.dispose();
            if (standardMat.normalMap) standardMat.normalMap.dispose();
            if (standardMat.roughnessMap) standardMat.roughnessMap.dispose();
            if (standardMat.metalnessMap) standardMat.metalnessMap.dispose();
            if (standardMat.bumpMap) standardMat.bumpMap.dispose();
            if (standardMat.envMap) standardMat.envMap.dispose();
            standardMat.dispose();
          }
        });
      }
      this.objects = this.objects.filter(o => o.id !== id);
      if (this.selectedObjectId === id) {
        this.selectedObjectId = this.objects.length > 0 ? this.objects[0].id : null;
      }
      this.notify();
    }
  }

  public executeCSG(objA: SceneObject, objB: SceneObject, resultMesh: THREE.Mesh, csgOpName: string): void {
    const removeA = new RemoveObjectCommand(objA, this);
    const removeB = new RemoveObjectCommand(objB, this);
    
    const resultObj: SceneObject = {
      id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `CSG_${csgOpName.toUpperCase()}`,
      visible: true,
      wireframe: this.showWireframe,
      type: 'mesh',
      mesh: resultMesh,
      geometryBackup: resultMesh.geometry.clone(),
      baseGeometry: resultMesh.geometry.clone(),
      modifiers: [],
      materialProps: {
        color: '#3b82f6',
        roughness: 0.5,
        metalness: 0.0,
        emissive: '#000000',
        emissiveIntensity: 0,
        flatShading: this.flatShading,
      },
    };
    resultMesh.userData.id = resultObj.id;
    const addResult = new AddObjectCommand(resultObj, this);

    const csgComposite = new CompositeCommand([removeA, removeB, addResult], `CSG ${csgOpName.toUpperCase()}`);
    commandHistory.recordAndExecute(csgComposite, false);
  }

  public recordTransformChange(
    objectId: string,
    prevTransform: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 },
    newTransform: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 },
    name?: string
  ): void {
    commandHistory.recordAndExecute(
      new TransformCommand(objectId, prevTransform, newTransform, this, name || 'Transformation Objet'),
      true
    );
  }

  // --- Modifier Stack Management ---

  public addModifier(objectId: string, modifier: ModifierConfig, skipHistory = false): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    const prevModifiers = JSON.parse(JSON.stringify(obj.modifiers));
    const newModifiers = JSON.parse(JSON.stringify([...obj.modifiers, modifier]));

    if (!skipHistory) {
      commandHistory.recordAndExecute(
        new ModifierChangeCommand(objectId, prevModifiers, newModifiers, this, `Ajout Modificateur: ${modifier.type}`),
        true
      );
    }

    obj.modifiers.push(modifier);
    this.reevaluateModifiers(objectId);
    this.notify();
  }

  public removeModifier(objectId: string, modifierId: string, skipHistory = false): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    const prevModifiers = JSON.parse(JSON.stringify(obj.modifiers));
    const newModifiers = JSON.parse(JSON.stringify(obj.modifiers.filter(m => m.id !== modifierId)));

    if (!skipHistory) {
      commandHistory.recordAndExecute(
        new ModifierChangeCommand(objectId, prevModifiers, newModifiers, this, 'Suppression Modificateur'),
        true
      );
    }

    obj.modifiers = obj.modifiers.filter(m => m.id !== modifierId);
    this.reevaluateModifiers(objectId);
    this.notify();
  }

  public toggleModifier(objectId: string, modifierId: string, skipHistory = false): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    const mod = obj.modifiers.find(m => m.id === modifierId);
    if (!mod) return;

    const prevModifiers = JSON.parse(JSON.stringify(obj.modifiers));
    const newModifiers = JSON.parse(JSON.stringify(obj.modifiers));
    const targetMod = newModifiers.find((m: any) => m.id === modifierId);
    if (targetMod) targetMod.enabled = !targetMod.enabled;

    if (!skipHistory) {
      commandHistory.recordAndExecute(
        new ModifierChangeCommand(objectId, prevModifiers, newModifiers, this, 'Activer/Désactiver Modificateur'),
        true
      );
    }

    mod.enabled = !mod.enabled;
    this.reevaluateModifiers(objectId);
    this.notify();
  }

  public updateModifier<T extends ModifierConfig>(
    objectId: string,
    modifierId: string,
    updates: Partial<T>,
    skipHistory = false
  ): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    const mod = obj.modifiers.find(m => m.id === modifierId);
    if (!mod) return;

    const prevModifiers = JSON.parse(JSON.stringify(obj.modifiers));
    const newModifiers = JSON.parse(JSON.stringify(obj.modifiers));
    const targetMod = newModifiers.find((m: any) => m.id === modifierId);
    if (targetMod) Object.assign(targetMod, updates);

    if (!skipHistory) {
      commandHistory.recordAndExecute(
        new ModifierChangeCommand(objectId, prevModifiers, newModifiers, this, 'Mise à jour Modificateur'),
        true
      );
    }

    Object.assign(mod, updates);
    this.reevaluateModifiers(objectId);
    this.notify();
  }

  public reevaluateModifiers(objectId: string): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj || !obj.mesh || !obj.geometryBackup) return;

    const newGeom = processModifierStack(obj.geometryBackup, obj.modifiers);
    obj.mesh.geometry.dispose();
    obj.mesh.geometry = newGeom;
  }

  public pushGeometryState(objectId: string): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj || !obj.mesh) return;
    const targetGeom = (this.mode === 'edit' && obj.baseGeometry) ? obj.baseGeometry : obj.mesh.geometry;
    this.pendingGeometrySnapshots.set(objectId, targetGeom.clone());
    
    const ver = sculptingEngine.getVersioning(targetGeom);
    ver.pushState(targetGeom);
  }

  public undo(): boolean {
    const success = commandHistory.undo();
    if (!success) {
      const selObj = this.getSelectedObject();
      if (selObj && selObj.mesh) {
        const targetGeom = (this.mode === 'edit' && selObj.baseGeometry) ? selObj.baseGeometry : selObj.mesh.geometry;
        const ver = sculptingEngine.getVersioning(targetGeom);
        if (ver.undo(targetGeom)) {
          this.updateGeometryBackup(selObj.id, targetGeom, true);
          return true;
        }
      }
    }
    return success;
  }

  public redo(): boolean {
    const success = commandHistory.redo();
    if (!success) {
      const selObj = this.getSelectedObject();
      if (selObj && selObj.mesh) {
        const targetGeom = (this.mode === 'edit' && selObj.baseGeometry) ? selObj.baseGeometry : selObj.mesh.geometry;
        const ver = sculptingEngine.getVersioning(targetGeom);
        if (ver.redo(targetGeom)) {
          this.updateGeometryBackup(selObj.id, targetGeom, true);
          return true;
        }
      }
    }
    return success;
  }

  public undoGeometry(): void {
    this.undo();
  }

  public redoGeometry(): void {
    this.redo();
  }

  public canUndo(): boolean {
    return commandHistory.canUndo();
  }

  public canRedo(): boolean {
    return commandHistory.canRedo();
  }

  public updateGeometryBackup(objectId: string, newGeometry: THREE.BufferGeometry, skipHistory = false): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj || !obj.mesh) return;

    const prevGeom = this.pendingGeometrySnapshots.get(objectId) || obj.baseGeometry?.clone() || obj.geometryBackup?.clone() || obj.mesh.geometry.clone();
    
    if (!skipHistory) {
      commandHistory.recordAndExecute(
        new GeometryChangeCommand(objectId, prevGeom, newGeometry, this, `Opération Maillage: ${obj.name}`),
        true
      );
    }
    this.pendingGeometrySnapshots.delete(objectId);

    obj.baseGeometry = newGeometry.clone();
    obj.geometryBackup = newGeometry.clone();

    if (obj.modifiers.length > 0) {
      this.reevaluateModifiers(objectId);
    } else {
      obj.mesh.geometry.dispose();
      obj.mesh.geometry = newGeometry.clone();
    }
    this.notify();
  }

  public applyAIAction(action: string, value?: number, color?: string): void {
    const selObj = this.getSelectedObject();
    if (!selObj || !selObj.mesh) return;

    if (action === 'extrude') {
      const dist = value !== undefined ? value : this.extrudeDistance;
      const faces = this.selectedIndices.faces;
      const targetFaces = faces.length > 0 ? faces : [0];
      const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
      const newGeom = extrudeFaces(sourceGeom, targetFaces, dist);
      this.updateGeometryBackup(selObj.id, newGeom);
    } else if (action === 'inset') {
      const amt = value !== undefined ? value : this.insetAmount;
      const faces = this.selectedIndices.faces;
      const targetFaces = faces.length > 0 ? faces : [0];
      const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
      const newGeom = insetFaces(sourceGeom, targetFaces, amt);
      this.updateGeometryBackup(selObj.id, newGeom);
    } else if (action === 'bevel') {
      const width = value !== undefined ? value : this.bevelWidth;
      const faces = this.selectedIndices.faces;
      const targetFaces = faces.length > 0 ? faces : [0];
      const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
      const newGeom = bevelFaces(sourceGeom, targetFaces, width);
      this.updateGeometryBackup(selObj.id, newGeom);
    } else if (action === 'subdivide') {
      const levels = value !== undefined ? Math.round(value) : 1;
      const subDMod = selObj.modifiers.find(m => m.type === 'subd');
      if (subDMod) {
        this.updateModifier(selObj.id, subDMod.id, { levels: Math.min(3, Math.max(1, levels)) });
      } else {
        const modId = `mod_subd_${Date.now()}`;
        this.addModifier(selObj.id, {
          id: modId,
          type: 'subd',
          enabled: true,
          levels: Math.min(3, Math.max(1, levels)),
          creaseWeight: 0.0,
        } as any);
      }
    } else if (action === 'color') {
      if (color) {
        selObj.materialProps.color = color;
        if (Array.isArray(selObj.mesh.material)) {
          selObj.mesh.material.forEach((mat: any) => {
            if (mat.color) mat.color.set(color);
          });
        } else if ((selObj.mesh.material as any).color) {
          (selObj.mesh.material as any).color.set(color);
        }
        this.notify();
      }
    }
  }

  public async handleAgentAction(toolName: string, args: any): Promise<{ status: 'success' | 'error'; message: string; data?: any }> {
    try {
      if (toolName === 'create_primitive') {
        const { shape, position, size } = args;
        let geom: THREE.BufferGeometry;
        if (shape === 'cube') {
          geom = new THREE.BoxGeometry(size ? size[0] : 1.5, size ? size[1] : 1.5, size ? size[2] : 1.5, 4, 4, 4);
        } else if (shape === 'sphere') {
          geom = new THREE.SphereGeometry(size ? size[0] : 1.0, 24, 24);
        } else if (shape === 'pyramid') {
          geom = new THREE.ConeGeometry(size ? size[0] : 1.0, size ? size[1] : 1.5, 4);
          geom.rotateY(Math.PI / 4);
        } else {
          throw new Error(`Shape de primitive non supportée : ${shape}. Choisissez parmi: 'cube', 'sphere', 'pyramid'.`);
        }
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4a90e2,
          roughness: 0.3,
          metalness: 0.1,
          flatShading: this.flatShading,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (position) {
          mesh.position.set(position[0], position[1], position[2]);
        } else {
          mesh.position.set(0, 1, 0);
        }
        const obj = this.addObject(`mcp_${shape}_${this.objects.length + 1}`, mesh);
        return { status: 'success', message: `Primitive ${shape} créée avec succès. (ID: ${obj.id})`, data: { objectId: obj.id } };
      }

      if (toolName === 'extrude_face') {
        const { targetObjectId, faceIndex, distance } = args;
        const obj = this.objects.find(o => o.id === targetObjectId);
        if (!obj || !obj.mesh) {
          throw new Error(`Objet cible introuvable: ${targetObjectId}`);
        }
        const sourceGeom = obj.baseGeometry || obj.geometryBackup || obj.mesh.geometry;
        const posAttr = sourceGeom.getAttribute('position');
        const maxFaces = posAttr ? posAttr.count / 3 : 0;
        if (faceIndex < 0 || faceIndex >= maxFaces) {
          throw new Error(`Index de face invalide (${faceIndex}). Le maillage de l'objet ${obj.name} contient seulement ${maxFaces} faces. Veuillez spécifier un index compris entre 0 et ${maxFaces - 1}.`);
        }
        const newGeom = extrudeFaces(sourceGeom, [faceIndex], distance !== undefined ? distance : 0.5);
        this.updateGeometryBackup(obj.id, newGeom);
        return { status: 'success', message: `Face ${faceIndex} de l'objet ${obj.name} extrudée avec succès d'une distance de ${distance !== undefined ? distance : 0.5} unités.` };
      }

      if (toolName === 'apply_subdivision') {
        const { targetObjectId, levels } = args;
        const obj = this.objects.find(o => o.id === targetObjectId);
        if (!obj || !obj.mesh) {
          throw new Error(`Objet cible introuvable: ${targetObjectId}`);
        }
        const subdLevels = levels !== undefined ? Math.round(levels) : 1;
        const subDMod = obj.modifiers.find(m => m.type === 'subd');
        if (subDMod) {
          this.updateModifier(obj.id, subDMod.id, { levels: Math.min(3, Math.max(1, subdLevels)) });
        } else {
          const modId = `mod_subd_${Date.now()}`;
          this.addModifier(obj.id, {
            id: modId,
            type: 'subd',
            enabled: true,
            levels: Math.min(3, Math.max(1, subdLevels)),
            creaseWeight: 0.0,
          });
        }
        return { status: 'success', message: `Modificateur de subdivision (niveau ${subdLevels}) appliqué sur l'objet ${obj.name} avec succès.` };
      }

      if (toolName === 'modify_transform') {
        const { targetObjectId, type, values } = args;
        const obj = this.objects.find(o => o.id === targetObjectId);
        if (!obj || !obj.mesh) {
          throw new Error(`Objet cible introuvable: ${targetObjectId}`);
        }
        if (type === 'translate') {
          obj.mesh.position.set(values[0], values[1], values[2]);
        } else if (type === 'rotate') {
          obj.mesh.rotation.set(values[0], values[1], values[2]);
        } else {
          throw new Error(`Type de transformation non supporté : ${type}. Choisissez parmi: 'translate', 'rotate'.`);
        }
        this.notify();
        return { status: 'success', message: `Transformation ${type} appliquée sur l'objet ${obj.name} avec les valeurs [${values.join(', ')}] avec succès.` };
      }

      if (toolName === 'update_object') {
        const { targetObjectId, property, value } = args;
        const obj = this.objects.find(o => o.id === targetObjectId);
        if (!obj || !obj.mesh) {
          throw new Error(`Objet cible introuvable: ${targetObjectId}`);
        }
        if (property === 'position') {
          obj.mesh.position.set(value[0], value[1], value[2]);
        } else if (property === 'rotation') {
          obj.mesh.rotation.set(value[0], value[1], value[2]);
        } else if (property === 'scale') {
          obj.mesh.scale.set(value[0], value[1], value[2]);
        } else if (property === 'visible') {
          obj.mesh.visible = value[0] !== 0;
        } else {
          throw new Error(`Propriété d'objet non supportée: ${property}. Choisissez parmi: 'position', 'rotation', 'scale', 'visible'.`);
        }
        this.notify();
        return { status: 'success', message: `Propriété '${property}' de l'objet ${obj.name} mise à jour avec succès.` };
      }

      if (toolName === 'set_material_property') {
        const { targetObjectId, property, value } = args;
        const obj = this.objects.find(o => o.id === targetObjectId);
        if (!obj || !obj.mesh) {
          throw new Error(`Objet cible introuvable: ${targetObjectId}`);
        }
        
        // Handle single material or array of materials
        const materials = Array.isArray(obj.mesh.material) ? obj.mesh.material : [obj.mesh.material];
        
        for (const mat of materials) {
          if (!mat) continue;
          
          if (property === 'color') {
            if (typeof value === 'string') {
              (mat as any).color.set(value);
            } else if (typeof value === 'number') {
              (mat as any).color.setHex(value);
            }
          } else if (property === 'roughness') {
            (mat as any).roughness = parseFloat(value);
          } else if (property === 'metalness') {
            (mat as any).metalness = parseFloat(value);
          } else if (property === 'opacity') {
            (mat as any).opacity = parseFloat(value);
            (mat as any).transparent = parseFloat(value) < 1.0;
          } else if (property === 'wireframe') {
            (mat as any).wireframe = value === 'true' || value === true;
          } else {
            throw new Error(`Propriété de matériau non supportée: ${property}. Choisissez parmi: 'color', 'roughness', 'metalness', 'opacity', 'wireframe'.`);
          }
        }
        
        this.notify();
        return { status: 'success', message: `Propriété de matériau '${property}' de l'objet ${obj.name} modifiée avec succès.` };
      }

      throw new Error(`Outil non reconnu : ${toolName}`);
    } catch (err: any) {
      return { status: 'error', message: err.message || String(err) };
    }
  }

  public forceAgentRefresh(targetObjectId: string): void {
    const obj = this.objects.find(o => o.id === targetObjectId);
    if (obj && obj.mesh) {
      if (obj.mesh.geometry.attributes.position) {
        obj.mesh.geometry.attributes.position.needsUpdate = true;
      }
      obj.mesh.geometry.computeVertexNormals();
    }
    this.notify();
  }
}

export const editorStore = new EditorStore();
