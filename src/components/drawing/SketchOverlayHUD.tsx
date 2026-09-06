/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CAD 2D Sketching Overlay & Heads-Up Display (HUD)
 * Real-time cursor coordinates, snap badges, dimensions, and closed profile alerts.
 */

import React, { useEffect, useState } from 'react';
import { editorStore } from '../../store/EditorStore';
import { CadDrawingEngine } from '../../core/drawing/cadDrawingEngine';
import { DimensionLabel } from '../../types/drawing';
import { Sparkles, ArrowRight, CornerUpRight, Magnet, Crosshair, Box } from 'lucide-react';

interface SketchOverlayHUDProps {
  cursorScreenPos: { x: number; y: number } | null;
  cursorWorldPos: { x: number; y: number } | null;
  rubberBandInfo?: {
    length: number;
    angleDeg: number;
    radius?: number;
  } | null;
}

export const SketchOverlayHUD: React.FC<SketchOverlayHUDProps> = ({
  cursorScreenPos,
  cursorWorldPos,
  rubberBandInfo,
}) => {
  const [, setForceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = editorStore.subscribe(() => {
      setForceUpdate({});
    });
    return () => unsubscribe();
  }, []);

  if (editorStore.mode !== 'curve') return null;

  const activeTool = editorStore.activeDrawTool;
  const activeSnap = editorStore.activeSnapPoint;
  const showDimensions = editorStore.sketchSettings.showDimensions;
  const profiles = editorStore.sketchProfiles;
  const dimensions: DimensionLabel[] = showDimensions
    ? CadDrawingEngine.computeDimensionLabels(editorStore.sketchEntities)
    : [];

  const getToolInstructions = () => {
    switch (activeTool) {
      case 'BEZIER':
        return 'Courbe Bézier : Cliquez pour poser une ancre. Glissez pour orienter les tangentes. Clic sur le 1er point pour fermer la boucle ou Entrée pour terminer.';
      case 'LINE':
        return 'Cliquez pour poser un point. Clic suivant pour tracer un segment. Clic sur le point initial pour fermer la boucle.';
      case 'RECTANGLE':
        return 'Cliquez pour poser le 1er coin, puis déplacez la souris et cliquez pour le coin opposé.';
      case 'CIRCLE':
        return 'Cliquez pour définir le centre du cercle, puis glissez pour définir le rayon.';
      case 'ARC':
        return 'Cliquez pour le centre, puis pour le point de départ et le point final de l\'arc.';
      case 'SPLINE':
        return 'Cliquez pour ajouter des points de contrôle à la spline. Double-cliquez pour terminer.';
      case 'TRIM':
        return 'Cliquez sur une portion de ligne pour la rogner à l\'intersection la plus proche.';
      case 'EXTEND':
        return 'Cliquez sur une ligne pour la prolonger vers la limite la plus proche.';
      case 'FILLET':
        return `Sélectionnez 2 lignes connectées pour arrondir le coin (Rayon: ${editorStore.sketchSettings.filletRadius} mm).`;
      case 'OFFSET':
        return `Cliquez sur un élément pour le décaler de ${editorStore.sketchSettings.offsetDistance} mm.`;
      case 'SELECT':
        return 'Sélectionnez des entités 2D pour les modifier ou les supprimer (Touche Suppr).';
      default:
        return 'Sélectionnez un outil de dessin 2D dans la barre supérieure.';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden">
      {/* Real-time Floating Cursor Coordinates & Dimension Badge */}
      {cursorScreenPos && cursorWorldPos && (
        <div
          style={{
            transform: `translate(${cursorScreenPos.x + 18}px, ${cursorScreenPos.y + 18}px)`,
          }}
          className="absolute top-0 left-0 bg-[#0F1113]/90 backdrop-blur border border-[#2D3139] px-2.5 py-1 rounded-md text-[10px] font-mono text-slate-300 shadow-xl flex flex-col gap-0.5 pointer-events-none"
        >
          <div className="flex items-center space-x-2">
            <span>X: <strong className="text-emerald-400">{cursorWorldPos.x.toFixed(2)}</strong></span>
            <span>Y: <strong className="text-sky-400">{cursorWorldPos.y.toFixed(2)}</strong></span>
          </div>

          {rubberBandInfo && (
            <div className="flex items-center space-x-2 border-t border-[#2D3139] pt-0.5 text-amber-300">
              {rubberBandInfo.radius !== undefined ? (
                <span>R: <strong>{rubberBandInfo.radius.toFixed(2)} mm</strong></span>
              ) : (
                <>
                  <span>L: <strong>{rubberBandInfo.length.toFixed(2)} mm</strong></span>
                  <span>∠: <strong>{rubberBandInfo.angleDeg.toFixed(1)}°</strong></span>
                </>
              )}
            </div>
          )}

          {activeSnap && (
            <div className="flex items-center space-x-1 text-emerald-400 font-bold border-t border-[#2D3139] pt-0.5">
              <Magnet className="w-3 h-3" />
              <span>{activeSnap.sourceLabel || activeSnap.type}</span>
            </div>
          )}
        </div>
      )}

      {/* Snap Glyph Indicator at Snap Screen Position */}
      {activeSnap && cursorScreenPos && (
        <div
          style={{
            transform: `translate(${cursorScreenPos.x - 7}px, ${cursorScreenPos.y - 7}px)`,
          }}
          className="absolute top-0 left-0 pointer-events-none"
        >
          {activeSnap.type === 'ENDPOINT' && (
            <div className="w-3.5 h-3.5 border-2 border-emerald-400 bg-emerald-400/20" />
          )}
          {activeSnap.type === 'MIDPOINT' && (
            <div className="w-3.5 h-3.5 border-2 border-cyan-400 bg-cyan-400/20 rotate-45" />
          )}
          {activeSnap.type === 'CENTER' && (
            <div className="w-3.5 h-3.5 border-2 border-amber-400 rounded-full bg-amber-400/20" />
          )}
          {activeSnap.type === 'INTERSECTION' && (
            <div className="w-3.5 h-3.5 flex items-center justify-center text-rose-400 font-black text-xs">
              ✕
            </div>
          )}
          {activeSnap.type === 'ORTHO' && (
            <div className="w-3.5 h-3.5 border border-dashed border-sky-400 rounded-full animate-ping" />
          )}
        </div>
      )}

      {/* Top Center CAD Mode & Quick Extrude / 3D Toggle Pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 bg-[#0F1113]/90 backdrop-blur-md border border-[#2D3139] px-3 py-1.5 rounded-full shadow-2xl text-xs z-30">
        <div className="flex items-center space-x-1.5 pr-2 border-r border-[#2D3139]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-200">Mode Dessin 2D</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">Plan XY</span>
        </div>

        <span className="text-[11px] text-slate-300 max-w-xs truncate hidden md:inline">
          {getToolInstructions()}
        </span>

        <div className="flex items-center space-x-1 pl-1">
          <button
            onClick={() => editorStore.toggle2D3DMode()}
            className="px-2 py-1 rounded bg-[#1C1E22] hover:bg-[#2D3139] text-sky-400 hover:text-sky-300 font-medium text-[11px] transition-colors cursor-pointer flex items-center space-x-1 border border-sky-500/30"
            title="Basculer vers la vue 3D libre"
          >
            <Box className="w-3 h-3" />
            <span>Vue 3D</span>
          </button>

          <button
            onClick={() => editorStore.extrudeSketchTo3D(1.0)}
            disabled={editorStore.sketchEntities.length === 0}
            className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all flex items-center space-x-1 ${
              editorStore.sketchProfiles.length > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 cursor-pointer'
                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
            title="Extruder en 3D et basculer automatiquement en vue 3D"
          >
            <Sparkles className="w-3 h-3" />
            <span>Extruder 3D</span>
          </button>
        </div>
      </div>
    </div>
  );
};
