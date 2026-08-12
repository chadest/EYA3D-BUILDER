import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Trash2, Terminal, TerminalSquare, AlertCircle, Sparkles } from 'lucide-react';
import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';

interface ConsoleLine {
  type: 'log' | 'warn' | 'error' | 'success';
  text: string;
  timestamp: string;
}

const DEFAULT_SCRIPT_BOILERPLATE = `// Script PolyCraft - Manipulez le modèle sélectionné
if (selectedModel) {
  // Exemple : Faire tourner l'objet et doubler sa hauteur
  selectedModel.rotation.y += Math.PI / 4;
  selectedModel.scale.y = 2;
  
  // Si c'est une modification géométrique, on notifie la carte graphique :
  selectedModel.geometry.attributes.position.needsUpdate = true;
  selectedModel.geometry.computeVertexNormals();
  
  console.log("Script exécuté avec succès sur :", selectedModel.name);
} else {
  console.warn("Aucun modèle sélectionné.");
}`;

export function ScriptEditor() {
  const [code, setCode] = useState(DEFAULT_SCRIPT_BOILERPLATE);
  const [consoleOutputs, setConsoleOutputs] = useState<ConsoleLine[]>([
    {
      type: 'success',
      text: 'Console PolyCraft initialisée. Prêt pour l\'exécution de scripts.',
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);

  const selObj = editorStore.getSelectedObject();

  const handleRunScript = () => {
    const outputs: ConsoleLine[] = [];
    
    const addLog = (type: 'log' | 'warn' | 'error' | 'success', text: any) => {
      outputs.push({
        type,
        text: typeof text === 'object' ? JSON.stringify(text) : String(text),
        timestamp: new Date().toLocaleTimeString(),
      });
    };

    // Create a custom mock console to capture user code's output
    const customConsole = {
      log: (...args: any[]) => addLog('log', args.join(' ')),
      warn: (...args: any[]) => addLog('warn', args.join(' ')),
      error: (...args: any[]) => addLog('error', args.join(' ')),
    };

    try {
      const activeScene = editorStore.activeThreeScene;
      const selectedMesh = selObj?.mesh || null;

      if (selectedMesh) {
        // Enforce update flags and name property compatibility
        if (!selectedMesh.name && selObj) {
          selectedMesh.name = selObj.name;
        }
      }

      // Safely construct a new execution context
      const scriptFunction = new Function('THREE', 'scene', 'selectedModel', 'console', `
        "use strict";
        try {
          ${code}
        } catch (e) {
          console.error("Runtime Exception: " + e.message);
          throw e;
        }
      `);

      // Execute the script with our injected live properties
      scriptFunction(THREE, activeScene, selectedMesh, customConsole);

      // Trigger standard React / Three updates
      if (selObj) {
        editorStore.notify();
      }

      setConsoleOutputs(prev => [
        ...prev,
        ...outputs,
        {
          type: 'success',
          text: 'Exécution terminée avec succès.',
          timestamp: new Date().toLocaleTimeString(),
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setConsoleOutputs(prev => [
        ...prev,
        ...outputs,
        {
          type: 'error',
          text: `Erreur fatale: ${err.message || String(err)}`,
          timestamp: new Date().toLocaleTimeString(),
        }
      ]);
    }
  };

  const handleClearConsole = () => {
    setConsoleOutputs([]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] border border-[#2D3139] rounded-lg overflow-hidden select-text pointer-events-auto">
      {/* Code Editor Header Controls */}
      <div className="h-12 bg-[#16181C] border-b border-[#2D3139] px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <TerminalSquare className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wide uppercase text-slate-300">
            Scripting Workspace
          </span>
          {selObj && (
            <span className="text-[10px] bg-[#2D3139] text-[#4A90E2] font-semibold px-2 py-0.5 rounded-full border border-blue-500/20">
              Ancré: {selObj.name}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRunScript}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            title="Exécuter le script (Play)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Exécuter le code</span>
          </button>
        </div>
      </div>

      {/* Main Code Editor Container */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val || '')}
          options={{
            fontSize: 12,
            fontFamily: "Fira Code, JetBrains Mono, source-code-pro, Menlo, Monaco, Consolas, Courier New, monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            tabSize: 2,
          }}
        />
      </div>

      {/* Bottom Scripting Console Terminal */}
      <div className="h-44 bg-[#0F1113] border-t border-[#2D3139] flex flex-col">
        {/* Console Header */}
        <div className="h-8 bg-[#16181C] px-3 flex items-center justify-between border-b border-[#2D3139] select-none">
          <div className="flex items-center space-x-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>Console de Sortie</span>
          </div>
          <button
            onClick={handleClearConsole}
            className="text-[10px] text-slate-500 hover:text-rose-400 font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
            title="Effacer l'historique"
          >
            <Trash2 className="w-3 h-3" />
            <span>Effacer</span>
          </button>
        </div>

        {/* Console logs output terminal container */}
        <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed space-y-1 bg-[#090A0C]">
          {consoleOutputs.length === 0 ? (
            <div className="text-slate-600 italic text-center pt-8">
              Aucun message dans la console. Lancez un script pour voir les logs d'exécution.
            </div>
          ) : (
            consoleOutputs.map((line, index) => (
              <div key={index} className="flex items-start gap-1">
                <span className="text-slate-600 text-[10px] min-w-[55px]">{line.timestamp}</span>
                <span className="text-slate-500 mr-1">|</span>
                
                {line.type === 'error' && (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 inline text-rose-500 shrink-0" />
                    {line.text}
                  </span>
                )}
                {line.type === 'warn' && (
                  <span className="text-amber-400">⚠ {line.text}</span>
                )}
                {line.type === 'success' && (
                  <span className="text-emerald-400 font-bold">✔ {line.text}</span>
                )}
                {line.type === 'log' && (
                  <span className="text-slate-300">⚡ {line.text}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
