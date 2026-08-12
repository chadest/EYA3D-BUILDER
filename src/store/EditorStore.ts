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
import { SculptBrushSettings } from '../core/sculpting/sculptBrush';
import { sculptingEngine, FalloffType } from '../core/sculpting/sculptEngine';
import { processModifierStack } from '../core/parametric/modifiers';

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

  // Snapping & Transform Engine
  public snapToGrid: boolean = false;
  public snapTranslationStep: number = 0.5;
  public gizmoMode: 'translate' | 'rotate' | 'scale' = 'translate';

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
  public drawingPrimitiveType: 'plane' | 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'pyramid' | 'star3d' = 'cube';
  public drawingSnapEnabled: boolean = true;
  public drawingSnapStep: number = 0.5;
  public drawingStep: 'IDLE' | 'DRAWING_BASE' | 'EXTRUDING_HEIGHT' | 'COMPLETED' = 'IDLE';
  public onCancelDrawingCallback: (() => void) | null = null;

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
    this.mode = newMode;
    if (newMode === 'edit') {
      if (this.selectionLevel === 'object') this.selectionLevel = 'face';
    } else if (newMode === 'sculpt') {
      this.activeTool = 'sculpt';
    } else if (newMode === 'curve') {
      this.activeTool = 'drawCurve';
    }
    this.notify();
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

  public addObject(
    name: string,
    mesh: THREE.Mesh,
    type: 'mesh' | 'curve' = 'mesh'
  ): SceneObject {
    const backupGeom = mesh.geometry.clone();
    const obj: SceneObject = {
      id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      visible: true,
      wireframe: this.showWireframe,
      type,
      mesh,
      geometryBackup: backupGeom,
      modifiers: [],
      materialProps: {
        color: '#3b82f6',
        roughness: 0.3,
        metalness: 0.1,
        flatShading: this.flatShading,
      },
    };

    mesh.userData.id = obj.id;
    this.objects.push(obj);
    this.selectedObjectId = obj.id;
    this.notify();
    return obj;
  }

  public removeObject(id: string): void {
    const targetObj = this.objects.find(o => o.id === id);
    if (targetObj && targetObj.mesh) {
      if (targetObj.mesh.parent) {
        targetObj.mesh.parent.remove(targetObj.mesh);
      }
      if (targetObj.mesh.geometry) {
        targetObj.mesh.geometry.dispose();
      }
      if (Array.isArray(targetObj.mesh.material)) {
        targetObj.mesh.material.forEach(m => m.dispose());
      } else if (targetObj.mesh.material) {
        targetObj.mesh.material.dispose();
      }
    }
    this.objects = this.objects.filter(o => o.id !== id);
    if (this.selectedObjectId === id) {
      this.selectedObjectId = this.objects.length > 0 ? this.objects[0].id : null;
    }
    this.notify();
  }

  // --- Modifier Stack Management ---

  public addModifier(objectId: string, modifier: ModifierConfig): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    obj.modifiers.push(modifier);
    this.reevaluateModifiers(objectId);
    this.notify();
  }

  public removeModifier(objectId: string, modifierId: string): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    obj.modifiers = obj.modifiers.filter(m => m.id !== modifierId);
    this.reevaluateModifiers(objectId);
    this.notify();
  }

  public toggleModifier(objectId: string, modifierId: string): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    const mod = obj.modifiers.find(m => m.id === modifierId);
    if (mod) {
      mod.enabled = !mod.enabled;
      this.reevaluateModifiers(objectId);
      this.notify();
    }
  }

  public updateModifier<T extends ModifierConfig>(
    objectId: string,
    modifierId: string,
    updates: Partial<T>
  ): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;

    const mod = obj.modifiers.find(m => m.id === modifierId);
    if (mod) {
      Object.assign(mod, updates);
      this.reevaluateModifiers(objectId);
      this.notify();
    }
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
    const ver = sculptingEngine.getVersioning(obj.mesh.geometry);
    ver.pushState(obj.mesh.geometry);
    this.updateGeometryBackup(objectId, obj.mesh.geometry);
  }

  public undoGeometry(): void {
    const selObj = this.getSelectedObject();
    if (!selObj || !selObj.mesh) return;
    const ver = sculptingEngine.getVersioning(selObj.mesh.geometry);
    if (ver.undo(selObj.mesh.geometry)) {
      this.updateGeometryBackup(selObj.id, selObj.mesh.geometry);
      this.notify();
    }
  }

  public redoGeometry(): void {
    const selObj = this.getSelectedObject();
    if (!selObj || !selObj.mesh) return;
    const ver = sculptingEngine.getVersioning(selObj.mesh.geometry);
    if (ver.redo(selObj.mesh.geometry)) {
      this.updateGeometryBackup(selObj.id, selObj.mesh.geometry);
      this.notify();
    }
  }

  public updateGeometryBackup(objectId: string, newGeometry: THREE.BufferGeometry): void {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj || !obj.mesh) return;

    obj.geometryBackup = newGeometry.clone();
    if (obj.modifiers.length > 0) {
      this.reevaluateModifiers(objectId);
    } else {
      obj.mesh.geometry.dispose();
      obj.mesh.geometry = newGeometry.clone();
    }
    this.notify();
  }
}

export const editorStore = new EditorStore();
