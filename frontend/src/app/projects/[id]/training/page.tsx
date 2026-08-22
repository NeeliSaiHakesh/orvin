"use client";
import React, { useState, useEffect } from 'react';
import { Play, Trophy, Zap, Clock, Target } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
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
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [leaderboard, setLeaderboard] = useState<ModelResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [projectId]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await api.training.leaderboard(projectId);
      const models = data.models || [];
      setLeaderboard(models);
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
        setProgress(prev => Math.min(prev + 3, 90));
      }, 400);

      const result = await api.training.start(projectId, {
        test_size: 0.2,
        cv_folds: 5,
        scoring_metric: 'auto',
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await api.training.leaderboard(projectId);
      setLeaderboard(data.models || result.models || []);

      setTimeout(() => {
        setIsTraining(false);
        setProgress(0);
      }, 600);
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
          {index === 0 ? <Trophy className="w-5 h-5 text-yellow-400" /> : <span className="w-5 text-center text-gray-500">{index + 1}</span>}
        </div>
      )
    },
    { key: 'algorithm', header: 'Model', sortable: true },
    { 
      key: 'accuracy', header: 'Accuracy', sortable: true, 
      render: (item: ModelResult, index = 0) => {
        const acc = item.metrics?.accuracy;
        return acc != null ? (
          <span className={index === 0 ? 'text-green-400 font-bold' : ''}>
            {(acc * 100).toFixed(2)}%
          </span>
        ) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'f1', header: 'F1 Score', sortable: true, 
      render: (item: ModelResult) => {
        const f1 = item.metrics?.f1;
        return f1 != null ? f1.toFixed(4) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'roc_auc', header: 'ROC AUC', sortable: true, 
      render: (item: ModelResult) => {
        const auc = item.metrics?.roc_auc;
        return auc != null ? auc.toFixed(4) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'rmse', header: 'RMSE',
      render: (item: ModelResult) => {
        const rmse = item.metrics?.rmse;
        return rmse != null ? rmse.toFixed(4) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'r2', header: 'R²',
      render: (item: ModelResult) => {
        const r2 = item.metrics?.r2;
        return r2 != null ? r2.toFixed(4) : <span className="text-gray-500">—</span>;
      }
    },
    { 
      key: 'time', header: 'Time', 
      render: (item: ModelResult) => (
        <span className="flex items-center gap-1 text-gray-400">
          <Clock className="w-3 h-3" /> {item.training_time_seconds?.toFixed(1)}s
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Model Training</h1>
          <p className="text-gray-400">AutoML engine — train, compare, and select the best model.</p>
        </div>
        <Button onClick={startTraining} disabled={isTraining} className="flex items-center gap-2">
          {isTraining ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Training...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" /> Start AutoML
            </>
          )}
        </Button>
      </div>

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
              <h3 className="font-bold">Training in progress...</h3>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-500 to-cyan-500 h-3 transition-all duration-300 rounded-full" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Training machine learning algorithms in parallel...</span>
              <span>{progress}%</span>
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
                <p className="text-sm text-gray-400">Models Trained</p>
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
                <p className="text-sm text-gray-400">Best Model</p>
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
                <p className="text-sm text-gray-400">Best Score</p>
                <p className="text-2xl font-bold">
                  {leaderboard[0]?.metrics?.accuracy 
                    ? `${(leaderboard[0].metrics.accuracy * 100).toFixed(1)}%`
                    : leaderboard[0]?.metrics?.r2
                    ? `R²=${leaderboard[0].metrics.r2.toFixed(3)}`
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
            <Trophy className="w-5 h-5 text-yellow-400" /> Leaderboard
          </h3>
        </CardHeader>
        {leaderboard.length > 0 ? (
          <DataTable data={leaderboard} columns={columns} />
        ) : (
          <CardBody>
            <div className="text-center py-12 text-gray-500">
              <Zap className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-bounce" />
              <p className="text-lg text-white font-medium">Starting AutoML Training...</p>
              <p className="text-sm mt-1 text-gray-400">Building algorithms and ranking leaderboard models</p>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}