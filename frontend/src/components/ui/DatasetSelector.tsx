"use client";
import React from 'react';
import { Database, FileSpreadsheet, Layers, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface Dataset {
  id: string;
  filename: string;
  file_type?: string;
  row_count?: number;
  column_count?: number;
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
  datasets,
  selectedDatasetId,
  onSelect,
  projectId,
  label = "Active Dataset"
}: DatasetSelectorProps) {
  if (!datasets || datasets.length === 0) {
    return (
      <div className="glass p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-yellow-300">
          <Database className="w-4 h-4 shrink-0" />
          <span>No datasets uploaded for this project yet.</span>
        </div>
        <Link 
          href={`/projects/${projectId}/datasets`}
          className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-200 text-xs font-semibold transition-colors"
        >
          Upload Dataset
        </Link>
      </div>
    );
  }

  const activeDataset = datasets.find(d => d.id === selectedDatasetId) || datasets[0];

  return (
    <div className="glass p-4 rounded-2xl border border-white/10 bg-[#0d1424]/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}:</span>
            <span className="font-bold text-white text-sm sm:text-base truncate max-w-[220px] sm:max-w-xs">
              {activeDataset.filename}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-white/10 text-cyan-300">
              {activeDataset.file_type || 'csv'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span>{activeDataset.row_count ? `${activeDataset.row_count.toLocaleString()} rows` : 'Processed rows'}</span>
            <span>•</span>
            <span>{activeDataset.column_count ? `${activeDataset.column_count} columns` : 'Structured columns'}</span>
            {datasets.length > 1 && (
              <>
                <span>•</span>
                <span className="text-purple-400 font-medium">{datasets.length} datasets available</span>
              </>
            )}
          </div>
        </div>
      </div>

      {datasets.length > 1 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 whitespace-nowrap">Switch Dataset:</span>
          <div className="relative min-w-[200px]">
            <select
              value={selectedDatasetId || activeDataset.id}
              onChange={(e) => onSelect(e.target.value)}
              className="w-full bg-[#131d33] border border-cyan-500/40 rounded-xl px-3 py-2 pr-8 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none cursor-pointer hover:border-cyan-400 transition-colors shadow-lg"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#0e1628] text-white py-1">
                  {d.filename} ({d.row_count || 0} rows)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      ) : (
        <Link
          href={`/projects/${projectId}/datasets`}
          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 self-end md:self-center"
        >
          <span>+ Upload another dataset</span>
        </Link>
      )}
    </div>
  );
}
