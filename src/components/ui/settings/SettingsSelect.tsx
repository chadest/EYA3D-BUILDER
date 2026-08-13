/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Accessible Settings Select Component for CAD/3D Studio
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
}

interface SettingsSelectProps {
  id: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export const SettingsSelect: React.FC<SettingsSelectProps> = ({
  id,
  value,
  options,
  onChange,
  title,
  description,
  icon,
}) => {
  return (
    <div
      id={`select-container-${id}`}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border bg-[#121418] border-[#242830] hover:border-[#323844] transition-all duration-200 gap-3"
    >
      <div className="flex items-start space-x-3 pr-2">
        {icon && (
          <div className="p-2 rounded-md mt-0.5 bg-[#1E222A] text-blue-400">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor={id} className="text-sm font-medium text-slate-200 select-none cursor-pointer">
            {title}
          </label>
          {description && (
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="relative min-w-[200px] self-end sm:self-center">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-[#1C2028] border border-[#353B47] text-slate-100 text-xs rounded-md pl-3 pr-8 py-2 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-[#16181D] text-slate-200 py-1">
              {opt.label} {opt.badge ? `(${opt.badge})` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
};
