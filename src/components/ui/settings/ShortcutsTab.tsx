/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Keyboard Shortcuts & Hotkeys Settings Tab
 */

import React, { useState, useMemo } from 'react';
import { Keyboard, Search, Command } from 'lucide-react';
import { DEFAULT_SHORTCUTS, ShortcutItem } from '../../../types/settings';

export const ShortcutsTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return DEFAULT_SHORTCUTS;
    const query = searchQuery.toLowerCase();
    return DEFAULT_SHORTCUTS.filter(
      item =>
        item.action.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.shortcut.some(k => k.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // Group by category
  const categories = useMemo(() => {
    const cats: Record<string, ShortcutItem[]> = {};
    filteredShortcuts.forEach(item => {
      if (!cats[item.category]) cats[item.category] = [];
      cats[item.category].push(item);
    });
    return cats;
  }, [filteredShortcuts]);

  return (
    <div id="settings-tab-shortcuts" className="space-y-5 animate-fadeIn pb-6">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher un raccourci clavier (ex: Extrude, Suppr, Ctrl+Z, Gizmo...)"
          className="w-full bg-[#121418] border border-[#242830] focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Shortcuts Category Sections */}
      {Object.keys(categories).length === 0 ? (
        <div className="p-8 text-center bg-[#121418] border border-[#242830] rounded-xl text-slate-400 text-xs">
          Aucun raccourci ne correspond à votre recherche "{searchQuery}".
        </div>
      ) : (
        Object.entries(categories).map(([categoryName, items]) => (
          <div key={categoryName} className="space-y-2">
            <div className="flex items-center space-x-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Command className="w-3.5 h-3.5 text-blue-400" />
              <span>{categoryName}</span>
            </div>

            <div className="bg-[#121418] border border-[#242830] rounded-xl overflow-hidden divide-y divide-[#1D212A]">
              {items.map(item => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-[#161920] transition-colors gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-slate-200">{item.action}</span>
                    {item.description && (
                      <p className="text-[11px] text-slate-400">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0 self-start sm:self-center">
                    {item.shortcut.map((key, idx) => (
                      <kbd
                        key={idx}
                        className="px-2 py-1 text-[11px] font-mono font-semibold bg-[#1C2028] border border-[#343B48] text-slate-200 rounded shadow-sm"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="p-3.5 rounded-lg border border-[#282E3B] bg-[#12151B] text-xs text-slate-400 flex items-center space-x-2">
        <Keyboard className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span>
          Les raccourcis clavier sont actifs dans l'ensemble de l'espace de modélisation 3D (sauf lors de la saisie de texte).
        </span>
      </div>
    </div>
  );
};
