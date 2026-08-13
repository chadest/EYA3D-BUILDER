/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Theme & UI Appearance Settings Tab
 */

import React from 'react';
import { Moon, Sun, Sparkles, Palette, Monitor, Check } from 'lucide-react';
import { ThemeSettings, ThemeStyle } from '../../../types/settings';
import { SettingsSwitch } from './SettingsSwitch';
import { editorStore } from '../../../store/EditorStore';

interface ThemesTabProps {
  settings: ThemeSettings;
  onChange: (updates: Partial<ThemeSettings>) => void;
}

export const ThemesTab: React.FC<ThemesTabProps> = ({ settings, onChange }) => {
  const themes: Array<{
    id: ThemeStyle;
    title: string;
    description: string;
    icon: React.ReactNode;
    previewBg: string;
    previewGrid: string;
    previewAccent: string;
  }> = [
    {
      id: 'dark',
      title: 'Sombre Studio (Dark)',
      description: 'Environnement de travail sombre classique haute lisibilité.',
      icon: <Moon className="w-5 h-5 text-indigo-400" />,
      previewBg: 'bg-[#0F1113]',
      previewGrid: 'border-[#2D3139]',
      previewAccent: 'bg-blue-600',
    },
    {
      id: 'night',
      title: 'Nuit Profonde (Night)',
      description: 'Teinte bleu nuit minuit pour réduire la fatigue oculaire.',
      icon: <Sparkles className="w-5 h-5 text-sky-400" />,
      previewBg: 'bg-[#07090E]',
      previewGrid: 'border-[#1E2638]',
      previewAccent: 'bg-sky-500',
    },
    {
      id: 'light',
      title: 'Mode Jour (Light)',
      description: 'Thème clair haute luminosité pour environnements éclairés.',
      icon: <Sun className="w-5 h-5 text-amber-400" />,
      previewBg: 'bg-[#F4F5F7]',
      previewGrid: 'border-[#D1D5DB]',
      previewAccent: 'bg-blue-600',
    },
  ];

  const handleSelectTheme = (mode: ThemeStyle) => {
    onChange({ mode });
    editorStore.themeMode = mode;
    editorStore.notify();
  };

  const accentColors = [
    { id: '#3b82f6', name: 'Bleu CAO (Défaut)', bg: 'bg-blue-500' },
    { id: '#10b981', name: 'Émeraude Studio', bg: 'bg-emerald-500' },
    { id: '#8b5cf6', name: 'Violet Cyber', bg: 'bg-purple-500' },
    { id: '#f59e0b', name: 'Ambre Chaud', bg: 'bg-amber-500' },
    { id: '#ec4899', name: 'Rose Synthwave', bg: 'bg-pink-500' },
  ];

  return (
    <div id="settings-tab-themes" className="space-y-6 animate-fadeIn pb-6">
      {/* Themes Visual Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Palette & Ambiance Globale
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {themes.map(theme => {
            const isSelected = settings.mode === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectTheme(theme.id)}
                className={`relative flex flex-col p-4 rounded-xl border transition-all text-left cursor-pointer group ${
                  isSelected
                    ? 'bg-[#181C24] border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'bg-[#121418] border-[#242830] hover:border-[#353C4C] hover:bg-[#15181F]'
                }`}
              >
                {/* Visual 3D Canvas Preview Representation */}
                <div
                  className={`w-full h-24 rounded-lg mb-3 ${theme.previewBg} border ${theme.previewGrid} p-2 flex flex-col justify-between overflow-hidden relative shadow-inner`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-2 rounded bg-slate-700/50" />
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    </div>
                  </div>

                  {/* Simulated 3D Cube In Wireframe */}
                  <div className="self-center my-auto flex items-center justify-center">
                    <div
                      className={`w-9 h-9 border border-blue-400/80 rounded rotate-12 transform shadow-md flex items-center justify-center ${
                        theme.id === 'light' ? 'bg-white shadow-slate-300' : 'bg-slate-800/80'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${theme.previewAccent}`} />
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <div className={`w-3 h-1.5 rounded ${theme.previewAccent}`} />
                    <div className="w-6 h-1.5 rounded bg-slate-700/40" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {theme.icon}
                    <span className="text-sm font-semibold text-slate-100">{theme.title}</span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{theme.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Color Customization */}
      <div className="p-4 bg-[#14171E] border border-[#262B37] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Palette className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-slate-200">Couleur d'accentuation des Gizmos & Sélection</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {accentColors.map(color => {
            const isSelected = settings.accentColor === color.id;
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => onChange({ accentColor: color.id })}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1D232F] border-blue-500 text-white'
                    : 'bg-[#101216] border-[#2A2F3B] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full ${color.bg} shadow-sm`} />
                <span>{color.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* High Contrast Mode Switch */}
      <SettingsSwitch
        id="theme-high-contrast"
        checked={settings.highContrast}
        onChange={checked => onChange({ highContrast: checked })}
        title="Mode Contraste Élevé pour les arêtes du maillage"
        description="Amplifie l'épaisseur et la luminosité des bordures filaires polygonales pour une visualisation optimale sur écrans à faible luminance."
        badge="Accessibilité"
        badgeColor="purple"
        icon={<Monitor className="w-4 h-4" />}
      />
    </div>
  );
};
