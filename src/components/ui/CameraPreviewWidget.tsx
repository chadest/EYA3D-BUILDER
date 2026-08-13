import React, { useState } from 'react';
import { Video, X } from 'lucide-react';
import { editorStore } from '../../store/EditorStore';

export const CameraPreviewWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const cameraObj = editorStore.objects.find(obj => obj.type === 'camera');

  if (!editorStore.isRenderMode || !cameraObj) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-950/80 p-2 rounded-xl border border-slate-800 shadow-xl z-50 text-white hover:bg-slate-800 transition-colors"
        title="Prévisualisation Caméra"
      >
        <Video size={20} />
      </button>

      {isOpen && (
        <div className="absolute left-16 top-1/2 -translate-y-1/2 w-64 h-40 bg-black rounded-lg border-2 border-slate-700 overflow-hidden shadow-2xl z-50">
          <div className="absolute top-1 right-1 z-10">
            <button onClick={() => setIsOpen(false)} className="text-white bg-black/50 rounded-full p-1 hover:bg-black/80">
              <X size={12} />
            </button>
          </div>
          {/* PiP content goes here, connected to cameraObj.camera */}
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
            Prévisualisation Caméra: {cameraObj.name}
          </div>
        </div>
      )}
    </>
  );
};
