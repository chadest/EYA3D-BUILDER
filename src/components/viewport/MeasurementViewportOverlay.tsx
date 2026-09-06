/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Viewport 3D Measurement Overlay HUD & Screen-Projected Badges
 */

import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';
import { formatDistance } from '../../core/measurement/measurementUtils';
import { Trash2, Copy, Check, Crosshair, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface MeasurementViewportOverlayProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const MeasurementViewportOverlay: React.FC<MeasurementViewportOverlayProps> = ({
  cameraRef,
  containerRef,
}) => {
  const [, setTick] = useState(0);
  const [expandedMeasId, setExpandedMeasId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  // Update screen coordinates on camera orbit / pan / frame loop
  useEffect(() => {
    let animId: number;
    const update = () => {
      setTick(t => t + 1);
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  const projectToScreen = (pos: [number, number, number] | THREE.Vector3) => {
    if (!cameraRef.current || !containerRef.current) return null;
    const v = pos instanceof THREE.Vector3 ? pos.clone() : new THREE.Vector3(pos[0], pos[1], pos[2]);
    v.project(cameraRef.current);

    // Behind camera check
    if (v.z > 1 || v.z < -1) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((v.x + 1) * rect.width) / 2;
    const y = ((-v.y + 1) * rect.height) / 2;

    // Check if within screen bounds with slight margin
    if (x < -100 || x > rect.width + 100 || y < -100 || y > rect.height + 100) return null;

    return { x, y };
  };

  const handleCopy = (id: string, distance: number) => {
    const text = formatDistance(distance, editorStore.measurementUnit);
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const measurements = editorStore.measurements;
  const measuringStart = editorStore.currentMeasuringStart;
  const hoverPos = editorStore.currentMeasuringHoverPos;
  const isMeasuring = editorStore.isMeasureToolActive;
  const snapType = editorStore.currentMeasuringSnapType;
  const unit = editorStore.measurementUnit;

  // Calculate live measuring midpoint and distance
  let liveMidpointScreen: { x: number; y: number } | null = null;
  let liveDistance = 0;
  let liveSnapScreen: { x: number; y: number } | null = null;

  if (isMeasuring && measuringStart && hoverPos) {
    const mid = new THREE.Vector3().addVectors(measuringStart, hoverPos).multiplyScalar(0.5);
    liveMidpointScreen = projectToScreen(mid);
    liveDistance = measuringStart.distanceTo(hoverPos);
  }

  if (isMeasuring && hoverPos) {
    liveSnapScreen = projectToScreen(hoverPos);
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden">
      {/* 1. SAVED MEASUREMENT SCREEN BADGES */}
      {measurements.map((m, idx) => {
        const p1 = new THREE.Vector3(m.start.position[0], m.start.position[1], m.start.position[2]);
        const p2 = new THREE.Vector3(m.end.position[0], m.end.position[1], m.end.position[2]);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        const screenPos = projectToScreen(mid);
        const startScreen = projectToScreen(p1);
        const endScreen = projectToScreen(p2);

        if (!screenPos) return null;

        const isSelected = editorStore.selectedMeasurementId === m.id;
        const isExpanded = expandedMeasId === m.id;

        return (
          <React.Fragment key={m.id}>
            {/* Endpoint Markers */}
            {startScreen && (
              <div
                style={{ left: `${startScreen.x}px`, top: `${startScreen.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black/80 shadow-sm"
              />
            )}
            {endScreen && (
              <div
                style={{ left: `${endScreen.x}px`, top: `${endScreen.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black/80 shadow-sm"
              />
            )}

            {/* Central Floating Dimension Pill */}
            <div
              style={{
                left: `${screenPos.x}px`,
                top: `${screenPos.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-auto flex flex-col items-center"
            >
              <div
                onClick={() => {
                  editorStore.selectMeasurement(m.id);
                  setExpandedMeasId(isExpanded ? null : m.id);
                }}
                className={`group flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold shadow-xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-300 shadow-emerald-600/40 scale-105'
                    : 'bg-[#121417]/90 text-emerald-300 hover:text-white hover:bg-emerald-950/80 border-emerald-500/40 backdrop-blur-md'
                }`}
              >
                <span className="text-[10px] text-emerald-200/80">#{idx + 1}</span>
                <span className="tracking-tight">{formatDistance(m.distance, unit)}</span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(m.id, m.distance);
                  }}
                  className="p-0.5 rounded text-emerald-300 hover:text-white transition-colors"
                  title="Copier la distance"
                >
                  {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    editorStore.removeMeasurement(m.id);
                  }}
                  className="p-0.5 rounded text-rose-400 hover:text-rose-300 transition-colors"
                  title="Supprimer la mesure"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Expanded Details Card on Click */}
              {isExpanded && (
                <div className="mt-1.5 p-2 rounded-xl bg-[#141619]/95 border border-white/10 shadow-2xl backdrop-blur-xl text-[10px] font-mono text-slate-300 space-y-1 w-44">
                  <div className="flex justify-between items-center text-slate-400 border-b border-white/5 pb-1">
                    <span>Dimensions Δ</span>
                    <span className="text-emerald-400 font-bold">{formatDistance(m.distance, unit)}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-400">
                    <span>Largeur (ΔX) :</span>
                    <span>{formatDistance(m.deltaX, unit)}</span>
                  </div>
                  <div className="flex justify-between items-center text-green-400">
                    <span>Hauteur (ΔY) :</span>
                    <span>{formatDistance(m.deltaY, unit)}</span>
                  </div>
                  <div className="flex justify-between items-center text-blue-400">
                    <span>Longueur (ΔZ) :</span>
                    <span>{formatDistance(m.deltaZ, unit)}</span>
                  </div>
                  {m.start.objectName && (
                    <div className="text-[9px] text-slate-500 pt-0.5 border-t border-white/5 truncate">
                      Objet : {m.start.objectName}
                    </div>
                  )}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* 2. LIVE IN-PROGRESS MEASURING BADGE & RETICLE */}
      {isMeasuring && (
        <>
          {/* Start Point Marker */}
          {measuringStart && projectToScreen(measuringStart) && (
            <div
              style={{
                left: `${projectToScreen(measuringStart)!.x}px`,
                top: `${projectToScreen(measuringStart)!.y}px`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-emerald-400 bg-emerald-400/30 flex items-center justify-center animate-pulse"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            </div>
          )}

          {/* Live Midpoint Distance Badge */}
          {liveMidpointScreen && (
            <div
              style={{
                left: `${liveMidpointScreen.x}px`,
                top: `${liveMidpointScreen.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute bg-emerald-500 text-slate-950 font-mono font-extrabold text-xs px-3 py-1 rounded-full shadow-2xl border border-emerald-300 flex items-center space-x-1.5 scale-110"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{formatDistance(liveDistance, unit)}</span>
            </div>
          )}

          {/* Smart Snap Cursor Reticle */}
          {liveSnapScreen && (
            <div
              style={{
                left: `${liveSnapScreen.x}px`,
                top: `${liveSnapScreen.y}px`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
            >
              <div className="w-6 h-6 rounded-full border-2 border-emerald-400/80 bg-emerald-400/10 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
              </div>
              {snapType !== 'none' && (
                <span className="mt-1 px-1.5 py-0.5 rounded bg-black/80 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 uppercase tracking-wider backdrop-blur-sm whitespace-nowrap shadow-md">
                  {snapType === 'vertex' ? 'Sommet' : snapType === 'edge' ? 'Arête' : snapType === 'face' ? 'Face' : 'Grille'}
                  {editorStore.currentMeasuringSnapObjName && ` (${editorStore.currentMeasuringSnapObjName})`}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
