/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Bottom Status Bar & Guidance Tips
 */

import React, { useState, useEffect } from 'react';
import { Info, Sparkles, Activity } from 'lucide-react';
import { editorStore } from '../../store/EditorStore';

export const StatusBar: React.FC = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const mode = editorStore.mode;
  const selObj = editorStore.getSelectedObject();

  let totalVerts = 0;
  let totalTris = 0;

  editorStore.objects.forEach(o => {
    if (o.mesh && o.mesh.geometry) {
      const pos = o.mesh.geometry.attributes.position;
      if (pos) {
        totalVerts += pos.count;
        totalTris += pos.count / 3;
      }
    }
  });

  const getTipForMode = () => {
    switch (mode) {
      case 'object':
        return 'Click objects to select. Drag to navigate camera (OrbitControls).';
      case 'edit':
        return 'Select faces in viewport. Click Extrude/Inset/Bevel in Tool Shelf.';
      case 'sculpt':
        return 'Click and drag on mesh surface to sculpt. Adjust brush radius in Tool Shelf.';
      case 'curve':
        return 'Click 3D space to edit curve control points. Click Revolve Lathe to create 3D shape.';
      case 'csg':
        return 'Select Primary (A) and Secondary (B) meshes, then click Execute Boolean.';
      case 'parametric':
        return 'Add SubD, Array, or Mirror modifiers in Property Panel.';
      case 'deform':
        return 'Adjust Twist/Bend sliders or initialize 3x3x3 Lattice Cage.';
      default:
        return 'Ready.';
    }
  };

  return (
    <footer id="status-bar" className="h-6 bg-[#090A0C] border-t border-[#2D3139] text-[#8E9299] text-[9px] px-3 flex items-center justify-between select-none z-20 font-mono">
      <div className="flex items-center space-x-2 truncate">
        <Info className="w-3 h-3 text-[#4A90E2] shrink-0" />
        <span className="text-[#E0E0E0] font-sans text-[10px] truncate">{getTipForMode()}</span>
      </div>

      <div className="flex items-center space-x-4 uppercase shrink-0">
        <div className="flex items-center space-x-1">
          <span className="text-[#8E9299]">Mode:</span>
          <span className="text-[#4A90E2] font-bold">{mode}</span>
        </div>

        <div className="flex items-center space-x-1">
          <span className="text-[#8E9299]">Verts:</span>
          <span className="text-white">{totalVerts.toLocaleString()}</span>
        </div>

        <div className="flex items-center space-x-1">
          <span className="text-[#8E9299]">Tris:</span>
          <span className="text-white">{totalTris.toLocaleString()}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[#8E9299]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4A90E2]"></div>
          <span>FPS: 144</span>
        </div>
      </div>
    </footer>
  );
};
