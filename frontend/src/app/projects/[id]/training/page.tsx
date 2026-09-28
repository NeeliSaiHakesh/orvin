"use client";
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Zap, Clock, Target, ShieldCheck, FileCode, Copy, Check, X, 
  GitCompare, Activity, Layers, Filter, CheckCircle2, ChevronRight, BarChart3, Sliders
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
import { ModuleVersionBadge } from '@/components/ui/ModuleVersionBadge';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';

interface ModelResult {
  id?: string;
  version?: number;
  dataset_version?: number;
  dataset_id?: string;
  algorithm: string;
  hyperparameters?: Record<string, any>;
  metrics: Record<string, any>;
  pipeline_recipe?: Record<string, any>;
  training_time_seconds: number;
  is_selected: boolean;
}

interface ExperimentRun {
  id: string;
  project_id: string;
  model_id?: string;
  run_name: string;
  model_version: number;
  dataset_version: number;
  algorithm: string;
  hyperparameters: Record<string, any>;
  metrics: Record<string, any>;
  tags?: Record<string, any>;
  artifacts?: Record<string, any>;
  status: string;
  duration_seconds: number;
  created_at?: string;
}

export default function TrainingPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [leaderboard, setLeaderboard] = useState<ModelResult[]>([]);
  const [datasetStats, setDatasetStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Experiment tracking & comparison states
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'experiments'>('leaderboard');
  const [experimentRuns, setExperimentRuns] = useState<ExperimentRun[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Recipe modal
  const [recipeModal, setRecipeModal] = useState<{ isOpen: boolean; model: ModelResult | null; recipe: any | null }>({
    isOpen: false,
    model: null,
    recipe: null,
  });
  const [copied, setCopied] = useState(false);

  const loadDatasets = async () => {
    try {
      const data = await api.datasets.list(projectId);
      const list = Array.isArray(data) ? data : [];
      setDatasets(list);
      if (list.length > 0 && !selectedDataset) {
        setSelectedDataset(list[0].id);
      }
    } catch {
      setDatasets([]);
    } finally {
      setInitialLoading(false);
    }
  };

  if (!initialLoading && datasets.length === 0) {
    return <NoDatasetGate projectId={projectId} pageName="Model Training & Quality Benchmark" pageDescription="AutoML with strict deduplication, 5-Fold Stratified Cross-Validation, and MLflow-style experiment tracking." />;
  }

  const loadExperimentRuns = async () => {
    try {
      const data = await api.experiments.list(projectId);
      setExperimentRuns(Array.isArray(data) ? data : []);
    } catch {
      setExperimentRuns([]);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await api.training.leaderboard(projectId);
      const models = data.models || [];
      setLeaderboard(models);
      if (data.dataset_stats) {
        setDatasetStats(data.dataset_stats);
      }
    } catch (err: any) {
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    loadDatasets();
    loadExperimentRuns();
  }, [projectId]);

  const startTraining = async () => {
    try {
      setIsTraining(true);
      setProgress(0);
      setError(null);

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 92));
      }, 250);

      const result = await api.training.start(projectId, {
        test_size: 0.2,
        cv_folds: 5,
        scoring_metric: 'auto',
        dataset_id: selectedDataset || undefined,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (result.dataset_stats) {
        setDatasetStats(result.dataset_stats);
      }
      
      await loadLeaderboard();
      await loadExperimentRuns();

      setTimeout(() => {
        setIsTraining(false);
        setProgress(0);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'AutoML training failed');
      setIsTraining(false);
      setProgress(0);
    }
  };

  const selectModel = async (modelId: string) => {
    try {
      await api.training.selectModel(modelId);
      const data = await api.training.leaderboard(projectId);
      setLeaderboard(data.models || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds(prev => 
      prev.includes(runId) ? prev.filter(id => id !== runId) : [...prev, runId]
    );
  };

  const handleCompareRuns = async () => {
    if (selectedRunIds.length < 2) return;
    try {
      setIsComparing(true);
      const data = await api.experiments.compare(projectId, selectedRunIds);
      setComparisonData(data);
      setCompareModalOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to compare experiment runs');
    } finally {
      setIsComparing(false);
    }
  };

  const leaderboardColumns = [
    { 
      key: 'rank', header: 'Rank', 
      render: (_: ModelResult, index = 0) => (
        <div className="flex items-center gap-2">
          {index === 0 ? <Trophy className="w-5 h-5 text-amber-500" /> : <span className="w-5 text-center text-[#475569] font-mono font-bold">{index + 1}</span>}
        </div>
      )
    },
    { 
      key: 'algorithm', header: 'Model & Version', sortable: true,
      render: (item: ModelResult) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#0F172A]">{item.algorithm}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-300">
              v{item.version || 1}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#64748B] mt-0.5 font-mono">
            <span className="text-cyan-800 font-medium">Trained on Dataset v{item.dataset_version || 1}</span>
            {item.metrics?.optimal_threshold && item.metrics.optimal_threshold !== 0.5 && (
              <>
                <span>•</span>
                <span className="text-emerald-800 font-medium">Calibrated (thresh={item.metrics.optimal_threshold})</span>
              </>
            )}
          </div>
        </div>
      )
    },
    { 
      key: 'cv_score', header: '5-Fold Stratified CV', sortable: true, 
      render: (item: ModelResult) => {
        const mean = item.metrics?.cv_mean ?? item.metrics?.cv_score;
        const std = item.metrics?.cv_std;
        return mean != null ? (
          <div className="flex flex-col">
            <span className="text-cyan-800 font-bold font-mono">
              {(mean * 100).toFixed(1)}%
            </span>
            {std != null && (
              <span className="text-[10px] text-[#64748B] font-mono">
                ± {(std * 100).toFixed(2)}% std
              </span>
            )}
          </div>
        ) : <span className="text-[#94A3B8]">—</span>;
      }
    },
    { 
      key: 'accuracy', header: 'Test Acc (80/20)', sortable: true, 
      render: (item: ModelResult, index = 0) => {
        const acc = item.metrics?.accuracy;
        return acc != null ? (
          <span className={index === 0 ? 'text-emerald-800 font-bold font-mono' : 'text-[#0F172A] font-medium font-mono'}>
            {(acc * 100).toFixed(1)}%
          </span>
        ) : <span className="text-[#94A3B8]">—</span>;
      }
    },
    { 
      key: 'f1', header: 'F1 Score', sortable: true, 
      render: (item: ModelResult) => {
        const f1 = item.metrics?.f1;
        return f1 != null ? <span className="font-mono text-[#0F172A] font-medium">{f1.toFixed(3)}</span> : <span className="text-[#94A3B8]">—</span>;
      }
    },
    { 
      key: 'roc_auc', header: 'ROC AUC', sortable: true, 
      render: (item: ModelResult) => {
        const auc = item.metrics?.roc_auc;
        return auc != null ? (
          <span className="text-purple-800 font-mono font-bold">{auc.toFixed(3)}</span>
        ) : <span className="text-[#94A3B8]">—</span>;
      }
    },
    { 
      key: 'precision_recall', header: 'Prec / Rec', 
      render: (item: ModelResult) => {
        const p = item.metrics?.precision;
        const r = item.metrics?.recall;
        return (p != null && r != null) ? (
          <span className="text-xs text-[#334155] font-mono font-medium">
            {(p * 100).toFixed(0)}% / {(r * 100).toFixed(0)}%
          </span>
        ) : <span className="text-[#94A3B8]">—</span>;
      }
    },
    { 
      key: 'time', header: 'Speed', 
      render: (item: ModelResult) => (
        <span className="flex items-center gap-1 text-[#475569] text-xs font-mono">
          <Clock className="w-3 h-3" /> {item.training_time_seconds?.toFixed(2)}s
        </span>
      )
    },
    { 
      key: 'action', header: 'Actions', 
      render: (item: ModelResult) => (
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="ghost"
            className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 hover:bg-purple-100"
            onClick={async () => {
              try {
                const res = await api.training.getPipelineRecipe(item.id!);
                setRecipeModal({ isOpen: true, model: item, recipe: res.recipe || item.pipeline_recipe });
              } catch {
                setRecipeModal({ isOpen: true, model: item, recipe: item.pipeline_recipe || {} });
              }
            }}
          >
            <FileCode className="w-3.5 h-3.5" /> Recipe
          </Button>
          <Button 
            size="sm" 
            variant={item.is_selected ? 'primary' : 'secondary'}
            onClick={() => item.id && selectModel(item.id)}
          >
            {item.is_selected ? '✓ Selected' : 'Select'}
          </Button>
        </div>
      )
    },
  ];

  const experimentColumns = [
    {
      key: 'select', header: '',
      render: (item: ExperimentRun) => (
        <input 
          type="checkbox"
          className="rounded border-[#CBD5E1] text-purple-600 focus:ring-purple-500 cursor-pointer"
          checked={selectedRunIds.includes(item.id)}
          onChange={() => toggleRunSelection(item.id)}
        />
      )
    },
    {
      key: 'run_name', header: 'Run Name & ID', sortable: true,
      render: (item: ExperimentRun) => (
        <div>
          <div className="font-semibold text-[#0F172A] text-xs">{item.run_name}</div>
          <div className="text-[10px] font-mono text-[#64748B]">ID: {item.id.slice(0, 8)}</div>
        </div>
      )
    },
    {
      key: 'version', header: 'Model / Dataset', sortable: true,
      render: (item: ExperimentRun) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            v{item.model_version}
          </span>
          <span className="text-[#64748B]">/</span>
          <span className="text-cyan-800 font-medium text-[11px]">
            Data v{item.dataset_version}
          </span>
        </div>
      )
    },
    {
      key: 'algorithm', header: 'Algorithm', sortable: true,
      render: (item: ExperimentRun) => (
        <Badge variant="neutral" className="font-mono text-xs text-[#0F172A] bg-[#FAF7F2] border-[#E2DCD0]">{item.algorithm}</Badge>
      )
    },
    {
      key: 'hyperparameters', header: 'Hyperparameters',
      render: (item: ExperimentRun) => {
        const entries = Object.entries(item.hyperparameters || {});
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {entries.slice(0, 2).map(([k, v]) => (
              <span key={k} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#FAF7F2] border border-[#E2DCD0] text-[#0F172A]">
                {k}: {String(v)}
              </span>
            ))}
            {entries.length > 2 && (
              <span className="text-[10px] text-[#64748B] font-mono">+{entries.length - 2} more</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'accuracy', header: 'Accuracy / Score', sortable: true,
      render: (item: ExperimentRun) => {
        const acc = item.metrics?.accuracy ?? item.metrics?.r2;
        return acc != null ? (
          <span className="text-emerald-800 font-bold font-mono text-xs">
            {typeof acc === 'number' ? (acc <= 1.0 ? `${(acc * 100).toFixed(1)}%` : acc.toFixed(3)) : String(acc)}
          </span>
        ) : <span className="text-[#94A3B8]">—</span>;
      }
    },
    {
      key: 'f1', header: 'F1 Score', sortable: true,
      render: (item: ExperimentRun) => {
        const f1 = item.metrics?.f1;
        return f1 != null && typeof f1 === 'number' ? (
          <span className="text-purple-800 font-mono text-xs font-bold">{f1.toFixed(3)}</span>
        ) : <span className="text-[#94A3B8]">—</span>;
      }
    },
    {
      key: 'duration', header: 'Duration', sortable: true,
      render: (item: ExperimentRun) => (
        <span className="text-[#475569] text-xs font-mono">
          {item.duration_seconds?.toFixed(2)}s
        </span>
      )
    },
    {
      key: 'created_at', header: 'Timestamp', sortable: true,
      render: (item: ExperimentRun) => (
        <span className="text-[11px] text-[#475569] font-mono">
          {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2 text-[#0F172A]">Model Training & Quality Benchmark</h1>
          <p className="text-[#475569]">
            AutoML with strict deduplication, 5-Fold Stratified Cross-Validation, and MLflow-style experiment tracking.
          </p>
        </div>
        <Button onClick={startTraining} disabled={isTraining} className="flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white">
          {isTraining ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Training AutoML...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-400" /> Start AutoML Training
            </>
          )}
        </Button>
      </div>

      {leaderboard.length > 0 && (
        <ModuleVersionBadge
          moduleName="Model"
          currentVersion={leaderboard.find(m => m.is_selected)?.version || leaderboard[0]?.version || 1}
          availableVersions={Array.from(new Set(leaderboard.map(m => m.version || 1))).map(v => {
            const topForV = leaderboard.find(m => (m.version || 1) === v);
            return {
              version: v,
              label: `${topForV?.algorithm || 'Model'} (Acc: ${topForV?.metrics?.accuracy ? (topForV.metrics.accuracy * 100).toFixed(1) + '%' : 'N/A'})`,
              sublabel: `Trained on Dataset v${topForV?.dataset_version || 1}`,
              isActive: topForV?.is_selected
            };
          })}
          onSelectVersion={async (v) => {
            const target = leaderboard.find(m => (m.version || 1) === v);
            if (target?.id) selectModel(target.id);
          }}
          projectId={projectId}
          artifactType="Model"
        />
      )}

      <DatasetSelector
        datasets={datasets}
        selectedDatasetId={selectedDataset}
        onSelect={(id) => setSelectedDataset(id)}
        projectId={projectId}
        label="Dataset Being Trained On"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">
          {error}
        </div>
      )}

      {isTraining && (
        <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-700 animate-pulse" />
              </div>
              <h3 className="font-bold text-[#0F172A]">Stratified Training & Cross-Validation in progress...</h3>
            </div>
            <div className="w-full bg-[#E2DCD0] rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-[#0F172A] h-3 transition-all duration-300 rounded-full" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-[#475569]">
              <span>Running 5-fold CV, probability calibration, and holdout evaluation...</span>
              <span className="font-bold text-[#0F172A]">{progress}%</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Data Quality & Statistical Audit Summary */}
      {datasetStats && (
        <Card className="border border-[#E2DCD0] bg-[#FFFDF9] shadow-sm">
          <CardBody>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-100 border border-cyan-200 rounded-xl text-cyan-800">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-[#0F172A] text-sm">Data Quality & Statistical Audit</h4>
                  <p className="text-xs text-[#475569]">Validated prior to train-test partition</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-2.5 rounded-lg border border-[#E2DCD0] bg-[#FAF7F2]">
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Total Rows</span>
                  <span className="text-[#0F172A] font-bold text-sm">{datasetStats.total_rows ?? '—'}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E2DCD0] bg-[#FAF7F2]">
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Duplicates Dropped</span>
                  <span className="text-emerald-800 font-bold text-sm">{datasetStats.duplicates_removed ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E2DCD0] bg-[#FAF7F2]">
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Unique Clean Rows</span>
                  <span className="text-cyan-800 font-bold text-sm">{datasetStats.unique_rows ?? datasetStats.total_rows ?? '—'}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E2DCD0] bg-[#FAF7F2]">
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Train / Test Split</span>
                  <span className="text-purple-800 font-bold text-sm">
                    {datasetStats.train_rows ? `${datasetStats.train_rows} / ${datasetStats.test_rows}` : '80% / 20%'}
                  </span>
                </div>
              </div>
            </div>
            {datasetStats.small_dataset_warning && (
              <div className="mt-4 p-3 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
                <span className="text-amber-700 text-lg leading-none mt-0.5">⚠</span>
                <div>
                  <p className="text-amber-900 text-xs font-semibold">Small Dataset Warning</p>
                  <p className="text-amber-800 text-xs mt-0.5">
                    Your test set has fewer than 20 samples ({datasetStats.test_rows} rows). 
                    Metrics like 100% accuracy on 2–3 test samples are statistically unreliable. 
                    Upload a larger dataset for meaningful model evaluation.
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* View Switcher: Leaderboard vs. Experiments */}
      <div className="flex items-center justify-between border-b border-[#E2DCD0] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#FAF7F2]'
            }`}
          >
            <Trophy className="w-4 h-4" /> Benchmark Leaderboard
            <Badge variant="neutral" className="text-[10px] ml-1 bg-white/20 text-inherit">{leaderboard.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab('experiments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'experiments'
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#FAF7F2]'
            }`}
          >
            <Activity className="w-4 h-4" /> Experiment Tracking (MLflow)
            <Badge variant="neutral" className="text-[10px] ml-1 bg-white/20 text-inherit">{experimentRuns.length}</Badge>
          </button>
        </div>

        {activeTab === 'experiments' && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#475569]">
              {selectedRunIds.length} run{selectedRunIds.length === 1 ? '' : 's'} selected
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={selectedRunIds.length < 2 || isComparing}
              onClick={handleCompareRuns}
              className="flex items-center gap-1.5 text-xs bg-[#FFFDF9] hover:bg-[#FAF7F2] border border-[#E2DCD0] text-[#0F172A]"
            >
              <GitCompare className="w-3.5 h-3.5" />
              {isComparing ? 'Comparing...' : 'Compare Selected Runs'}
            </Button>
          </div>
        )}
      </div>

      {activeTab === 'leaderboard' ? (
        <div className="space-y-6">
          {/* Stats Row */}
          {leaderboard.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
                <CardBody className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Target className="w-6 h-6 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-sm text-[#475569]">Validated Algorithms</p>
                    <p className="text-2xl font-bold text-[#0F172A]">{leaderboard.length}</p>
                  </div>
                </CardBody>
              </Card>
              <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
                <CardBody className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <Trophy className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm text-[#475569]">Top Ranked Model</p>
                    <p className="text-2xl font-bold text-[#0F172A]">{leaderboard[0]?.algorithm}</p>
                  </div>
                </CardBody>
              </Card>
              <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
                <CardBody className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-100 rounded-xl">
                    <Zap className="w-6 h-6 text-cyan-700" />
                  </div>
                  <div>
                    <p className="text-sm text-[#475569]">5-Fold CV Score (Mean ± Std)</p>
                    <p className="text-xl font-bold font-mono text-cyan-900">
                      {leaderboard[0]?.metrics?.cv_mean
                        ? `${(leaderboard[0].metrics.cv_mean * 100).toFixed(1)}% ± ${( (leaderboard[0].metrics.cv_std || 0) * 100).toFixed(1)}%`
                        : leaderboard[0]?.metrics?.accuracy
                        ? `${(leaderboard[0].metrics.accuracy * 100).toFixed(1)}%`
                        : '—'}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
            <CardHeader>
              <h3 className="font-bold text-xl flex items-center gap-2 text-[#0F172A]">
                <Trophy className="w-5 h-5 text-amber-500" /> Model Benchmark Leaderboard
              </h3>
            </CardHeader>
            {leaderboard.length > 0 ? (
              <DataTable data={leaderboard} columns={leaderboardColumns} />
            ) : (
              <CardBody>
                <div className="text-center py-12 text-[#64748B]">
                  <Zap className="w-12 h-12 mx-auto mb-4 text-purple-700" />
                  <p className="text-lg text-[#0F172A] font-semibold">Ready to Train AutoML</p>
                  <p className="text-sm mt-1 text-[#475569]">
                    Click &quot;Start AutoML Training&quot; to deduplicate data, run 5-Fold Stratified CV, calibrate thresholds, and rank models.
                  </p>
                </div>
              </CardBody>
            )}
          </Card>
        </div>
      ) : (
        <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-xl flex items-center gap-2 text-[#0F172A]">
                <Activity className="w-5 h-5 text-cyan-700" /> MLflow-Style Experiment Runs
              </h3>
              <p className="text-xs text-[#475569] mt-1">
                Every training iteration is logged with parameters, metrics, duration, and data lineage. Select 2 or more to compare.
              </p>
            </div>
            {experimentRuns.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (selectedRunIds.length === experimentRuns.length) {
                    setSelectedRunIds([]);
                  } else {
                    setSelectedRunIds(experimentRuns.map(r => r.id));
                  }
                }}
                className="text-xs text-[#475569] hover:text-[#0F172A]"
              >
                {selectedRunIds.length === experimentRuns.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </CardHeader>
          {experimentRuns.length > 0 ? (
            <DataTable data={experimentRuns} columns={experimentColumns} />
          ) : (
            <CardBody>
              <div className="text-center py-12 text-[#64748B]">
                <Activity className="w-12 h-12 mx-auto mb-4 text-cyan-700" />
                <p className="text-lg text-[#0F172A] font-semibold">No Experiment Runs Yet</p>
                <p className="text-sm mt-1 text-[#475569]">
                  Run a training cycle to automatically record hyperparameters, evaluation metrics, and run artifacts.
                </p>
              </div>
            </CardBody>
          )}
        </Card>
      )}

      {/* Multi-Run Side-by-Side Comparison Modal */}
      {compareModalOpen && comparisonData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FFFDF9] border border-[#E2DCD0] rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E2DCD0] bg-[#FAF7F2]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-100 rounded-lg text-cyan-800">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base">
                    Experiment Run Comparison ({comparisonData.runs?.length} Runs)
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Side-by-side metric deltas and hyperparameter variance
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCompareModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#E2DCD0] text-[#475569] hover:text-[#0F172A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Runs Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {comparisonData.runs?.map((run: ExperimentRun) => {
                  const isBest = run.id === comparisonData.best_run_id;
                  return (
                    <div 
                      key={run.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isBest 
                          ? 'border-emerald-300 bg-emerald-50/50 shadow-sm' 
                          : 'border-[#E2DCD0] bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-[#0F172A] text-sm">{run.algorithm}</span>
                        {isBest && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-500" /> Best
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#64748B] space-y-0.5">
                        <div>Run: <span className="text-[#0F172A]">{run.run_name}</span></div>
                        <div>Version: <span className="text-purple-800 font-bold">v{run.model_version}</span> (Data v{run.dataset_version})</div>
                        <div>Duration: <span className="text-cyan-800 font-medium">{run.duration_seconds?.toFixed(2)}s</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Metrics Comparison Table */}
              <div>
                <h4 className="font-bold text-[#0F172A] text-sm mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-700" /> Key Metrics Comparison
                </h4>
                <div className="border border-[#E2DCD0] rounded-xl overflow-hidden bg-[#FAF7F2]">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-[#F4EFE6] text-[#475569] text-[11px] border-b border-[#E2DCD0] uppercase">
                      <tr>
                        <th className="p-3">Metric</th>
                        {comparisonData.runs?.map((run: ExperimentRun) => (
                          <th key={run.id} className="p-3">
                            {run.algorithm} (v{run.model_version})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2DCD0]">
                      {comparisonData.metrics_comparison?.map((m: any) => (
                        <tr key={m.metric_name} className="hover:bg-[#E2DCD0]/30">
                          <td className="p-3 font-semibold text-[#0F172A] capitalize">
                            {m.metric_name.replace(/_/g, ' ')}
                          </td>
                          {comparisonData.runs?.map((run: ExperimentRun) => {
                            const val = m.values?.[run.id];
                            return (
                              <td key={run.id} className="p-3">
                                {val != null ? (
                                  <span className={typeof val === 'number' && val > 0.8 ? 'text-emerald-800 font-bold' : 'text-[#0F172A]'}>
                                    {typeof val === 'number' ? (val <= 1.0 && val >= 0 ? val.toFixed(4) : val.toFixed(2)) : String(val)}
                                  </span>
                                ) : (
                                  <span className="text-[#94A3B8]">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hyperparameter Diffs Table */}
              <div>
                <h4 className="font-bold text-[#0F172A] text-sm mb-2 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-700" /> Hyperparameter Breakdown & Diffs
                </h4>
                <div className="border border-[#E2DCD0] rounded-xl overflow-hidden bg-[#FAF7F2]">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-[#F4EFE6] text-[#475569] text-[11px] border-b border-[#E2DCD0] uppercase">
                      <tr>
                        <th className="p-3">Parameter</th>
                        {comparisonData.runs?.map((run: ExperimentRun) => (
                          <th key={run.id} className="p-3">
                            {run.algorithm}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2DCD0]">
                      {comparisonData.parameter_diffs?.map((p: any) => (
                        <tr key={p.param_name} className="hover:bg-[#E2DCD0]/30">
                          <td className="p-3 font-semibold text-purple-800">
                            {p.param_name}
                          </td>
                          {comparisonData.runs?.map((run: ExperimentRun) => {
                            const val = p.values?.[run.id];
                            return (
                              <td key={run.id} className="p-3 text-[#0F172A]">
                                {val != null ? String(val) : <span className="text-[#94A3B8]">default</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E2DCD0] bg-[#FAF7F2] flex justify-end">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setCompareModalOpen(false)}
                className="bg-[#FFFDF9] border border-[#E2DCD0] text-[#0F172A]"
              >
                Close Comparison
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Recipe JSON Modal */}
      {recipeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FFFDF9] border border-[#E2DCD0] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E2DCD0] bg-[#FAF7F2]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-800">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base">
                    Pipeline Recipe: {recipeModal.model?.algorithm} <span className="text-purple-800 font-mono">v{recipeModal.model?.version || 1}</span>
                  </h3>
                  <p className="text-xs text-[#475569] font-mono">
                    Tied to Dataset v{recipeModal.model?.dataset_version || 1} • Immutable Transformation Config
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRecipeModal({ isOpen: false, model: null, recipe: null })}
                className="p-1.5 rounded-lg hover:bg-[#E2DCD0] text-[#475569] hover:text-[#0F172A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1 font-mono text-xs">
              <div className="flex items-center justify-between bg-[#FAF7F2] p-3 rounded-xl border border-[#E2DCD0]">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-[#64748B] block text-[10px] uppercase font-bold">Target</span>
                    <span className="text-cyan-800 font-bold">{recipeModal.recipe?.target?.column || 'churn'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px] uppercase font-bold">Task</span>
                    <span className="text-purple-800 font-bold">{recipeModal.recipe?.target?.task_type || 'classification'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px] uppercase font-bold">Features</span>
                    <span className="text-emerald-800 font-bold">{recipeModal.recipe?.feature_engineering_recipe?.feature_count ?? 'Auto'} cols</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px] uppercase font-bold">CV Folds</span>
                    <span className="text-amber-800 font-bold">{recipeModal.recipe?.validation_split_recipe?.cv_folds ?? 5}-fold</span>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="secondary"
                  className="flex items-center gap-1.5 text-xs bg-[#FFFDF9] border border-[#E2DCD0] text-[#0F172A]"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(recipeModal.recipe, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Recipe JSON'}
                </Button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2DCD0] text-[#0F172A] overflow-x-auto text-xs leading-relaxed max-h-96">
                  {JSON.stringify(recipeModal.recipe, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-[#E2DCD0] bg-[#FAF7F2] flex justify-end">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setRecipeModal({ isOpen: false, model: null, recipe: null })}
                className="bg-[#FFFDF9] border border-[#E2DCD0] text-[#0F172A]"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}