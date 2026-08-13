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
import { useTranslation } from '../../../context/LanguageContext';

interface OptimizationTabProps {
  settings: OptimizationSettings;
  onChange: (updates: Partial<OptimizationSettings>) => void;
}

export const OptimizationTab: React.FC<OptimizationTabProps> = ({ settings, onChange }) => {
  const { t } = useTranslation();
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const handleManualPurge = async () => {
    setIsPurging(true);
    setPurgeStatus(t.common.loading);

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
        `${t.optimization.purgedSuccess} (${stats.geometries} geom, ${stats.materials} mat, ${stats.textures} tex)`
      );
    } catch (err) {
      console.error('Erreur lors de la purge manuelle:', err);
      setPurgeStatus(t.optimization.purgedSuccess);
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
                <h4 className="text-sm font-semibold text-slate-100">{t.optimization.gpuStatus}</h4>
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
            <span>{t.optimization.purgeBtn}</span>
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
            {t.optimization.sectionA}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Vider le cache au démarrage */}
          <SettingsSwitch
            id="opt-clear-startup"
            checked={settings.clearCacheOnStartup}
            onChange={checked => onChange({ clearCacheOnStartup: checked })}
            title={t.optimization.clearStartupTitle}
            description={t.optimization.clearStartupDesc}
            badge={t.optimization.recommended}
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
            title={t.optimization.threeCacheTitle}
            description={t.optimization.threeCacheDesc}
            badge={settings.threeCacheEnabled ? t.optimization.active : t.optimization.disabled}
            badgeColor={settings.threeCacheEnabled ? 'blue' : 'slate'}
            icon={<HardDrive className="w-4 h-4" />}
          />

          {/* Nettoyage agressif de la mémoire GPU (VRAM) */}
          <SettingsSwitch
            id="opt-vram-cleanup"
            checked={settings.aggressiveVRAMCleanup}
            onChange={checked => onChange({ aggressiveVRAMCleanup: checked })}
            title={t.optimization.vramCleanupTitle}
            description={t.optimization.vramCleanupDesc}
            badge={t.optimization.antiLeak}
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
            title={t.optimization.browserCacheTitle}
            description={t.optimization.browserCacheDesc}
            badge="CacheStorage"
            badgeColor="slate"
            icon={<Database className="w-4 h-4" />}
          />

          {/* Cache Busting des fichiers 3D */}
          <SettingsSwitch
            id="opt-cache-busting"
            checked={settings.cacheBusting3D}
            onChange={checked => onChange({ cacheBusting3D: checked })}
            title={t.optimization.cacheBustingTitle}
            description={t.optimization.cacheBustingDesc}
            badge={t.optimization.autoVersion}
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
            {t.optimization.sectionB}
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
            title={t.optimization.ecoShadowsTitle}
            description={t.optimization.ecoShadowsDesc}
            badge={settings.ecoStaticShadows ? t.optimization.ecoStatic : t.optimization.dynamic}
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
                    {t.optimization.fpsLimiterTitle}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                      settings.fpsLimiterEnabled
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    }`}
                  >
                    {settings.fpsLimiterEnabled ? `${settings.fpsLimit.toUpperCase()} FPS` : t.optimization.disabled}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                  {t.optimization.fpsLimiterDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end sm:self-center flex-shrink-0">
              {settings.fpsLimiterEnabled && (
                <div className="flex items-center space-x-1.5 bg-[#181B22] border border-[#2E3442] rounded px-2 py-1">
                  <label htmlFor="fps-limit-select" className="text-xs text-slate-400 font-mono">
                    {t.optimization.fpsTarget} :
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
                    <option value="30">{t.optimization.fpsEco}</option>
                    <option value="60">{t.optimization.fpsFluid}</option>
                    <option value="max">{t.optimization.fpsUnlimited}</option>
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
                <span className="sr-only">{t.optimization.fpsLimiterTitle}</span>
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
            title={t.optimization.antialiasTitle}
            description={t.optimization.antialiasDesc}
            badge={settings.hardwareAntialias ? t.optimization.smoothingActive : t.optimization.rawGain}
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
            title={t.optimization.frustumTitle}
            description={t.optimization.frustumDesc}
            badge={settings.aggressiveFrustumCulling ? t.optimization.frustumActive : t.optimization.disabled}
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
            {t.optimization.sectionC}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Moteur de rendu principal */}
          <SettingsSelect
            id="opt-primary-renderer"
            value={settings.primaryRenderer}
            onChange={val => onChange({ primaryRenderer: val as RendererEngineType })}
            title={t.optimization.primaryRendererTitle}
            description={t.optimization.primaryRendererDesc}
            icon={<Layers className="w-4 h-4" />}
            options={[
              {
                value: 'webgl',
                label: 'WebGLRenderer',
                badge: t.optimization.webglStable,
                description: t.optimization.webglDesc,
              },
              {
                value: 'webgpu',
                label: 'WebGPURenderer',
                badge: t.optimization.webgpuExp,
                description: t.optimization.webgpuDesc,
              },
            ]}
          />

          {/* Puissance maximale du GPU */}
          <SettingsSwitch
            id="opt-high-perf-gpu"
            checked={settings.highPerformanceGPU}
            onChange={checked => onChange({ highPerformanceGPU: checked })}
            title={t.optimization.highPerfTitle}
            description={t.optimization.highPerfDesc}
            badge={t.optimization.dedicatedGPU}
            badgeColor="emerald"
            icon={<Flame className="w-4 h-4" />}
          />

          {/* Multithreading via Workers CPU */}
          <SettingsSwitch
            id="opt-draco-workers"
            checked={settings.dracoWorkerMultithreading}
            onChange={checked => onChange({ dracoWorkerMultithreading: checked })}
            title={t.optimization.dracoWorkersTitle}
            description={t.optimization.dracoWorkersDesc}
            badge={t.optimization.webWorkers}
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
            {t.optimization.sectionD}
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
                      {t.optimization.antiFreezeTitle}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                        settings.antiFreezeDetectorEnabled
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {settings.antiFreezeDetectorEnabled ? t.optimization.workerMonitoring : t.optimization.disabled}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                    {t.optimization.antiFreezeDesc}
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
                  <span className="sr-only">{t.optimization.antiFreezeTitle}</span>
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
                  <span>{t.optimization.heartbeatActive}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-300">
                    {t.optimization.freezesIntercepted} : <strong className="text-rose-400">{antiFreezeDetector.totalFreezesIntercepted}</strong>
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
                    {t.optimization.autoGCTitle}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    Auto-GC
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                  {t.optimization.autoGCDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end sm:self-center">
              {settings.periodicAutoOptimization && (
                <div className="flex items-center space-x-1.5 bg-[#181B22] border border-[#2E3442] rounded px-2 py-1">
                  <span className="text-xs text-slate-400 font-mono">{t.optimization.everyMinutes}</span>
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
                  <span className="text-xs text-slate-400 font-mono">{t.optimization.minUnit}</span>
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
                <span className="sr-only">{t.optimization.autoGCTitle}</span>
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
              <h5 className="font-semibold text-amber-300">{t.optimization.systemTipTitle}</h5>
              <p className="text-amber-200/80 leading-relaxed text-[11px]">
                {t.optimization.systemTipDesc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


