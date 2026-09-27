"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { GitBranch, History, ChevronDown, Check, ArrowRight } from 'lucide-react';

export interface VersionOption {
  version: number;
  label: string;
  sublabel?: string;
  timestamp?: string;
  isActive?: boolean;
}

interface ModuleVersionBadgeProps {
  moduleName: string;
  currentVersion: number;
  availableVersions: VersionOption[];
  onSelectVersion: (version: number) => void;
  projectId: string;
  artifactType?: string;
  className?: string;
}

export function ModuleVersionBadge({
  moduleName,
  currentVersion,
  availableVersions = [],
  onSelectVersion,
  projectId,
  artifactType = "Artifact",
  className = ""
}: ModuleVersionBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // If no versions exist or array is empty, do NOT render anything
  if (!availableVersions || availableVersions.length === 0) {
    return null;
  }

  const activeOption = availableVersions.find(v => v.version === currentVersion) || availableVersions[0] || {
    version: currentVersion || 1,
    label: `${artifactType} v${currentVersion || 1}`,
  };

  const hasMultipleVersions = availableVersions.length > 1;

  return (
    <div className={`relative z-20 flex flex-wrap items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl bg-[#0c1424]/90 border border-purple-500/25 backdrop-blur-md shadow-md ${className}`}>
      {/* Current Version Indicator */}
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
          <GitBranch className="w-4 h-4" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {moduleName}:
          </span>
          <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.2)]">
            v{currentVersion || activeOption.version || 1}
          </span>
          <span className="text-xs text-gray-300 font-medium truncate max-w-[200px] sm:max-w-xs" title={activeOption.label}>
            ({activeOption.label})
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5 ml-auto">
        {/* Switch Version Dropdown: ONLY shown if there are multiple versions */}
        {hasMultipleVersions && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#131d33] hover:bg-[#1a2744] border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Switch ({availableVersions.length})</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-300' : 'text-gray-400'}`} />
            </button>

            {isOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 max-w-[90vw] rounded-xl bg-[#0b1220] border border-cyan-500/30 shadow-2xl p-2 z-50 divide-y divide-white/10 animate-fade-in">
                <div className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                  <span>Select {moduleName} Version</span>
                  <span className="text-purple-400 font-mono font-bold">{availableVersions.length} versions</span>
                </div>
                
                <div className="py-1 max-h-56 overflow-y-auto space-y-1">
                  {availableVersions.map((opt) => {
                    const isSelected = opt.version === currentVersion;
                    return (
                      <button
                        key={opt.version}
                        type="button"
                        onClick={() => {
                          onSelectVersion(opt.version);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-start justify-between p-2 rounded-lg text-left text-xs transition-all ${
                          isSelected 
                            ? 'bg-purple-600/25 border border-purple-500/40 text-white' 
                            : 'hover:bg-white/5 text-gray-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="font-mono font-bold text-purple-300">v{opt.version}</span>
                            <span className="truncate">{opt.label}</span>
                          </div>
                          {opt.sublabel && (
                            <div className="text-[10px] text-gray-400 truncate">{opt.sublabel}</div>
                          )}
                          {opt.timestamp && (
                            <div className="text-[9px] text-gray-500 font-mono">{opt.timestamp}</div>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 px-1">
                  <Link
                    href={`/projects/${projectId}/versions`}
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 hover:from-purple-500/30 hover:to-cyan-500/30 text-cyan-300 text-xs font-semibold transition-all border border-cyan-500/30"
                  >
                    <span>Full Lineage Graph</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shortcut Link to Centralized Page */}
        <Link
          href={`/projects/${projectId}/versions`}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-purple-300 hover:text-purple-100 hover:bg-purple-500/10 font-medium transition-colors"
        >
          <span>Lineage Chain →</span>
        </Link>
      </div>
    </div>
  );
}
