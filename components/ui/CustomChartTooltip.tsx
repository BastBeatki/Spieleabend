import React from 'react';

interface TooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
}

export const CustomChartTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 p-3 rounded-lg shadow-lg text-sm transition-all duration-300">
        <p className="font-bold text-slate-300 mb-2">{label}</p>
        <div className="space-y-1">
            {payload.map((pld, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pld.color }}></div>
                    <span className="text-slate-400">{pld.name}:</span>
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
