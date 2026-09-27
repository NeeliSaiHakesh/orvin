"use client";
import React, { useState, useEffect } from 'react';
import { 
  GitBranch, History, RotateCcw, Database, Wand2, Cpu, FileCode2, 
  CheckCircle2, ShieldCheck, ArrowRight, Clock, Layers, Sparkles, 
  ExternalLink, AlertCircle, RefreshCw, FileCode, Check, ChevronRight
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
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
  const projectId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [hasDatasets, setHasDatasets] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);

  useEffect(() => {
    checkDatasetsAndLoad();
  }, [projectId]);

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
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Centralized Provenance
            </span>
            <span className="text-gray-400 text-xs">•</span>
            <span className="text-gray-400 text-xs font-mono">{historyData?.total_versions || 0} Versions Logged</span>
          </div>
          <h1 className="text-3xl font-bold font-heading text-white flex items-center gap-2.5">
            <GitBranch className="w-8 h-8 text-purple-400" /> Version History & Lineage
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            End-to-end audit trail connecting Dataset → Recipe → Model → API Endpoint with instantaneous one-action rollback.
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
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="glass border-emerald-500/40 bg-emerald-500/10 p-4 rounded-xl text-emerald-300 flex items-center gap-3 text-sm shadow-lg shadow-emerald-950/30 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Active Production Summary Banner */}
      {activeChain && (
        <Card className="border border-cyan-500/40 bg-gradient-to-r from-cyan-950/30 via-[#0d1527] to-purple-950/30 shadow-xl">
          <CardBody>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-white text-base">Active Production Version</span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-green-500/20 text-green-300 border border-green-500/40 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      Live (v{activeChain.version})
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Currently serving live inference requests and powering generated Docker APIs.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs font-mono">
                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-cyan-300">
                      Model: {activeChain.model?.algorithm || 'Ensemble'}
                    </span>
                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-purple-300">
                      Data: {activeChain.dataset?.filename || 'dataset.csv'} (v{activeChain.dataset?.version || 1})
                    </span>
                    {activeChain.model?.metrics?.accuracy && (
                      <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-emerald-300 font-bold">
                        Accuracy: {(activeChain.model.metrics.accuracy * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end lg:self-center">
                <Link
                  href={`/projects/${projectId}/training`}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>Leaderboard</span>
                </Link>
                <Link
                  href={`/projects/${projectId}/api-gen`}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-semibold text-cyan-200 transition-all flex items-center gap-1.5"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Inspect API</span>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Linked Multi-Layer Version Chains */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" /> Full Lineage Provenance Chains
        </h3>

        {loading && !historyData ? (
          <div className="py-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Reconstructing artifact lineage graph...</p>
          </div>
        ) : historyData?.chains?.length > 0 ? (
          <div className="space-y-6">
            {historyData.chains.map((chain: VersionChain) => {
              const isCurrent = chain.is_active;
              return (
                <div
                  key={chain.version}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isCurrent
                      ? 'bg-[#0f172a]/90 border-purple-500/50 shadow-2xl shadow-purple-950/30 ring-1 ring-purple-500/30'
                      : 'bg-[#0b1220]/70 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Chain Header */}
                  <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent 
                      ? 'bg-gradient-to-r from-purple-900/30 via-slate-900 to-cyan-900/30 border-purple-500/30' 
                      : 'bg-white/[0.02] border-white/10'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold flex items-center justify-center text-sm shadow-md">
                        v{chain.version}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-base">
                            Pipeline Chain Version {chain.version}
                          </h4>
                          {isCurrent ? (
                            <Badge variant="success" className="font-mono text-[10px]">Active Production</Badge>
                          ) : (
                            <Badge variant="neutral" className="font-mono text-[10px]">Historical Version</Badge>
                          )}
                        </div>
                        {chain.created_at && (
                          <p className="text-[11px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-gray-500" />
                            Created: {new Date(chain.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rollback Action Button */}
                    <div>
                      {isCurrent ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Currently Active</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={rollingBackVersion === chain.version}
                          onClick={() => handleRollback(chain.version, chain.model?.id)}
                          className="flex items-center gap-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 hover:text-white shadow-md transition-all"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 text-purple-300 ${rollingBackVersion === chain.version ? 'animate-spin' : ''}`} />
                          <span>{rollingBackVersion === chain.version ? 'Rolling back...' : `Rollback to v${chain.version}`}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 4-Layer Lineage Chain Grid */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                    {/* Layer 1: Dataset */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5" /> 1. Dataset Layer
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            v{chain.dataset?.version || chain.version}
                          </span>
                        </div>
                        <p className="font-semibold text-white truncate text-xs" title={chain.dataset?.filename}>
                          {chain.dataset?.filename || 'dataset.csv'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            {(chain.dataset as any)?.status === 'features_engineered' || chain.dataset?.filename?.includes('_features')
                              ? '⚡ Features Snapshot'
                              : (chain.dataset as any)?.status === 'cleaned' || chain.dataset?.filename?.includes('_cleaned')
                              ? '🧹 Cleaned Snapshot'
                              : '📊 Raw Analyzed'}
                          </span>
                        </div>
                        <div className="text-gray-400 space-y-1 mt-2 text-[11px]">
                          <div>Rows: <span className="text-gray-200">{chain.dataset?.row_count?.toLocaleString() || '—'}</span></div>
                          <div>Cols: <span className="text-gray-200">{chain.dataset?.column_count || '—'}</span></div>
                          {chain.dataset?.file_hash && (
                            <div className="truncate text-[10px] text-cyan-400/80" title={chain.dataset.file_hash}>
                              Hash: {chain.dataset.file_hash.substring(0, 10)}…
                            </div>
                          )}
                        </div>
                      </div>
                      <Link 
                        href={`/projects/${projectId}/datasets`}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 pt-1 border-t border-white/5"
                      >
                        <span>Inspect Data</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Layer 2: Preprocessing & Recipe */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1.5">
                            <Wand2 className="w-3.5 h-3.5" /> 2. Recipe & Config
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            recipe_v{chain.version}
                          </span>
                        </div>
                        <p className="font-semibold text-white text-xs">
                          {chain.recipe?.applied_steps_count || 0} Clean Step(s) Applied
                        </p>
                        <div className="text-gray-400 space-y-1 mt-2 text-[11px]">
                          <div>Features: <span className="text-gray-200">{chain.recipe?.features_count || 'Auto'}</span></div>
                          <div>Validation: <span className="text-gray-200">{chain.recipe?.cv_folds || 5}-Fold Stratified</span></div>
                          <div>Split: <span className="text-gray-200">{chain.recipe?.test_size ? `${(chain.recipe.test_size * 100).toFixed(0)}% Holdout` : '20% Holdout'}</span></div>
                        </div>
                      </div>
                      <Link 
                        href={`/projects/${projectId}/cleaning`}
                        className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 pt-1 border-t border-white/5"
                      >
                        <span>Cleaning Recipe</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Layer 3: Model */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5" /> 3. Model Weights
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            v{chain.model?.version || chain.version}
                          </span>
                        </div>
                        <p className="font-semibold text-white text-xs">
                          {chain.model?.algorithm || 'Top Candidate'}
                        </p>
                        <div className="text-gray-400 space-y-1 mt-2 text-[11px]">
                          {chain.model?.metrics?.accuracy != null && (
                            <div>Acc: <span className="text-green-400 font-bold">{(chain.model.metrics.accuracy * 100).toFixed(1)}%</span></div>
                          )}
                          {chain.model?.metrics?.f1 != null && (
                            <div>F1: <span className="text-purple-300">{chain.model.metrics.f1.toFixed(3)}</span></div>
                          )}
                          <div>Candidates: <span className="text-gray-200">{chain.model?.total_candidates || 1} evaluated</span></div>
                        </div>
                      </div>
                      <Link 
                        href={`/projects/${projectId}/training`}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 pt-1 border-t border-white/5"
                      >
                        <span>View Model</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Layer 4: API Endpoint */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-yellow-400 flex items-center gap-1.5">
                            <FileCode2 className="w-3.5 h-3.5" /> 4. Deployed API
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isCurrent 
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}>
                            {chain.api?.status || (isCurrent ? 'active' : 'standby')}
                          </span>
                        </div>
                        <p className="font-semibold text-white text-xs truncate">
                          {chain.api?.endpoint || `/predict (v${chain.version})`}
                        </p>
                        <div className="text-gray-400 space-y-1 mt-2 text-[11px]">
                          <div>Framework: <span className="text-gray-200">FastAPI</span></div>
                          <div>Docker: <span className="text-cyan-300 font-bold">Enabled</span></div>
                          <div>Rollback: <span className="text-purple-300">Ready</span></div>
                        </div>
                      </div>
                      <Link 
                        href={`/projects/${projectId}/api-gen`}
                        className="text-[11px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1 pt-1 border-t border-white/5"
                      >
                        <span>API Specs</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardBody>
              <div className="text-center py-12 text-gray-500">
                <GitBranch className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                <p className="text-lg text-white font-medium">No Provenance Chains Found</p>
                <p className="text-sm mt-1 text-gray-400">
                  Upload a dataset and execute AutoML training to generate the first version chain.
                </p>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
