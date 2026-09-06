/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - 3D Measurement & Scale Verification Panel
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Ruler,
  X,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Magnet,
  ChevronDown,
  ChevronUp,
  Info,
  Scale,
  Sparkles,
  Layers,
  HelpCircle,
  Crosshair
} from 'lucide-react';
import { editorStore } from '../../store/EditorStore';
import { MeasurementUnit } from '../../types/measurement';
import { formatDistance, convertToMeters } from '../../core/measurement/measurementUtils';

export const MeasurementPanel: React.FC = () => {
  const [, setTick] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showScaleHelper, setShowScaleHelper] = useState(true);
  const [targetDistanceInput, setTargetDistanceInput] = useState<string>('4.70');
  const [selectedReferenceMeasId, setSelectedReferenceMeasId] = useState<string>('');
  const [scaleSuccessMessage, setScaleSuccessMessage] = useState<string | null>(null);
  const [showQuickPresets, setShowQuickPresets] = useState(false);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const isActive = editorStore.isMeasureToolActive;
  const isOpen = editorStore.isMeasurementPanelOpen;
  const measurements = editorStore.measurements;
  const unit = editorStore.measurementUnit;
  const snapSettings = editorStore.measureSnapSettings;
  const selectedObject = editorStore.getSelectedObject();
  const measuringStart = editorStore.currentMeasuringStart;
  const hoverPos = editorStore.currentMeasuringHoverPos;
  const snapType = editorStore.currentMeasuringSnapType;

  // Auto-select latest measurement for scale tool if none selected
  useEffect(() => {
    if (measurements.length > 0 && !selectedReferenceMeasId) {
      setSelectedReferenceMeasId(measurements[measurements.length - 1].id);
    }
  }, [measurements, selectedReferenceMeasId]);

  if (!isOpen) return null;

  const handleCopyDistance = (id: string, distance: number) => {
    const text = formatDistance(distance, unit);
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyScale = () => {
    if (!selectedObject) {
      alert('Veuillez sélectionner un objet 3D dans la scène (ex: la voiture FBX) pour appliquer la mise à l\'échelle.');
      return;
    }

    const refMeas = measurements.find(m => m.id === selectedReferenceMeasId) || measurements[measurements.length - 1];
    if (!refMeas) {
      alert('Veuillez d\'abord effectuer une mesure 3D de référence (en cliquant 2 points).');
      return;
    }

    const targetVal = parseFloat(targetDistanceInput);
    if (isNaN(targetVal) || targetVal <= 0) {
      alert('Veuillez entrer une distance cible valide supérieure à 0.');
      return;
    }

    const targetMeters = convertToMeters(targetVal, unit);
    const measuredMeters = refMeas.distance;

    const success = editorStore.scaleObjectToMeasurement(selectedObject.id, measuredMeters, targetMeters);
    if (success) {
      const factor = (targetMeters / measuredMeters).toFixed(3);
      setScaleSuccessMessage(`Objet "${selectedObject.name}" redimensionné avec succès (facteur ×${factor}) !`);
      setTimeout(() => setScaleSuccessMessage(null), 4000);
    }
  };

  // Common real-world reference presets
  const presets = [
    { label: 'Voiture Berline / Sedan (Longueur)', value: '4.70', unit: 'm', desc: 'Longueur standard ~4.5 - 4.9 m' },
    { label: 'Voiture SUV / Break (Longueur)', value: '4.95', unit: 'm', desc: 'Longueur grand SUV ~4.8 - 5.2 m' },
    { label: 'Voiture (Largeur avec rétros)', value: '2.05', unit: 'm', desc: 'Largeur standard ~1.9 - 2.1 m' },
    { label: 'Voiture (Hauteur)', value: '1.45', unit: 'm', desc: 'Hauteur berline ~1.4 - 1.5 m' },
    { label: 'Diamètre Roue / Pneu', value: '0.65', unit: 'm', desc: 'Jante + Pneu R18 ~65 cm' },
    { label: 'Taille Humain Adulte', value: '1.75', unit: 'm', desc: 'Hauteur standard personnage ~1.70 - 1.85 m' },
    { label: 'Porte Standard (Hauteur)', value: '2.10', unit: 'm', desc: 'Hauteur de porte architecturale ~2.10 m' },
  ];

  return (
    <div
      id="measurement-panel"
      className="fixed bottom-12 right-72 z-30 w-84 bg-[#141619]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-slate-200 select-none font-sans text-xs transition-all duration-200"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-emerald-950/40 via-[#1C1E22] to-[#141619] border-b border-white/10">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-400'}`}>
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center space-x-1.5">
              <span>Outil de Mesure 3D</span>
              {isActive && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                  ACTIF
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400">Vérification d'échelle & dimensions</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={isMinimized ? "Agrandir le panneau" : "Réduire le panneau"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              editorStore.setMeasurementPanelOpen(false);
              editorStore.setMeasureToolActive(false);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {!isMinimized && (
        <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Tool Activation / Deactivation Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => editorStore.toggleMeasureTool()}
              className={`flex-1 py-2 px-3 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm ${
                isActive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 border border-emerald-400/40'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
              }`}
            >
              <Crosshair className="w-4 h-4" />
              <span>{isActive ? 'Mesure en cours (cliquez 2 points)' : 'Activer la mesure 3D (Touche M)'}</span>
            </button>
          </div>

          {/* Real-time Status / Tip Bar */}
          {isActive && (
            <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start space-x-2">
              <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                {!measuringStart ? (
                  <p>
                    <strong className="text-white">Étape 1 :</strong> Cliquez sur le 1er point 3D (ex: pare-chocs avant de la voiture).
                  </p>
                ) : (
                  <p>
                    <strong className="text-white">Étape 2 :</strong> Cliquez sur le 2nd point 3D (ex: pare-chocs arrière). 
                    <span className="block text-emerald-300 font-mono text-[10px] mt-0.5">
                      Accrochage actif : <span className="uppercase font-bold">{snapType}</span>
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Unit Selector & Snapping Controls */}
          <div className="bg-black/40 rounded-xl p-2.5 border border-white/5 space-y-2">
            {/* Unit Selector */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Unité d'affichage :</span>
              <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                {(['m', 'cm', 'mm', 'ft', 'in'] as MeasurementUnit[]).map(u => (
                  <button
                    key={u}
                    onClick={() => editorStore.setMeasurementUnit(u)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono font-medium transition-all ${
                      unit === u
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Snapping Toggles */}
            <div className="pt-1 border-t border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] flex items-center space-x-1">
                  <Magnet className="w-3 h-3 text-emerald-400" />
                  <span>Accrochage intelligent (Snapping)</span>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => editorStore.updateMeasureSnapSettings({ snapToVertices: !snapSettings.snapToVertices })}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all ${
                    snapSettings.snapToVertices
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-slate-500 border-transparent'
                  }`}
                  title="Accrocher aux sommets du maillage"
                >
                  Sommets
                </button>
                <button
                  onClick={() => editorStore.updateMeasureSnapSettings({ snapToEdges: !snapSettings.snapToEdges })}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all ${
                    snapSettings.snapToEdges
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-slate-500 border-transparent'
                  }`}
                  title="Accrocher aux arêtes"
                >
                  Arêtes
                </button>
                <button
                  onClick={() => editorStore.updateMeasureSnapSettings({ snapToFaces: !snapSettings.snapToFaces })}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all ${
                    snapSettings.snapToFaces
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-slate-500 border-transparent'
                  }`}
                  title="Accrocher à la surface des faces"
                >
                  Faces
                </button>
                <button
                  onClick={() => editorStore.updateMeasureSnapSettings({ snapToGrid: !snapSettings.snapToGrid })}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all ${
                    snapSettings.snapToGrid
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-slate-500 border-transparent'
                  }`}
                  title="Accrocher à la grille du sol"
                >
                  Grille
                </button>
              </div>
            </div>
          </div>

          {/* Active Measurements List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px] font-medium flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Mesures enregistrées ({measurements.length})</span>
              </span>
              {measurements.length > 0 && (
                <button
                  onClick={() => editorStore.clearMeasurements()}
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center space-x-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Tout effacer</span>
                </button>
              )}
            </div>

            {measurements.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-slate-500 space-y-1">
                <p className="text-[11px]">Aucune mesure pour le moment.</p>
                <p className="text-[10px] text-slate-600">
                  Activez l'outil et cliquez sur deux points 3D pour mesurer.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                {measurements.map((m, idx) => {
                  const isSelected = editorStore.selectedMeasurementId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => editorStore.selectMeasurement(m.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md'
                          : 'bg-black/30 hover:bg-black/50 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
                          <span className="font-mono font-bold text-sm text-slate-100">
                            {formatDistance(m.distance, unit)}
                          </span>
                          <span className="text-[10px] text-slate-500">#{idx + 1}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyDistance(m.id, m.distance);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Copier la valeur"
                          >
                            {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              editorStore.removeMeasurement(m.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Supprimer la mesure"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Component breakdown (Delta X, Y, Z) */}
                      <div className="mt-1.5 pt-1.5 border-t border-white/5 grid grid-cols-3 gap-1 font-mono text-[10px] text-slate-400">
                        <div className="flex items-center space-x-1">
                          <span className="text-red-400 font-semibold">ΔX :</span>
                          <span>{formatDistance(m.deltaX, unit)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-green-400 font-semibold">ΔY :</span>
                          <span>{formatDistance(m.deltaY, unit)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-blue-400 font-semibold">ΔZ :</span>
                          <span>{formatDistance(m.deltaZ, unit)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Model Scale Verification & Calibration Tool */}
          <div className="bg-gradient-to-br from-[#1C1E22] to-black/60 rounded-xl p-3 border border-white/10 space-y-2.5">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowScaleHelper(!showScaleHelper)}
            >
              <div className="flex items-center space-x-1.5 text-slate-200 font-semibold">
                <Scale className="w-4 h-4 text-amber-400" />
                <span>Calibrer l'échelle d'un modèle</span>
              </div>
              {showScaleHelper ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {showScaleHelper && (
              <div className="space-y-2 pt-1 border-t border-white/5">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Redimensionne automatiquement le modèle sélectionné (ex: voiture FBX) pour que la dimension mesurée corresponde à la taille réelle.
                </p>

                {/* Selected object info */}
                <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Objet sélectionné :</span>
                  <span className={`font-medium ${selectedObject ? 'text-sky-300' : 'text-amber-400'}`}>
                    {selectedObject ? selectedObject.name : 'Aucun objet sélectionné'}
                  </span>
                </div>

                {/* Reference measurement selector */}
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px]">Mesure de référence :</label>
                  <select
                    value={selectedReferenceMeasId}
                    onChange={(e) => setSelectedReferenceMeasId(e.target.value)}
                    disabled={measurements.length === 0}
                    className="w-full bg-[#0F1113] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {measurements.length === 0 ? (
                      <option value="">Aucune mesure disponible</option>
                    ) : (
                      measurements.map((m, idx) => (
                        <option key={m.id} value={m.id}>
                          Mesure #{idx + 1} : {formatDistance(m.distance, unit)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Target real-world distance */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-400 text-[10px]">Taille réelle souhaitée :</label>
                    <button
                      onClick={() => setShowQuickPresets(!showQuickPresets)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center space-x-0.5"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Gabarits types</span>
                    </button>
                  </div>

                  {showQuickPresets && (
                    <div className="p-2 rounded-lg bg-black/60 border border-amber-500/20 space-y-1 mb-2">
                      <p className="text-[10px] font-semibold text-amber-300 mb-1">Dimensions réelles courantes :</p>
                      {presets.map(p => (
                        <button
                          key={p.label}
                          onClick={() => {
                            setTargetDistanceInput(p.value);
                            editorStore.setMeasurementUnit(p.unit as MeasurementUnit);
                            setShowQuickPresets(false);
                          }}
                          className="w-full text-left p-1 rounded hover:bg-white/10 flex items-center justify-between text-[10px] text-slate-300"
                        >
                          <span>{p.label}</span>
                          <span className="font-mono text-emerald-400 font-bold">{p.value} {p.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={targetDistanceInput}
                      onChange={(e) => setTargetDistanceInput(e.target.value)}
                      placeholder="Ex: 4.70"
                      className="flex-1 bg-[#0F1113] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                      {unit}
                    </span>
                  </div>
                </div>

                {/* Apply Scale Button */}
                <button
                  onClick={handleApplyScale}
                  disabled={!selectedObject || measurements.length === 0}
                  className={`w-full py-2 px-3 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer ${
                    selectedObject && measurements.length > 0
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 border border-amber-400/40'
                      : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  <span>Appliquer l'échelle au modèle</span>
                </button>

                {scaleSuccessMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[10px] text-center font-medium"
                  >
                    {scaleSuccessMessage}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
