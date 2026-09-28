"use client";
import React, { useState } from 'react';
import { FileCode, Check, Copy, Wand2, Sparkles } from 'lucide-react';

interface IncidentDiffViewerProps {
  diff: string;
  suggestedPatch: string | null;
  rule: string | null;
  onApplyPatch?: () => void;
}

export function IncidentDiffViewer({ diff, suggestedPatch, rule, onApplyPatch }: IncidentDiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'patch'>('diff');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-[#FFFDF9] rounded-2xl p-5 border border-[#E8E2D5] shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D5]">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-amber-700" />
          <h3 className="text-base font-bold text-[#1C1917]">PR Code Diff & Hindsight Auto-Patch</h3>
        </div>

        {suggestedPatch && (
          <div className="flex items-center gap-1 bg-[#FAF7F0] p-1 rounded-xl border border-[#E8E2D5]">
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'diff' ? 'bg-[#1C1917] text-white shadow' : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              PR Diff
            </button>
            <button
              onClick={() => setActiveTab('patch')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'patch' ? 'bg-gradient-to-r from-amber-700 to-amber-900 text-white shadow' : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              Auto-Patch
            </button>
          </div>
        )}
      </div>

      {rule && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
            <span><strong className="text-purple-950">Hindsight Rule Enforced:</strong> {rule}</span>
          </div>
        </div>
      )}

      {activeTab === 'diff' ? (
        <div className="relative">
          <pre className="font-mono text-xs p-4 rounded-xl bg-[#1C1917] border border-[#292524] overflow-x-auto text-[#E7E5E4] leading-relaxed max-h-[320px]">
            {diff.split('\n').map((line, i) => {
              let bg = '';
              let textColor = 'text-[#E7E5E4]';
              if (line.startsWith('+')) {
                bg = 'bg-emerald-950/60';
                textColor = 'text-emerald-400 font-semibold';
              } else if (line.startsWith('-')) {
                bg = 'bg-rose-950/60';
                textColor = 'text-rose-400 font-semibold';
              } else if (line.startsWith('@@')) {
                textColor = 'text-amber-400 font-bold';
              }
              return (
                <div key={i} className={`${bg} px-2 py-0.5 rounded`}>
                  <span className={textColor}>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-900 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              Unified Git Diff Auto-Patch generated via Groq & Hindsight Memory
            </span>
            {suggestedPatch && (
              <button
                onClick={() => copyToClipboard(suggestedPatch)}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#1C1917] hover:bg-[#292524] rounded-lg text-xs font-semibold text-white transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Patch'}
              </button>
            )}
          </div>
          <pre className="font-mono text-xs p-4 rounded-xl bg-[#064E3B]/10 border border-[#059669]/30 overflow-x-auto text-[#065F46] font-semibold leading-relaxed max-h-[320px]">
            {suggestedPatch || '# Generating patch...'}
          </pre>
        </div>
      )}
    </div>
  );
}
