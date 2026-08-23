"use client";
import React, { useState, useEffect } from 'react';
import { Play, Trophy, Zap, Clock, Target, CheckCircle2, ShieldCheck, Filter, Users, Database } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';

interface ModelResult {
  id?: string;
  algorithm: string;
  metrics: Record<string, any>;
  training_time_seconds: number;
  is_selected: boolean;
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

  useEffect(() => {
    loadLeaderboard();
    loadDatasets();
  }, [projectId]);

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
      
      const data = await api.training.leaderboard(projectId);
      setLeaderboard(data.models || result.models || []);
      if (data.dataset_stats) {
        setDatasetStats(data.dataset_stats);
      }

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

  const columns = [
    { 
      key: 'rank', header: 'Rank', 
      render: (_: ModelResult, index = 0) => (
        <div className="flex items-center gap-2">
          {index === 0 ? <Trophy className="w-5 h-5 text-yellow-400" /> : <span className="w-5 text-center text-gray-500 font-mono">{index + 1}</span>}
        </div>
      )
    },
    { 
      key: 'algorithm', header: 'Algorithm', sortable: true,
      render: (item: ModelResult) => (
        <div>
          <span className="font-semibold text-white">{item.algorithm}</span>
          {item.metrics?.optimal_threshold && item.metrics.optimal_threshold !== 0.5 && (
            <span className="block text-[10px] text-cyan-400 font-mono">
              Calibrated (thresh={item.metrics.optimal_threshold})
            </span>
          )}
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
      key: 'split_rows', header: 'Train / Test', 
      render: (item: ModelResult) => {
        const tr = item.metrics?.train_rows;
        const ts = item.metrics?.test_rows;
        return (tr != null && ts != null) ? (
          <span className="text-xs text-gray-400 font-mono">
            {tr} / {ts}
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
      key: 'action', header: '', 
      render: (item: ModelResult) => (
        <Button 
          size="sm" 
          variant={item.is_selected ? 'primary' : 'secondary'}
          onClick={() => item.id && selectModel(item.id)}
        >
          {item.is_selected ? '✓ Selected' : 'Select'}
        </Button>
      )
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Model Training & Quality Benchmark</h1>
          <p className="text-gray-400">
            AutoML with strict deduplication, 5-Fold Stratified Cross-Validation, and threshold calibration.
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
          </CardBody>
        </Card>
      )}

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
          <DataTable data={leaderboard} columns={columns} />
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
  );
}