"use client";
import React, { useState, useEffect } from 'react';
import { 
  GitBranch, Database, Wand2, Cpu, FileCode2, 
  CheckCircle2, ShieldCheck, ArrowRight, Clock, Layers,
  AlertCircle, RefreshCw, FileCode, Check, RotateCcw
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface VersionChain {
  version: number;
  is_active: boolean;
  created_at?: string;
  dataset?: {
    id: string;
    version: number;
    filename: string;
    file_hash?: string;
    row_count?: number;
    column_count?: number;
    uploaded_at?: string;
  };
  cleaning?: {
    id: string;
    steps_applied?: any[];
    rows_before?: number;
    rows_after?: number;
    created_at?: string;
  };
  recipe?: {
    recipe_version: string;
    applied_steps_count: number;
    features_count: number;
    test_size: number;
    cv_folds: number;
    details?: any;
  };
  model?: {
    id: string;
    algorithm: string;
    version: number;
    metrics?: Record<string, any>;
    hyperparameters?: Record<string, any>;
    model_path?: string;
    training_time_seconds?: number;
    is_selected: boolean;
    total_candidates?: number;
  };
  api?: {
    id?: string;
    framework: string;
    endpoint: string;
    status: string;
    has_dockerfile: boolean;
    created_at?: string;
  };
}

export default function VersionHistoryPage() {
  const params = useParams();
  const projectId = (params?.id as string) || 'p-101';
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [hasDatasets, setHasDatasets] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.versionLineage.getHistory(projectId);
      setHistoryData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const checkDatasetsAndLoad = async () => {
    try {
      const data = await api.datasets.list(projectId);
      const list = Array.isArray(data) ? data : [];
      setHasDatasets(list.length > 0);
      if (list.length > 0) {
        await loadVersionHistory();
      }
    } catch {
      setHasDatasets(false);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    checkDatasetsAndLoad();
  }, [projectId]);

  if (!initialLoading && !hasDatasets) {
    return <NoDatasetGate projectId={projectId} pageName="Version History & Lineage" pageDescription="End-to-end audit trail connecting Dataset → Recipe → Model → API Endpoint." />;
  }

  const handleRollback = async (targetVersion: number, modelId?: string) => {
    try {
      setRollingBackVersion(targetVersion);
      setError(null);
      setSuccessMessage(null);
      
      const res = await api.versionLineage.rollback(projectId, targetVersion, modelId);
      setSuccessMessage(res.message || `Successfully rolled back to Version v${targetVersion}`);
      await loadVersionHistory();
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 6000);
    } catch (err: any) {
      setError(err.message || 'Failed to rollback version');
    } finally {
      setRollingBackVersion(null);
    }
  };

  const activeChain = historyData?.chains?.find((c: VersionChain) => c.is_active);

  return (
    <div className="space-y-8 animate-fade-in pb-12 text-[#0f172a]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFDF9] p-7 rounded-3xl border border-[#E2DCD0] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
              Centralized Provenance
            </span>
            <span className="text-[#64748b] text-xs">•</span>
            <span className="text-[#475569] text-xs font-mono font-bold">{historyData?.total_versions || 0} Versions Logged</span>
          </div>
          <h1 className="text-3xl font-extrabold font-heading text-[#0f172a] flex items-center gap-2.5">
            <GitBranch className="w-8 h-8 text-[#0f172a]" /> Version History & Lineage
          </h1>
          <p className="text-[#475569] text-sm mt-1">
            End-to-end audit trail connecting Dataset → Recipe → Model → API Endpoint with instantaneous rollback.
          </p>
        </div>
        <Button 
          variant="secondary" 
          onClick={loadVersionHistory} 
          disabled={loading}
          className="flex items-center gap-2 self-start sm:self-center text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Lineage
        </Button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 rounded-2xl text-rose-900 flex items-center gap-3 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-700" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="border border-emerald-300 bg-emerald-50 p-4 rounded-2xl text-emerald-950 flex items-center gap-3 text-sm shadow-sm animate-fade-in font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Active Production Summary Banner */}
      {activeChain && (
        <Card className="border border-[#E2DCD0] bg-[#FFFDF9] shadow-sm">
          <CardBody>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl text-[#92400E] shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-[#0f172a] text-lg">Active Production Version</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      Live (v{activeChain.version})
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] mt-1 font-medium">
                    Currently serving live inference requests and powering generated Docker APIs.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded-md bg-[#FAF7F0] border border-[#E2DCD0] text-[#0f172a] font-bold">
                      Model: {activeChain.model?.algorithm || 'Ensemble'}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-[#FAF7F0] border border-[#E2DCD0] text-indigo-900 font-bold">
                      Data: {activeChain.dataset?.filename || 'dataset.csv'} (v{activeChain.dataset?.version || 1})
                    </span>
                    {activeChain.model?.metrics?.accuracy && (
                      <span className="px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-950 font-bold">
                        Accuracy: {(activeChain.model.metrics.accuracy * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end lg:self-center">
                <Link
                  href={`/projects/${projectId}/training`}
                  className="px-4 py-2 rounded-xl bg-[#FAF7F0] hover:bg-[#EFEBE0] border border-[#E2DCD0] text-xs font-bold text-[#0f172a] transition-all flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5 text-[#0f172a]" />
                  <span>Leaderboard</span>
                </Link>
                <Link
                  href={`/projects/${projectId}/api-gen`}
                  className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Inspect API</span>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Linked Multi-Layer Version Chains */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-700" /> Full Lineage Provenance Chains
        </h3>

        {loading && !historyData ? (
          <div className="py-12 text-center text-[#64748b]">
            <div className="w-8 h-8 border-2 border-[#0f172a]/20 border-t-[#0f172a] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold">Reconstructing artifact lineage graph...</p>
          </div>
        ) : historyData?.chains?.length > 0 ? (
          <div className="space-y-6">
            {historyData.chains.map((chain: VersionChain) => {
              const isCurrent = chain.is_active;
              return (
                <div
                  key={chain.version}
                  className={`rounded-3xl border transition-all overflow-hidden shadow-sm ${
                    isCurrent
                      ? 'bg-[#FFFDF9] border-[#0f172a] ring-2 ring-[#0f172a]/10'
                      : 'bg-[#FFFDF9] border-[#E2DCD0]'
                  }`}
                >
                  {/* Chain Header */}
                  <div className={`p-5 border-b border-[#E2DCD0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent 
                      ? 'bg-[#FEF3C7]/40' 
                      : 'bg-[#FAF7F0]'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-[#0F172A] text-white font-mono font-bold flex items-center justify-center text-sm shadow-sm">
                        v{chain.version}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-[#0f172a] text-base">
                            Pipeline Chain Version {chain.version}
                          </h4>
                          {isCurrent ? (
                            <Badge variant="success" className="font-mono text-[10px]">Active Production</Badge>
                          ) : (
                            <Badge variant="neutral" className="font-mono text-[10px]">Historical Version</Badge>
                          )}
                        </div>
                        {chain.created_at && (
                          <p className="text-xs text-[#64748b] font-medium flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-[#94a3b8]" />
                            Created: {new Date(chain.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rollback Action Button */}
                    <div>
                      {isCurrent ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>Currently Active</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={rollingBackVersion === chain.version}
                          onClick={() => handleRollback(chain.version, chain.model?.id)}
                          className="flex items-center gap-1.5 font-bold text-xs"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${rollingBackVersion === chain.version ? 'animate-spin' : ''}`} />
                          <span>Rollback to v{chain.version}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 4 Pipeline Artifact Pillars */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Dataset */}
                    <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1">
                          <Database className="w-3.5 h-3.5 text-blue-700" /> Dataset
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                          v{chain.dataset?.version || 1}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#0f172a] truncate" title={chain.dataset?.filename}>
                        {chain.dataset?.filename || 'dataset.csv'}
                      </div>
                      <div className="text-xs text-[#475569] space-y-0.5 font-medium">
                        <div>Rows: <strong className="text-[#0f172a]">{chain.dataset?.row_count?.toLocaleString() || 'N/A'}</strong></div>
                        <div>Cols: <strong className="text-[#0f172a]">{chain.dataset?.column_count || 'N/A'}</strong></div>
                      </div>
                    </div>

                    {/* Cleaning */}
                    <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1">
                          <Wand2 className="w-3.5 h-3.5 text-amber-700" /> Cleaning
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded">
                          {chain.cleaning?.steps_applied?.length || 0} Steps
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#0f172a]">
                        {chain.cleaning?.steps_applied?.length ? 'Cleaned Dataset' : 'Raw Clean Pass'}
                      </div>
                      <div className="text-xs text-[#475569] space-y-0.5 font-medium">
                        <div>Before: <strong className="text-[#0f172a]">{chain.cleaning?.rows_before?.toLocaleString() || 'N/A'}</strong> rows</div>
                        <div>After: <strong className="text-[#0f172a]">{chain.cleaning?.rows_after?.toLocaleString() || 'N/A'}</strong> rows</div>
                      </div>
                    </div>

                    {/* Model */}
                    <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-emerald-700" /> Trained Model
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded">
                          v{chain.model?.version || 1}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#0f172a] truncate">
                        {chain.model?.algorithm || 'AutoML Winner'}
                      </div>
                      <div className="text-xs text-[#475569] space-y-0.5 font-medium">
                        {chain.model?.metrics?.accuracy && (
                          <div>Acc: <strong className="text-emerald-800">{(chain.model.metrics.accuracy * 100).toFixed(1)}%</strong></div>
                        )}
                        {chain.model?.metrics?.r2 && (
                          <div>R²: <strong className="text-emerald-800">{chain.model.metrics.r2.toFixed(3)}</strong></div>
                        )}
                        <div>Time: <strong className="text-[#0f172a]">{chain.model?.training_time_seconds ? `${chain.model.training_time_seconds.toFixed(1)}s` : 'N/A'}</strong></div>
                      </div>
                    </div>

                    {/* API Endpoint */}
                    <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1">
                          <FileCode2 className="w-3.5 h-3.5 text-indigo-700" /> Exported API
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-950 bg-indigo-100 px-2 py-0.5 rounded">
                          {chain.api?.framework || 'FastAPI'}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-[#0f172a] font-mono truncate">
                        {chain.api?.endpoint || '/api/predict'}
                      </div>
                      <div className="text-xs text-[#475569] space-y-0.5 font-medium">
                        <div>Docker: <strong className="text-[#0f172a]">{chain.api?.has_dockerfile ? 'Packaged' : 'Ready'}</strong></div>
                        <div>Status: <strong className="text-emerald-800 font-bold">{chain.api?.status || 'Active'}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center bg-[#FFFDF9] border border-[#E2DCD0] rounded-3xl text-[#475569]">
            <GitBranch className="w-12 h-12 text-[#94a3b8] mx-auto mb-3" />
            <h4 className="text-base font-bold text-[#0f172a]">No Lineage History Recorded Yet</h4>
            <p className="text-xs text-[#64748b] mt-1">Train a model or apply transformations to generate your first version chain.</p>
          </div>
        )}
      </div>
    </div>
  );
}
