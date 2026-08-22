"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Database, BarChart2, Wand2, Dna, Cpu, 
  Share2, FileCode2, Bot, CheckCircle2, ArrowRight,
  Sparkles, Layers, Clock, AlertCircle
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [projData, dsData, trainData] = await Promise.allSettled([
        api.projects.get(projectId),
        api.datasets.list(projectId),
        api.training.leaderboard(projectId),
      ]);

      if (projData.status === 'fulfilled') {
        setProject(projData.value);
      } else {
        setProject({
          id: projectId,
          name: `Project ${projectId.substring(0, 8)}`,
          description: 'Tabular Machine Learning Project',
          task_type: 'classification',
          status: 'created',
          created_at: new Date().toISOString(),
        });
      }

      if (dsData.status === 'fulfilled' && Array.isArray(dsData.value)) {
        setDatasets(dsData.value);
      }
      if (trainData.status === 'fulfilled' && trainData.value?.models) {
        setModels(trainData.value.models);
      }
    } catch {
      // Fallback state
    } finally {
      setLoading(false);
    }
  };

  const hasDataset = datasets.length > 0;
  const hasModels = models.length > 0;
  const bestModel = models.find(m => m.is_selected) || models[0];

  const pipelineStages = [
    { 
      id: 'datasets', 
      name: 'Dataset Ingestion', 
      icon: <Database className="w-5 h-5" />, 
      status: hasDataset ? 'completed' : 'active',
      desc: hasDataset ? `${datasets[0].filename} (${datasets[0].row_count ?? '?'} rows)` : 'Upload CSV, Excel, or JSON dataset',
      color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30'
    },
    { 
      id: 'analysis', 
      name: 'Dataset Intelligence', 
      icon: <BarChart2 className="w-5 h-5" />, 
      status: hasDataset ? 'active' : 'pending',
      desc: hasDataset ? 'Statistical profiling, missing values & correlations' : 'Requires uploaded dataset',
      color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30'
    },
    { 
      id: 'cleaning', 
      name: 'AI Data Cleaning', 
      icon: <Wand2 className="w-5 h-5" />, 
      status: hasDataset ? 'active' : 'pending',
      desc: 'Automated imputation, outlier capping & encoding',
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30'
    },
    { 
      id: 'features', 
      name: 'Feature Engineering', 
      icon: <Dna className="w-5 h-5" />, 
      status: hasDataset ? 'active' : 'pending',
      desc: 'Temporal extraction, one-hot/label encoding & variance pruning',
      color: 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30'
    },
    { 
      id: 'training', 
      name: 'AutoML Training', 
      icon: <Cpu className="w-5 h-5" />, 
      status: hasModels ? 'completed' : hasDataset ? 'active' : 'pending',
      desc: hasModels ? `Trained ${models.length} algorithms. Best: ${bestModel?.algorithm}` : 'Train 8+ ML algorithms with hyperparameter tuning',
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30'
    },
    { 
      id: 'explain', 
      name: 'Explainable AI', 
      icon: <Share2 className="w-5 h-5" />, 
      status: hasModels ? 'active' : 'pending',
      desc: hasModels ? 'SHAP feature importance, confusion matrix & ROC curves' : 'Requires trained model',
      color: 'from-violet-500/20 to-fuchsia-500/20 text-violet-400 border-violet-500/30'
    },
    { 
      id: 'api-gen', 
      name: 'API Generator', 
      icon: <FileCode2 className="w-5 h-5" />, 
      status: hasModels ? 'active' : 'pending',
      desc: hasModels ? 'Download FastAPI microservice & Docker bundle' : 'Export trained model to REST API',
      color: 'from-sky-500/20 to-blue-500/20 text-sky-400 border-sky-500/30'
    },
    { 
      id: 'assistant', 
      name: 'AI MLOps Assistant', 
      icon: <Bot className="w-5 h-5" />, 
      status: 'active',
      desc: 'Ask questions grounded in your project metrics & data',
      color: 'from-rose-500/20 to-purple-500/20 text-rose-400 border-rose-500/30'
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2 text-white">
            {project?.name || 'Machine Learning Project'}
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>Project ID: <span className="font-mono text-gray-300">{projectId}</span></span>
            <span>•</span>
            <Badge variant="info">
              {project?.task_type ? project.task_type.toUpperCase() : 'CLASSIFICATION'}
            </Badge>
            {project?.target_column && (
              <>
                <span>•</span>
                <span>Target: <span className="text-cyan-400 font-mono">{project.target_column}</span></span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/projects/${projectId}/datasets`}>
            <Button variant="secondary" className="flex items-center gap-2">
              <Database className="w-4 h-4" /> Manage Datasets
            </Button>
          </Link>
          <Link href={`/projects/${projectId}/training`}>
            <Button className="flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Start Training
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Interactive Pipeline Stages */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" /> Pipeline Modules
            </h2>
            <span className="text-xs text-gray-400">Click any stage to open</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pipelineStages.map((stage) => (
              <Link 
                key={stage.id} 
                href={`/projects/${projectId}/${stage.id}`}
                className="block group"
              >
                <div className={`p-5 rounded-2xl border transition-all duration-300 h-full flex flex-col justify-between ${
                  stage.status === 'completed'
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                    : stage.status === 'active'
                    ? 'bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-white/10 hover:scale-[1.02]'
                    : 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100 hover:border-white/20'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br border ${stage.color}`}>
                        {stage.icon}
                      </div>
                      {stage.status === 'completed' ? (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </Badge>
                      ) : stage.status === 'active' ? (
                        <Badge variant="info">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Pending</Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors text-base mb-1">
                      {stage.name}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {stage.desc}
                    </p>
                  </div>
                  <div className="pt-4 mt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-400 group-hover:text-white">
                    <span>Open Module</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Col: Project Stats & Quick Info */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold font-heading text-white">Project Details</h2>
          <Card>
            <CardBody className="space-y-4 text-sm">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Description</span>
                <p className="font-medium text-gray-200 mt-1">
                  {project?.description || 'End-to-end automated machine learning pipeline'}
                </p>
              </div>
              <div className="pt-3 border-t border-white/10 flex justify-between">
                <span className="text-gray-400">Datasets Uploaded</span>
                <span className="font-semibold text-white">{datasets.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Models Trained</span>
                <span className="font-semibold text-white">{models.length}</span>
              </div>
              {bestModel && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Top Model</span>
                  <span className="font-semibold text-purple-400">{bestModel.algorithm}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Task Type</span>
                <span className="font-medium uppercase text-cyan-400">{project?.task_type || 'Classification'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="font-medium capitalize text-emerald-400">{project?.status || 'Created'}</span>
              </div>
            </CardBody>
          </Card>

          {/* AI Assistant Quick Card */}
          <Card glow>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Bot className="w-5 h-5" /> Need Insights?
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Use the grounded AI MLOps assistant to explain model trade-offs, feature importance, and cleaning history.
              </p>
              <Link href={`/projects/${projectId}/assistant`} className="block pt-2">
                <Button size="sm" className="w-full flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" /> Open Assistant
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}