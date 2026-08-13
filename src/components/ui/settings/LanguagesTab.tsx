/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Language & Localization Settings Tab
 */

import React from 'react';
import { Languages, Check, Globe } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../../../types/settings';

interface LanguagesTabProps {
  currentLanguage: SupportedLanguage;
  onChangeLanguage: (lang: SupportedLanguage) => void;
}

export const LanguagesTab: React.FC<LanguagesTabProps> = ({ currentLanguage, onChangeLanguage }) => {
  return (
    <div id="settings-tab-languages" className="space-y-6 animate-fadeIn pb-6">
      {/* Header Info */}
      <div className="flex items-center space-x-3 p-4 bg-[#14171E] border border-[#262B37] rounded-xl">
        <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-100">Langue de l'Espace de Travail</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Sélectionnez la langue principale pour l'interface utilisateur, les infobulles CAO et les raccourcis.
          </p>
        </div>
      </div>

      {/* Language Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUPPORTED_LANGUAGES.map(lang => {
          const isSelected = currentLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChangeLanguage(lang.code)}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-blue-950/50 to-[#181E29] border-blue-500/80 shadow-md shadow-blue-500/10'
                  : 'bg-[#121418] border-[#242830] hover:border-[#384050] hover:bg-[#161920]'
              }`}
            >
              <div className="flex items-center space-x-3.5">
                <span className="text-2xl select-none" role="img" aria-label={lang.name}>
                  {lang.flag}
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                    <span>{lang.name}</span>
                    {lang.code === 'fr' && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        Par défaut
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{lang.nativeName}</span>
                </div>
              </div>

              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-[#353A45] bg-[#1A1D24] text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Localization Info Notice */}
      <div className="p-3.5 rounded-lg border border-[#282E3B] bg-[#12151B] text-xs text-slate-400 flex items-center space-x-2">
        <Languages className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span>
          Les modifications linguistiques s'appliquent immédiatement à l'ensemble des modules d'inspection et outils 3D.
        </span>
      </div>
    </div>
  );
};
