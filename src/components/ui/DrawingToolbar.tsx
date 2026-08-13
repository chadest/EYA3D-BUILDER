/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CAD 2D Drawing & Sketching Toolbar
 * Modern professional CAD-grade tool shelf with full toolsets and parameters.
 */

import React, { useState, useEffect } from 'react';
import {
  PenLine,
  Square,
  Circle,
  CircleDot,
  PenTool,
  Scissors,
  MoveUpRight,
  CornerUpRight,
  Copy,
  Magnet,
  Grid,
  Ruler,
  Lock,
  Unlock,
  Box,
  RotateCw,
  Trash2,
  Crosshair,
  Sparkles,
  Layers,
  ChevronDown,
  Info,
} from 'lucide-react';
import { editorStore } from '../../store/EditorStore';
import { DrawToolType } from '../../types/drawing';
import { useLanguage } from '../../context/LanguageContext';

export const DrawingToolbar: React.FC = () => {
  const { language } = useLanguage();
  const [, setForceUpdate] = useState({});
  const [isSnapMenuOpen, setIsSnapMenuOpen] = useState(false);
  const [isParamsOpen, setIsParamsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = editorStore.subscribe(() => {
      setForceUpdate({});
    });
    return () => unsubscribe();
  }, []);

  const activeTool = editorStore.activeDrawTool;
  const settings = editorStore.sketchSettings;
  const isLocked2D = editorStore.isDrawingLocked2D;
  const closedProfilesCount = editorStore.sketchProfiles.length;
  const entitiesCount = editorStore.sketchEntities.length;

  const drawTools: { id: DrawToolType; label: string; icon: React.ReactNode; tooltip: string }[] = [
    { id: 'SELECT', label: 'Sélection', icon: <Crosshair className="w-4 h-4" />, tooltip: 'Sélectionner ou inspecter un élément 2D' },
    { id: 'LINE', label: 'Ligne', icon: <PenLine className="w-4 h-4" />, tooltip: 'Tracer des segments de ligne continus ou uniques' },
    { id: 'RECTANGLE', label: 'Rectangle', icon: <Square className="w-4 h-4" />, tooltip: 'Tracer un rectangle par 2 coins opposés' },
    { id: 'CIRCLE', label: 'Cercle', icon: <Circle className="w-4 h-4" />, tooltip: 'Tracer un cercle par centre et rayon' },
    { id: 'ARC', label: 'Arc 3 Points', icon: <CircleDot className="w-4 h-4" />, tooltip: 'Tracer un arc circulaire par centre, départ et fin' },
    { id: 'SPLINE', label: 'Courbe Spline', icon: <PenTool className="w-4 h-4" />, tooltip: 'Tracer une courbe de Bézier / Spline lisse' },
    { id: 'TRIM', label: 'Rogner', icon: <Scissors className="w-4 h-4 text-amber-400" />, tooltip: 'Rogner un segment à l\'intersection la plus proche' },
    { id: 'EXTEND', label: 'Prolonger', icon: <MoveUpRight className="w-4 h-4 text-emerald-400" />, tooltip: 'Prolonger un segment vers la limite la plus proche' },
    { id: 'FILLET', label: 'Congé / Raccord', icon: <CornerUpRight className="w-4 h-4 text-sky-400" />, tooltip: 'Arrondir un angle entre 2 segments avec un rayon' },
    { id: 'OFFSET', label: 'Décalage', icon: <Copy className="w-4 h-4 text-purple-400" />, tooltip: 'Décaler une ligne ou un contour d\'une distance fixe' },
  ];

  return (
    <div id="drawing-toolbar" className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#141619] border-b border-[#2D3139] text-[#E0E0E0] select-none z-20">
      {/* Left: Drawing Tools List */}
      <div className="flex flex-wrap items-center gap-1">
        {/* Lock / Unlock 2D Camera View */}
        <button
          onClick={() => editorStore.setDrawingLocked2D(!isLocked2D)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
            isLocked2D
              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'bg-[#0F1113] border-[#2D3139] text-slate-400 hover:text-white'
          }`}
          title={isLocked2D ? "Vue 2D Orthogonale verrouillée (Axe Z face)" : "Déverrouiller pour orbiter en 3D"}
        >
          {isLocked2D ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span className="text-[11px]">{isLocked2D ? 'Vue 2D Fixée' : 'Vue Libre'}</span>
        </button>

        <div className="h-4 w-px bg-[#2D3139] mx-1" />

        {/* Primary Draw Tools Buttons */}
        <div className="flex items-center bg-[#0F1113] p-1 rounded-lg border border-[#2D3139] space-x-0.5">
          {drawTools.map(t => {
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => editorStore.setActiveDrawTool(t.id)}
                className={`p-1.5 rounded transition-all flex items-center justify-center ${
                  isActive
                    ? 'bg-[#4A90E2] text-white shadow-md font-bold'
                    : 'text-[#8E9299] hover:text-white hover:bg-[#2D3139]'
                }`}
                title={`${t.label} : ${t.tooltip}`}
              >
                {t.icon}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-[#2D3139] mx-1" />

        {/* Snapping & Guides Controls */}
        <div className="flex items-center bg-[#0F1113] p-1 rounded-lg border border-[#2D3139] space-x-1">
          {/* Object Snap Toggle */}
          <button
            onClick={() => editorStore.updateSketchSettings({ objectSnapEnabled: !settings.objectSnapEnabled })}
            className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
              settings.objectSnapEnabled
                ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-bold'
                : 'text-[#8E9299] hover:text-white'
            }`}
            title={settings.objectSnapEnabled ? "Magnétisme Objet Actif (Extrémités, Milieux, Centres, Intersections)" : "Activer l'accroche objet"}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">OSNAP</span>
          </button>

          {/* Grid Snap Toggle */}
          <button
            onClick={() => editorStore.updateSketchSettings({ gridSnapEnabled: !settings.gridSnapEnabled })}
            className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
              settings.gridSnapEnabled
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40 font-bold'
                : 'text-[#8E9299] hover:text-white'
            }`}
            title={settings.gridSnapEnabled ? `Accroche Grille Active (Pas: ${settings.gridStep})` : "Activer l'accroche grille"}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">{settings.gridStep}</span>
          </button>

          {/* Ortho Lock Toggle */}
          <button
            onClick={() => editorStore.updateSketchSettings({ orthoLockEnabled: !settings.orthoLockEnabled })}
            className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
              settings.orthoLockEnabled
                ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40 font-bold'
                : 'text-[#8E9299] hover:text-white'
            }`}
            title={settings.orthoLockEnabled ? "Verrouillage Orthogonal Actif (0°, 90°, 180°, 270°)" : "Activer le mode Ortho (Shift)"}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">ORTHO</span>
          </button>

          {/* Dimension Visibility Toggle */}
          <button
            onClick={() => editorStore.updateSketchSettings({ showDimensions: !settings.showDimensions })}
            className={`p-1.5 rounded transition-all flex items-center space-x-1 text-xs ${
              settings.showDimensions
                ? 'bg-sky-600/30 text-sky-400 border border-sky-500/40 font-bold'
                : 'text-[#8E9299] hover:text-white'
            }`}
            title={settings.showDimensions ? "Cotations / Dimensions affichées" : "Afficher les cotations"}
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fillet / Offset quick settings toggle */}
        {(activeTool === 'FILLET' || activeTool === 'OFFSET') && (
          <div className="flex items-center bg-[#0F1113] px-2 py-1 rounded-lg border border-[#2D3139] space-x-2 text-xs font-mono">
            {activeTool === 'FILLET' ? (
              <>
                <span className="text-[#8E9299] text-[11px]">Rayon Congé:</span>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={settings.filletRadius}
                  onChange={e => editorStore.updateSketchSettings({ filletRadius: parseFloat(e.target.value) || 0.5 })}
                  className="w-12 bg-[#1C1E22] border border-[#2D3139] rounded px-1 text-emerald-400 font-bold text-center text-[11px]"
                />
                <span className="text-slate-500 text-[10px]">mm</span>
              </>
            ) : (
              <>
                <span className="text-[#8E9299] text-[11px]">Distance Décalage:</span>
                <input
                  type="number"
                  min="-10"
                  max="10"
                  step="0.1"
                  value={settings.offsetDistance}
                  onChange={e => editorStore.updateSketchSettings({ offsetDistance: parseFloat(e.target.value) || 0.5 })}
                  className="w-12 bg-[#1C1E22] border border-[#2D3139] rounded px-1 text-purple-400 font-bold text-center text-[11px]"
                />
                <span className="text-slate-500 text-[10px]">mm</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: 3D CAD Operations (Extrude, Lathe, Clear) */}
      <div className="flex items-center space-x-1.5">
        {/* Closed Profile Indicator Badge */}
        {closedProfilesCount > 0 ? (
          <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px]">{closedProfilesCount} Profil{closedProfilesCount > 1 ? 's' : ''} Fermé{closedProfilesCount > 1 ? 's' : ''}</span>
          </div>
        ) : entitiesCount > 0 ? (
          <div className="flex items-center space-x-1 px-2 py-1 bg-[#1C1E22] text-slate-400 border border-[#2D3139] rounded-lg text-[10px]">
            <span>{entitiesCount} Entité{entitiesCount > 1 ? 's' : ''} 2D</span>
          </div>
        ) : null}

        {/* 3D Extrusion Action Button */}
        <button
          onClick={() => editorStore.extrudeSketchTo3D(settings.extrudeHeight)}
          disabled={entitiesCount === 0}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            closedProfilesCount > 0
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/30 cursor-pointer'
              : 'bg-[#1C1E22] text-slate-400 hover:text-white border border-[#2D3139] cursor-pointer'
          }`}
          title="Convertir le profil 2D en solide 3D extrudé"
        >
          <Box className="w-3.5 h-3.5" />
          <span className="text-[11px]">Extruder en 3D</span>
        </button>

        {/* 360° Lathe Revolution Action Button */}
        <button
          onClick={() => editorStore.latheSketchTo3D(32)}
          disabled={entitiesCount === 0}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#1C1E22] hover:bg-[#2D3139] border border-[#2D3139] hover:border-[#4A90E2] text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
          title="Créer une révolution 360° autour de l'axe Y (Lathe)"
        >
          <RotateCw className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] hidden md:inline">Révolution</span>
        </button>

        {/* Clear Sketch Action */}
        <button
          onClick={() => {
            if (entitiesCount > 0 && confirm('Effacer tous les tracés de l\'esquisse 2D ?')) {
              editorStore.clearSketch();
            }
          }}
          disabled={entitiesCount === 0}
          className="p-1.5 bg-[#1C1E22] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-[#2D3139] hover:border-rose-500/40 rounded-lg transition-all"
          title="Effacer toute l'esquisse"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
