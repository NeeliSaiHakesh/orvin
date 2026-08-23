"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Sparkles, BrainCircuit, Wand2, Cpu, Server, Activity, 
  CheckCircle2, AlertTriangle, ArrowRight, Download, RefreshCw, 
  Layers, ShieldAlert, Zap, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { api } from '@/lib/api';

interface RecommendationItem {
  id: string;
  category: string;
  title: string;
  action: string;
  confidence_score: number;
  reasoning: string;
  impact: string;
  priority: string;
  tags: string[];
}

interface CategorySummary {
  category: string;
  total_recommendations: number;
  high_priority_count: number;
  readiness_rating: string;
}

interface DecisionReport {
  project_id: string;
  dataset_id?: string;
  dataset_name?: string;
  task_type: string;
  overall_readiness_score: number;
  executive_summary: string;
  dataset_profile_highlights: Record<string, any>;
  categories: CategorySummary[];
  recommendations: RecommendationItem[];
  generated_at: string;
}

export default function DecisionEnginePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [report, setReport] = useState<DecisionReport | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [appliedActions, setAppliedActions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDatasetsAndReport();
  }, [projectId]);

  const loadDatasetsAndReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const dsData = await api.datasets.list(projectId);
      const list = Array.isArray(dsData) ? dsData : [];
      setDatasets(list);

      const defaultDsId = list.length > 0 ? list[0].id : undefined;
      if (defaultDsId) {
        setSelectedDataset(defaultDsId);
      }

      const rep = await api.decision.get(projectId, defaultDsId);
      setReport(rep);
    } catch (err: any) {
      setError(err.message || 'Failed to load AI decision report');
    } finally {
      setLoading(false);
    }
  };

  const handleDatasetSelect = async (datasetId: string) => {
    try {
      setSelectedDataset(datasetId);
      setGenerating(true);
      setError(null);
      const rep = await api.decision.get(projectId, datasetId);
      setReport(rep);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze selected dataset');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const rep = await api.decision.generate(projectId, selectedDataset || undefined);
      setReport(rep);
    } catch (err: any) {
      setError(err.message || 'Failed to re-generate decisions');
    } finally {
      setGenerating(false);
    }
  };

  const toggleApply = (id: string) => {
    setAppliedActions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const downloadBlueprint = () => {
    if (!report) return;
    const content = JSON.stringify(report, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mlops_decision_blueprint_${report.dataset_name || 'project'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredRecommendations = (report?.recommendations || []).filter(item => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchPriority = selectedPriority === 'all' || item.priority === selectedPriority;
    return matchCategory && matchPriority;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'preprocessing':
        return <Wand2 className="w-4 h-4 text-purple-400" />;
      case 'modeling':
        return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'deployment':
        return <Server className="w-4 h-4 text-emerald-400" />;
      case 'monitoring':
        return <Activity className="w-4 h-4 text-amber-400" />;
      default:
        return <BrainCircuit className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'preprocessing':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'modeling':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'deployment':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'monitoring':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      default:
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40">
              <BrainCircuit className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">AI-Driven Optimization</span>
          </div>
          <h1 className="text-3xl font-bold font-heading">AI MLOps Decision Engine</h1>
          <p className="text-gray-400 text-sm">
            Explainable strategic blueprint covering preprocessing, algorithms, infrastructure sizing, and drift policies.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="secondary" 
            onClick={downloadBlueprint}
            disabled={!report || loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Blueprint
          </Button>

          <Button 
            onClick={handleRegenerate} 
            disabled={generating || loading || !selectedDataset}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Analyzing...' : 'Re-Evaluate'}
          </Button>
        </div>
      </div>

      {/* Dataset Selector Bar */}
      <DatasetSelector
        datasets={datasets}
        selectedDatasetId={selectedDataset}
        onSelect={handleDatasetSelect}
        projectId={projectId}
        label="Target Dataset Evaluated"
      />

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Executive Hero Banner */}
      {report && (
        <div className="glass rounded-2xl p-6 border border-white/10 relative overflow-hidden bg-gradient-to-br from-[#12192e] via-[#0d1424] to-[#0a0f1d] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Executive Strategy Synthesis</span>
              </div>
              <p className="text-sm sm:text-base text-gray-200 leading-relaxed font-normal">
                {report.executive_summary}
              </p>

              {/* Data Quality Highlights */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-gray-400">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                  <strong className="text-white">{report.dataset_profile_highlights?.row_count?.toLocaleString()}</strong> Rows
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                  <strong className="text-white">{report.dataset_profile_highlights?.col_count}</strong> Columns
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                  Missing Ratio: <strong className={report.dataset_profile_highlights?.missing_percentage > 5 ? 'text-amber-400' : 'text-emerald-400'}>{report.dataset_profile_highlights?.missing_percentage}%</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                  Class Balance: <strong className={report.dataset_profile_highlights?.is_imbalanced ? 'text-amber-400' : 'text-emerald-400'}>{report.dataset_profile_highlights?.is_imbalanced ? 'Imbalanced' : 'Balanced'}</strong>
                </span>
              </div>
            </div>

            {/* Score Radial Indicator */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 shrink-0 min-w-[170px] text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">MLOps Readiness</span>
              <div className="text-4xl font-extrabold font-heading text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                {report.overall_readiness_score}%
              </div>
              <span className={`text-[11px] font-semibold mt-1 px-2.5 py-0.5 rounded-full ${
                report.overall_readiness_score >= 80 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {report.overall_readiness_score >= 80 ? 'Production Ready' : 'Optimization Advised'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Category Pills & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {[
            { key: 'all', label: 'All Recommendations', count: report?.recommendations?.length || 0 },
            { key: 'preprocessing', label: 'Data Preprocessing', count: report?.recommendations?.filter(r => r.category === 'preprocessing').length || 0 },
            { key: 'modeling', label: 'Model Architecture', count: report?.recommendations?.filter(r => r.category === 'modeling').length || 0 },
            { key: 'deployment', label: 'Deployment & Sizing', count: report?.recommendations?.filter(r => r.category === 'deployment').length || 0 },
            { key: 'monitoring', label: 'Drift & Observability', count: report?.recommendations?.filter(r => r.category === 'monitoring').length || 0 },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeCategory === tab.key
                  ? 'bg-gradient-to-r from-purple-600/40 to-cyan-600/40 border border-cyan-500/50 text-white shadow-md'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono font-bold">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#10182b] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority Only</option>
            <option value="medium">Medium Priority</option>
          </select>
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRecommendations.map((item) => {
          const isExpanded = expandedCard === item.id;
          const isApplied = appliedActions[item.id];

          return (
            <div
              key={item.id}
              className={`glass rounded-2xl p-5 border transition-all duration-200 ${
                item.priority === 'high' 
                  ? 'border-purple-500/30 bg-[#0e1628]/90 hover:border-purple-500/50' 
                  : 'border-white/10 bg-[#0d1424]/70 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border flex items-center gap-1.5 ${getCategoryBadgeClass(item.category)}`}>
                      {getCategoryIcon(item.category)}
                      {item.category}
                    </span>

                    {item.priority === 'high' && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-300 border border-red-500/30">
                        High Priority
                      </span>
                    )}

                    <span className="text-xs text-gray-400 font-mono">
                      Confidence: <strong className="text-cyan-300">{Math.round(item.confidence_score * 100)}%</strong>
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    {item.title}
                  </h3>

                  {/* Suggested Action Pill */}
                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-start gap-2.5 text-xs text-gray-200">
                    <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-cyan-300 font-medium">Recommended Action:</strong> {item.action}
                    </div>
                  </div>

                  {/* Impact Tag & Tags */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                      🎯 Impact: {item.impact}
                    </span>
                    {item.tags?.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-white/5 text-gray-400 text-[11px]">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right Side Action Controls */}
                <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 pt-2 md:pt-0">
                  <button
                    onClick={() => toggleApply(item.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isApplied 
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
                        : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isApplied ? 'text-emerald-400' : 'text-gray-400'}`} />
                    <span>{isApplied ? 'Applied to Pipeline' : 'Mark as Applied'}</span>
                  </button>

                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : item.id)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 mt-1"
                  >
                    <span>{isExpanded ? 'Hide Reasoning' : 'Explain Why'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Detailed Reasoning Accordion */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2 animate-slide-up text-xs bg-black/20 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold uppercase tracking-wider text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" /> AI Statistical Rationale
                  </div>
                  <p className="text-gray-300 leading-relaxed font-normal">
                    {item.reasoning}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {filteredRecommendations.length === 0 && !loading && (
          <div className="glass p-12 text-center rounded-2xl border border-white/10">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-cyan-400" />
            <h4 className="text-base font-bold text-white">No matching recommendations found</h4>
            <p className="text-xs text-gray-400 mt-1">Try switching to &quot;All Recommendations&quot; or changing priority filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
