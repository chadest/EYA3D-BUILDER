/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Interactive Primitives Controls & Selector Popup
 */

import React, { useState } from 'react';
import {
  Plus,
  Box,
  Square,
  Circle,
  Cylinder as CylinderIcon,
  Disc,
  Star,
  Triangle,
  Magnet,
  X,
  Sparkles,
  MousePointer,
  Hand,
  ToggleLeft,
  ToggleRight,
  Type,
  Video,
  Sun,
} from 'lucide-react';
import {
  InteractivePrimitiveType,
  DrawingStep,
} from '../../core/primitives/interactivePrimitives';

interface InteractivePrimitivePopupProps {
  isOpen: boolean;
  onClose: () => void;
  activeType: InteractivePrimitiveType;
  drawingStep: DrawingStep;
  snapEnabled: boolean;
  snapStep: number;
  isInteractiveMode: boolean;
  onToggleInteractiveMode: (active: boolean) => void;
  onSelectType: (type: InteractivePrimitiveType) => void;
  onAddDirectPrimitive: (type: InteractivePrimitiveType) => void;
  onToggleSnap: () => void;
  onChangeSnapStep: (step: number) => void;
  onCancelDrawing: () => void;
}

export const InteractivePrimitivePopup: React.FC<InteractivePrimitivePopupProps> = ({
  isOpen,
  onClose,
  activeType,
  drawingStep,
  snapEnabled,
  snapStep,
  isInteractiveMode,
  onToggleInteractiveMode,
  onSelectType,
  onAddDirectPrimitive,
  onToggleSnap,
  onChangeSnapStep,
  onCancelDrawing,
}) => {
  if (!isOpen) return null;

  const primitivesList: { id: InteractivePrimitiveType; name: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'cube', name: 'Cube', icon: <Box className="w-4 h-4" />, desc: 'Base rectangulaire + hauteur' },
    { id: 'plane', name: 'Plan', icon: <Square className="w-4 h-4" />, desc: 'Surface 2D sur le plan de travail' },
    { id: 'sphere', name: 'Sphère', icon: <Circle className="w-4 h-4" />, desc: 'Rayon depuis le point d\'ancrage' },
    { id: 'cylinder', name: 'Cylindre', icon: <CylinderIcon className="w-4 h-4" />, desc: 'Base circulaire + extrusions' },
    { id: 'cone', name: 'Cône', icon: <Triangle className="w-4 h-4" />, desc: 'Base circulaire + sommet aigu' },
    { id: 'pyramid', name: 'Pyramide', icon: <Triangle className="w-4 h-4 rotate-180" />, desc: 'Base à 4 côtés + sommet' },
    { id: 'torus', name: 'Torus', icon: <Disc className="w-4 h-4" />, desc: 'Rayon principal + épaisseur tube' },
    { id: 'star3d', name: 'Étoile 3D', icon: <Star className="w-4 h-4" />, desc: 'Forme étoile 2D + profondeur' },
    { id: 'text', name: 'Texte', icon: <Type className="w-4 h-4" />, desc: 'Plaque de texte 3D personnalisable' },
    { id: 'camera', name: 'Caméra', icon: <Video className="w-4 h-4" />, desc: 'Caméra de scène' },
    { id: 'spotlight', name: 'Projecteur', icon: <Sun className="w-4 h-4" />, desc: 'Lumière directionnelle Spot' },
    { id: 'pointlight', name: 'Ampoule', icon: <Circle className="w-4 h-4" />, desc: 'Point lumineux omnidirectionnel' },
  ];

  const getStepText = () => {
    if (!isInteractiveMode) {
      return 'Mode Direct: Clic pour créer le solide à l\'origine';
    }
    switch (drawingStep) {
      case 'DRAWING_BASE':
        return 'Étape 1: Maintenez & glissez pour tracer la base...';
      case 'EXTRUDING_HEIGHT':
        return 'Étape 2: Déplacez vers le haut pour fixer la hauteur (Clic pour valider)';
      case 'COMPLETED':
        return 'Solide créé ! Main levée (Navigation réactivée)';
      default:
        return 'Sélectionnez une forme et tracez dans le Viewport.';
    }
  };

  return (
    <div className="absolute top-3 right-3 z-50 flex flex-col items-end space-y-2 pointer-events-auto select-none">
      {/* Floating Dialog Popup */}
      <div className="bg-[#16181C]/95 backdrop-blur-md border border-[#2D3139] rounded-2xl p-3.5 shadow-2xl w-84 text-[#E0E0E0] space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
        {/* Header Title & Close Button */}
        <div className="flex items-center justify-between border-b border-[#2D3139] pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#4A90E2]/20 border border-[#4A90E2]/40 flex items-center justify-center text-[#4A90E2]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-tight">Solides Primitifs</h3>
              <p className="text-[10px] text-[#8E9299]">Création 3D interactive</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#8E9299] hover:text-white hover:bg-[#2D3139] rounded-lg transition-colors"
            title="Fermer (Échap)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

          {/* Mode Switcher: Interactive Mode vs Direct Mode */}
          <div className="bg-[#0F1113] p-1.5 rounded-xl border border-[#2D3139] flex items-center justify-between">
            <div className="flex items-center space-x-1.5 px-1">
              {isInteractiveMode ? (
                <Hand className="w-3.5 h-3.5 text-[#4A90E2]" />
              ) : (
                <MousePointer className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="text-[11px] font-semibold text-white">
                {isInteractiveMode ? 'Mode Interactif' : 'Mode Direct'}
              </span>
            </div>

            <button
              onClick={() => onToggleInteractiveMode(!isInteractiveMode)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                isInteractiveMode
                  ? 'bg-[#4A90E2] border-[#4A90E2] text-white shadow-sm'
                  : 'bg-[#2D3139] border-[#3A3F4A] text-[#B0B4BC] hover:text-white'
              }`}
              title="Activer ou désactiver le dessin interactif dans le viewport"
            >
              {isInteractiveMode ? (
                <>
                  <ToggleRight className="w-4 h-4 text-white" />
                  <span>Interactif ON</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                  <span>Direct</span>
                </>
              )}
            </button>
          </div>

          {/* Snapping Options (Only shown when Interactive Mode is ON) */}
          {isInteractiveMode && (
            <div className="flex items-center justify-between bg-[#0F1113]/60 px-2.5 py-1.5 rounded-xl border border-[#2D3139]/80 text-[10px]">
              <span className="text-[#8E9299] font-medium">Aimantation Grille:</span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={onToggleSnap}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold border transition-all ${
                    snapEnabled
                      ? 'bg-[#4A90E2]/20 border-[#4A90E2] text-[#4A90E2]'
                      : 'bg-[#0F1113] border-[#2D3139] text-[#8E9299] hover:text-white'
                  }`}
                >
                  <Magnet className="w-3 h-3" />
                  <span>{snapEnabled ? 'Actif' : 'Off'}</span>
                </button>

                {snapEnabled && (
                  <select
                    value={snapStep}
                    onChange={e => onChangeSnapStep(parseFloat(e.target.value))}
                    className="bg-[#0F1113] border border-[#2D3139] text-white text-[10px] font-mono rounded px-1.5 py-0.5 focus:outline-none"
                  >
                    <option value={0.1}>0.1m</option>
                    <option value={0.25}>0.25m</option>
                    <option value={0.5}>0.5m</option>
                    <option value={1.0}>1.0m</option>
                    <option value={2.0}>2.0m</option>
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Primitives Grid (4 Columns) */}
          <div className="grid grid-cols-4 gap-1.5">
            {primitivesList.map(p => {
              const isSelected = activeType === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (isInteractiveMode) {
                      onSelectType(p.id);
                    } else {
                      onAddDirectPrimitive(p.id);
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                    isSelected && isInteractiveMode && drawingStep !== 'IDLE'
                      ? 'bg-[#4A90E2] border-[#4A90E2] text-white shadow-lg scale-105'
                      : isSelected && isInteractiveMode
                      ? 'bg-[#2D3139] border-[#4A90E2] text-[#4A90E2]'
                      : 'bg-[#0F1113] border-[#2D3139] text-[#8E9299] hover:text-white hover:bg-[#1C1E22]'
                  }`}
                  title={`${p.name}: ${p.desc}`}
                >
                  <div className="mb-1">{p.icon}</div>
                  <span className="text-[10px] font-medium truncate w-full">{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Status Guide & Instructions */}
          <div className="bg-[#0F1113] p-2 rounded-xl border border-[#2D3139] text-[10px] font-mono flex items-center justify-between text-[#8E9299]">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-sans leading-tight pr-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="truncate">{getStepText()}</span>
            </div>

            {drawingStep !== 'IDLE' && (
              <button
                onClick={onCancelDrawing}
                className="p-1 hover:bg-[#2D3139] text-rose-400 rounded transition-colors flex-shrink-0"
                title="Annuler le dessin (Échap)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
    </div>
  );
};

