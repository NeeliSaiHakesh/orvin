"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Database, BarChart2, Wand2, Dna, Cpu, 
  Share2, FileCode2, Bot, CheckCircle2, ArrowRight,
  Sparkles, Layers, BrainCircuit
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = (params?.id as string) || 'p-101';
  const [project, setProject] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
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
    }
  };

  const hasDataset = datasets.length > 0;
  const hasModels = models.length > 0;
  const bestModel = models.find(m => m.is_selected) || models[0];

  const pipelineStages = [
    { 
      id: 'devops-agent', 
      name: 'Orvin AI Gate', 
      icon: <BrainCircuit className="w-5 h-5 text-indigo-700" />, 
      status: 'active',
      desc: 'Hindsight Memory powered CI/CD risk detection & auto-patch generator',
      color: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] font-bold'
    },
    { 
      id: 'datasets', 
      name: 'Dataset Ingestion', 
      icon: <Database className="w-5 h-5 text-blue-700" />, 
      status: hasDataset ? 'completed' : 'active',
      desc: hasDataset ? `${datasets[0].filename} (${datasets[0].row_count ?? '?'} rows)` : 'Upload CSV, Excel, or JSON dataset',
      color: 'bg-blue-50 text-blue-900 border-blue-200'
    },
    { 
      id: 'analysis', 
      name: 'Dataset Intelligence', 
      icon: <BarChart2 className="w-5 h-5 text-purple-700" />, 
      status: hasDataset ? 'active' : 'pending',
      desc: hasDataset ? 'Statistical profiling, missing values & correlations' : 'Requires uploaded dataset',
      color: 'bg-purple-50 text-purple-900 border-purple-200'
    },
    { 
      id: 'cleaning', 
      name: 'AI Data Cleaning', 
      icon: <Wand2 className="w-5 h-5 text-amber-700" />, 
      status: hasDataset ? 'active' : 'pending',
      desc: 'Automated imputation, outlier capping & encoding',
      color: 'bg-amber-50 text-amber-900 border-amber-200'
    },
    { 
      id: 'features', 
      name: 'Feature Engineering', 
      icon: <Dna className="w-5 h-5 text-indigo-700" />, 
      status: hasDataset ? 'active' : 'pending',
      desc: 'Temporal extraction, one-hot/label encoding & variance pruning',
      color: 'bg-indigo-50 text-indigo-900 border-indigo-200'
    },
    { 
      id: 'training', 
      name: 'AutoML Training', 
      icon: <Cpu className="w-5 h-5 text-emerald-700" />, 
      status: hasModels ? 'completed' : hasDataset ? 'active' : 'pending',
      desc: hasModels ? `Trained ${models.length} algorithms. Best: ${bestModel?.algorithm}` : 'Train 8+ ML algorithms with hyperparameter tuning',
      color: 'bg-emerald-50 text-emerald-900 border-emerald-200'
    },
    { 
      id: 'explain', 
      name: 'Explainable AI', 
      icon: <Share2 className="w-5 h-5 text-violet-700" />, 
      status: hasModels ? 'active' : 'pending',
      desc: hasModels ? 'SHAP feature importance, confusion matrix & ROC curves' : 'Requires trained model',
      color: 'bg-violet-50 text-violet-900 border-violet-200'
    },
    { 
      id: 'api-gen', 
      name: 'API Generator', 
      icon: <FileCode2 className="w-5 h-5 text-sky-700" />, 
      status: hasModels ? 'active' : 'pending',
      desc: hasModels ? 'Download FastAPI microservice & Docker bundle' : 'Export trained model to REST API',
      color: 'bg-sky-50 text-sky-900 border-sky-200'
    },
    { 
      id: 'assistant', 
      name: 'AI MLOps Assistant', 
      icon: <Bot className="w-5 h-5 text-rose-700" />, 
      status: 'active',
      desc: 'Ask questions grounded in your project metrics & data',
      color: 'bg-rose-50 text-rose-900 border-rose-200'
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in text-[#1F2937]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFDF9] p-6 rounded-3xl border border-[#E5E0D8] shadow-sm">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2 text-[#111827]">
            {project?.name || 'Machine Learning Project'}
          </h1>
          <div className="flex items-center gap-3 text-sm text-[#6B7280]">
            <span>Project ID: <span className="font-mono text-[#111827]">{projectId}</span></span>
            <span>•</span>
            <Badge variant="info">
              {project?.task_type ? project.task_type.toUpperCase() : 'CLASSIFICATION'}
            </Badge>
            {project?.target_column && (
              <>
                <span>•</span>
                <span>Target: <span className="text-amber-800 font-mono font-bold">{project.target_column}</span></span>
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
            <h2 className="text-xl font-bold font-heading text-[#111827] flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-700" /> Pipeline Modules
            </h2>
            <span className="text-xs text-[#6B7280]">Click any stage to open</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pipelineStages.map((stage) => (
              <Link 
                key={stage.id} 
                href={`/projects/${projectId}/${stage.id}`}
                className="block group"
              >
                <div className="p-5 rounded-2xl border border-[#E5E0D8] bg-[#FFFDF9] hover:bg-[#FAF7F0] hover:border-[#CBD5E1] transition-all duration-300 h-full flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-xl border ${stage.color}`}>
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
                    <h3 className="font-bold text-[#111827] group-hover:text-indigo-700 transition-colors text-base mb-1">
                      {stage.name}
                    </h3>
                    <p className="text-xs text-[#4B5563] leading-relaxed">
                      {stage.desc}
                    </p>
                  </div>
                  <div className="pt-4 mt-2 border-t border-[#E5E0D8] flex items-center justify-between text-xs text-[#6B7280] group-hover:text-[#111827]">
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
          <h2 className="text-xl font-bold font-heading text-[#111827]">Project Details</h2>
          <Card className="bg-[#FFFDF9] border-[#E5E0D8]">
            <CardBody className="space-y-4 text-sm text-[#1F2937]">
              <div>
                <span className="text-xs text-[#6B7280] uppercase tracking-wider">Description</span>
                <p className="font-medium text-[#111827] mt-1">
                  {project?.description || 'End-to-end automated machine learning pipeline'}
                </p>
              </div>
              <div className="pt-3 border-t border-[#E5E0D8] flex justify-between">
                <span className="text-[#6B7280]">Datasets Uploaded</span>
                <span className="font-semibold text-[#111827]">{datasets.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Models Trained</span>
                <span className="font-semibold text-[#111827]">{models.length}</span>
              </div>
              {bestModel && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Top Model</span>
                  <span className="font-semibold text-indigo-700">{bestModel.algorithm}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Task Type</span>
                <span className="font-medium uppercase text-amber-800">{project?.task_type || 'Classification'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Status</span>
                <span className="font-medium capitalize text-emerald-700">{project?.status || 'Created'}</span>
              </div>
            </CardBody>
          </Card>

          {/* AI Assistant Quick Card */}
          <Card className="bg-[#FFFDF9] border-[#E5E0D8]">
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                <Bot className="w-5 h-5" /> Need Insights?
              </div>
              <p className="text-xs text-[#4B5563] leading-relaxed">
                Use the grounded AI MLOps assistant to explain model trade-offs, feature importance, and cleaning history.
              </p>
              <Link href={`/projects/${projectId}/assistant`} className="block pt-2">
                <Button size="sm" className="w-full flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Open Assistant
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}