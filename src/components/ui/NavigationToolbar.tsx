import React, { useEffect } from 'react';
import { Lock, Unlock, Minus, Plus, Hand, ArrowLeft, ArrowRight } from 'lucide-react';
import { editorStore } from '../../store/EditorStore';

export const NavigationToolbar: React.FC = () => {
  const isCameraLocked = editorStore.isCameraLocked;
  const isPanMode = editorStore.isPanMode;
  const [, setForceUpdate] = React.useState({});

  useEffect(() => {
    const unsubscribe = editorStore.subscribe(() => {
      setForceUpdate({});
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-1.5 shadow-2xl space-x-1 select-none">
      {/* Camera Lock / Unlock Button */}
      <button
        onClick={() => editorStore.setCameraLocked(!editorStore.isCameraLocked)}
        title={isCameraLocked ? "Déverrouiller la caméra" : "Verrouiller la caméra sur le plan le plus proche"}
        className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
          isCameraLocked
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {isCameraLocked ? <Lock size={18} /> : <Unlock size={18} />}
      </button>

      {/* Hand / Pan Displacement Mode Toggle */}
      <button
        onClick={() => editorStore.togglePanMode()}
        title={isPanMode ? "Désactiver le mode Déplacement (Main)" : "Mode Déplacement panoramique (Main)"}
        className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
          isPanMode
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Hand size={18} />
      </button>

      {/* Optional Pan Left / Right Displacement Buttons */}
      {isPanMode && (
        <div className="flex items-center space-x-0.5 pl-0.5 pr-0.5 border-l border-r border-white/10 my-1">
          <button
            onClick={() => {
              if (editorStore.onPanLeftCallback) editorStore.onPanLeftCallback();
            }}
            title="Déplacer à gauche"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/15 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <button
            onClick={() => {
              if (editorStore.onPanRightCallback) editorStore.onPanRightCallback();
            }}
            title="Déplacer à droite"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/15 transition-colors"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Zoom Out (-) Button */}
      <button
        onClick={() => {
          if (editorStore.onZoomOutCallback) {
            editorStore.onZoomOutCallback();
          }
        }}
        title="Zoom arrière"
        className="p-2 rounded-lg transition-all duration-200 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
      >
        <Minus size={18} />
      </button>

      {/* Zoom In (+) Button */}
      <button
        onClick={() => {
          if (editorStore.onZoomInCallback) {
            editorStore.onZoomInCallback();
          }
        }}
        title="Zoom avant"
        className="p-2 rounded-lg transition-all duration-200 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
      >
        <Plus size={18} />
      </button>
    </div>
  );
};
