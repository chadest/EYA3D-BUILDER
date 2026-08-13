/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AntiFreezeRescueBanner - Visual Alert Overlay when a Main Thread Freeze (>1500ms)
 * is intercepted and the session is rescued by emergency GC and graphics downscaling.
 */

import React from 'react';
import {
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  X,
  RotateCcw,
  Zap,
  Cpu,
  Flame,
} from 'lucide-react';
import { editorStore } from '../../store/EditorStore';
import { useTranslation } from '../../context/LanguageContext';

export const AntiFreezeRescueBanner: React.FC = () => {
  const { t } = useTranslation();
  const alertState = editorStore.antiFreezeAlert;

  if (!alertState.isOpen || !alertState.info) {
    return null;
  }

  const { lagDurationMs, thresholdMs, freedGeometries, freedTextures, degradedOptions } = alertState.info;

  return (
    <div
      id="antifreeze-rescue-banner"
      role="alert"
      aria-live="assertive"
      className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl bg-[#13161C]/95 backdrop-blur-md border-2 border-amber-500/70 rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.7)] p-4 text-slate-200 animate-fadeIn"
    >
      <div className="flex items-start space-x-3.5">
        <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex-shrink-0 animate-pulse">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                <span>{t.rescue.freezeIntercepted} ({lagDurationMs}ms)</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                {t.rescue.sessionSaved}
              </span>
            </div>

            <button
              onClick={() => editorStore.dismissAntiFreezeAlert()}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title={t.common.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {t.rescue.freezeDesc} <strong className="text-amber-300 font-mono">{lagDurationMs}ms</strong> :
          </p>

          {/* Rescue Action Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="flex items-center space-x-1.5 bg-[#1C2029] px-2.5 py-1.5 rounded-lg border border-[#2D3342] text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{t.rescue.vramFreed}</span>
            </div>

            <div className="flex items-center space-x-1.5 bg-[#1C2029] px-2.5 py-1.5 rounded-lg border border-[#2D3342] text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t.rescue.shadowsFrozen}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#252B38] mt-2">
            <button
              onClick={() => editorStore.openSettings('optimization')}
              className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              <Cpu className="w-3 h-3" />
              <span>{t.rescue.manageOptions}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => editorStore.restoreGraphicsAfterRescue()}
                className="px-3 py-1.5 text-xs font-medium bg-[#222834] hover:bg-[#2C3444] text-slate-200 border border-[#3A4356] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title={t.rescue.restoreGraphics}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.rescue.restoreGraphics}</span>
              </button>

              <button
                onClick={() => editorStore.dismissAntiFreezeAlert()}
                className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black rounded-lg transition-colors cursor-pointer shadow-md shadow-amber-500/20"
              >
                {t.rescue.continueButton}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
