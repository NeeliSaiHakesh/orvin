"use client";
import React from 'react';
import { Sparkles, AlertTriangle, BrainCircuit, Wand2 } from 'lucide-react';

interface StoryStep {
  day: string;
  stage_name: string;
  description: string;
  risk_score: number;
  risk_level: string;
  recalled_count: number;
  summary: string;
  action_taken: string;
  auto_patch_available: boolean;
}

interface StoryModeStepperProps {
  steps: StoryStep[];
  activeStepIndex: number;
  onSelectStep: (index: number) => void;
}

export function StoryModeStepper({ steps, activeStepIndex, onSelectStep }: StoryModeStepperProps) {
  return (
    <div className="w-full bg-[#FFFDF9] rounded-2xl p-5 border border-[#E8E2D5] shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D5]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#B45309]" />
          <h3 className="text-base font-bold text-[#1C1917]">Interactive Story Mode Timeline</h3>
        </div>
        <span className="text-xs text-[#92400E] font-semibold bg-[#FEF3C7] px-3 py-1 rounded-full border border-[#FDE68A]">
          3-Stage Hindsight Memory Evolution
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, idx) => {
          const isActive = idx === activeStepIndex;
          const isDay1 = idx === 0;
          const isDay14 = idx === 1;

          return (
            <button
              key={step.day}
              onClick={() => onSelectStep(idx)}
              className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                isActive
                  ? 'bg-[#FEF3C7]/60 border-[#D97706] shadow-md'
                  : 'bg-[#FAF7F0] border-[#E8E2D5] hover:border-[#D6CEBE] hover:bg-[#F5EFE0]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    isDay1 ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' :
                    isDay14 ? 'bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]' :
                    'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                  }`}>
                    {step.day}
                  </span>
                  {isActive && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] animate-pulse"></span>
                  )}
                </div>

                <h4 className="font-bold text-sm text-[#1C1917] mb-1 flex items-center gap-1.5">
                  {isDay1 && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                  {isDay14 && <BrainCircuit className="w-4 h-4 text-purple-600 shrink-0" />}
                  {!isDay1 && !isDay14 && <Wand2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {step.stage_name}
                </h4>

                <p className="text-xs text-[#57534E] leading-relaxed mb-3">
                  {step.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#E8E2D5] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#78716C]">Risk Assessment:</span>
                  <span className={`font-bold ${step.risk_score >= 80 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {step.risk_score}% ({step.risk_level})
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#78716C]">Recalled Memories:</span>
                  <span className="font-bold text-[#92400E]">{step.recalled_count} incidents</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
