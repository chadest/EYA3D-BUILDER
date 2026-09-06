/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Main Application Component (SelfCAD Layout)
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HeaderBar } from './components/ui/HeaderBar';
import { ToolShelf } from './components/ui/ToolShelf';
import { Viewport3D } from './components/viewport/Viewport3D';
import { PropertyPanel } from './components/ui/PropertyPanel';
import { StatusBar } from './components/ui/StatusBar';
import { AntiFreezeRescueBanner } from './components/ui/AntiFreezeRescueBanner';
import { editorStore } from './store/EditorStore';
import { addDirectPrimitive } from './core/primitives/interactivePrimitives';

// Lazy-loaded secondary & heavyweight UI modules to optimize initial bundle and boot performance
const LazyInteractivePrimitivePopup = lazy(() =>
  import('./components/ui/InteractivePrimitivePopup').then(module => ({
    default: module.InteractivePrimitivePopup,
  }))
);

const LazySettingsModal = lazy(() =>
  import('./components/ui/settings/SettingsModal').then(module => ({
    default: module.SettingsModal,
  }))
);

export default function App() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  // Global Keyboard Shortcuts (Delete / Backspace / Suppr for deleting selected models)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Suppr') {
        const selObj = editorStore.getSelectedObject();
        if (selObj) {
          e.preventDefault();
          editorStore.removeObject(selObj.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`theme-${editorStore.themeMode} flex flex-col h-screen w-screen overflow-hidden bg-[#0F1113] font-sans text-[#E0E0E0] select-none transition-colors duration-200`}>
      {/* Top Navigation Bar */}
      <HeaderBar />

      {/* Contextual Icon Tool Shelf */}
      <ToolShelf />

      {/* Main Workspace Area (3D Viewport + Right Inspector Panel) */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Floating Notification Toast */}
        {editorStore.notificationToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center space-x-2 px-4 py-2 bg-[#1C1E22]/95 border border-blue-500/40 text-blue-200 text-xs font-medium rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>{editorStore.notificationToast.message}</span>
          </div>
        )}

        {/* Anti-Freeze Emergency Rescue Banner */}
        <AntiFreezeRescueBanner />

        {/* Center 3D Viewport with ViewCube and Transform Panel */}
        <Viewport3D />

        {/* Right SelfCAD Inspector Panel (Selection, Outliner, Material, Modifiers) */}
        <PropertyPanel />

        {/* Floating Primitives Popup (Opens ON TOP of Properties panel) */}
        {editorStore.isPrimitivePopupOpen && (
          <Suspense fallback={null}>
            <LazyInteractivePrimitivePopup
              isOpen={editorStore.isPrimitivePopupOpen}
              onClose={() => {
                editorStore.isPrimitivePopupOpen = false;
                editorStore.notify();
              }}
              activeType={editorStore.drawingPrimitiveType}
              drawingStep={editorStore.drawingStep}
              snapEnabled={editorStore.drawingSnapEnabled}
              snapStep={editorStore.drawingSnapStep}
              isInteractiveMode={editorStore.isInteractiveDrawingMode}
              onToggleInteractiveMode={active => {
                editorStore.isInteractiveDrawingMode = active;
                editorStore.notify();
              }}
              onSelectType={type => {
                editorStore.drawingPrimitiveType = type;
                editorStore.isInteractiveDrawingMode = true;
                editorStore.notify();
              }}
              onAddDirectPrimitive={addDirectPrimitive}
              onToggleSnap={() => {
                editorStore.drawingSnapEnabled = !editorStore.drawingSnapEnabled;
                editorStore.notify();
              }}
              onChangeSnapStep={step => {
                editorStore.drawingSnapStep = step;
                editorStore.notify();
              }}
              onCancelDrawing={() => {
                editorStore.cancelInteractiveDrawing();
              }}
            />
          </Suspense>
        )}

        {/* Global Settings & Optimization Modal */}
        {editorStore.isSettingsModalOpen && (
          <Suspense fallback={null}>
            <LazySettingsModal
              isOpen={editorStore.isSettingsModalOpen}
              onClose={() => editorStore.closeSettings()}
              initialTab={editorStore.settingsInitialTab}
            />
          </Suspense>
        )}
      </div>

      {/* Bottom Status & Info Bar */}
      <StatusBar />
    </div>
  );
}
