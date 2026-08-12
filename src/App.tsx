/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Main Application Component (SelfCAD Layout)
 */

import React, { useState, useEffect } from 'react';
import { HeaderBar } from './components/ui/HeaderBar';
import { ToolShelf } from './components/ui/ToolShelf';
import { Viewport3D } from './components/viewport/Viewport3D';
import { PropertyPanel } from './components/ui/PropertyPanel';
import { StatusBar } from './components/ui/StatusBar';
import { InteractivePrimitivePopup } from './components/ui/InteractivePrimitivePopup';
import { editorStore } from './store/EditorStore';
import { addDirectPrimitive } from './core/primitives/interactivePrimitives';

export default function App() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return editorStore.subscribe(() => setTick(t => t + 1));
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0F1113] font-sans text-[#E0E0E0] select-none">
      {/* Top Navigation Bar */}
      <HeaderBar />

      {/* Contextual Icon Tool Shelf */}
      <ToolShelf />

      {/* Main Workspace Area (3D Viewport + Right Inspector Panel) */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Center 3D Viewport with ViewCube and Transform Panel */}
        <Viewport3D />

        {/* Right SelfCAD Inspector Panel (Selection, Outliner, Material, Modifiers) */}
        <PropertyPanel />

        {/* Floating Primitives Popup (Opens ON TOP of Properties panel) */}
        <InteractivePrimitivePopup
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
      </div>

      {/* Bottom Status & Info Bar */}
      <StatusBar />
    </div>
  );
}
