/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Top Navigation & Menu Bar (SelfCAD Style)
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Circle,
  Eye,
  Download,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  Copy,
  CheckCircle2,
  Share2,
  Bell,
  User,
  Info,
  Maximize,
  Grid,
} from 'lucide-react';
import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';
import { exportToOBJ, exportToSTL, downloadFile } from '../../core/export/exporter';

export const HeaderBar: React.FC = () => {
  const [, setTick] = useState(0);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const handleExportOBJ = () => {
    const selObj = editorStore.getSelectedObject();
    if (!selObj || !selObj.mesh) {
      alert('Please select an object in the scene to export.');
      return;
    }
    const content = exportToOBJ(selObj.mesh);
    downloadFile(content, `${selObj.name || 'PolyCraftMesh'}.obj`, 'text/plain');
  };

  const handleExportSTL = () => {
    const selObj = editorStore.getSelectedObject();
    if (!selObj || !selObj.mesh) {
      alert('Please select an object in the scene to export.');
      return;
    }
    const content = exportToSTL(selObj.mesh);
    downloadFile(content, `${selObj.name || 'PolyCraftMesh'}.stl`, 'text/plain');
  };

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
      case 'cone':
        geom = new THREE.ConeGeometry(1, 2, 24, 12);
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

  const handleDeleteSelected = () => {
    const sel = editorStore.getSelectedObject();
    if (sel) {
      editorStore.removeObject(sel.id);
    }
  };

  const handleDuplicateSelected = () => {
    const sel = editorStore.getSelectedObject();
    if (sel && sel.mesh) {
      const cloneGeom = sel.mesh.geometry.clone();
      const cloneMat = (sel.mesh.material as THREE.Material).clone();
      const newMesh = new THREE.Mesh(cloneGeom, cloneMat);
      newMesh.position.copy(sel.mesh.position).add(new THREE.Vector3(0.5, 0, 0.5));
      editorStore.addObject(`${sel.name}_copy`, newMesh);
    }
  };

  return (
    <header id="header-bar" className="h-10 bg-[#16181C] border-b border-[#2D3139] text-[#E0E0E0] px-3 flex items-center justify-between select-none z-30">
      {/* Left: SelfCAD style Logo & Dropdown Menus */}
      <div className="flex items-center space-x-4">
        {/* Logo */}
        <div className="flex items-center space-x-1.5 cursor-pointer">
          <div className="w-5 h-5 rounded bg-[#4A90E2] flex items-center justify-center text-white font-black text-[10px] shadow-sm">
            3D
          </div>
          <span className="text-xs font-bold tracking-tight text-white font-sans">
            Poly<span className="text-[#4A90E2]">Craft</span>
          </span>
        </div>

        {/* Top Dropdown Menus */}
        <div className="flex items-center space-x-1 text-xs text-[#8E9299]">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
              className="px-2 py-1 rounded hover:text-white hover:bg-[#2D3139] transition-colors"
            >
              File ▾
            </button>
            {activeMenu === 'file' && (
              <div
                className="absolute left-0 top-full mt-1 w-44 bg-[#1C1E22] border border-[#2D3139] rounded shadow-xl py-1 z-50 text-xs text-[#E0E0E0]"
                onMouseLeave={() => setActiveMenu(null)}
              >
                <button
                  onClick={() => {
                    editorStore.objects = [];
                    editorStore.setSelectedObject(null);
                    editorStore.notify();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  New Project
                </button>
                <div className="my-1 border-t border-[#2D3139]" />
                <button
                  onClick={() => {
                    handleExportOBJ();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Export .OBJ
                </button>
                <button
                  onClick={() => {
                    handleExportSTL();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Export .STL
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
              className="px-2 py-1 rounded hover:text-white hover:bg-[#2D3139] transition-colors"
            >
              Edit ▾
            </button>
            {activeMenu === 'edit' && (
              <div
                className="absolute left-0 top-full mt-1 w-44 bg-[#1C1E22] border border-[#2D3139] rounded shadow-xl py-1 z-50 text-xs text-[#E0E0E0]"
                onMouseLeave={() => setActiveMenu(null)}
              >
                <button
                  onClick={() => {
                    editorStore.undoGeometry();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Undo (Ctrl+Z)
                </button>
                <button
                  onClick={() => {
                    editorStore.redoGeometry();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Redo (Ctrl+Y)
                </button>
                <div className="my-1 border-t border-[#2D3139]" />
                <button
                  onClick={() => {
                    handleDuplicateSelected();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Duplicate Object
                </button>
                <button
                  onClick={() => {
                    handleDeleteSelected();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] text-rose-400"
                >
                  Delete Object
                </button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
              className="px-2 py-1 rounded hover:text-white hover:bg-[#2D3139] transition-colors"
            >
              View ▾
            </button>
            {activeMenu === 'view' && (
              <div
                className="absolute left-0 top-full mt-1 w-44 bg-[#1C1E22] border border-[#2D3139] rounded shadow-xl py-1 z-50 text-xs text-[#E0E0E0]"
                onMouseLeave={() => setActiveMenu(null)}
              >
                <button
                  onClick={() => {
                    editorStore.showGrid = !editorStore.showGrid;
                    editorStore.notify();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Toggle Grid
                </button>
                <button
                  onClick={() => {
                    editorStore.showWireframe = !editorStore.showWireframe;
                    editorStore.objects.forEach(o => {
                      if (o.mesh) {
                        if (Array.isArray(o.mesh.material)) {
                          o.mesh.material.forEach(m => ((m as THREE.MeshStandardMaterial).wireframe = editorStore.showWireframe));
                        } else {
                          (o.mesh.material as THREE.MeshStandardMaterial).wireframe = editorStore.showWireframe;
                        }
                      }
                    });
                    editorStore.notify();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Toggle Wireframe
                </button>
              </div>
            )}
          </div>

          {/* Settings Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'settings' ? null : 'settings')}
              className="px-2 py-1 rounded hover:text-white hover:bg-[#2D3139] transition-colors"
            >
              Settings ▾
            </button>
            {activeMenu === 'settings' && (
              <div
                className="absolute left-0 top-full mt-1 w-44 bg-[#1C1E22] border border-[#2D3139] rounded shadow-xl py-1 z-50 text-xs text-[#E0E0E0]"
                onMouseLeave={() => setActiveMenu(null)}
              >
                <button
                  onClick={() => {
                    editorStore.flatShading = !editorStore.flatShading;
                    editorStore.notify();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2D3139] hover:text-[#4A90E2]"
                >
                  Flat Shading: {editorStore.flatShading ? 'ON' : 'OFF'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Project Title & Cloud Status */}
      <div className="hidden md:flex items-center space-x-2 text-xs font-mono">
        <span className="text-white font-medium">project_1</span>
        <span className="text-[#8E9299]">|</span>
        <div className="flex items-center space-x-1 text-emerald-400 text-[11px]">
          <span>All changes saved</span>
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Right: Icon-only Utilities & Export */}
      <div className="flex items-center space-x-2">
        {/* Quick Icon Actions (NO text, icon only) */}
        <div className="flex items-center bg-[#0F1113] p-0.5 rounded border border-[#2D3139] space-x-0.5">
          <button
            onClick={() => editorStore.undoGeometry()}
            className="p-1 text-[#8E9299] hover:text-white hover:bg-[#2D3139] rounded transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editorStore.redoGeometry()}
            className="p-1 text-[#8E9299] hover:text-white hover:bg-[#2D3139] rounded transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDuplicateSelected}
            className="p-1 text-[#8E9299] hover:text-white hover:bg-[#2D3139] rounded transition-colors"
            title="Duplicate Object"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDeleteSelected}
            className="p-1 text-[#8E9299] hover:text-rose-400 hover:bg-[#2D3139] rounded transition-colors"
            title="Delete Object"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-[#2D3139]" />

        {/* Display Wireframe & Grid Toggle Icons */}
        <button
          onClick={() => {
            editorStore.showWireframe = !editorStore.showWireframe;
            editorStore.notify();
          }}
          className={`p-1.5 rounded border transition-colors ${
            editorStore.showWireframe
              ? 'bg-[#2D3139] border-[#4A90E2] text-[#4A90E2]'
              : 'bg-[#1C1E22] border-[#2D3139] text-[#8E9299] hover:text-white'
          }`}
          title="Toggle Wireframe"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            editorStore.showGrid = !editorStore.showGrid;
            editorStore.notify();
          }}
          className={`p-1.5 rounded border transition-colors ${
            editorStore.showGrid
              ? 'bg-[#2D3139] border-[#4A90E2] text-[#4A90E2]'
              : 'bg-[#1C1E22] border-[#2D3139] text-[#8E9299] hover:text-white'
          }`}
          title="Toggle Grid"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        {/* Export Button */}
        <button
          onClick={handleExportOBJ}
          className="bg-[#4A90E2] hover:bg-[#3A80D2] text-white px-3 py-1 rounded text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
          title="Export OBJ"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};

