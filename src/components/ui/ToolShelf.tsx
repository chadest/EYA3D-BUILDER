/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Contextual Tool Shelf & Modeling Operations Control Panel (SelfCAD Icon-First Style)
 */

import React, { useState, useEffect, useTransition } from 'react';
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
  Code,
  ShieldAlert,
  MoveUpRight,
  PenLine,
  Square,
  CircleDot,
  Trash2,
  Lock,
  Unlock,
  Ruler,
  Crosshair,
  Magnet,
  Film,
  Activity,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Key,
  Flame,
  MousePointer,
} from 'lucide-react';
import { motion } from 'motion/react';
import * as THREE from 'three';
import { DrawToolType } from '../../types/drawing';
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
import {
  applySculptDeformation,
  remeshUniformly,
  clearMeshMask,
  invertMeshMask,
} from '../../core/sculpting/sculptBrush';
import { performCSGOperation } from '../../core/csg/csgOperations';
import { applyTwist, applyBend } from '../../core/deformation/twistBend';
import { generateDefaultLatticeCage } from '../../core/deformation/lattice';

export const ToolShelf: React.FC = () => {
  const [, setTick] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const mode = editorStore.mode;
  const selObj = editorStore.getSelectedObject();

  const handleSetMode = (targetMode: EditorMode) => {
    startTransition(() => {
      editorStore.setMode(targetMode);
    });
  };

  const handleToggleRenderMode = () => {
    startTransition(() => {
      editorStore.toggleRenderMode();
    });
  };

  const handleToggleXRayMode = () => {
    startTransition(() => {
      editorStore.toggleXRayMode();
    });
  };

  const handleSetMainTab = (tab: 'preview' | 'code') => {
    startTransition(() => {
      editorStore.setMainTab(tab);
    });
  };

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
    const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
    const newGeom = extrudeFaces(sourceGeom, targetFaces, editorStore.extrudeDistance);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleInset = () => {
    if (!selObj || !selObj.mesh) return;
    const faces = editorStore.selectedIndices.faces;
    const targetFaces = faces.length > 0 ? faces : [0];
    const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
    const newGeom = insetFaces(sourceGeom, targetFaces, editorStore.insetAmount);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleBevel = () => {
    if (!selObj || !selObj.mesh) return;
    const faces = editorStore.selectedIndices.faces;
    const targetFaces = faces.length > 0 ? faces : [0];
    const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
    const newGeom = bevelFaces(sourceGeom, targetFaces, editorStore.bevelWidth);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleLoopCut = () => {
    if (!selObj || !selObj.mesh) return;
    const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
    const newGeom = loopCut(sourceGeom);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const handleBridge = () => {
    if (!selObj || !selObj.mesh) return;
    const faces = editorStore.selectedIndices.faces;
    if (faces.length < 2) {
      alert('Please select at least 2 faces to bridge.');
      return;
    }
    const sourceGeom = selObj.baseGeometry || selObj.geometryBackup || selObj.mesh.geometry;
    const newGeom = bridgeFaces(sourceGeom, faces[0], faces[1]);
    editorStore.updateGeometryBackup(selObj.id, newGeom);
  };

  const activeSubD = selObj?.modifiers?.find(m => m.type === 'subd' && m.enabled) as any;

  const handleToggleSubdivision = () => {
    if (!selObj) return;
    const subDMod = selObj.modifiers.find(m => m.type === 'subd');
    if (subDMod) {
      if ((subDMod as any).levels >= 3) {
        editorStore.removeModifier(selObj.id, subDMod.id);
      } else {
        editorStore.updateModifier(selObj.id, subDMod.id, { levels: (subDMod as any).levels + 1 });
      }
    } else {
      const modId = `mod_subd_${Date.now()}`;
      editorStore.addModifier(selObj.id, {
        id: modId,
        type: 'subd',
        enabled: true,
        levels: 1,
        creaseWeight: 0.0,
      } as any);
    }
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
      editorStore.executeCSG(objA, objB, resultMesh, editorStore.csgOperation);
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
    { id: 'animation', label: 'Animation', icon: <Film className="w-4 h-4" /> },
    { id: 'simulation', label: 'Simulation', icon: <Activity className="w-4 h-4" /> },
  ];

  const sculptBrushes: { mode: SculptMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'sculpt', label: 'Draw / Sculpt (Standard)', icon: <PenTool className="w-4 h-4" /> },
    { mode: 'clay', label: 'Clay Strips', icon: <Layers className="w-4 h-4" /> },
    { mode: 'inflate', label: 'Inflate / Deflate', icon: <Maximize2 className="w-4 h-4" /> },
    { mode: 'smooth', label: 'Smooth Surface', icon: <Zap className="w-4 h-4" /> },
    { mode: 'flatten', label: 'Flatten / Scrape', icon: <Minimize2 className="w-4 h-4" /> },
    { mode: 'pinch', label: 'Pinch / Crease', icon: <Scissors className="w-4 h-4" /> },
    { mode: 'grab', label: 'Grab & Move', icon: <Hand className="w-4 h-4" /> },
    { mode: 'snakehook', label: 'Snake Hook (Extrude Horns/Hair)', icon: <MoveUpRight className="w-4 h-4" /> },
    { mode: 'mask', label: 'Mask Vertices (Protect Areas)', icon: <ShieldAlert className="w-4 h-4" /> },
  ];

  return (
    <div id="tool-shelf" className="bg-[#1C1E22] border-b border-[#2D3139] text-[#E0E0E0] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none z-20">
      {/* Mode Navigation Tabs (50% Rounded Circular Icon Items with Smooth Transitions & No Text) */}
      <div className="flex items-center space-x-1.5 bg-[#0F1113] p-1 rounded-full border border-[#2D3139]">
        {modes.map(m => {
          const isActive = mode === m.id;
          return (
            <motion.button
              key={m.id}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 450, damping: 25 }}
              onClick={() => handleSetMode(m.id)}
              className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#4A90E2] text-white shadow-md shadow-[#4A90E2]/30 border border-[#6BA4E8]'
                  : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
              }`}
              title={m.label}
            >
              {isActive && (
                <motion.div
                  layoutId="activeModePill"
                  className="absolute inset-0 rounded-full bg-[#4A90E2] -z-10 shadow-md shadow-blue-500/30"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              {m.icon}
            </motion.button>
          );
        })}

        <div className="h-4 w-px bg-[#2D3139] mx-1" />

        {/* SPECIAL MODULE: Mode Rendu Réaliste (Render Mode Toggle) after Deform */}
        <button
          onClick={handleToggleRenderMode}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
            className={`text-[9px] px-1 py-0.2 rounded-full uppercase font-black ${
              editorStore.isRenderMode ? 'bg-slate-950 text-amber-400' : 'bg-[#2D3139] text-[#8E9299]'
            }`}
          >
            {editorStore.isRenderMode ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* X-Ray / Transparent Wireframe Mode Toggle (Edition Mode Only) */}
        <button
          onClick={handleToggleXRayMode}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
            className={`text-[9px] px-1 py-0.2 rounded-full uppercase font-black ${
              editorStore.xRayMode ? 'bg-slate-950 text-sky-400' : 'bg-[#2D3139] text-[#8E9299]'
            }`}
          >
            {editorStore.xRayMode ? 'ON' : 'OFF'}
          </span>
        </button>

        <div className="h-4 w-px bg-[#2D3139] mx-1" />

        {/* Preview / Code Tab Switcher (Professional Scripting Environment Toggle) */}
        <div className="flex items-center bg-[#0F1113] p-0.5 rounded-full border border-[#2D3139] space-x-0.5">
          <button
            onClick={() => handleSetMainTab('preview')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              editorStore.activeMainTab === 'preview'
                ? 'bg-[#2D3139] text-white border border-[#4A90E2] shadow-sm'
                : 'text-[#8E9299] hover:text-white'
            }`}
            title="Aperçu 3D interactif"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>Preview</span>
          </button>
          <button
            onClick={() => handleSetMainTab('code')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              editorStore.activeMainTab === 'code'
                ? 'bg-[#2D3139] text-white border border-[#4A90E2] shadow-sm'
                : 'text-[#8E9299] hover:text-white'
            }`}
            title="Éditeur de code JavaScript/TypeScript pour manipuler la scène"
          >
            <Code className="w-3.5 h-3.5 text-emerald-400" />
            <span>Code</span>
          </button>
        </div>
      </div>

      {/* 1. OBJECT MODE TOOLBAR */}
      {mode === 'object' && (
        <div className="flex items-center space-x-2">
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

          {/* Remesh & Mask Actions */}
          <div className="flex items-center space-x-1.5">
            {/* Falloff Curve Dropdown */}
            <select
              value={editorStore.sculptSettings.falloff || 'smoothstep'}
              onChange={e => {
                editorStore.sculptSettings.falloff = e.target.value as any;
                editorStore.notify();
              }}
              className="bg-[#0F1113] border border-[#2D3139] text-[#E0E0E0] text-[10px] px-1.5 py-1 rounded focus:outline-none"
              title="Brush Falloff Curve"
            >
              <option value="smoothstep">Smooth</option>
              <option value="gaussian">Gaussian</option>
              <option value="linear">Linear</option>
              <option value="constant">Flat</option>
            </select>

            {/* Mask Clear & Invert Buttons */}
            <button
              onClick={() => {
                if (selObj && selObj.mesh) {
                  clearMeshMask(selObj.mesh);
                  editorStore.notify();
                }
              }}
              className="bg-[#0F1113] hover:bg-[#2D3139] border border-[#2D3139] text-[#8E9299] hover:text-white px-1.5 py-1 rounded text-[10px] transition-colors"
              title="Clear Vertex Mask"
            >
              Clear Mask
            </button>
            <button
              onClick={() => {
                if (selObj && selObj.mesh) {
                  invertMeshMask(selObj.mesh);
                  editorStore.notify();
                }
              }}
              className="bg-[#0F1113] hover:bg-[#2D3139] border border-[#2D3139] text-[#8E9299] hover:text-white px-1.5 py-1 rounded text-[10px] transition-colors"
              title="Invert Vertex Mask"
            >
              Invert Mask
            </button>

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
            <button
              onClick={handleToggleSubdivision}
              className={`p-1.5 rounded transition-all flex items-center justify-center relative ${
                activeSubD
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                  : 'hover:bg-[#2D3139] text-white hover:text-[#4A90E2]'
              }`}
              title={activeSubD ? `Catmull-Clark Subdivision Level ${activeSubD.levels} (Click to cycle levels)` : "Apply Catmull-Clark Subdivision Modifier"}
            >
              <Grid className={`w-4 h-4 ${activeSubD ? 'text-amber-400' : 'text-gray-400'}`} />
              {activeSubD && (
                <span className="text-[9px] px-1 bg-amber-500 text-slate-950 rounded font-black absolute -top-1 -right-1">
                  {activeSubD.levels}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 4. CAD 2D DRAWING & SKETCHING MODE TOOLBAR */}
      {mode === 'curve' && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Lock / Unlock 2D Camera View */}
          <button
            onClick={() => editorStore.setDrawingLocked2D(!editorStore.isDrawingLocked2D)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold border transition-all ${
              editorStore.isDrawingLocked2D
                ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'bg-[#0F1113] border-[#2D3139] text-slate-400 hover:text-white'
            }`}
            title={editorStore.isDrawingLocked2D ? "Vue 2D Orthogonale verrouillée (Axe Z face)" : "Déverrouiller pour orbiter en 3D"}
          >
            {editorStore.isDrawingLocked2D ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span className="text-[10px] hidden sm:inline">{editorStore.isDrawingLocked2D ? 'Vue 2D Fixée' : 'Vue Libre'}</span>
          </button>

          <div className="h-4 w-px bg-[#2D3139]" />

          {/* Primary CAD Drawing Tools */}
          <div className="flex items-center bg-[#0F1113] p-1 rounded-lg border border-[#2D3139] space-x-0.5">
            {[
              { id: 'SELECT' as DrawToolType, label: 'Sélection', icon: <Crosshair className="w-3.5 h-3.5" /> },
              { id: 'LINE' as DrawToolType, label: 'Ligne (L)', icon: <PenLine className="w-3.5 h-3.5" /> },
              { id: 'RECTANGLE' as DrawToolType, label: 'Rectangle (R)', icon: <Square className="w-3.5 h-3.5" /> },
              { id: 'CIRCLE' as DrawToolType, label: 'Cercle (C)', icon: <Circle className="w-3.5 h-3.5" /> },
              { id: 'ARC' as DrawToolType, label: 'Arc 3 Points', icon: <CircleDot className="w-3.5 h-3.5" /> },
              { id: 'SPLINE' as DrawToolType, label: 'Spline', icon: <PenTool className="w-3.5 h-3.5" /> },
              { id: 'TRIM' as DrawToolType, label: 'Rogner', icon: <Scissors className="w-3.5 h-3.5 text-amber-400" /> },
              { id: 'EXTEND' as DrawToolType, label: 'Prolonger', icon: <MoveUpRight className="w-3.5 h-3.5 text-emerald-400" /> },
              { id: 'FILLET' as DrawToolType, label: 'Congé', icon: <CornerUpRight className="w-3.5 h-3.5 text-sky-400" /> },
              { id: 'OFFSET' as DrawToolType, label: 'Décalage', icon: <Copy className="w-3.5 h-3.5 text-purple-400" /> },
            ].map(t => {
              const active = editorStore.activeDrawTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    editorStore.setActiveDrawTool(t.id);
                  }}
                  className={`p-1.5 rounded transition-all ${
                    active
                      ? 'bg-[#4A90E2] text-white shadow-sm'
                      : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
                  }`}
                  title={t.label}
                >
                  {t.icon}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-[#2D3139]" />

          {/* Snapping, Grids & Dimensions */}
          <div className="flex items-center bg-[#0F1113] p-1 rounded-lg border border-[#2D3139] space-x-1">
            <button
              onClick={() => editorStore.updateSketchSettings({ objectSnapEnabled: !editorStore.sketchSettings.objectSnapEnabled })}
              className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
                editorStore.sketchSettings.objectSnapEnabled
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-bold'
                  : 'text-[#8E9299] hover:text-white'
              }`}
              title="Magnétisme Objet (Extrémités, Milieux, Centres, Intersections)"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span className="text-[9px] font-mono hidden sm:inline">SNAP</span>
            </button>
            <button
              onClick={() => editorStore.updateSketchSettings({ gridSnapEnabled: !editorStore.sketchSettings.gridSnapEnabled })}
              className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
                editorStore.sketchSettings.gridSnapEnabled
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40 font-bold'
                  : 'text-[#8E9299] hover:text-white'
              }`}
              title={`Accroche Grille (${editorStore.sketchSettings.gridStep})`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editorStore.updateSketchSettings({ orthoLockEnabled: !editorStore.sketchSettings.orthoLockEnabled })}
              className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
                editorStore.sketchSettings.orthoLockEnabled
                  ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40 font-bold'
                  : 'text-[#8E9299] hover:text-white'
              }`}
              title="Verrouillage Orthogonal (0°, 90°, 180°, 270°)"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="text-[9px] font-mono hidden sm:inline">ORTHO</span>
            </button>
            <button
              onClick={() => editorStore.updateSketchSettings({ showDimensions: !editorStore.sketchSettings.showDimensions })}
              className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
                editorStore.sketchSettings.showDimensions
                  ? 'bg-sky-600/30 text-sky-400 border border-sky-500/40 font-bold'
                  : 'text-[#8E9299] hover:text-white'
              }`}
              title="Afficher/Masquer les cotations exactes"
            >
              <Ruler className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fillet / Offset quick settings inline */}
          {editorStore.activeDrawTool === 'FILLET' && (
            <div className="flex items-center bg-[#0F1113] px-2 py-0.5 rounded border border-[#2D3139] space-x-1 text-[11px] font-mono">
              <span className="text-slate-400">R:</span>
              <input
                type="number"
                min="0.1"
                max="5"
                step="0.1"
                value={editorStore.sketchSettings.filletRadius}
                onChange={e => editorStore.updateSketchSettings({ filletRadius: parseFloat(e.target.value) || 0.5 })}
                className="w-10 bg-[#1C1E22] border border-[#2D3139] rounded text-center text-sky-300 text-[10px]"
              />
            </div>
          )}

          {editorStore.activeDrawTool === 'OFFSET' && (
            <div className="flex items-center bg-[#0F1113] px-2 py-0.5 rounded border border-[#2D3139] space-x-1 text-[11px] font-mono">
              <span className="text-slate-400">D:</span>
              <input
                type="number"
                min="-10"
                max="10"
                step="0.1"
                value={editorStore.sketchSettings.offsetDistance}
                onChange={e => editorStore.updateSketchSettings({ offsetDistance: parseFloat(e.target.value) || 0.5 })}
                className="w-10 bg-[#1C1E22] border border-[#2D3139] rounded text-center text-purple-300 text-[10px]"
              />
            </div>
          )}

          <div className="h-4 w-px bg-[#2D3139]" />

          {/* 3D Extrude & Lathe Actions */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => editorStore.extrudeSketchTo3D(1.0)}
              disabled={editorStore.sketchEntities.length === 0}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                editorStore.sketchProfiles.length > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer'
                  : 'bg-[#0F1113] text-slate-400 hover:text-white border border-[#2D3139] cursor-pointer'
              }`}
              title="Extruder le profil 2D en solide 3D"
            >
              <Box className="w-3.5 h-3.5" />
              <span className="text-[11px]">Extruder 3D</span>
            </button>

            <button
              onClick={() => editorStore.latheSketchTo3D(32)}
              disabled={editorStore.sketchEntities.length === 0}
              className="flex items-center space-x-1 px-2 py-1 bg-[#0F1113] hover:bg-[#2D3139] border border-[#2D3139] text-slate-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
              title="Révolution 360° (Lathe)"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] hidden sm:inline">Lathe</span>
            </button>

            <button
              onClick={() => {
                if (editorStore.sketchEntities.length > 0 && confirm('Effacer tous les éléments 2D de l\'esquisse ?')) {
                  editorStore.clearSketch();
                }
              }}
              disabled={editorStore.sketchEntities.length === 0}
              className="p-1.5 bg-[#0F1113] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-[#2D3139] rounded transition-colors"
              title="Effacer l'esquisse"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 6. ANIMATION MODE TOOLBAR */}
      {mode === 'animation' && (
        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center bg-[#0F1113] p-1 rounded-full border border-[#2D3139] space-x-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => editorStore.setAnimationFrame(0)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#2D3139] transition-colors cursor-pointer"
              title="Début (Frame 0)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => editorStore.setAnimationFrame(editorStore.animationCurrentFrame - 1)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#2D3139] transition-colors cursor-pointer"
              title="Image précédente"
            >
              <Minimize2 className="w-3.5 h-3.5 rotate-45" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => editorStore.toggleAnimationPlay()}
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all shadow-sm cursor-pointer ${
                editorStore.isAnimationPlaying
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20'
              }`}
              title={editorStore.isAnimationPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}
            >
              {editorStore.isAnimationPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => editorStore.setAnimationFrame(editorStore.animationCurrentFrame + 1)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#2D3139] transition-colors cursor-pointer"
              title="Image suivante"
            >
              <Maximize2 className="w-3.5 h-3.5 rotate-45" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => editorStore.setAnimationFrame(editorStore.animationTotalFrames)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#2D3139] transition-colors cursor-pointer"
              title="Fin"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          <div className="flex items-center space-x-2 bg-[#0F1113] px-3 py-1 rounded-full border border-[#2D3139] font-mono text-[11px]">
            <span className="text-slate-400">Frame:</span>
            <span className="text-blue-400 font-bold w-6 text-right">{editorStore.animationCurrentFrame}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{editorStore.animationTotalFrames}</span>
            <input
              type="range"
              min="0"
              max={editorStore.animationTotalFrames}
              value={editorStore.animationCurrentFrame}
              onChange={e => editorStore.setAnimationFrame(parseInt(e.target.value))}
              className="w-24 accent-blue-500 cursor-pointer h-1.5 bg-[#2D3139] rounded-lg"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => editorStore.addKeyframeForSelected()}
            disabled={!selObj}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-semibold text-xs border transition-all ${
              selObj
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30 cursor-pointer'
                : 'bg-[#0F1113] border-[#2D3139] text-slate-600 cursor-not-allowed'
            }`}
            title="Ajouter une image clé (Keyframe) sur l'objet sélectionné"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Keyframe</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => editorStore.toggleTurntable()}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-semibold text-xs border transition-all cursor-pointer ${
              editorStore.isTurntableActive
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                : 'bg-[#0F1113] border-[#2D3139] text-[#8E9299] hover:text-white'
            }`}
            title="Rotation 360° continue du plateau de présentation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${editorStore.isTurntableActive ? 'animate-spin text-amber-400' : ''}`} />
            <span>Turntable 360°</span>
          </motion.button>
        </div>
      )}

      {/* 7. SIMULATION MODE TOOLBAR */}
      {mode === 'simulation' && (
        <div className="flex items-center space-x-2 text-xs">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => editorStore.togglePhysics()}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-bold text-xs border transition-all cursor-pointer ${
              editorStore.isPhysicsActive
                ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30'
            }`}
            title={editorStore.isPhysicsActive ? 'Mettre en pause la physique' : 'Lancer la simulation physique'}
          >
            {editorStore.isPhysicsActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{editorStore.isPhysicsActive ? 'Simulation Active' : 'Démarrer Simulation'}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => editorStore.resetPhysics()}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0F1113] hover:bg-[#2D3139] border border-[#2D3139] text-slate-300 hover:text-white rounded-full font-medium transition-colors cursor-pointer"
            title="Réinitialiser les objets à leur position initiale"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Réinitialiser</span>
          </motion.button>

          <div className="h-4 w-px bg-[#2D3139] mx-1" />

          {/* Interaction Mode: Standard vs Grab Circle vs Radial Push vs Explode */}
          <div className="flex items-center bg-[#0F1113] p-0.5 rounded-full border border-[#2D3139] space-x-0.5">
            <button
              onClick={() => editorStore.setSimulationInteractionMode('none')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                editorStore.simulationInteractionMode === 'none'
                  ? 'bg-slate-700 text-white border border-slate-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Curseur standard (navigation caméra et sélection)"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Curseur Standard</span>
            </button>
            <button
              onClick={() => editorStore.setSimulationInteractionMode('grab')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                editorStore.simulationInteractionMode === 'grab'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Activer le cercle interactif pour attraper et déplacer les objets en temps réel"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Cercle Déplacer</span>
            </button>
            <button
              onClick={() => editorStore.setSimulationInteractionMode('push')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                editorStore.simulationInteractionMode === 'push'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Pousser les objets avec la zone d'influence du cercle"
            >
              <MoveUpRight className="w-3.5 h-3.5" />
              <span>Cercle Pousser</span>
            </button>
            <button
              onClick={() => editorStore.setSimulationInteractionMode('explode')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                editorStore.simulationInteractionMode === 'explode'
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-400/60 shadow-sm shadow-rose-500/20'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
              title="Cliquer sur un solide avec le cercle pour le faire exploser en morceaux physiques"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span>Mode Explosion</span>
            </button>
          </div>

          {/* Instant Explode Selected Solid Button */}
          {editorStore.getSelectedObject() && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => editorStore.explodeSelectedSolid()}
              className="flex items-center space-x-1.5 px-3 py-1 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-full text-xs font-bold shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              title="Exploser immédiatement le solide sélectionné"
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>Exploser le Solide</span>
            </motion.button>
          )}

          {/* Explosion / Brush Settings */}
          {editorStore.simulationInteractionMode === 'explode' && (
            <>
              {/* Blast Force */}
              <div className="flex items-center space-x-1.5 bg-[#0F1113] px-2.5 py-1 rounded-full border border-[#2D3139] text-[11px]">
                <span className="text-slate-400 font-medium">Puissance:</span>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={editorStore.simulationExplosionForce}
                  onChange={e => editorStore.setSimulationExplosionForce(parseFloat(e.target.value))}
                  className="w-16 accent-rose-500 cursor-pointer h-1.5 bg-[#2D3139] rounded-lg"
                />
                <span className="text-rose-400 font-mono font-bold w-6">{editorStore.simulationExplosionForce.toFixed(0)}</span>
              </div>

              {/* Fragment Count */}
              <div className="flex items-center space-x-1.5 bg-[#0F1113] px-2.5 py-1 rounded-full border border-[#2D3139] text-[11px]">
                <span className="text-slate-400 font-medium">Éclats:</span>
                <input
                  type="range"
                  min="6"
                  max="36"
                  step="2"
                  value={editorStore.simulationExplosionChunks}
                  onChange={e => editorStore.setSimulationExplosionChunks(parseInt(e.target.value))}
                  className="w-14 accent-amber-500 cursor-pointer h-1.5 bg-[#2D3139] rounded-lg"
                />
                <span className="text-amber-400 font-mono font-bold w-5">{editorStore.simulationExplosionChunks}</span>
              </div>
            </>
          )}

          {(editorStore.simulationInteractionMode === 'grab' || editorStore.simulationInteractionMode === 'push') && (
            <>
              {/* Brush Circle Radius */}
              <div className="flex items-center space-x-1.5 bg-[#0F1113] px-2.5 py-1 rounded-full border border-[#2D3139] text-[11px]">
                <span className="text-slate-400 font-medium">Rayon Cercle:</span>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={editorStore.simulationBrushRadius}
                  onChange={e => editorStore.setSimulationBrushRadius(parseFloat(e.target.value))}
                  className="w-16 accent-sky-500 cursor-pointer h-1.5 bg-[#2D3139] rounded-lg"
                />
                <span className="text-sky-400 font-mono font-bold w-6">{editorStore.simulationBrushRadius.toFixed(1)}m</span>
              </div>

              {/* Spring Force Strength */}
              {editorStore.simulationInteractionMode === 'grab' && (
                <div className="flex items-center space-x-1.5 bg-[#0F1113] px-2.5 py-1 rounded-full border border-[#2D3139] text-[11px]">
                  <span className="text-slate-400 font-medium">Force Ressort:</span>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={editorStore.simulationSpringStrength}
                    onChange={e => editorStore.setSimulationSpringStrength(parseFloat(e.target.value))}
                    className="w-16 accent-amber-500 cursor-pointer h-1.5 bg-[#2D3139] rounded-lg"
                  />
                  <span className="text-amber-400 font-mono font-bold w-6">{editorStore.simulationSpringStrength.toFixed(0)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
