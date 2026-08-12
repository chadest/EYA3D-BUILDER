/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Main Application Component (SelfCAD Layout)
 */

import React from 'react';
import { HeaderBar } from './components/ui/HeaderBar';
import { ToolShelf } from './components/ui/ToolShelf';
import { Viewport3D } from './components/viewport/Viewport3D';
import { PropertyPanel } from './components/ui/PropertyPanel';
import { StatusBar } from './components/ui/StatusBar';

export default function App() {
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
      </div>

      {/* Bottom Status & Info Bar */}
      <StatusBar />
    </div>
  );
}
