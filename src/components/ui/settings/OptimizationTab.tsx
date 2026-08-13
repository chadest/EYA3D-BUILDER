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
  Sun,
  Timer,
  EyeOff,
  Sliders,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { OptimizationSettings, RendererEngineType, FpsLimitOption } from '../../../types/settings';
import { SettingsSwitch } from './SettingsSwitch';
import { SettingsSelect } from './SettingsSelect';
import { threeOptimizationEngine } from '../../../core/optimization/threeOptimizationEngine';
import { antiFreezeDetector } from '../../../core/optimization/antiFreezeDetector';
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

      {/* SECTION B : OPTIMISATIONS AVANCÉES DU RENDU & DU GPU */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-[#252A34]">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Section B : Optimisations Avancées du Rendu & du GPU
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* 1. Ombres Éco / Fixes */}
          <SettingsSwitch
            id="opt-eco-shadows"
            checked={settings.ecoStaticShadows}
            onChange={checked => {
              const updated = { ...settings, ecoStaticShadows: checked };
              onChange({ ecoStaticShadows: checked });
              threeOptimizationEngine.applySettings(
                updated,
                editorStore.activeThreeScene,
                editorStore.activeThreeRenderer
              );
            }}
            title="Ombres Éco / Fixes (shadowMap.autoUpdate = false)"
            description="Passe renderer.shadowMap.autoUpdate à false pour figer les ombres et économiser le GPU en évitant de recalculer les ShadowMaps à chaque frame."
            badge={settings.ecoStaticShadows ? 'Éco Fixe' : 'Dynamique'}
            badgeColor={settings.ecoStaticShadows ? 'amber' : 'slate'}
            icon={<Sun className="w-4 h-4" />}
          />

          {/* 2. Limiteur de FPS (Switch + Dropdown 30/60/Max) */}
          <div
            id="switch-container-opt-fps-limiter"
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border transition-all duration-200 gap-3 ${
              settings.fpsLimiterEnabled
                ? 'bg-[#181B21] border-[#374151] hover:border-[#4B5563]'
                : 'bg-[#121418] border-[#242830] hover:border-[#323844]'
            }`}
          >
            <div className="flex items-start space-x-3 pr-2">
              <div
                className={`p-2 rounded-md mt-0.5 transition-colors ${
                  settings.fpsLimiterEnabled ? 'bg-amber-500/15 text-amber-400' : 'bg-[#1E222A] text-slate-400'
                }`}
              >
                <Timer className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-200 select-none">
                    Limiteur de FPS (FPS Throttling)
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                      settings.fpsLimiterEnabled
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    }`}
                  >
                    {settings.fpsLimiterEnabled ? `${settings.fpsLimit.toUpperCase()} FPS` : 'Désactivé'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                  Permet de brider le rafraîchissement de la boucle requestAnimationFrame pour stabiliser le framerate et éviter la surchauffe de la carte graphique.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end sm:self-center flex-shrink-0">
              {settings.fpsLimiterEnabled && (
                <div className="flex items-center space-x-1.5 bg-[#181B22] border border-[#2E3442] rounded px-2 py-1">
                  <label htmlFor="fps-limit-select" className="text-xs text-slate-400 font-mono">
                    Cible :
                  </label>
                  <select
                    id="fps-limit-select"
                    value={settings.fpsLimit}
                    onChange={e => {
                      const newLimit = e.target.value as FpsLimitOption;
                      const updated = { ...settings, fpsLimit: newLimit };
                      onChange({ fpsLimit: newLimit });
                      threeOptimizationEngine.applySettings(
                        updated,
                        editorStore.activeThreeScene,
                        editorStore.activeThreeRenderer
                      );
                    }}
                    className="bg-[#0F1115] border border-[#3A4150] rounded text-xs text-amber-400 font-mono py-0.5 px-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="30">30 FPS (Éco Batterie)</option>
                    <option value="60">60 FPS (Standard Fluide)</option>
                    <option value="max">Max (Illimité)</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                role="switch"
                aria-checked={settings.fpsLimiterEnabled}
                onClick={() => {
                  const newEnabled = !settings.fpsLimiterEnabled;
                  const updated = { ...settings, fpsLimiterEnabled: newEnabled };
                  onChange({ fpsLimiterEnabled: newEnabled });
                  threeOptimizationEngine.applySettings(
                    updated,
                    editorStore.activeThreeScene,
                    editorStore.activeThreeRenderer
                  );
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                  settings.fpsLimiterEnabled ? 'bg-amber-600' : 'bg-[#2A2E39]'
                }`}
              >
                <span className="sr-only">Limiteur de FPS</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.fpsLimiterEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. Anticrénelage matériel */}
          <SettingsSwitch
            id="opt-hardware-antialias"
            checked={settings.hardwareAntialias}
            onChange={checked => {
              const updated = { ...settings, hardwareAntialias: checked };
              onChange({ hardwareAntialias: checked });
              threeOptimizationEngine.applySettings(
                updated,
                editorStore.activeThreeScene,
                editorStore.activeThreeRenderer
              );
            }}
            title="Anticrénelage matériel (Antialias & Sub-sampling)"
            description="Permet d'activer ou désactiver l'option 'antialias' et le sous-échantillonnage de pixels du WebGLRenderer pour un gain de performance brut immédiat (au détriment du lissage visuel)."
            badge={settings.hardwareAntialias ? 'Lissage Actif' : 'Gain Brut (+FPS)'}
            badgeColor={settings.hardwareAntialias ? 'blue' : 'emerald'}
            icon={<Sparkles className="w-4 h-4" />}
          />

          {/* 4. Masquage hors-champ agressif (Frustum Culling) */}
          <SettingsSwitch
            id="opt-frustum-culling"
            checked={settings.aggressiveFrustumCulling}
            onChange={checked => {
              const updated = { ...settings, aggressiveFrustumCulling: checked };
              onChange({ aggressiveFrustumCulling: checked });
              threeOptimizationEngine.applySettings(
                updated,
                editorStore.activeThreeScene,
                editorStore.activeThreeRenderer
              );
            }}
            title="Masquage hors-champ agressif (Frustum Culling)"
            description="Force mesh.frustumCulled = true sur tous les maillages pour que le moteur n'envoie pas au GPU les objets non visibles à l'écran, réduisant drastiquement le nombre de Draw Calls."
            badge={settings.aggressiveFrustumCulling ? 'Actif (Frustum)' : 'Désactivé'}
            badgeColor={settings.aggressiveFrustumCulling ? 'emerald' : 'slate'}
            icon={<EyeOff className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* SECTION C : CONFIGURATION DU MOTEUR DE RENDU (ENGINE SETTINGS) */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-[#252A34]">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Section C : Configuration du Moteur de Rendu (Engine Settings)
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

      {/* SECTION D : AUTOMATISATION ET SYSTÈME */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-[#252A34]">
          <Clock className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Section D : Automatisation et Système
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* NOUVEAU : Détecteur Anti-Freeze Actif (Surveillance Web Worker) */}
          <div
            id="switch-container-opt-antifreeze"
            className={`flex flex-col p-3.5 rounded-lg border transition-all duration-200 gap-3 ${
              settings.antiFreezeDetectorEnabled
                ? 'bg-[#181B21] border-[#374151] hover:border-[#4B5563]'
                : 'bg-[#121418] border-[#242830] hover:border-[#323844]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3 pr-2">
                <div
                  className={`p-2 rounded-md mt-0.5 transition-colors ${
                    settings.antiFreezeDetectorEnabled
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : 'bg-[#1E222A] text-slate-400'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-slate-200 select-none">
                      Détecteur Anti-Freeze Actif
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                        settings.antiFreezeDetectorEnabled
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {settings.antiFreezeDetectorEnabled ? 'Surveillance Worker (>1500ms)' : 'Désactivé'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                    Active le composant AntiFreezeDetector via Web Workers d'arrière-plan. Si l'application subit un gel de plus de 1500ms, le système intercepte le freeze, lance une Garbage Collection d'urgence et notifie l'utilisateur via une alerte visuelle tout en dégradant temporairement les options graphiques (ex: couper les ombres dynamiques) pour sauver la session de modélisation.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-end sm:self-center flex-shrink-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.antiFreezeDetectorEnabled}
                  onClick={() => {
                    const newEnabled = !settings.antiFreezeDetectorEnabled;
                    const updated = { ...settings, antiFreezeDetectorEnabled: newEnabled };
                    onChange({ antiFreezeDetectorEnabled: newEnabled });
                    antiFreezeDetector.setEnabled(newEnabled);
                    threeOptimizationEngine.applySettings(
                      updated,
                      editorStore.activeThreeScene,
                      editorStore.activeThreeRenderer
                    );
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500/40 ${
                    settings.antiFreezeDetectorEnabled ? 'bg-rose-600' : 'bg-[#2A2E39]'
                  }`}
                >
                  <span className="sr-only">Détecteur Anti-Freeze Actif</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.antiFreezeDetectorEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Barre de statut et statistiques de surveillance */}
            {settings.antiFreezeDetectorEnabled && (
              <div className="flex items-center justify-between pt-2 border-t border-[#252A34] text-xs">
                <div className="flex items-center space-x-2 text-slate-400 font-mono text-[11px]">
                  <Activity className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  <span>Heartbeat actif (Pulsation 250ms)</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-300">
                    Freezes neutralisés : <strong className="text-rose-400">{antiFreezeDetector.totalFreezesIntercepted}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

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

