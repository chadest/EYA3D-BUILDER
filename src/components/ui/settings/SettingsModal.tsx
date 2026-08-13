/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Settings Modal Component for CAD / 3D Modeling (Three.js)
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Languages,
  SunMoon,
  Keyboard,
  RotateCcw,
  Check,
  Cpu,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import {
  SettingsOptions,
  DEFAULT_OPTIMIZATION_SETTINGS,
  OptimizationSettings,
  ThemeSettings,
  SupportedLanguage,
} from '../../../types/settings';
import { OptimizationTab } from './OptimizationTab';
import { LanguagesTab } from './LanguagesTab';
import { ThemesTab } from './ThemesTab';
import { ShortcutsTab } from './ShortcutsTab';
import { threeOptimizationEngine } from '../../../core/optimization/threeOptimizationEngine';
import { editorStore } from '../../../store/EditorStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'optimization' | 'languages' | 'themes' | 'shortcuts';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'optimization',
}) => {
  // Global Settings State management
  const [activeTab, setActiveTab] = useState<'optimization' | 'languages' | 'themes' | 'shortcuts'>(initialTab);
  
  const [optimizationConfig, setOptimizationConfig] = useState<OptimizationSettings>(() => {
    return { ...DEFAULT_OPTIMIZATION_SETTINGS };
  });

  const [themeConfig, setThemeConfig] = useState<ThemeSettings>(() => ({
    mode: editorStore.themeMode,
    accentColor: '#3b82f6',
    highContrast: false,
    viewportBgStyle: 'dark_charcoal',
  }));

  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('fr');
  const [saveToast, setSaveToast] = useState<boolean>(false);

  // Synchronise le premier affichage et le focus
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Gestion de la touche Échap pour fermer la modale
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Met à jour les paramètres d'optimisation Three.js
  const handleUpdateOptimization = (updates: Partial<OptimizationSettings>) => {
    setOptimizationConfig(prev => {
      const next = { ...prev, ...updates };
      // Branchement direct avec le moteur d'optimisation Three.js
      threeOptimizationEngine.applySettings(
        next,
        editorStore.activeThreeScene,
        editorStore.activeThreeRenderer
      );
      return next;
    });
  };

  // Réinitialiser les paramètres par défaut
  const handleResetDefaults = () => {
    const defaultOpt = { ...DEFAULT_OPTIMIZATION_SETTINGS };
    setOptimizationConfig(defaultOpt);
    threeOptimizationEngine.applySettings(
      defaultOpt,
      editorStore.activeThreeScene,
      editorStore.activeThreeRenderer
    );
    setThemeConfig({
      mode: 'dark',
      accentColor: '#3b82f6',
      highContrast: false,
      viewportBgStyle: 'dark_charcoal',
    });
    editorStore.themeMode = 'dark';
    editorStore.notify();
    setCurrentLanguage('fr');

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleSaveAndClose = () => {
    // Sauvegarder les configurations
    threeOptimizationEngine.applySettings(
      optimizationConfig,
      editorStore.activeThreeScene,
      editorStore.activeThreeRenderer
    );
    onClose();
  };

  if (!isOpen) return null;

  const sidebarTabs: Array<{
    id: 'optimization' | 'languages' | 'themes' | 'shortcuts';
    label: string;
    description: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: 'optimization',
      label: 'Optimisation',
      description: 'VRAM, Cache & Three.js Engine',
      icon: <Zap className="w-4 h-4" />,
      badge: 'GPU',
    },
    {
      id: 'languages',
      label: 'Langues',
      description: 'Localisation & Traductions',
      icon: <Languages className="w-4 h-4" />,
    },
    {
      id: 'themes',
      label: 'Thèmes',
      description: 'Mode Jour / Nuit & Couleurs',
      icon: <SunMoon className="w-4 h-4" />,
    },
    {
      id: 'shortcuts',
      label: 'Raccourcis',
      description: 'Commandes clavier & Hotkeys',
      icon: <Keyboard className="w-4 h-4" />,
    },
  ];

  return (
    <div
      id="settings-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm transition-opacity duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Container */}
      <div
        id="settings-modal-container"
        className="relative w-full max-w-4xl h-[90vh] max-h-[720px] bg-[#101216] border border-[#262B36] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 select-none animate-scaleIn"
      >
        {/* Modal Header */}
        <div className="h-14 px-5 bg-[#14171E] border-b border-[#222733] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>Paramètres de l'Application</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Eya3D Studio v1.0
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Configuration avancée du moteur 3D Three.js, mémoire GPU et espace de travail
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer les paramètres"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#222733] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - 2 Columns (Sidebar Left + Dynamic Content Right) */}
        <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
          {/* Left Sidebar */}
          <div
            id="settings-modal-sidebar"
            className="w-full md:w-64 bg-[#12141A] border-b md:border-b-0 md:border-r border-[#202530] p-3 flex flex-row md:flex-col justify-start space-x-1 md:space-x-0 md:space-y-1.5 overflow-x-auto md:overflow-x-visible flex-shrink-0"
          >
            <div className="hidden md:block px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Catégories
            </div>

            {sidebarTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer whitespace-nowrap md:whitespace-normal group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-medium'
                      : 'text-slate-300 hover:text-white hover:bg-[#1C202A]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}>
                      {tab.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs">{tab.label}</span>
                      <span
                        className={`text-[10px] hidden md:block leading-tight ${
                          isActive ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {tab.description}
                      </span>
                    </div>
                  </div>

                  {tab.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border hidden md:inline-block ${
                        isActive
                          ? 'bg-blue-500/40 text-white border-blue-400/40'
                          : 'bg-[#181B22] text-slate-400 border-[#2D3340]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Sidebar Bottom Diagnostic Widget */}
            <div className="hidden md:block mt-auto pt-4 border-t border-[#1F2430] px-2 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Moteur Three.js</span>
                </span>
                <span className="font-mono text-emerald-400">Prêt</span>
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                VRAM gérée automatiquement par le cycle de vie des maillages.
              </div>
            </div>
          </div>

          {/* Right Dynamic Content Area */}
          <div
            id="settings-modal-content"
            className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0E1014] focus:outline-none"
          >
            {activeTab === 'optimization' && (
              <OptimizationTab settings={optimizationConfig} onChange={handleUpdateOptimization} />
            )}
            {activeTab === 'languages' && (
              <LanguagesTab currentLanguage={currentLanguage} onChangeLanguage={setCurrentLanguage} />
            )}
            {activeTab === 'themes' && (
              <ThemesTab settings={themeConfig} onChange={updates => setThemeConfig(prev => ({ ...prev, ...updates }))} />
            )}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
          </div>
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="h-16 px-5 bg-[#14171E] border-t border-[#222733] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetDefaults}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-[#1E232E] border border-transparent hover:border-[#2D3340] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Valeurs par défaut</span>
            </button>

            {saveToast && (
              <span className="text-xs text-emerald-400 flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                <Check className="w-3.5 h-3.5" />
                <span>Paramètres réinitialisés</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#1A1D24] hover:bg-[#222630] border border-[#2E3442] transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveAndClose}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Appliquer et Fermer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
