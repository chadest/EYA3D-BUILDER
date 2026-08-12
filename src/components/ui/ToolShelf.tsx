/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Contextual Tool Shelf & Modeling Operations Control Panel (SelfCAD Icon-First Style)
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Circle,
  Scissors,
  Maximize2,
  Minimize2,
  BoxSelect,
  Layers,
  Sparkles,
  Compass,
  Repeat,
  Copy,
  RotateCw,
  Grid,
  PenTool,
  Hand,
  Target,
  Sliders,
  Plus,
  Zap,
  Split,
  CornerUpRight,
  Maximize as ExtrudeIcon,
  GitMerge,
  Cylinder as CylinderIcon,
  Disc,
  Eye,
  Camera,
} from 'lucide-react';
import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';
import { SelectionLevel, SculptMode, EditorMode } from '../../types/editor';
import {
  extrudeFaces,
  insetFaces,
  bevelFaces,
  loopCut,
  bridgeFaces,
} from '../../core/geometry/polygonOps';
import {
  createLatheFromCurve,
  createSweepMeshFromCurve,
  createCatmullRomCurve,
} from '../../core/splines/splineTool';
import { applySculptDeformation, remeshUniformly } from '../../core/sculpting/sculptBrush';
import { performCSGOperation } from '../../core/csg/csgOperations';
import { applyTwist, applyBend } from '../../core/deformation/twistBend';
import { generateDefaultLatticeCage } from '../../core/deformation/lattice';

export const ToolShelf: React.FC = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const mode = editorStore.mode;
  const selObj = editorStore.getSelectedObject();

  // Primitive adding helper
  const handleAddPrimitive = (type: string) => {
    let geom: THREE.BufferGeometry;
    const name = `mesh_${editorStore.objects.length + 1}`;

    switch (type) {
      case 'cube':
        geom = new THREE.BoxGeometry(1.5, 1.5, 1.5, 4, 4, 4);
        break;
      case 'sphere':
        geom = new THREE.SphereGeometry(1, 24, 24);
        break;
      case 'cylinder':
        geom = new THREE.CylinderGeometry(0.8, 0.8, 2, 24, 12);
        break;
      case 'torus':
        geom = new THREE.TorusGeometry(1, 0.4, 16, 32);
        break;
      case 'plane':
        geom = new THREE.PlaneGeometry(3, 3, 8, 8);
        geom.rotateX(-Math.PI / 2);
        break;
      default:
        geom = new THREE.BoxGeometry(1, 1, 1);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      roughness: 0.3,
      metalness: 0.1,
      flatShading: editorStore.flatShading,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(0, 1, 0);

    editorStore.addObject(name, mesh);
  };

  // Mesh Modeling Handlers
  const handleExtrude = () => {
    if (!selObj || !selObj.mesh) return;
    const faces = editorStore.selectedIndices.faces;
    const targetFaces = faces.length > 0 ? faces : [0];
    const newGeom = extrudeFaces(selObj.mesh.geometry, targetFaces, editorStore.extrudeDistance);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleInset = () => {
    if (!selObj || !selObj.mesh) return;
    const faces = editorStore.selectedIndices.faces;
    const targetFaces = faces.length > 0 ? faces : [0];
    const newGeom = insetFaces(selObj.mesh.geometry, targetFaces, editorStore.insetAmount);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleBevel = () => {
    if (!selObj || !selObj.mesh) return;
    const faces = editorStore.selectedIndices.faces;
    const targetFaces = faces.length > 0 ? faces : [0];
    const newGeom = bevelFaces(selObj.mesh.geometry, targetFaces, editorStore.bevelWidth);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleLoopCut = () => {
    if (!selObj || !selObj.mesh) return;
    const newGeom = loopCut(selObj.mesh.geometry);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleBridge = () => {
    if (!selObj || !selObj.mesh) return;
    const faces = editorStore.selectedIndices.faces;
    if (faces.length < 2) {
      alert('Please select at least 2 faces to bridge.');
      return;
    }
    const newGeom = bridgeFaces(selObj.mesh.geometry, faces[0], faces[1]);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  // Curve / Lathe
  const handleGenerateLathe = () => {
    const pts = editorStore.curveControlPoints;
    if (pts.length < 2) return;
    const latheGeom = createLatheFromCurve(pts, editorStore.latheSegments);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.3 });
    const mesh = new THREE.Mesh(latheGeom, mat);
    editorStore.addObject('Lathe Mesh', mesh);
  };

  // CSG Handlers
  const handleExecuteCSG = () => {
    if (!editorStore.csgPrimaryId || !editorStore.csgSecondaryId) {
      alert('Select primary and secondary objects for CSG operation.');
      return;
    }
    const objA = editorStore.objects.find(o => o.id === editorStore.csgPrimaryId);
    const objB = editorStore.objects.find(o => o.id === editorStore.csgSecondaryId);

    if (!objA?.mesh || !objB?.mesh) return;

    try {
      const resultMesh = performCSGOperation(objA.mesh, objB.mesh, editorStore.csgOperation);
      editorStore.removeObject(objA.id);
      editorStore.removeObject(objB.id);
      editorStore.addObject(`CSG_${editorStore.csgOperation.toUpperCase()}`, resultMesh);
    } catch (err) {
      console.error('CSG Error:', err);
    }
  };

  const modes: { id: EditorMode; label: string; icon: React.ReactNode }[] = [
    { id: 'object', label: '3D Shapes', icon: <Box className="w-4 h-4" /> },
    { id: 'edit', label: 'Mesh Edit', icon: <Scissors className="w-4 h-4" /> },
    { id: 'sculpt', label: 'Sculpting', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'curve', label: 'Drawing', icon: <Compass className="w-4 h-4" /> },
    { id: 'csg', label: 'Booleans', icon: <Layers className="w-4 h-4" /> },
    { id: 'deform', label: 'Deform', icon: <Maximize2 className="w-4 h-4" /> },
  ];

  const sculptBrushes: { mode: SculptMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'sculpt', label: 'Draw / Sculpt', icon: <PenTool className="w-4 h-4" /> },
    { mode: 'clay', label: 'Clay Strips', icon: <Layers className="w-4 h-4" /> },
    { mode: 'inflate', label: 'Inflate Mesh', icon: <Maximize2 className="w-4 h-4" /> },
    { mode: 'smooth', label: 'Smooth Surface', icon: <Zap className="w-4 h-4" /> },
    { mode: 'flatten', label: 'Flatten Plane', icon: <Minimize2 className="w-4 h-4" /> },
    { mode: 'pinch', label: 'Pinch / Attract', icon: <Target className="w-4 h-4" /> },
    { mode: 'grab', label: 'Grab & Drag', icon: <Hand className="w-4 h-4" /> },
  ];

  return (
    <div id="tool-shelf" className="bg-[#1C1E22] border-b border-[#2D3139] text-[#E0E0E0] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none z-20">
      {/* Mode Navigation Tabs */}
      <div className="flex items-center space-x-1 bg-[#0F1113] p-1 rounded border border-[#2D3139]">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => editorStore.setMode(m.id)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              mode === m.id
                ? 'bg-[#2D3139] text-white border border-[#4A90E2] shadow-sm'
                : 'text-[#8E9299] hover:text-white'
            }`}
            title={m.label}
          >
            {m.icon}
            <span className="hidden sm:inline text-[11px]">{m.label}</span>
          </button>
        ))}

        <div className="h-4 w-px bg-[#2D3139] mx-1" />

        {/* SPECIAL MODULE: Mode Rendu Réaliste (Render Mode Toggle) after Deform */}
        <button
          onClick={() => editorStore.toggleRenderMode()}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
            editorStore.isRenderMode
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 border border-amber-400 font-bold'
              : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
          }`}
          title={
            editorStore.isRenderMode
              ? 'Mode Rendu Actif (Cliquer pour désactiver et repasser en Édition)'
              : 'Activer le Mode Rendu Réaliste (HDRI Studio, SSAO, Bloom, SMAA)'
          }
        >
          <Camera className={`w-3.5 h-3.5 ${editorStore.isRenderMode ? 'text-slate-950' : 'text-amber-400'}`} />
          <span className="text-[11px] font-bold">Rendu</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded uppercase font-black ${
              editorStore.isRenderMode ? 'bg-slate-950 text-amber-400' : 'bg-[#2D3139] text-[#8E9299]'
            }`}
          >
            {editorStore.isRenderMode ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* X-Ray / Transparent Wireframe Mode Toggle (Edition Mode Only) */}
        <button
          onClick={() => editorStore.toggleXRayMode()}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
            editorStore.xRayMode
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 border border-sky-400 font-bold'
              : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
          }`}
          title={
            editorStore.xRayMode
              ? 'Mode X-Ray Actif (Cliquer pour désactiver)'
              : 'Activer le Filaire Transparent X-Ray (Voir et sélectionner à travers les volumes en Édition)'
          }
        >
          <BoxSelect className={`w-3.5 h-3.5 ${editorStore.xRayMode ? 'text-white' : 'text-sky-400'}`} />
          <span className="text-[11px] font-bold">X-Ray</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded uppercase font-black ${
              editorStore.xRayMode ? 'bg-slate-950 text-sky-400' : 'bg-[#2D3139] text-[#8E9299]'
            }`}
          >
            {editorStore.xRayMode ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* 1. OBJECT MODE TOOLBAR */}
      {mode === 'object' && (
        <div className="flex items-center space-x-2">
          {/* Interactive Draw Mode Toggle */}
          <button
            onClick={() => {
              editorStore.isInteractiveDrawingMode = !editorStore.isInteractiveDrawingMode;
              editorStore.notify();
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              editorStore.isInteractiveDrawingMode
                ? 'bg-[#4A90E2] border-[#4A90E2] text-white shadow-md'
                : 'bg-[#0F1113] border-[#2D3139] text-[#8E9299] hover:text-white'
            }`}
            title="Activer l'outil de dessin interactif de solides 3D dans le Viewport"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px]">Dessin Interactif</span>
          </button>

          {/* Add Solides Popup Trigger Button (+) */}
          <button
            onClick={() => {
              editorStore.isPrimitivePopupOpen = !editorStore.isPrimitivePopupOpen;
              editorStore.notify();
            }}
            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
              editorStore.isPrimitivePopupOpen
                ? 'bg-[#4A90E2] border-[#4A90E2] text-white shadow-md'
                : 'bg-[#0F1113] border-[#2D3139] text-[#E0E0E0] hover:text-white hover:bg-[#1C1E22] hover:border-[#4A90E2]'
            }`}
            title={editorStore.isPrimitivePopupOpen ? "Fermer le menu des solides" : "Ouvrir le menu de création de solides 3D (+)"}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. SCULPT MODE TOOLBAR (SelfCAD Icon-Only Brushes!) */}
      {mode === 'sculpt' && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Sculpt Brushes (ICON ONLY - NO TEXT!) */}
          <div className="flex items-center bg-[#0F1113] p-1 rounded border border-[#2D3139] space-x-1">
            {sculptBrushes.map(b => {
              const active = editorStore.sculptSettings.mode === b.mode;
              return (
                <button
                  key={b.mode}
                  onClick={() => {
                    editorStore.sculptSettings.mode = b.mode;
                    editorStore.notify();
                  }}
                  className={`p-1.5 rounded transition-all ${
                    active
                      ? 'bg-[#4A90E2] text-white shadow-md'
                      : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
                  }`}
                  title={b.label}
                >
                  {b.icon}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-[#2D3139]" />

          {/* Compact Sliders & Controls */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="flex items-center space-x-1">
              <span className="text-[#8E9299] text-[10px]">Radius:</span>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={editorStore.sculptSettings.radius}
                onChange={e => {
                  editorStore.sculptSettings.radius = parseFloat(e.target.value);
                  editorStore.notify();
                }}
                className="w-16 accent-[#4A90E2]"
              />
              <span className="text-[#4A90E2] text-[10px] w-6">{editorStore.sculptSettings.radius.toFixed(1)}</span>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-[#8E9299] text-[10px]">Strength:</span>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={editorStore.sculptSettings.strength}
                onChange={e => {
                  editorStore.sculptSettings.strength = parseFloat(e.target.value);
                  editorStore.notify();
                }}
                className="w-16 accent-[#4A90E2]"
              />
              <span className="text-[#4A90E2] text-[10px] w-6">{editorStore.sculptSettings.strength.toFixed(2)}</span>
            </div>

            {/* Symmetry Toggles */}
            <div className="flex items-center bg-[#0F1113] p-0.5 rounded border border-[#2D3139] space-x-0.5">
              {(['X', 'Y', 'Z'] as const).map(axis => {
                const key = `symmetry${axis}` as 'symmetryX' | 'symmetryY' | 'symmetryZ';
                const active = editorStore.sculptSettings[key];
                return (
                  <button
                    key={axis}
                    onClick={() => {
                      editorStore.sculptSettings[key] = !active;
                      editorStore.notify();
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-[#4A90E2] text-white'
                        : 'text-[#8E9299] hover:text-white bg-[#1C1E22]'
                    }`}
                    title={`Symmetry ${axis}`}
                  >
                    {axis}
                  </button>
                );
              })}
            </div>

            {/* Invert Toggle Icon */}
            <button
              onClick={() => {
                editorStore.sculptSettings.invert = !editorStore.sculptSettings.invert;
                editorStore.notify();
              }}
              className={`p-1 rounded text-[10px] font-bold border transition-colors ${
                editorStore.sculptSettings.invert
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                  : 'bg-[#0F1113] border-[#2D3139] text-[#8E9299] hover:text-white'
              }`}
              title="Invert Brush Direction"
            >
              Inv
            </button>
          </div>

          <div className="h-4 w-px bg-[#2D3139]" />

          {/* Remesh Action */}
          <button
            onClick={() => {
              if (selObj && selObj.mesh) {
                const newGeom = remeshUniformly(selObj.mesh.geometry);
                editorStore.updateGeometryBackup(selObj.id, newGeom);
              }
            }}
            className="bg-[#2D3139] hover:bg-[#383D47] border border-[#3D424D] text-white px-2 py-1 rounded text-xs font-semibold transition-colors"
            title="Uniform Remesh Geometry"
          >
            Remesh
          </button>
        </div>
      )}

      {/* 3. MESH EDIT MODE TOOLBAR (Icon-Only Buttons!) */}
      {mode === 'edit' && (
        <div className="flex items-center space-x-3">
          {/* Element Selection Mode Icons */}
          <div className="flex items-center bg-[#0F1113] p-1 rounded border border-[#2D3139] space-x-1">
            <button
              onClick={() => editorStore.setSelectionLevel('vertex')}
              className={`p-1.5 rounded transition-all ${
                editorStore.selectionLevel === 'vertex'
                  ? 'bg-[#4A90E2] text-white shadow-sm'
                  : 'text-[#8E9299] hover:text-white'
              }`}
              title="Vertex Selection Mode"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editorStore.setSelectionLevel('edge')}
              className={`p-1.5 rounded transition-all ${
                editorStore.selectionLevel === 'edge'
                  ? 'bg-[#4A90E2] text-white shadow-sm'
                  : 'text-[#8E9299] hover:text-white'
              }`}
              title="Edge Selection Mode"
            >
              <Split className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editorStore.setSelectionLevel('face')}
              className={`p-1.5 rounded transition-all ${
                editorStore.selectionLevel === 'face'
                  ? 'bg-[#4A90E2] text-white shadow-sm'
                  : 'text-[#8E9299] hover:text-white'
              }`}
              title="Face Selection Mode"
            >
              <BoxSelect className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-[#2D3139]" />

          {/* Modeling Operations (Icon Buttons!) */}
          <div className="flex items-center space-x-1 bg-[#0F1113] p-1 rounded border border-[#2D3139]">
            <button
              onClick={handleExtrude}
              className="p-1.5 rounded hover:bg-[#2D3139] text-white hover:text-[#4A90E2] transition-colors"
              title="Extrude Selected Faces"
            >
              <ExtrudeIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleInset}
              className="p-1.5 rounded hover:bg-[#2D3139] text-white hover:text-[#4A90E2] transition-colors"
              title="Inset Selected Faces"
            >
              <BoxSelect className="w-4 h-4" />
            </button>
            <button
              onClick={handleBevel}
              className="p-1.5 rounded hover:bg-[#2D3139] text-white hover:text-[#4A90E2] transition-colors"
              title="Bevel Edges / Faces"
            >
              <CornerUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleLoopCut}
              className="p-1.5 rounded hover:bg-[#2D3139] text-white hover:text-[#4A90E2] transition-colors"
              title="Loop Cut Mesh"
            >
              <Scissors className="w-4 h-4" />
            </button>
            <button
              onClick={handleBridge}
              className="p-1.5 rounded hover:bg-[#2D3139] text-white hover:text-[#4A90E2] transition-colors"
              title="Bridge Selected Faces"
            >
              <GitMerge className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
