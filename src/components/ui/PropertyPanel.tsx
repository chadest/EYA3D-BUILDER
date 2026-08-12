/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - SelfCAD Style Right Inspector Panel
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Settings,
  Circle,
  Split,
  BoxSelect,
  Box,
  Palette,
  Layers,
  ChevronDown,
  CheckSquare,
  Square,
  Activity,
} from 'lucide-react';
import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';
import { SelectionLevel } from '../../types/editor';

export const PropertyPanel: React.FC = () => {
  const [, setTick] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'scene' | 'material' | 'modifiers'>('scene');

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const selObj = editorStore.getSelectedObject();
  const objects = editorStore.objects;

  // Calculate mesh metrics
  let faceCount = 0;
  let edgeCount = 0;
  let vertexCount = 0;

  if (selObj?.mesh?.geometry) {
    const pos = selObj.mesh.geometry.attributes.position;
    if (pos) {
      vertexCount = pos.count;
      faceCount = Math.floor(pos.count / 3);
      edgeCount = Math.floor(pos.count * 1.5);
    }
  }

  const selectedFaces = editorStore.selectedIndices.faces.length;
  const selectedEdges = editorStore.selectedIndices.edges.length;
  const selectedVertices = editorStore.selectedIndices.vertices.length;

  return (
    <div id="inspector-panel" className="w-80 bg-[#16181C] border-l border-[#2D3139] text-[#E0E0E0] select-none z-10 flex flex-col h-full overflow-hidden">
      {/* 1. SELECTION DIAGRAM & COUNTERS SECTION */}
      <div className="p-3 border-b border-[#2D3139] bg-[#1C1E22] space-y-3">
        {/* Selection Counts Diagram */}
        <div className="flex items-center justify-between text-xs font-mono bg-[#0F1113] p-2.5 rounded-lg border border-[#2D3139]">
          {/* Cube Schematic SVG */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-14 h-14 text-[#4A90E2] stroke-current fill-none stroke-[2]">
              <path d="M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z" />
              <path d="M50 10 L50 90" />
              <path d="M50 50 L85 30" />
              <path d="M50 50 L15 30" />
            </svg>
          </div>

          <div className="flex-1 ml-3 space-y-1 text-[11px]">
            <div className="flex justify-between items-center text-[#8E9299]">
              <span>Face</span>
              <span className="text-white font-bold">{selectedFaces}/{faceCount}</span>
            </div>
            <div className="flex justify-between items-center text-[#8E9299]">
              <span>Edge</span>
              <span className="text-white font-bold">{selectedEdges}/{edgeCount}</span>
            </div>
            <div className="flex justify-between items-center text-[#8E9299]">
              <span>Vertex</span>
              <span className="text-white font-bold">{selectedVertices}/{vertexCount}</span>
            </div>
          </div>
        </div>

        {/* Selection Mode Icon Buttons */}
        <div className="flex items-center justify-between bg-[#0F1113] p-1 rounded border border-[#2D3139]">
          <span className="text-[10px] font-bold text-[#8E9299] px-2 uppercase tracking-wider">Selection Mode</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => editorStore.setSelectionLevel('vertex')}
              className={`p-1.5 rounded transition-all ${
                editorStore.selectionLevel === 'vertex'
                  ? 'bg-[#4A90E2] text-white shadow-sm'
                  : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
              }`}
              title="Vertex Selection"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editorStore.setSelectionLevel('edge')}
              className={`p-1.5 rounded transition-all ${
                editorStore.selectionLevel === 'edge'
                  ? 'bg-[#4A90E2] text-white shadow-sm'
                  : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
              }`}
              title="Edge Selection"
            >
              <Split className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editorStore.setSelectionLevel('face')}
              className={`p-1.5 rounded transition-all ${
                editorStore.selectionLevel === 'face'
                  ? 'bg-[#4A90E2] text-white shadow-sm'
                  : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
              }`}
              title="Face Selection"
            >
              <BoxSelect className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. TABBED PANEL CONTENT (Objects Outliner | Material | Modifiers) */}
      <div className="flex items-center border-b border-[#2D3139] bg-[#1C1E22] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('scene')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors ${
            activeTab === 'scene'
              ? 'border-[#4A90E2] text-white font-bold bg-[#16181C]'
              : 'border-transparent text-[#8E9299] hover:text-white'
          }`}
        >
          Objects ({objects.length})
        </button>
        <button
          onClick={() => setActiveTab('material')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors ${
            activeTab === 'material'
              ? 'border-[#4A90E2] text-white font-bold bg-[#16181C]'
              : 'border-transparent text-[#8E9299] hover:text-white'
          }`}
        >
          Material
        </button>
        <button
          onClick={() => setActiveTab('modifiers')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors ${
            activeTab === 'modifiers'
              ? 'border-[#4A90E2] text-white font-bold bg-[#16181C]'
              : 'border-transparent text-[#8E9299] hover:text-white'
          }`}
        >
          Modifiers
        </button>
      </div>

      {/* TAB CONTENT: OBJECTS LIST (Matching SelfCAD Outliner List) */}
      {activeTab === 'scene' && (
        <div className="flex-1 flex flex-col p-3 space-y-3 overflow-hidden">
          {/* Search Header */}
          <div className="flex items-center justify-between space-x-2">
            <div className="flex-1 flex items-center bg-[#0F1113] border border-[#2D3139] rounded px-2 py-1 text-xs text-white">
              <Search className="w-3.5 h-3.5 text-[#8E9299] mr-1.5" />
              <input
                type="text"
                placeholder="Search objects..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs text-white"
              />
            </div>
            <button className="p-1.5 bg-[#0F1113] border border-[#2D3139] rounded text-[#8E9299] hover:text-white">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Objects List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {objects
              .filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(obj => {
                const isSelected = editorStore.selectedObjectId === obj.id;
                return (
                  <div
                    key={obj.id}
                    onClick={() => editorStore.setSelectedObject(obj.id)}
                    className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#2D3139] border-[#4A90E2] text-white font-semibold shadow-sm'
                        : 'bg-[#0F1113] border-[#2D3139] text-[#8E9299] hover:text-white hover:bg-[#1C1E22]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {/* Checkbox */}
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#4A90E2]" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-[#8E9299]" />
                      )}

                      {/* 3D Mesh Thumbnail Icon */}
                      <div className="w-5 h-5 rounded bg-[#1C1E22] border border-[#3D424D] flex items-center justify-center text-[#4A90E2]">
                        <Box className="w-3 h-3" />
                      </div>

                      {/* Name */}
                      <span className="truncate text-xs">{obj.name}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          obj.visible = !obj.visible;
                          if (obj.mesh) obj.mesh.visible = obj.visible;
                          editorStore.notify();
                        }}
                        className="p-1 text-[#8E9299] hover:text-white"
                      >
                        {obj.visible ? (
                          <Eye className="w-3.5 h-3.5 text-[#4A90E2]" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                        )}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          editorStore.removeObject(obj.id);
                        }}
                        className="p-1 text-[#8E9299] hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: MATERIAL */}
      {activeTab === 'material' && selObj && (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="space-y-3 bg-[#0F1113] p-3 rounded border border-[#2D3139] text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#8E9299]">Color Swatch</span>
              <input
                type="color"
                value={selObj.materialProps.color}
                onChange={e => {
                  selObj.materialProps.color = e.target.value;
                  if (selObj.mesh) {
                    const mat = selObj.mesh.material as THREE.MeshStandardMaterial;
                    if (mat && mat.color) mat.color.set(e.target.value);
                  }
                  editorStore.notify();
                }}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[#8E9299]">
                <span>Roughness</span>
                <span className="font-mono text-[#4A90E2]">{selObj.materialProps.roughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={selObj.materialProps.roughness}
                onChange={e => {
                  selObj.materialProps.roughness = parseFloat(e.target.value);
                  if (selObj.mesh) {
                    (selObj.mesh.material as THREE.MeshStandardMaterial).roughness = selObj.materialProps.roughness;
                  }
                  editorStore.notify();
                }}
                className="w-full accent-[#4A90E2]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MODIFIERS */}
      {activeTab === 'modifiers' && selObj && (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8E9299] uppercase">Modifier Stack</span>
            <button
              onClick={() => {
                const modId = `mod_subd_${Date.now()}`;
                editorStore.addModifier(selObj.id, {
                  id: modId,
                  type: 'subd',
                  enabled: true,
                  levels: 1,
                  creaseWeight: 0.0,
                } as any);
              }}
              className="bg-[#4A90E2] hover:bg-[#3A80D2] text-white px-2 py-1 rounded text-xs font-bold flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add SubD</span>
            </button>
          </div>

          <div className="space-y-2">
            {selObj.modifiers.length === 0 ? (
              <div className="text-center py-6 text-[#8E9299] text-xs italic bg-[#0F1113] rounded border border-[#2D3139]">
                No active modifiers in stack.
              </div>
            ) : (
              selObj.modifiers.map(m => (
                <div key={m.id} className="p-2.5 bg-[#0F1113] border border-[#2D3139] rounded text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-[#2D3139] pb-1">
                    <span className="font-bold text-white uppercase">{m.type}</span>
                    <button
                      onClick={() => editorStore.removeModifier(selObj.id, m.id)}
                      className="text-[#8E9299] hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
