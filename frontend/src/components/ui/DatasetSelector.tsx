"use client";
import React from 'react';
import { Database, ChevronDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Dataset {
  id: string;
  filename: string;
  file_type?: string;
  version?: number;
  row_count?: number | null;
  column_count?: number | null;
  uploaded_at?: string;
}

interface DatasetSelectorProps {
  datasets: Dataset[];
  selectedDatasetId: string | null;
  onSelect: (datasetId: string) => void;
  projectId: string;
  label?: string;
}

export function DatasetSelector({
  datasets = [],
  selectedDatasetId,
  onSelect,
  projectId,
  label = "Active Dataset"
}: DatasetSelectorProps) {
  if (!datasets || datasets.length === 0) {
    return (
      <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm shadow-sm text-[#0f172a]">
        <div className="flex items-center gap-2 text-amber-950 font-semibold">
          <Database className="w-4 h-4 shrink-0 text-amber-700" />
          <span>No datasets uploaded for this project yet.</span>
        </div>
        <Link 
          href={`/projects/${projectId}/datasets`}
          className="px-3.5 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 border border-amber-400 text-amber-950 text-xs font-bold transition-colors"
        >
          Upload Dataset
        </Link>
      </div>
    );
  }

  const activeDataset = datasets.find(d => d.id === selectedDatasetId) || datasets[0];
  const hasMultiple = datasets.length > 1;

  const getStageLabel = (d: Dataset) => {
    if (d.filename?.includes('_features') || (d as any).status === 'features_engineered') return 'Features';
    if (d.filename?.includes('_cleaned') || (d as any).status === 'cleaned') return 'Cleaned';
    return 'Raw Analyzed';
  };

  return (
    <div className="p-4 rounded-2xl border border-[#E2DCD0] bg-[#FFFDF9] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-[#0f172a]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] flex items-center justify-center text-[#0f172a] shrink-0 font-bold">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">{label}:</span>
            <span className="font-extrabold text-[#0f172a] text-sm sm:text-base truncate max-w-[220px] sm:max-w-xs" title={activeDataset.filename}>
              {activeDataset.filename}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
              v{activeDataset.version || 1}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
              {getStageLabel(activeDataset)}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-[#FAF7F0] border border-[#E2DCD0] text-[#0f172a]">
              {activeDataset.file_type || 'csv'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#475569] mt-1 font-medium">
            <span>{activeDataset.row_count ? `${activeDataset.row_count.toLocaleString()} rows` : '0 rows'}</span>
            <span>•</span>
            <span>{activeDataset.column_count ? `${activeDataset.column_count} cols` : '0 cols'}</span>
            {hasMultiple && (
              <>
                <span>•</span>
                <span className="text-indigo-700 font-bold">{datasets.length} versions available</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 self-start md:self-center">
        {hasMultiple && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#475569] whitespace-nowrap">Switch:</span>
            <div className="relative min-w-[240px]">
              <select
                value={selectedDatasetId || activeDataset.id}
                onChange={(e) => onSelect(e.target.value)}
                className="w-full bg-[#FAF7F0] border border-[#E2DCD0] rounded-xl px-3 py-1.5 pr-8 text-xs text-[#0f172a] font-bold focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 appearance-none cursor-pointer hover:border-[#CBD5E1] transition-colors shadow-sm"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#FFFDF9] text-[#0f172a] py-1">
                    v{d.version || 1} [{getStageLabel(d)}]: {d.filename} ({d.row_count || 0} rows)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        <Link
          href={`/projects/${projectId}/versions`}
          className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 whitespace-nowrap"
        >
          <span>Lineage Chain</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
