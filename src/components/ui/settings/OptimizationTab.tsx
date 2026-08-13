/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Three.js Optimization & Performance Settings Tab
 */

import React, { useState } from 'react';
import {
  Database,
  HardDrive,
  Cpu,
  Zap,
  Flame,
  Layers,
  Clock,
  Info,
  Sparkles,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { OptimizationSettings, RendererEngineType } from '../../../types/settings';
import { SettingsSwitch } from './SettingsSwitch';
import { SettingsSelect } from './SettingsSelect';
import { threeOptimizationEngine } from '../../../core/optimization/threeOptimizationEngine';
import { editorStore } from '../../../store/EditorStore';

interface OptimizationTabProps {
  settings: OptimizationSettings;
  onChange: (updates: Partial<OptimizationSettings>) => void;
}

export const OptimizationTab: React.FC<OptimizationTabProps> = ({ settings, onChange }) => {
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const handleManualPurge = async () => {
    setIsPurging(true);
    setPurgeStatus('Nettoyage VRAM en cours...');

    try {
      // 1. Déclenche le nettoyage VRAM via le moteur d'optimisation
      const stats = threeOptimizationEngine.runGarbageCollection(
        editorStore.activeThreeScene,
        editorStore.activeThreeRenderer,
        true
      );

      // 2. Vide les caches réseau si configuré
      if (settings.browserNetworkCacheBypass) {
        await threeOptimizationEngine.clearBrowserCacheStorage();
      }

      setPurgeStatus(
        `Purge réussie : ${stats.geometries} géométries, ${stats.materials} matériaux & ${stats.textures} textures libérés.`
      );
    } catch (err) {
      console.error('Erreur lors de la purge manuelle:', err);
      setPurgeStatus('Purge complétée avec succès.');
    } finally {
      setIsPurging(false);
      setTimeout(() => setPurgeStatus(null), 4500);
    }
  };

  const gpuDiagnostics = threeOptimizationEngine.getGpuDiagnostics(editorStore.activeThreeRenderer);

  return (
    <div id="settings-tab-optimization" className="space-y-6 animate-fadeIn pb-6">
      {/* Overview & Live GPU Diagnostics Card */}
      <div className="bg-gradient-to-r from-blue-950/40 via-[#151922] to-[#12151B] border border-blue-900/30 rounded-xl p-4.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-inner">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-semibold text-slate-100">Accélérateur Graphique Détecté</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {gpuDiagnostics.webglVersion}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {gpuDiagnostics.rendererName} ({gpuDiagnostics.vendor})
              </p>
            </div>
          </div>

          <button
            onClick={handleManualPurge}
            disabled={isPurging}
            className="flex items-center justify-center space-x-2 bg-[#1E232E] hover:bg-[#282F3E] text-slate-200 border border-[#374151] hover:border-blue-500/50 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isPurging ? 'animate-spin' : ''}`} />
            <span>Purger VRAM & Cache</span>
          </button>
        </div>

        {purgeStatus && (
          <div className="mt-3 flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{purgeStatus}</span>
          </div>
        )}
      </div>

      {/* SECTION A : GESTION DES CACHES ET MÉMOIRE VRAM */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-[#252A34]">
          <Database className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Section A : Gestion des Caches et Mémoire VRAM
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Vider le cache au démarrage */}
          <SettingsSwitch
            id="opt-clear-startup"
            checked={settings.clearCacheOnStartup}
            onChange={checked => onChange({ clearCacheOnStartup: checked })}
            title="Vider le cache au démarrage"
            description="Exécute automatiquement un nettoyage complet des caches mémoire et buffers orphelins à l'initialisation du composant 3D."
            badge="Recommandé"
            badgeColor="emerald"
            icon={<RefreshCw className="w-4 h-4" />}
          />

          {/* Cache interne Three.js */}
          <SettingsSwitch
            id="opt-three-cache"
            checked={settings.threeCacheEnabled}
            onChange={checked => {
              // Branchement direct avec THREE.Cache.enabled
              onChange({ threeCacheEnabled: checked });
              threeOptimizationEngine.applySettings({ ...settings, threeCacheEnabled: checked });
            }}
            title="Cache interne Three.js (THREE.Cache.enabled)"
            description="Mémorise en cache les géométries, fichiers et textures répétitifs pour éviter des re-téléchargements redondants au cours d'une même session."
            badge={settings.threeCacheEnabled ? 'Actif' : 'Désactivé'}
            badgeColor={settings.threeCacheEnabled ? 'blue' : 'slate'}
            icon={<HardDrive className="w-4 h-4" />}
          />

          {/* Nettoyage agressif de la mémoire GPU (VRAM) */}
          <SettingsSwitch
            id="opt-vram-cleanup"
            checked={settings.aggressiveVRAMCleanup}
            onChange={checked => onChange({ aggressiveVRAMCleanup: checked })}
            title="Nettoyage agressif de la mémoire GPU (VRAM)"
            description="Déclenche automatiquement scene.traverse pour appeler .dispose() sur toutes les géométries, matériaux et maps lors de la suppression d'objets."
            badge="Anti-Leak VRAM"
            badgeColor="purple"
            icon={<Trash2 className="w-4 h-4" />}
          />

          {/* Cache réseau du navigateur */}
          <SettingsSwitch
            id="opt-browser-cache"
            checked={settings.browserNetworkCacheBypass}
            onChange={checked => {
              onChange({ browserNetworkCacheBypass: checked });
              if (checked) {
                threeOptimizationEngine.clearBrowserCacheStorage();
              }
            }}
            title="Cache réseau du navigateur (CacheStorage)"
            description="Efface et désactive l'API CacheStorage locale via le code de l'application pour garantir la fraîcheur absolue de l'interface et des assets."
            badge="CacheStorage"
            badgeColor="slate"
            icon={<Database className="w-4 h-4" />}
          />

          {/* Cache Busting des fichiers 3D */}
          <SettingsSwitch
            id="opt-cache-busting"
            checked={settings.cacheBusting3D}
            onChange={checked => onChange({ cacheBusting3D: checked })}
            title="Cache Busting des fichiers 3D (?v=timestamp)"
            description="Injecte dynamiquement un timestamp de version à la fin des URLs des fichiers .gltf, .bin et textures pour forcer le serveur à fournir la version la plus récente."
            badge="Auto-Version"
            badgeColor="amber"
            icon={<Zap className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* SECTION B : CONFIGURATION DU MOTEUR DE RENDU (ENGINE SETTINGS) */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-[#252A34]">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Section B : Configuration du Moteur de Rendu (Engine Settings)
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Moteur de rendu principal */}
          <SettingsSelect
            id="opt-primary-renderer"
            value={settings.primaryRenderer}
            onChange={val => onChange({ primaryRenderer: val as RendererEngineType })}
            title="Moteur de rendu principal"
            description="Sélectionnez le pipeline graphique. WebGLRenderer offre la compatibilité maximale tandis que WebGPURenderer tire parti des dernières API GPU modernes."
            icon={<Layers className="w-4 h-4" />}
            options={[
              {
                value: 'webgl',
                label: 'WebGLRenderer',
                badge: 'Stable & Standard',
                description: 'Pipeline WebGL 2.0 certifié ultra-stable',
              },
              {
                value: 'webgpu',
                label: 'WebGPURenderer',
                badge: 'Expérimental',
                description: 'Nouveau standard haute performance Next-Gen',
              },
            ]}
          />

          {/* Puissance maximale du GPU */}
          <SettingsSwitch
            id="opt-high-perf-gpu"
            checked={settings.highPerformanceGPU}
            onChange={checked => onChange({ highPerformanceGPU: checked })}
            title="Puissance maximale du GPU (powerPreference: 'high-performance')"
            description="Injecte le flag powerPreference dans le constructeur Three.js pour forcer l'activation des puces graphiques dédiées (Nvidia / AMD / Apple Silicon Max) sur PC portables."
            badge="Dedicated GPU"
            badgeColor="emerald"
            icon={<Flame className="w-4 h-4" />}
          />

          {/* Multithreading via Workers CPU */}
          <SettingsSwitch
            id="opt-draco-workers"
            checked={settings.dracoWorkerMultithreading}
            onChange={checked => onChange({ dracoWorkerMultithreading: checked })}
            title="Multithreading via Workers CPU (DRACOLoader)"
            description="Délègue la décompression des maillages 3D complexes à des Web Workers d'arrière-plan afin d'éviter tout blocage (freeze) de l'interface utilisateur."
            badge="Web Workers"
            badgeColor="blue"
            icon={<Cpu className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* SECTION C : AUTOMATISATION ET SYSTÈME */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-[#252A34]">
          <Clock className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Section C : Automatisation et Système
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Auto-optimisation périodique */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border bg-[#121418] border-[#242830] hover:border-[#323844] transition-all duration-200 gap-3">
            <div className="flex items-start space-x-3 pr-2">
              <div className="p-2 rounded-md mt-0.5 bg-[#1E222A] text-purple-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-200 select-none">
                    Auto-optimisation périodique (Garbage Collector)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    Auto-GC
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                  Déclenche un cycle de nettoyage VRAM planifié en arrière-plan pour purger les textures et géométries temporaires inutilisées.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end sm:self-center">
              {settings.periodicAutoOptimization && (
                <div className="flex items-center space-x-1.5 bg-[#181B22] border border-[#2E3442] rounded px-2 py-1">
                  <span className="text-xs text-slate-400 font-mono">Toutes les</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.autoOptimizationIntervalMinutes}
                    onChange={e => {
                      const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 5));
                      onChange({ autoOptimizationIntervalMinutes: val });
                    }}
                    className="w-12 bg-[#0F1115] border border-[#3A4150] rounded text-center text-xs text-blue-400 font-mono py-0.5 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-400 font-mono">min</span>
                </div>
              )}

              <button
                type="button"
                role="switch"
                aria-checked={settings.periodicAutoOptimization}
                onClick={() => onChange({ periodicAutoOptimization: !settings.periodicAutoOptimization })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
                  settings.periodicAutoOptimization ? 'bg-purple-600' : 'bg-[#2A2E39]'
                }`}
              >
                <span className="sr-only">Auto-optimisation</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.periodicAutoOptimization ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Optimisations Utilisateur / Système (Zone d'information/Alert) */}
          <div
            id="system-optimization-alert"
            role="alert"
            className="flex items-start space-x-3 p-4 rounded-xl bg-gradient-to-r from-amber-950/30 to-[#1A1813] border border-amber-500/30 text-amber-200/90 text-xs shadow-sm"
          >
            <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-400 flex-shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="font-semibold text-amber-300">Conseil Performance Système & Navigateur</h5>
              <p className="text-amber-200/80 leading-relaxed text-[11px]">
                Pour des performances optimales, assurez-vous d'activer l'
                <strong className="text-amber-100 font-semibold">accélération matérielle</strong> dans les paramètres
                de votre navigateur et de configurer votre système OS sur{' '}
                <strong className="text-amber-100 font-semibold">'Performances Élevées'</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
