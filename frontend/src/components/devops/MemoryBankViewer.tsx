"use client";
import React, { useState } from 'react';
import { Database, Search, ShieldCheck, Clock } from 'lucide-react';

interface MemoryItem {
  id: string;
  timestamp: string;
  title: string;
  category: string;
  summary: string;
  prevention_rule: string;
  severity: string;
  recall_score?: number;
}

interface MemoryBankViewerProps {
  memories: MemoryItem[];
}

export function MemoryBankViewer({ memories }: MemoryBankViewerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filtered = memories.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
                          m.summary.toLowerCase().includes(search.toLowerCase()) ||
                          m.prevention_rule.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="w-full bg-[#FFFDF9] rounded-2xl p-5 border border-[#E8E2D5] shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8E2D5]">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-700" />
          <div>
            <h3 className="text-base font-bold text-[#1C1917]">Hindsight Cloud Memory Bank</h3>
            <p className="text-xs text-[#78716C]">Filterable memory store of post-mortems, stack traces, and synthesized rules</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search post-mortems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-[#FAF7F0] border border-[#E8E2D5] rounded-xl text-xs text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-purple-600 w-48"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-[#FAF7F0] border border-[#E8E2D5] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-purple-600"
          >
            <option value="all">All Categories</option>
            <option value="dependency">Dependencies</option>
            <option value="hardware_oom">GPU / OOM</option>
            <option value="secret_drift">Secret Drift</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-[#78716C] text-xs">
            No incident memories found matching search filter.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E8E2D5] hover:border-purple-300 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                      {item.category}
                    </span>
                    <span className="text-xs text-[#78716C] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#A8A29E]" />
                      {item.timestamp}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-[#1C1917]">{item.title}</h4>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-1 rounded border border-amber-200">
                    Recall: {Math.round((item.recall_score || 0.95) * 100)}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#44403C] leading-relaxed bg-[#FFFDF9] p-2.5 rounded-lg border border-[#E8E2D5]">
                {item.summary}
              </p>

              <div className="flex items-center gap-2 text-xs text-emerald-900 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
                <span><strong className="text-emerald-950">Prevention Rule:</strong> {item.prevention_rule}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
