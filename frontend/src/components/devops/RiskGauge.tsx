"use client";
import React from 'react';

interface RiskGaugeProps {
  score: number; // 0 - 100
  level: string; // LOW, MEDIUM, HIGH, CRITICAL
}

export function RiskGauge({ score, level }: RiskGaugeProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return { stroke: '#E11D48', text: 'text-rose-700', bg: 'bg-rose-100/70 text-rose-900 border-rose-200' };
    if (s >= 50) return { stroke: '#D97706', text: 'text-amber-800', bg: 'bg-amber-100/70 text-amber-900 border-amber-200' };
    return { stroke: '#059669', text: 'text-emerald-800', bg: 'bg-emerald-100/70 text-emerald-900 border-emerald-200' };
  };

  const theme = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[#FFFDF9] rounded-2xl border border-[#E8E2D5] shadow-sm relative overflow-hidden">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="text-[#EFEBE0]"
            strokeWidth="10"
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            strokeWidth="10"
            stroke={theme.stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`text-3xl font-extrabold ${theme.text}`}>
            {score}%
          </span>
          <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider">Blast Radius</span>
        </div>
      </div>
      <div className={`mt-3 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${theme.bg}`}>
        Risk Level: {level}
      </div>
    </div>
  );
}
