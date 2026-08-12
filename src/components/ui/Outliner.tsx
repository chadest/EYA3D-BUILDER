/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Outliner / Scene Hierarchy Panel
 */

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Trash2, Box, Layers, ChevronRight } from 'lucide-react';
import { editorStore } from '../../store/EditorStore';

export const Outliner: React.FC = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  const objects = editorStore.objects;
  const selectedId = editorStore.selectedObjectId;

  return (
    <div id="outliner-panel" className="w-64 bg-[#1C1E22] border-r border-[#2D3139] text-[#E0E0E0] flex flex-col select-none z-10">
      <div className="p-3 border-b border-[#2D3139] flex items-center justify-between bg-[#16181C]">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#4A90E2]" />
          Scene Outliner
        </h2>
        <span className="text-[10px] bg-[#2D3139] border border-[#3D424D] px-2 py-0.5 rounded text-[#8E9299] font-mono">
          {objects.length} Objects
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {objects.length === 0 ? (
          <div className="text-center py-8 text-[#8E9299] text-xs italic">
            No objects in scene. Add a primitive mesh from the top menu.
          </div>
        ) : (
          objects.map(obj => {
            const isSelected = selectedId === obj.id;
            return (
              <div
                key={obj.id}
                onClick={() => editorStore.setSelectedObject(obj.id)}
                className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#2D3139] text-white border border-[#4A90E2] font-bold shadow-sm'
                    : 'hover:bg-[#2D3139]/50 text-[#8E9299] hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <Box className={`w-3.5 h-3.5 ${isSelected ? 'text-[#4A90E2]' : 'text-[#8E9299]'}`} />
                  <span className="truncate">{obj.name}</span>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      obj.visible = !obj.visible;
                      if (obj.mesh) obj.mesh.visible = obj.visible;
                      editorStore.notify();
                    }}
                    className="p-1 text-[#8E9299] hover:text-white transition-colors"
                  >
                    {obj.visible ? <Eye className="w-3.5 h-3.5 text-[#4A90E2]" /> : <EyeOff className="w-3.5 h-3.5 text-gray-600" />}
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      editorStore.removeObject(obj.id);
                    }}
                    className="p-1 text-[#8E9299] hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
