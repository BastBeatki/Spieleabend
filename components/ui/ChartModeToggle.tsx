import React from 'react';
import { TooltipProps } from 'recharts';

// --- ChartModeToggle Component ---

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ChartModeToggleProps<T extends string> {
  options: [ToggleOption<T>, ToggleOption<T>];
  currentMode: T;
  onChange: (newMode: T) => void;
}

export function ChartModeToggle<T extends string>({ options, currentMode, onChange }: ChartModeToggleProps<T>) {
  const [option1, option2] = options;
  return (
    <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700/80 w-48 text-sm">
      <button
        onClick={() => onChange(option1.value)}
        aria-pressed={currentMode === option1.value}
        className={`px-3 py-1 font-semibold rounded-md transition-colors w-1/2 ${
          currentMode === option1.value
            ? 'bg-slate-700/90 text-slate-100 shadow'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {option1.label}
      </button>
      <button
        onClick={() => onChange(option2.value)}
        aria-pressed={currentMode === option2.value}
        className={`px-3 py-1 font-semibold rounded-md transition-colors w-1/2 ${
          currentMode === option2.value
            ? 'bg-slate-700/90 text-slate-100 shadow'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {option2.label}
      </button>
    </div>
  );
}


// --- CustomChartTooltip Component ---

// The ValueType and NameType are generic types for recharts' TooltipProps.
// Using 'any' here is a pragmatic way to avoid potential deep import issues
// with the UMD build of recharts loaded from the CDN.
export const CustomChartTooltip: React.FC<TooltipProps<any, any>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 p-4 rounded-lg shadow-lg text-sm">
        <p className="label font-bold text-slate-300 mb-2">{`${label}`}</p>
        <div className="space-y-1">
          {payload.map((pld, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pld.color || '#8884d8' }}></span>
                 <span className="text-slate-200">{pld.name}:</span>
              </div>
              <span className="font-bold text-white">{pld.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};
