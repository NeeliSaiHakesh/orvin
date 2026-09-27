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
          {index === 0 ? <Trophy className="w-5 h-5 text-yellow-400" /> : <span className="w-5 text-center text-gray-500 font-mono">{index + 1}</span>}
        </div>
      )
    },
    { 
      key: 'algorithm', header: 'Model & Version', sortable: true,
      render: (item: ModelResult) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{item.algorithm}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              v{item.version || 1}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 font-mono">
            <span className="text-cyan-400/80">Trained on Dataset v{item.dataset_version || 1}</span>
            {item.metrics?.optimal_threshold && item.metrics.optimal_threshold !== 0.5 && (
              <>
                <span>•</span>
                <span className="text-emerald-400">Calibrated (thresh={item.metrics.optimal_threshold})</span>
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
            <span className="text-cyan-300 font-bold font-mono">
              {(mean * 100).toFixed(1)}%
            </span>
            {std != null && (
              <span className="text-[10px] text-gray-400 font-mono">
                ± {(std * 100).toFixed(2)}% std
              </span>
            )}
          </div>
        ) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'accuracy', header: 'Test Acc (80/20)', sortable: true, 
      render: (item: ModelResult, index = 0) => {
        const acc = item.metrics?.accuracy;
        return acc != null ? (
          <span className={index === 0 ? 'text-green-400 font-bold font-mono' : 'font-mono'}>
            {(acc * 100).toFixed(1)}%
          </span>
        ) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'f1', header: 'F1 Score', sortable: true, 
      render: (item: ModelResult) => {
        const f1 = item.metrics?.f1;
        return f1 != null ? <span className="font-mono">{f1.toFixed(3)}</span> : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'roc_auc', header: 'ROC AUC', sortable: true, 
      render: (item: ModelResult) => {
        const auc = item.metrics?.roc_auc;
        return auc != null ? (
          <span className="text-purple-300 font-mono font-medium">{auc.toFixed(3)}</span>
        ) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'precision_recall', header: 'Prec / Rec', 
      render: (item: ModelResult) => {
        const p = item.metrics?.precision;
        const r = item.metrics?.recall;
        return (p != null && r != null) ? (
          <span className="text-xs text-gray-300 font-mono">
            {(p * 100).toFixed(0)}% / {(r * 100).toFixed(0)}%
          </span>
        ) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'time', header: 'Speed', 
      render: (item: ModelResult) => (
        <span className="flex items-center gap-1 text-gray-400 text-xs font-mono">
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
            className="flex items-center gap-1 text-xs text-purple-300 hover:text-white hover:bg-purple-500/20"
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
          className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
          checked={selectedRunIds.includes(item.id)}
          onChange={() => toggleRunSelection(item.id)}
        />
      )
    },
    {
      key: 'run_name', header: 'Run Name & ID', sortable: true,
      render: (item: ExperimentRun) => (
        <div>
          <div className="font-semibold text-white text-xs">{item.run_name}</div>
          <div className="text-[10px] font-mono text-gray-500">ID: {item.id.slice(0, 8)}</div>
        </div>
      )
    },
    {
      key: 'version', header: 'Model / Dataset', sortable: true,
      render: (item: ExperimentRun) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            v{item.model_version}
          </span>
          <span className="text-gray-500">/</span>
          <span className="text-cyan-400 text-[11px]">
            Data v{item.dataset_version}
          </span>
        </div>
      )
    },
    {
      key: 'algorithm', header: 'Algorithm', sortable: true,
      render: (item: ExperimentRun) => (
        <Badge variant="neutral" className="font-mono text-xs">{item.algorithm}</Badge>
      )
    },
    {
      key: 'hyperparameters', header: 'Hyperparameters',
      render: (item: ExperimentRun) => {
        const entries = Object.entries(item.hyperparameters || {});
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {entries.slice(0, 2).map(([k, v]) => (
              <span key={k} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-gray-300">
                {k}: {String(v)}
              </span>
            ))}
            {entries.length > 2 && (
              <span className="text-[10px] text-gray-500 font-mono">+{entries.length - 2} more</span>
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
          <span className="text-green-400 font-bold font-mono text-xs">
            {typeof acc === 'number' ? (acc <= 1.0 ? `${(acc * 100).toFixed(1)}%` : acc.toFixed(3)) : String(acc)}
          </span>
        ) : <span className="text-gray-500">—</span>;
      }
    },
    {
      key: 'f1', header: 'F1 Score', sortable: true,
      render: (item: ExperimentRun) => {
        const f1 = item.metrics?.f1;
        return f1 != null && typeof f1 === 'number' ? (
          <span className="text-purple-300 font-mono text-xs">{f1.toFixed(3)}</span>
        ) : <span className="text-gray-500">—</span>;
      }
    },
    {
      key: 'duration', header: 'Duration', sortable: true,
      render: (item: ExperimentRun) => (
        <span className="text-gray-400 text-xs font-mono">
          {item.duration_seconds?.toFixed(2)}s
        </span>
      )
    },
    {
      key: 'created_at', header: 'Timestamp', sortable: true,
      render: (item: ExperimentRun) => (
        <span className="text-[11px] text-gray-400 font-mono">
          {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Model Training & Quality Benchmark</h1>
          <p className="text-gray-400">
            AutoML with strict deduplication, 5-Fold Stratified Cross-Validation, and MLflow-style experiment tracking.
          </p>
        </div>
        <Button onClick={startTraining} disabled={isTraining} className="flex items-center gap-2">
          {isTraining ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Training AutoML...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" /> Start AutoML Training
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
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {isTraining && (
        <Card glow>
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
              <h3 className="font-bold">Stratified Training & Cross-Validation in progress...</h3>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-500 to-cyan-500 h-3 transition-all duration-300 rounded-full" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Running 5-fold CV, probability calibration, and holdout evaluation...</span>
              <span>{progress}%</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Data Quality & Statistical Audit Summary */}
      {datasetStats && (
        <Card className="border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 via-transparent to-purple-950/20">
          <CardBody>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Data Quality & Statistical Audit</h4>
                  <p className="text-xs text-gray-400">Validated prior to train-test partition</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="glass p-2.5 rounded-lg border border-white/10">
                  <span className="text-gray-400 block text-[10px] uppercase">Total Rows</span>
                  <span className="text-white font-bold text-sm">{datasetStats.total_rows ?? '—'}</span>
                </div>
                <div className="glass p-2.5 rounded-lg border border-white/10">
                  <span className="text-gray-400 block text-[10px] uppercase">Duplicates Dropped</span>
                  <span className="text-emerald-400 font-bold text-sm">{datasetStats.duplicates_removed ?? 0}</span>
                </div>
                <div className="glass p-2.5 rounded-lg border border-white/10">
                  <span className="text-gray-400 block text-[10px] uppercase">Unique Clean Rows</span>
                  <span className="text-cyan-300 font-bold text-sm">{datasetStats.unique_rows ?? datasetStats.total_rows ?? '—'}</span>
                </div>
                <div className="glass p-2.5 rounded-lg border border-white/10">
                  <span className="text-gray-400 block text-[10px] uppercase">Train / Test Split</span>
                  <span className="text-purple-300 font-bold text-sm">
                    {datasetStats.train_rows ? `${datasetStats.train_rows} / ${datasetStats.test_rows}` : '80% / 20%'}
                  </span>
                </div>
              </div>
            </div>
            {datasetStats.small_dataset_warning && (
              <div className="mt-4 p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex items-start gap-3">
                <span className="text-yellow-400 text-lg leading-none mt-0.5">⚠</span>
                <div>
                  <p className="text-yellow-300 text-xs font-semibold">Small Dataset Warning</p>
                  <p className="text-yellow-200/70 text-xs mt-0.5">
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
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-4 h-4" /> Benchmark Leaderboard
            <Badge variant="neutral" className="text-[10px] ml-1">{leaderboard.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab('experiments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'experiments'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" /> Experiment Tracking (MLflow)
            <Badge variant="neutral" className="text-[10px] ml-1">{experimentRuns.length}</Badge>
          </button>
        </div>

        {activeTab === 'experiments' && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {selectedRunIds.length} run{selectedRunIds.length === 1 ? '' : 's'} selected
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={selectedRunIds.length < 2 || isComparing}
              onClick={handleCompareRuns}
              className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-purple-500/20 to-cyan-500/20 hover:from-purple-500/30 hover:to-cyan-500/30 border border-cyan-500/30 text-cyan-300"
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
              <Card>
                <CardBody className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Validated Algorithms</p>
                    <p className="text-2xl font-bold">{leaderboard.length}</p>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <Trophy className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Top Ranked Model</p>
                    <p className="text-2xl font-bold">{leaderboard[0]?.algorithm}</p>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/20 rounded-xl">
                    <Zap className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">5-Fold CV Score (Mean ± Std)</p>
                    <p className="text-xl font-bold font-mono text-cyan-300">
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

          <Card>
            <CardHeader>
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" /> Model Benchmark Leaderboard
              </h3>
            </CardHeader>
            {leaderboard.length > 0 ? (
              <DataTable data={leaderboard} columns={leaderboardColumns} />
            ) : (
              <CardBody>
                <div className="text-center py-12 text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                  <p className="text-lg text-white font-medium">Ready to Train AutoML</p>
                  <p className="text-sm mt-1 text-gray-400">
                    Click &quot;Start AutoML Training&quot; to deduplicate data, run 5-Fold Stratified CV, calibrate thresholds, and rank models.
                  </p>
                </div>
              </CardBody>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" /> MLflow-Style Experiment Runs
              </h3>
              <p className="text-xs text-gray-400 mt-1">
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
                className="text-xs text-gray-400 hover:text-white"
              >
                {selectedRunIds.length === experimentRuns.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </CardHeader>
          {experimentRuns.length > 0 ? (
            <DataTable data={experimentRuns} columns={experimentColumns} />
          ) : (
            <CardBody>
              <div className="text-center py-12 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-4 text-cyan-400" />
                <p className="text-lg text-white font-medium">No Experiment Runs Yet</p>
                <p className="text-sm mt-1 text-gray-400">
                  Run a training cycle to automatically record hyperparameters, evaluation metrics, and run artifacts.
                </p>
              </div>
            </CardBody>
          )}
        </Card>
      )}

      {/* Multi-Run Side-by-Side Comparison Modal */}
      {compareModalOpen && comparisonData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-950/40 via-gray-900 to-cyan-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Experiment Run Comparison ({comparisonData.runs?.length} Runs)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Side-by-side metric deltas and hyperparameter variance
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCompareModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
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
                          ? 'border-green-500/40 bg-green-500/10 shadow-lg shadow-green-500/10' 
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-white text-sm">{run.algorithm}</span>
                        {isBest && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-yellow-400" /> Best
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 space-y-0.5">
                        <div>Run: <span className="text-gray-300">{run.run_name}</span></div>
                        <div>Version: <span className="text-purple-300">v{run.model_version}</span> (Data v{run.dataset_version})</div>
                        <div>Duration: <span className="text-cyan-300">{run.duration_seconds?.toFixed(2)}s</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Metrics Comparison Table */}
              <div>
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-green-400" /> Key Metrics Comparison
                </h4>
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-white/5 text-gray-400 text-[11px] border-b border-white/10 uppercase">
                      <tr>
                        <th className="p-3">Metric</th>
                        {comparisonData.runs?.map((run: ExperimentRun) => (
                          <th key={run.id} className="p-3">
                            {run.algorithm} (v{run.model_version})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {comparisonData.metrics_comparison?.map((m: any) => (
                        <tr key={m.metric_name} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-semibold text-gray-300 capitalize">
                            {m.metric_name.replace(/_/g, ' ')}
                          </td>
                          {comparisonData.runs?.map((run: ExperimentRun) => {
                            const val = m.values?.[run.id];
                            return (
                              <td key={run.id} className="p-3">
                                {val != null ? (
                                  <span className={typeof val === 'number' && val > 0.8 ? 'text-green-400 font-bold' : 'text-gray-200'}>
                                    {typeof val === 'number' ? (val <= 1.0 && val >= 0 ? val.toFixed(4) : val.toFixed(2)) : String(val)}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">—</span>
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
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" /> Hyperparameter Breakdown & Diffs
                </h4>
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-white/5 text-gray-400 text-[11px] border-b border-white/10 uppercase">
                      <tr>
                        <th className="p-3">Parameter</th>
                        {comparisonData.runs?.map((run: ExperimentRun) => (
                          <th key={run.id} className="p-3">
                            {run.algorithm}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {comparisonData.parameter_diffs?.map((p: any) => (
                        <tr key={p.param_name} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-semibold text-purple-300">
                            {p.param_name}
                          </td>
                          {comparisonData.runs?.map((run: ExperimentRun) => {
                            const val = p.values?.[run.id];
                            return (
                              <td key={run.id} className="p-3 text-gray-300">
                                {val != null ? String(val) : <span className="text-gray-600">default</span>}
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

            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setCompareModalOpen(false)}
              >
                Close Comparison
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Recipe JSON Modal */}
      {recipeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Pipeline Recipe: {recipeModal.model?.algorithm} <span className="text-purple-400 font-mono">v{recipeModal.model?.version || 1}</span>
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    Tied to Dataset v{recipeModal.model?.dataset_version || 1} • Immutable Transformation Config
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRecipeModal({ isOpen: false, model: null, recipe: null })}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1 font-mono text-xs">
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Target</span>
                    <span className="text-cyan-300 font-bold">{recipeModal.recipe?.target?.column || 'churn'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Task</span>
                    <span className="text-purple-300 font-bold">{recipeModal.recipe?.target?.task_type || 'classification'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Features</span>
                    <span className="text-emerald-300 font-bold">{recipeModal.recipe?.feature_engineering_recipe?.feature_count ?? 'Auto'} cols</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">CV Folds</span>
                    <span className="text-yellow-300 font-bold">{recipeModal.recipe?.validation_split_recipe?.cv_folds ?? 5}-fold</span>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="secondary"
                  className="flex items-center gap-1.5 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(recipeModal.recipe, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Recipe JSON'}
                </Button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-black/60 border border-white/10 text-cyan-300 overflow-x-auto text-xs leading-relaxed max-h-96">
                  {JSON.stringify(recipeModal.recipe, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-white/10 bg-white/5 flex justify-end">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setRecipeModal({ isOpen: false, model: null, recipe: null })}
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