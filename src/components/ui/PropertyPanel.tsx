/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - SelfCAD Style Right Inspector Panel
 */

import React, { useState, useEffect, useTransition } from 'react';
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
  Sun,
  Grid,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Layout,
  Tv,
  XCircle,
  Zap,
  RotateCcw
} from 'lucide-react';
import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';
import { SelectionLevel } from '../../types/editor';
import { updateTextPrimitiveMesh } from '../../core/primitives/textPrimitive';

export const PropertyPanel: React.FC = () => {
  const [, setTick] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [backdropDropdownOpen, setBackdropDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scene' | 'material' | 'modifiers'>('scene');
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (tab: 'scene' | 'material' | 'modifiers') => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  const handleSelectObject = (id: string) => {
    startTransition(() => {
      editorStore.setSelectedObject(id);
    });
  };

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

  if (!editorStore.isPropertyPanelOpen) {
    return (
      <div 
        id="inspector-panel-collapsed" 
        className="w-12 bg-[#16181C] border-l border-[#2D3139] text-[#E0E0E0] select-none z-10 flex flex-col items-center py-3 space-y-5 h-full overflow-hidden"
      >
        <button
          onClick={() => editorStore.togglePropertyPanel()}
          className="p-2 rounded hover:bg-[#2D3139] text-[#8E9299] hover:text-white transition-all flex items-center justify-center"
          title="Open Inspector Panel"
        >
          <PanelRightOpen className="w-5 h-5" />
        </button>

        <div className="w-full border-b border-[#2D3139]" />

        <div className="flex flex-col items-center space-y-3">
          <button
            onClick={() => {
              setActiveTab('scene');
              editorStore.togglePropertyPanel();
            }}
            className="p-2 rounded hover:bg-[#2D3139] text-[#8E9299] hover:text-white transition-all flex items-center justify-center"
            title="Scene Outliner (Click to open)"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('material');
              editorStore.togglePropertyPanel();
            }}
            className="p-2 rounded hover:bg-[#2D3139] text-[#8E9299] hover:text-white transition-all flex items-center justify-center"
            title="Material Properties (Click to open)"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('modifiers');
              editorStore.togglePropertyPanel();
            }}
            className="p-2 rounded hover:bg-[#2D3139] text-[#8E9299] hover:text-white transition-all flex items-center justify-center"
            title="Modifier Stack (Click to open)"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        {selObj && (
          <div className="flex-1 flex flex-col justify-end pb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4A90E2]" title={`Active: ${selObj.name}`} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="inspector-panel" className="w-80 bg-[#16181C] border-l border-[#2D3139] text-[#E0E0E0] select-none z-10 flex flex-col h-full overflow-hidden">
      {/* Drawer Toggle Header */}
      <div className="px-3 py-2 border-b border-[#2D3139] bg-[#1C1E22] flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider uppercase text-[#8E9299]">Inspector</span>
        <button
          onClick={() => editorStore.togglePropertyPanel()}
          className="p-1 rounded hover:bg-[#2D3139] text-[#8E9299] hover:text-white transition-all flex items-center justify-center"
          title="Collapse Panel"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

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
      {editorStore.isRenderMode && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-amber-400">
            <span className="flex items-center space-x-1.5">
              <Sun className="w-4 h-4" />
              <span>Configuration du Soleil (HDRI)</span>
            </span>
          </div>

          <div className="space-y-2 bg-[#0F1113] p-2.5 rounded border border-[#2D3139]">
            {/* Sun Color Picker */}
            <div className="flex items-center justify-between">
              <span className="text-[#8E9299]">Couleur du Soleil</span>
              <input
                type="color"
                value={editorStore.sunSettings.color}
                onChange={e => editorStore.setSunColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                title="Teinte de la lumière du soleil"
              />
            </div>

            {/* Intensity Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[#8E9299]">
                <span>Intensité (0 - 10)</span>
                <span className="font-mono text-amber-400">{editorStore.sunSettings.intensity.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={editorStore.sunSettings.intensity}
                onChange={e => editorStore.setSunIntensity(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Sun Scale / Size Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[#8E9299]">
                <span>Taille du Soleil</span>
                <span className="font-mono text-amber-400">{editorStore.sunSettings.scale.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={editorStore.sunSettings.scale}
                onChange={e => editorStore.setSunScale(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Time of Day Arc Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[#8E9299]">
                <span>Course du Soleil (Heure)</span>
                <span className="font-mono text-amber-400">Arc 360°</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                defaultValue="0.25"
                onChange={e => editorStore.setSunAngleTime(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
                title="Simuler la course du soleil autour de la scène"
              />
            </div>

            {/* Environnement de Scène Selector */}
            <div className="border-t border-[#2D3139] pt-2.5 mt-1 space-y-2 relative">
              <div className="flex items-center space-x-1.5 font-bold text-amber-400 mb-2">
                <Settings className="w-3.5 h-3.5" />
                <span>Environnement de Scène</span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBackdropDropdownOpen(!backdropDropdownOpen)}
                  className="bg-slate-800 text-white border border-slate-700 px-3 py-2 rounded-lg flex items-center justify-between w-full"
                >
                  <span className="truncate flex items-center space-x-2">
                    {editorStore.backdropType === 'StudioCyclorama' && <><Tv size={16} /> <span>StudioCyclorama</span></>}
                    {editorStore.backdropType === 'Plane' && <><Grid size={16} /> <span>Plane Surface</span></>}
                    {editorStore.backdropType === 'None' && <><EyeOff size={16} /> <span>Aucun</span></>}
                  </span>
                  <ChevronDown size={16} className="text-gray-400 shrink-0" />
                </button>

                {backdropDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setBackdropDropdownOpen(false)} 
                    />
                    <div className="absolute left-0 right-0 z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 animate-in fade-in slide-in-from-top-1">
                      <div
                        onClick={() => {
                          editorStore.setBackdropType('StudioCyclorama');
                          setBackdropDropdownOpen(false);
                        }}
                        className={`flex items-center space-x-2 hover:bg-blue-600 hover:text-white rounded-md p-2 transition-colors cursor-pointer ${
                          editorStore.backdropType === 'StudioCyclorama' ? 'bg-blue-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        <Tv size={16} />
                        <span>StudioCyclorama</span>
                      </div>
                      <div
                        onClick={() => {
                          editorStore.setBackdropType('Plane');
                          setBackdropDropdownOpen(false);
                        }}
                        className={`flex items-center space-x-2 hover:bg-blue-600 hover:text-white rounded-md p-2 transition-colors cursor-pointer ${
                          editorStore.backdropType === 'Plane' ? 'bg-blue-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        <Grid size={16} />
                        <span>Plane Surface</span>
                      </div>
                      <div
                        onClick={() => {
                          editorStore.setBackdropType('None');
                          setBackdropDropdownOpen(false);
                        }}
                        className={`flex items-center space-x-2 hover:bg-blue-600 hover:text-white rounded-md p-2 transition-colors cursor-pointer ${
                          editorStore.backdropType === 'None' ? 'bg-blue-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        <EyeOff size={16} />
                        <span>Aucun</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Physics Simulation */}
            <div className="border-t border-[#2D3139] pt-2.5 mt-1 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-amber-400">
                <Zap className="w-3.5 h-3.5" />
                <span>Simulation Physique</span>
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => editorStore.togglePhysics()}
                  className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded transition-colors ${
                    editorStore.isPhysicsActive
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Zap size={16} />
                  <span>{editorStore.isPhysicsActive ? 'Stop' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => editorStore.resetPhysics()}
                  className="px-3 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded transition-colors flex items-center"
                  title="Reset Simulation"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Fond de Studio (Cyclorama) */}
            {editorStore.backdropType !== 'None' && (
              <div className="border-t border-[#2D3139] pt-2.5 mt-1 space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-amber-400">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Fond de Studio (Cyclorama)</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => editorStore.setCycloramaColor('#1e293b')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border transition-all ${
                        editorStore.cycloramaColor === '#1e293b'
                          ? 'bg-[#1e293b] text-white border-amber-500 shadow'
                          : 'bg-[#111316] text-[#8E9299] border-[#2D3139] hover:text-white hover:bg-white/5'
                      }`}
                      title="Gris Bleu Nuit"
                    >
                      Gris Nuit
                    </button>
                    <button
                      onClick={() => editorStore.setCycloramaColor('#f8fafc')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border transition-all ${
                        editorStore.cycloramaColor === '#f8fafc'
                          ? 'bg-[#f8fafc] text-slate-900 border-amber-500 shadow'
                          : 'bg-[#111316] text-[#8E9299] border-[#2D3139] hover:text-white hover:bg-white/5'
                      }`}
                      title="Blanc Studio Pur"
                    >
                      Blanc Pur
                    </button>
                    <button
                      onClick={() => editorStore.setCycloramaColor('#10b981')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border transition-all ${
                        editorStore.cycloramaColor === '#10b981'
                          ? 'bg-[#10b981] text-white border-amber-500 shadow'
                          : 'bg-[#111316] text-[#8E9299] border-[#2D3139] hover:text-white hover:bg-white/5'
                      }`}
                      title="Vert de Masquage / Greenscreen"
                    >
                      Greenscreen
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-[#111316] p-1.5 rounded border border-[#2D3139]">
                    <span className="text-[#8E9299]">Couleur</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] text-[#8E9299] uppercase">{editorStore.cycloramaColor}</span>
                      <input
                        type="color"
                        value={editorStore.cycloramaColor}
                        onChange={e => editorStore.setCycloramaColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                        title="Sélecteur de couleur personnalisé"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Snapping & Aimantation Controls */}
      <div className="p-3 bg-[#1C1E22] border-b border-[#2D3139] space-y-2 text-xs">
        <div className="flex items-center justify-between font-bold text-white">
          <span className="flex items-center space-x-1.5">
            <Grid className="w-3.5 h-3.5 text-[#4A90E2]" />
            <span>Système d'Aimantation (Snapping)</span>
          </span>
          <button
            onClick={() => editorStore.setSnapToGrid(!editorStore.snapToGrid)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              editorStore.snapToGrid ? 'bg-[#4A90E2] text-white' : 'bg-[#2D3139] text-[#8E9299] hover:text-white'
            }`}
          >
            {editorStore.snapToGrid ? 'ON' : 'OFF'}
          </button>
        </div>

        {editorStore.snapToGrid && (
          <div className="space-y-1 bg-[#0F1113] p-2 rounded border border-[#2D3139]">
            <div className="flex justify-between text-[#8E9299]">
              <span>Pas de translation (Grid Step)</span>
              <span className="font-mono text-[#4A90E2]">{editorStore.snapTranslationStep}m</span>
            </div>
            <div className="flex space-x-1">
              {[0.1, 0.25, 0.5, 1.0, 2.0].map(step => (
                <button
                  key={step}
                  onClick={() => editorStore.setSnapTranslationStep(step)}
                  className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors ${
                    editorStore.snapTranslationStep === step
                      ? 'bg-[#4A90E2] text-white font-bold'
                      : 'bg-[#1C1E22] text-[#8E9299] hover:text-white'
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center border-b border-[#2D3139] bg-[#1C1E22] text-xs font-semibold">
        <button
          onClick={() => handleTabChange('scene')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors ${
            activeTab === 'scene'
              ? 'border-[#4A90E2] text-white font-bold bg-[#16181C]'
              : 'border-transparent text-[#8E9299] hover:text-white'
          }`}
        >
          Objects ({objects.length})
        </button>
        <button
          onClick={() => handleTabChange('material')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors ${
            activeTab === 'material'
              ? 'border-[#4A90E2] text-white font-bold bg-[#16181C]'
              : 'border-transparent text-[#8E9299] hover:text-white'
          }`}
        >
          Material
        </button>
        <button
          onClick={() => handleTabChange('modifiers')}
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
                    onClick={() => handleSelectObject(obj.id)}
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
                    if (selObj.mesh.userData.isText) {
                      updateTextPrimitiveMesh(selObj.mesh, selObj.mesh.userData.textValue || 'Text', e.target.value);
                    } else {
                      const mat = selObj.mesh.material as THREE.MeshStandardMaterial;
                      if (mat && mat.color) mat.color.set(e.target.value);
                    }
                  }
                  editorStore.notify();
                }}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
            </div>

            {selObj.mesh?.userData?.isText && (
              <div className="space-y-3 pt-2 border-t border-[#2D3139]/50">
                <div className="space-y-1">
                  <div className="flex justify-between text-[#8E9299]">
                    <span>Contenu du texte</span>
                  </div>
                  <input
                    type="text"
                    value={selObj.mesh.userData.textValue || 'Text'}
                    onChange={e => {
                      if (selObj.mesh) {
                        const newText = e.target.value;
                        if (!selObj.textProps) {
                          selObj.textProps = {
                            textString: newText,
                            height: selObj.mesh.userData.height !== undefined ? selObj.mesh.userData.height : 0.2,
                            size: selObj.mesh.userData.size !== undefined ? selObj.mesh.userData.size : 1.0
                          };
                        } else {
                          selObj.textProps.textString = newText;
                        }
                        updateTextPrimitiveMesh(
                          selObj.mesh,
                          newText,
                          selObj.materialProps.color,
                          selObj.textProps.height,
                          selObj.textProps.size
                        );
                        editorStore.notify();
                      }
                    }}
                    className="w-full bg-[#16181C] border border-[#2D3139] rounded px-2 py-1.5 text-white focus:outline-none focus:border-[#4A90E2] transition-colors font-sans text-xs"
                    placeholder="Saisissez votre texte..."
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[#8E9299]">
                    <span>Épaisseur d'extrusion</span>
                    <span className="font-mono text-[#4A90E2]">{(selObj.mesh.userData.height ?? 0.2).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="2.0"
                    step="0.05"
                    value={selObj.mesh.userData.height ?? 0.2}
                    onChange={e => {
                      if (selObj.mesh) {
                        const newHeight = parseFloat(e.target.value);
                        if (!selObj.textProps) {
                          selObj.textProps = {
                            textString: selObj.mesh.userData.textValue || 'Text',
                            height: newHeight,
                            size: selObj.mesh.userData.size !== undefined ? selObj.mesh.userData.size : 1.0
                          };
                        } else {
                          selObj.textProps.height = newHeight;
                        }
                        updateTextPrimitiveMesh(
                          selObj.mesh,
                          selObj.mesh.userData.textValue || 'Text',
                          selObj.materialProps.color,
                          newHeight,
                          selObj.textProps.size
                        );
                        editorStore.notify();
                      }
                    }}
                    className="w-full accent-[#4A90E2]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[#8E9299]">
                    <span>Taille des caractères</span>
                    <span className="font-mono text-[#4A90E2]">{(selObj.mesh.userData.size ?? 1.0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.05"
                    value={selObj.mesh.userData.size ?? 1.0}
                    onChange={e => {
                      if (selObj.mesh) {
                        const newSize = parseFloat(e.target.value);
                        if (!selObj.textProps) {
                          selObj.textProps = {
                            textString: selObj.mesh.userData.textValue || 'Text',
                            height: selObj.mesh.userData.height !== undefined ? selObj.mesh.userData.height : 0.2,
                            size: newSize
                          };
                        } else {
                          selObj.textProps.size = newSize;
                        }
                        updateTextPrimitiveMesh(
                          selObj.mesh,
                          selObj.mesh.userData.textValue || 'Text',
                          selObj.materialProps.color,
                          selObj.textProps.height,
                          newSize
                        );
                        editorStore.notify();
                      }
                    }}
                    className="w-full accent-[#4A90E2]"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-[#8E9299]">
                <span>Roughness</span>
                <span className="font-mono text-[#4A90E2]">{selObj.materialProps.roughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
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

            <div className="space-y-1">
              <div className="flex justify-between text-[#8E9299]">
                <span>Metalness</span>
                <span className="font-mono text-[#4A90E2]">{selObj.materialProps.metalness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selObj.materialProps.metalness}
                onChange={e => {
                  selObj.materialProps.metalness = parseFloat(e.target.value);
                  if (selObj.mesh) {
                    (selObj.mesh.material as THREE.MeshStandardMaterial).metalness = selObj.materialProps.metalness;
                  }
                  editorStore.notify();
                }}
                className="w-full accent-[#4A90E2]"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-[#2D3139]/50">
              <div className="flex items-center justify-between">
                <span className="text-[#8E9299]">Emission Color</span>
                <input
                  type="color"
                  value={selObj.materialProps.emissive}
                  onChange={e => {
                    selObj.materialProps.emissive = e.target.value;
                    if (selObj.mesh) {
                      const mat = selObj.mesh.material as THREE.MeshStandardMaterial;
                      if (mat && mat.emissive) mat.emissive.set(e.target.value);
                    }
                    editorStore.notify();
                  }}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[#8E9299]">
                  <span>Emission Intensity</span>
                  <span className="font-mono text-[#4A90E2]">{selObj.materialProps.emissiveIntensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={selObj.materialProps.emissiveIntensity}
                  onChange={e => {
                    selObj.materialProps.emissiveIntensity = parseFloat(e.target.value);
                    if (selObj.mesh) {
                      (selObj.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = selObj.materialProps.emissiveIntensity;
                    }
                    editorStore.notify();
                  }}
                  className="w-full accent-[#4A90E2]"
                />
              </div>
            </div>

            {selObj.mesh && (selObj.mesh.material as THREE.MeshStandardMaterial).map && (
              <div className="space-y-3 pt-2 border-t border-[#2D3139]/50">
                <span className="text-[#8E9299] block mb-2">Texture Tiling</span>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[#8E9299]">
                    <span>Repeat X</span>
                    <span className="font-mono text-[#4A90E2]">{(selObj.materialProps.textureRepeatX || 1).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={selObj.materialProps.textureRepeatX || 1}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      selObj.materialProps.textureRepeatX = val;
                      const mat = selObj.mesh!.material as THREE.MeshStandardMaterial;
                      if (mat.map) {
                        mat.map.repeat.x = val;
                        mat.map.wrapS = THREE.RepeatWrapping;
                        mat.map.needsUpdate = true;
                      }
                      editorStore.notify();
                    }}
                    className="w-full accent-[#4A90E2]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[#8E9299]">
                    <span>Repeat Y</span>
                    <span className="font-mono text-[#4A90E2]">{(selObj.materialProps.textureRepeatY || 1).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={selObj.materialProps.textureRepeatY || 1}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      selObj.materialProps.textureRepeatY = val;
                      const mat = selObj.mesh!.material as THREE.MeshStandardMaterial;
                      if (mat.map) {
                        mat.map.repeat.y = val;
                        mat.map.wrapT = THREE.RepeatWrapping;
                        mat.map.needsUpdate = true;
                      }
                      editorStore.notify();
                    }}
                    className="w-full accent-[#4A90E2]"
                  />
                </div>
              </div>
            )}
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
