/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Command Pattern History System for PolyCraft 3D Studio
 */

import * as THREE from 'three';
import { SceneObject, ModifierConfig } from '../../types/editor';

export interface Command {
  name: string;
  execute(): void;
  undo(): void;
  redo?(): void;
}

export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number = 50;

  /**
   * Executes a command (or accepts an already executed command) and pushes it to history stack.
   */
  public recordAndExecute(command: Command, alreadyExecuted = true): void {
    if (!alreadyExecuted) {
      command.execute();
    }
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new operation
    if (this.undoStack.length > this.maxHistory) {
      const removed = this.undoStack.shift();
      // Dispose any disposable resources if needed
    }
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const command = this.redoStack.pop()!;
    if (command.redo) {
      command.redo();
    } else {
      command.execute();
    }
    this.undoStack.push(command);
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoName(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].name;
  }

  public getRedoName(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].name;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const commandHistory = new CommandHistory();

// --- Concrete Command Implementations ---

export interface EditorStoreInterface {
  objects: SceneObject[];
  selectedObjectId: string | null;
  activeThreeScene: THREE.Scene | null;
  notify(): void;
  updateGeometryBackup(objectId: string, newGeometry: THREE.BufferGeometry, skipHistory?: boolean): void;
  reevaluateModifiers(objectId: string): void;
}

export class AddObjectCommand implements Command {
  public name: string;
  private sceneObject: SceneObject;
  private store: EditorStoreInterface;

  constructor(sceneObject: SceneObject, store: EditorStoreInterface, name?: string) {
    this.name = name || `Placement: ${sceneObject.name}`;
    this.sceneObject = sceneObject;
    this.store = store;
  }

  public execute(): void {
    const exists = this.store.objects.some(o => o.id === this.sceneObject.id);
    if (!exists) {
      this.store.objects.push(this.sceneObject);
    }
    const targetObj = this.sceneObject.mesh || this.sceneObject.camera || this.sceneObject.light;
    if (targetObj && this.store.activeThreeScene) {
      if (!targetObj.parent) {
        this.store.activeThreeScene.add(targetObj);
      }
    }
    this.store.selectedObjectId = this.sceneObject.id;
    this.store.notify();
  }

  public undo(): void {
    const targetObj = this.sceneObject.mesh || this.sceneObject.camera || this.sceneObject.light;
    if (targetObj && targetObj.parent) {
      targetObj.parent.remove(targetObj);
    }
    this.store.objects = this.store.objects.filter(o => o.id !== this.sceneObject.id);
    if (this.store.selectedObjectId === this.sceneObject.id) {
      this.store.selectedObjectId = this.store.objects.length > 0 ? this.store.objects[this.store.objects.length - 1].id : null;
    }
    this.store.notify();
  }

  public redo(): void {
    this.execute();
  }
}

export class RemoveObjectCommand implements Command {
  public name: string;
  private sceneObject: SceneObject;
  private store: EditorStoreInterface;

  constructor(sceneObject: SceneObject, store: EditorStoreInterface, name?: string) {
    this.name = name || `Suppression: ${sceneObject.name}`;
    this.sceneObject = sceneObject;
    this.store = store;
  }

  public execute(): void {
    const targetObj = this.sceneObject.mesh || this.sceneObject.camera || this.sceneObject.light;
    if (targetObj && targetObj.parent) {
      targetObj.parent.remove(targetObj);
    }
    this.store.objects = this.store.objects.filter(o => o.id !== this.sceneObject.id);
    if (this.store.selectedObjectId === this.sceneObject.id) {
      this.store.selectedObjectId = this.store.objects.length > 0 ? this.store.objects[this.store.objects.length - 1].id : null;
    }
    this.store.notify();
  }

  public undo(): void {
    const exists = this.store.objects.some(o => o.id === this.sceneObject.id);
    if (!exists) {
      this.store.objects.push(this.sceneObject);
    }
    const targetObj = this.sceneObject.mesh || this.sceneObject.camera || this.sceneObject.light;
    if (targetObj && this.store.activeThreeScene) {
      if (!targetObj.parent) {
        this.store.activeThreeScene.add(targetObj);
      }
    }
    this.store.selectedObjectId = this.sceneObject.id;
    this.store.notify();
  }

  public redo(): void {
    this.execute();
  }
}

export class GeometryChangeCommand implements Command {
  public name: string;
  private objectId: string;
  private prevGeometry: THREE.BufferGeometry;
  private newGeometry: THREE.BufferGeometry;
  private store: EditorStoreInterface;

  constructor(
    objectId: string,
    prevGeometry: THREE.BufferGeometry,
    newGeometry: THREE.BufferGeometry,
    store: EditorStoreInterface,
    name?: string
  ) {
    this.name = name || 'Opération de Maillage';
    this.objectId = objectId;
    this.prevGeometry = prevGeometry.clone();
    this.newGeometry = newGeometry.clone();
    this.store = store;
  }

  public execute(): void {
    this.store.updateGeometryBackup(this.objectId, this.newGeometry, true);
  }

  public undo(): void {
    this.store.updateGeometryBackup(this.objectId, this.prevGeometry, true);
  }

  public redo(): void {
    this.execute();
  }
}

export interface TransformSnapshot {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export class TransformCommand implements Command {
  public name: string;
  private objectId: string;
  private prevTransform: TransformSnapshot;
  private newTransform: TransformSnapshot;
  private store: EditorStoreInterface;

  constructor(
    objectId: string,
    prevTransform: TransformSnapshot,
    newTransform: TransformSnapshot,
    store: EditorStoreInterface,
    name?: string
  ) {
    this.name = name || 'Transformation Objet';
    this.objectId = objectId;
    this.prevTransform = {
      position: prevTransform.position.clone(),
      rotation: prevTransform.rotation.clone(),
      scale: prevTransform.scale.clone(),
    };
    this.newTransform = {
      position: newTransform.position.clone(),
      rotation: newTransform.rotation.clone(),
      scale: newTransform.scale.clone(),
    };
    this.store = store;
  }

  public execute(): void {
    const obj = this.store.objects.find(o => o.id === this.objectId);
    const target = obj?.mesh || obj?.camera || obj?.light;
    if (target) {
      target.position.copy(this.newTransform.position);
      target.rotation.copy(this.newTransform.rotation);
      target.scale.copy(this.newTransform.scale);
      this.store.notify();
    }
  }

  public undo(): void {
    const obj = this.store.objects.find(o => o.id === this.objectId);
    const target = obj?.mesh || obj?.camera || obj?.light;
    if (target) {
      target.position.copy(this.prevTransform.position);
      target.rotation.copy(this.prevTransform.rotation);
      target.scale.copy(this.prevTransform.scale);
      this.store.notify();
    }
  }

  public redo(): void {
    this.execute();
  }
}

export class ModifierChangeCommand implements Command {
  public name: string;
  private objectId: string;
  private prevModifiers: ModifierConfig[];
  private newModifiers: ModifierConfig[];
  private store: EditorStoreInterface;

  constructor(
    objectId: string,
    prevModifiers: ModifierConfig[],
    newModifiers: ModifierConfig[],
    store: EditorStoreInterface,
    name?: string
  ) {
    this.name = name || 'Modification Modificateur';
    this.objectId = objectId;
    this.prevModifiers = JSON.parse(JSON.stringify(prevModifiers));
    this.newModifiers = JSON.parse(JSON.stringify(newModifiers));
    this.store = store;
  }

  public execute(): void {
    const obj = this.store.objects.find(o => o.id === this.objectId);
    if (obj) {
      obj.modifiers = JSON.parse(JSON.stringify(this.newModifiers));
      this.store.reevaluateModifiers(this.objectId);
      this.store.notify();
    }
  }

  public undo(): void {
    const obj = this.store.objects.find(o => o.id === this.objectId);
    if (obj) {
      obj.modifiers = JSON.parse(JSON.stringify(this.prevModifiers));
      this.store.reevaluateModifiers(this.objectId);
      this.store.notify();
    }
  }

  public redo(): void {
    this.execute();
  }
}

export class CompositeCommand implements Command {
  public name: string;
  private commands: Command[];

  constructor(commands: Command[], name?: string) {
    this.name = name || 'Opération Composée';
    this.commands = commands;
  }

  public execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  public undo(): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  public redo(): void {
    for (const cmd of this.commands) {
      if (cmd.redo) cmd.redo();
      else cmd.execute();
    }
  }
}
