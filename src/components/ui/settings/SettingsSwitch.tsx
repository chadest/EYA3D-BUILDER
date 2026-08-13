/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Accessible Settings Switch Component for CAD/3D Studio
 */

import React from 'react';

interface SettingsSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  badge?: string;
  badgeColor?: 'blue' | 'amber' | 'emerald' | 'purple' | 'slate';
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const SettingsSwitch: React.FC<SettingsSwitchProps> = ({
  id,
  checked,
  onChange,
  title,
  description,
  badge,
  badgeColor = 'blue',
  disabled = false,
  icon,
}) => {
  const getBadgeStyle = () => {
    switch (badgeColor) {
      case 'amber':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'purple':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'slate':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      case 'blue':
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div
      id={`switch-container-${id}`}
      className={`group flex items-start justify-between p-3.5 rounded-lg border transition-all duration-200 ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-[#14161A] border-[#252830]'
          : checked
          ? 'bg-[#181B21] border-[#374151] hover:border-[#4B5563]'
          : 'bg-[#121418] border-[#242830] hover:border-[#323844]'
      }`}
    >
      <div className="flex items-start space-x-3 pr-4">
        {icon && (
          <div
            className={`p-2 rounded-md mt-0.5 transition-colors ${
              checked ? 'bg-blue-500/15 text-blue-400' : 'bg-[#1E222A] text-slate-400'
            }`}
          >
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <label
              htmlFor={id}
              className={`text-sm font-medium select-none cursor-pointer transition-colors ${
                checked ? 'text-slate-100' : 'text-slate-300'
              }`}
            >
              {title}
            </label>
            {badge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${getBadgeStyle()}`}>
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              {description}
            </p>
          )}
        </div>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
          checked ? 'bg-blue-600' : 'bg-[#2A2E39]'
        }`}
      >
        <span className="sr-only">{title}</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
