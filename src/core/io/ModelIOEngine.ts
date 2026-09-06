/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Model Import / Export Engine
 * Supports full pipeline for OBJ, STL (Binary & ASCII), and FBX formats
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { editorStore } from '../../store/EditorStore';

export class ModelIOEngine {
  private static instance: ModelIOEngine;

  public static getInstance(): ModelIOEngine {
    if (!ModelIOEngine.instance) {
      ModelIOEngine.instance = new ModelIOEngine();
    }
    return ModelIOEngine.instance;
  }

  // ==========================================
  // SECTION 1: IMPORT FUNCTIONALITY
  // ==========================================

  /**
   * Imports a 3D model from a File object (.obj, .stl, .fbx)
   */
  public async importFile(file: File): Promise<THREE.Object3D | null> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();

    let loadedObject: THREE.Object3D | null = null;

    try {
      if (ext === 'obj') {
        const text = new TextDecoder().decode(buffer);
        const loader = new OBJLoader();
        loadedObject = loader.parse(text);
      } else if (ext === 'stl') {
        const loader = new STLLoader();
        const geometry = loader.parse(buffer);
        const material = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.4,
          metalness: 0.1,
        });
        loadedObject = new THREE.Mesh(geometry, material);
      } else if (ext === 'fbx') {
        const loader = new FBXLoader();
        loadedObject = loader.parse(buffer, '');
      } else {
        throw new Error(`Unsupported 3D file format: .${ext}`);
      }

      if (loadedObject) {
        this.processAndAddToScene(loadedObject, file.name);
      }
      return loadedObject;
    } catch (err) {
      console.error('Failed to import 3D model:', err);
      alert(`Erreur d'importation du fichier 3D: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Scales, centers, assigns standard PBR materials if missing, and adds to editor store.
   */
  private processAndAddToScene(object: THREE.Object3D, fileName: string): void {
    // Traverse meshes to ensure shadows & normals
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!mesh.material) {
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.4,
            metalness: 0.1,
          });
        }
        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();
        }
      }
    });

    // 1. Force complete world matrix computation for all descendants
    object.updateMatrixWorld(true);

    // 2. Compute true composite bounding box in world space
    let bbox = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // 3. Scale normalization:
    // Standard PolyCraft 3D reference scale: 1 unit = 1 meter.
    // Workspace grid is 10x10 units. Primitives are 1 to 2 units.
    // Standard vehicle/prop target bounding dimension is ~2.5 - 3.0 units.
    let scaleFactor = 1.0;
    if (maxDim > 0) {
      if (maxDim >= 800) {
        // Authored in millimeters (e.g. 4500mm car -> scale to meters: 0.001)
        scaleFactor = 0.001;
        const normalizedDim = maxDim * scaleFactor;
        if (normalizedDim > 6.0 || normalizedDim < 0.5) {
          scaleFactor = 2.5 / maxDim;
        }
      } else if (maxDim >= 20) {
        // Authored in centimeters (e.g. 450cm car -> scale to meters: 0.01)
        scaleFactor = 0.01;
        const normalizedDim = maxDim * scaleFactor;
        if (normalizedDim > 6.0 || normalizedDim < 0.5) {
          scaleFactor = 2.5 / maxDim;
        }
      } else if (maxDim > 5.0 || maxDim < 0.3) {
        // Arbitrary scale: normalize largest dimension to 2.5 units
        scaleFactor = 2.5 / maxDim;
      }
    }

    if (scaleFactor !== 1.0) {
      object.scale.multiplyScalar(scaleFactor);
      object.updateMatrixWorld(true);
    }

    // 4. Recompute bounding box after scale and center precisely at Origin (0, 0, 0)
    bbox = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    // Offset position so geometry center is strictly at (0, 0, 0)
    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;
    object.updateMatrixWorld(true);

    const baseName = fileName.replace(/\.[^/.]+$/, "");

    // Register object in store with preserved root transform
    if (object instanceof THREE.Mesh) {
      editorStore.addObject(baseName, object, 'mesh');
    } else {
      editorStore.addObject(baseName, object, 'group');
    }
  }

  // ==========================================
  // SECTION 2: EXPORT FUNCTIONALITY
  // ==========================================

  /**
   * Exports an object or entire scene to OBJ format
   */
  public exportOBJ(targetObject?: THREE.Object3D, fileName: string = 'model'): void {
    const objectToExport = targetObject || this.getExportTarget();
    if (!objectToExport) {
      alert('Aucun objet sélectionné à exporter.');
      return;
    }

    const exporter = new OBJExporter();
    const result = exporter.parse(objectToExport);
    this.downloadBlob(new Blob([result], { type: 'text/plain' }), `${fileName}.obj`);
  }

  /**
   * Exports an object or entire scene to STL format (Binary or ASCII)
   */
  public exportSTL(targetObject?: THREE.Object3D, fileName: string = 'model', binary: boolean = true): void {
    const objectToExport = targetObject || this.getExportTarget();
    if (!objectToExport) {
      alert('Aucun objet sélectionné à exporter.');
      return;
    }

    const exporter = new STLExporter();
    const result = exporter.parse(objectToExport, { binary });
    const blob = binary
      ? new Blob([result], { type: 'application/octet-stream' })
      : new Blob([result as string], { type: 'text/plain' });

    this.downloadBlob(blob, `${fileName}.stl`);
  }

  /**
   * Exports an object or entire scene to FBX 7.4 ASCII format
   */
  public exportFBX(targetObject?: THREE.Object3D, fileName: string = 'model'): void {
    const objectToExport = targetObject || this.getExportTarget();
    if (!objectToExport) {
      alert('Aucun objet sélectionné à exporter.');
      return;
    }

    const fbxContent = this.generateFBXASCII(objectToExport, fileName);
    const blob = new Blob([fbxContent], { type: 'text/plain' });
    this.downloadBlob(blob, `${fileName}.fbx`);
  }

  /**
   * Helper to retrieve currently selected object or whole scene hierarchy
   */
  private getExportTarget(): THREE.Object3D | null {
    const sel = editorStore.getSelectedObject();
    if (sel && sel.mesh) return sel.mesh;

    // Default to active Three scene or all meshes
    if (editorStore.activeThreeScene) {
      return editorStore.activeThreeScene;
    }
    return null;
  }

  /**
   * Serializes standard Three.js Mesh / Hierarchy into clean FBX 7.4 ASCII syntax
   */
  private generateFBXASCII(root: THREE.Object3D, modelName: string): string {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        meshes.push(child as THREE.Mesh);
      }
    });

    let fbx = `; FBX 7.4.0 project file
; Generated by PolyCraft 3D Studio
; --------------------------------------------------

FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
\tCreationTimeStamp:  {
\t\tVersion: 1000
\t\tYear: 2026
\t\tMonth: 8
\t\tDay: 20
\t}
\tCreator: "PolyCraft 3D Studio"
}

GlobalSettings:  {
\tVersion: 1000
\tProperties70:  {
\t\tP: "UpAxis", "int", "Integer", "",1
\t\tP: "UpAxisSign", "int", "Integer", "",1
\t\tP: "FrontAxis", "int", "Integer", "",2
\t\tP: "FrontAxisSign", "int", "Integer", "",1
\t\tP: "CoordAxis", "int", "Integer", "",0
\t\tP: "CoordAxisSign", "int", "Integer", "",1
\t\tP: "UnitScaleFactor", "double", "Number", "",1.0
\t}
}

Objects:  {
`;

    meshes.forEach((mesh, index) => {
      if (!mesh || !mesh.geometry || typeof mesh.geometry.clone !== 'function') return;
      const geom = mesh.geometry.clone();
      geom.applyMatrix4(mesh.matrixWorld);
      const posAttr = geom.getAttribute('position');
      if (!posAttr) return;
      const normAttr = geom.getAttribute('normal');

      const vertCoords: string[] = [];
      for (let i = 0; i < posAttr.count; i++) {
        vertCoords.push(`${posAttr.getX(i)},${posAttr.getY(i)},${posAttr.getZ(i)}`);
      }

      const polyIndices: string[] = [];
      if (geom.index) {
        for (let i = 0; i < geom.index.count; i += 3) {
          const a = geom.index.getX(i);
          const b = geom.index.getX(i + 1);
          const c = geom.index.getX(i + 2);
          // In FBX ASCII, last index of polygon is bitwise inverted (-c - 1)
          polyIndices.push(`${a},${b},${-c - 1}`);
        }
      } else {
        for (let i = 0; i < posAttr.count; i += 3) {
          polyIndices.push(`${i},${i + 1},${-(i + 2) - 1}`);
        }
      }

      fbx += `\tGeometry: ${100000 + index}, "Geometry::${mesh.name || `Mesh_${index}`}", "Mesh" {\n`;
      fbx += `\t\tVertices: *${posAttr.count * 3} {\n\t\t\ta: ${vertCoords.join(',')}\n\t\t}\n`;
      fbx += `\t\tPolygonVertexIndex: *${polyIndices.length * 3} {\n\t\t\ta: ${polyIndices.join(',')}\n\t\t}\n`;
      
      if (normAttr) {
        const normCoords: string[] = [];
        for (let i = 0; i < normAttr.count; i++) {
          normCoords.push(`${normAttr.getX(i)},${normAttr.getY(i)},${normAttr.getZ(i)}`);
        }
        fbx += `\t\tLayerElementNormal: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n\t\t\tMappingInformationType: "ByPolygonVertex"\n\t\t\tReferenceInformationType: "Direct"\n\t\t\tNormals: *${normAttr.count * 3} {\n\t\t\t\ta: ${normCoords.join(',')}\n\t\t\t}\n\t\t}\n`;
      }
      fbx += `\t}\n`;

      fbx += `\tModel: ${200000 + index}, "Model::${mesh.name || `Node_${index}`}", "Mesh" {\n`;
      fbx += `\t\tVersion: 232\n`;
      fbx += `\t\tProperties70:  {\n`;
      fbx += `\t\t\tP: "InheritType", "enum", "", "",1\n`;
      fbx += `\t\t}\n`;
      fbx += `\t}\n`;
    });

    fbx += `}\n\nConnections:  {\n`;
    meshes.forEach((mesh, index) => {
      fbx += `\t;Object: Geometry::, Model::\n`;
      fbx += `\tC: "OO",${100000 + index},${200000 + index}\n`;
      fbx += `\t;Object: Model::, Model::RootNode\n`;
      fbx += `\tC: "OO",${200000 + index},0\n`;
    });
    fbx += `}\n`;

    return fbx;
  }

  /**
   * Triggers native browser download for a Blob
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const modelIOEngine = ModelIOEngine.getInstance();
