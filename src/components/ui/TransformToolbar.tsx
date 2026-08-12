import React, { useEffect } from 'react';
import { Move, RotateCw, Maximize2, BoxSelect } from 'lucide-react';
import { editorStore } from '../../store/EditorStore';

export const TransformToolbar: React.FC = () => {
  const gizmoMode = editorStore.gizmoMode;
  const isLassoModeActive = editorStore.isLassoModeActive;
  const [, setForceUpdate] = React.useState({});

  useEffect(() => {
    const unsubscribe = editorStore.subscribe(() => {
      setForceUpdate({});
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'g') {
          editorStore.setGizmoMode('translate');
        } else if (key === 'r') {
          editorStore.setGizmoMode('rotate');
        } else if (key === 's') {
          editorStore.setGizmoMode('scale');
        } else if (key === 'l') {
          editorStore.setLassoModeActive(!editorStore.isLassoModeActive);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-1.5 shadow-2xl space-x-1 select-none">
      <button
        onClick={() => editorStore.setGizmoMode('translate')}
        title="Déplacement (G)"
        className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
          gizmoMode === 'translate'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Move size={18} />
      </button>

      <button
        onClick={() => editorStore.setGizmoMode('rotate')}
        title="Rotation (R)"
        className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
          gizmoMode === 'rotate'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <RotateCw size={18} />
      </button>

      <button
        onClick={() => editorStore.setGizmoMode('scale')}
        title="Mise à l'échelle (S)"
        className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
          gizmoMode === 'scale'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Maximize2 size={18} />
      </button>

      <button
        onClick={() => editorStore.setLassoModeActive(!editorStore.isLassoModeActive)}
        title="Sélection par Lasso / Boîte (L)"
        className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
          isLassoModeActive
            ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30 font-semibold'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <BoxSelect size={18} />
      </button>
    </div>
  );
};
