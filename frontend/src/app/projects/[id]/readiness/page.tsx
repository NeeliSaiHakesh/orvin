"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Award, CheckCircle2, AlertTriangle, ShieldCheck, 
  Cpu, Zap, Layers, Activity, Download, RefreshCw, 
  FileText, ArrowRight, ChevronDown, ChevronUp, Sparkles, Check
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { Plot } from '@/components/ui/Plot';
import { api } from '@/lib/api';

interface MetricDetail {
  name: string;
  score: number;
  max_score: number;
  status: string;
  detail: string;
}

interface PillarScoreItem {
  id: string;
  name: string;
  weight: number;
  score: number;
  max_score: number;
  status: string;
  icon: string;
  metrics: MetricDetail[];
}

interface RemediationCheckItem {
  id: string;
  pillar: string;
  title: string;
  severity: string;
  action: string;
  points_gain: number;
  status: string;
}

interface RadarAxisPoint {
  pillar_name: string;
  score_percentage: number;
}

interface ProductionReadinessResponse {
  project_id: string;
  dataset_name?: string;
  overall_score: number;
  gate_verdict: string;
  verdict_badge: string;
  verdict_summary: string;
  pillars: PillarScoreItem[];
  radar_data: RadarAxisPoint[];
  remediation_checklist: RemediationCheckItem[];
  generated_at: string;
}

export default function ReadinessPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [data, setData] = useState<ProductionReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [completedRemediations, setCompletedRemediations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDatasetsAndScore();
  }, [projectId]);

  const loadDatasetsAndScore = async () => {
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

      const res = await api.readiness.getScore(projectId, defaultDsId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load readiness scorecard');
    } finally {
      setLoading(false);
    }
  };

  const handleDatasetSelect = async (datasetId: string) => {
    try {
      setSelectedDataset(datasetId);
      setLoading(true);
      setError(null);
      const res = await api.readiness.getScore(projectId, datasetId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate dataset readiness');
    } finally {
      setLoading(false);
    }
  };

  const toggleRemediation = (id: string) => {
    setCompletedRemediations(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Compute live score with completed remediations
  const computedBonusPoints = data?.remediation_checklist?.reduce((acc, item) => {
    return completedRemediations[item.id] ? acc + item.points_gain : acc;
  }, 0) || 0;

  const displayScore = Math.min(100, (data?.overall_score || 0) + computedBonusPoints);

  const downloadSignOffCertificate = () => {
    if (!data) return;
    const cert = `# MLOps Production Gate Readiness Sign-Off Certificate
======================================================
Project ID: ${projectId}
Target Dataset: ${data.dataset_name || 'Active Project Model'}
Evaluation Timestamp: ${data.generated_at}

Readiness Score: ${displayScore} / 100
Gate Verdict: ${displayScore >= 90 ? 'APPROVED (Certified Production Ready)' : (displayScore >= 75 ? 'CONDITIONAL (Approved with Telemetry)' : 'BLOCKED')}

--- PILLAR BREAKDOWN ---
1. Performance & Calibration: ${data.pillars[0]?.score}/${data.pillars[0]?.max_score} pts
2. Latency SLA & Resilience: ${data.pillars[1]?.score}/${data.pillars[1]?.max_score} pts
3. Data Quality & Feature Integrity: ${data.pillars[2]?.score}/${data.pillars[2]?.max_score} pts
4. Drift Observability & Monitoring: ${data.pillars[3]?.score}/${data.pillars[3]?.max_score} pts
5. Security, Privacy & Fairness: ${data.pillars[4]?.score}/${data.pillars[4]?.max_score} pts

Executive Summary:
${data.verdict_summary}

Signed-Off By: AutoMLOps Automated Governance Engine
`;
    const blob = new Blob([cert], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production_readiness_certificate_${projectId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPillarIcon = (iconName: string) => {
    switch (iconName) {
      case 'Cpu':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case 'Layers':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'Activity':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
      default:
        return <Award className="w-4 h-4 text-cyan-400" />;
    }
  };

  // Plotly Radar / Spider Chart data
  const getRadarPlotData = () => {
    if (!data?.radar_data) return [];
    const rValues = data.radar_data.map(p => p.score_percentage);
    const thetaValues = data.radar_data.map(p => p.pillar_name);

    // Close the polygon
    rValues.push(rValues[0]);
    thetaValues.push(thetaValues[0]);

    return [
      {
        type: 'scatterpolar' as const,
        r: rValues,
        theta: thetaValues,
        fill: 'toself' as const,
        name: 'Model Readiness',
        fillcolor: 'rgba(6, 182, 212, 0.25)',
        line: { color: '#06B6D4', width: 2.5 },
        marker: { size: 6, color: '#8B5CF6' }
      }
    ];
  };

  const radarLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#F9FAFB', size: 10 },
    polar: {
      radialaxis: { visible: true, range: [0, 100], color: '#4B5563', gridcolor: '#1f293d' },
      angularaxis: { color: '#9CA3AF', gridcolor: '#1f293d' }
    },
    margin: { t: 30, b: 30, l: 40, r: 40 },
    showlegend: false
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/40">
              <Award className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Production Governance & QA</span>
          </div>
          <h1 className="text-3xl font-bold font-heading">Model Health & Readiness Score</h1>
          <p className="text-gray-400 text-sm">
            5-pillar production gate evaluation across Performance, Latency SLA, Data Quality, Drift Observability, and Fairness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={downloadSignOffCertificate}
            disabled={!data || loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Certificate
          </Button>

          <Button 
            onClick={loadDatasetsAndScore} 
            disabled={loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-Audit
          </Button>
        </div>
      </div>

      {/* Dataset Selector */}
      <DatasetSelector
        datasets={datasets}
        selectedDatasetId={selectedDataset}
        onSelect={handleDatasetSelect}
        projectId={projectId}
        label="Audited Dataset / Artifact"
      />

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Production Gate Hero Banner */}
      {data && (
        <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-[#0e1628] via-[#0d1424] to-[#0a0f1d] shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Governance Verdict</span>
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  displayScore >= 90
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : displayScore >= 75
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {displayScore >= 90 ? '🟢 Certified Production-Ready' : (displayScore >= 75 ? '🟡 Conditional Approval' : '🔴 Deployment Blocked')}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {displayScore >= 90 ? 'Automated Release Authorized' : (displayScore >= 75 ? 'Production Deployment Approved with Active Monitoring' : 'Governance Blockers Identified')}
              </h2>

              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-normal">
                {data.verdict_summary}
              </p>
            </div>

            {/* Overall Score Radial Gauge */}
            <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white/5 border border-white/10 shrink-0 min-w-[180px] text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Production Health</span>
              <div className="text-5xl font-extrabold font-heading text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400">
                {displayScore}
              </div>
              <span className="text-[11px] text-gray-400 mt-1">out of 100 points</span>
              {computedBonusPoints > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                  +{computedBonusPoints} pts from remediations
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5 Pillars & Radar Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 5 Pillar Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" /> Multi-Pillar Governance Scorecards
          </h3>

          <div className="space-y-3">
            {data?.pillars?.map((p) => {
              const pct = Math.round((p.score / p.max_score) * 100);
              const isExpanded = expandedPillar === p.id;

              return (
                <div 
                  key={p.id}
                  className="glass rounded-2xl p-4 border border-white/10 bg-[#0d1424]/80 space-y-3 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        {getPillarIcon(p.icon)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{p.name}</h4>
                        <span className="text-[11px] text-gray-400">Weight: {p.weight} pts</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-cyan-300 font-mono">
                        {p.score} <span className="text-xs text-gray-400 font-normal">/ {p.max_score}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold">{pct}%</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Accordion Toggle */}
                  <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
                    <button
                      onClick={() => setExpandedPillar(isExpanded ? null : p.id)}
                      className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 text-[11px]"
                    >
                      <span>{isExpanded ? 'Hide Metric Audit' : `View ${p.metrics.length} Detailed Checks`}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Sub-Metrics Breakdown */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-white/10 animate-slide-up text-xs">
                      {p.metrics.map((m) => (
                        <div key={m.name} className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-white">{m.name}</span>
                            <span className="font-mono text-cyan-300">{m.score}/{m.max_score} pts</span>
                          </div>
                          <p className="text-[11px] text-gray-400">{m.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Radar Chart & Remediation Checklist (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Radar Chart Card */}
          <Card glow>
            <CardHeader className="pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-white">5-Pillar Balance Radar</h3>
              </div>
            </CardHeader>
            <CardBody className="h-[270px]">
              <Plot
                data={getRadarPlotData()}
                layout={radarLayout}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
              />
            </CardBody>
          </Card>

          {/* Remediation Action Checklist */}
          <Card glow>
            <CardHeader className="pb-3 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Remediation Checklist</h3>
              </div>
              <span className="text-[11px] text-gray-400">Resolve to earn bonus points</span>
            </CardHeader>

            <CardBody className="p-4 space-y-3">
              {data?.remediation_checklist?.map((item) => {
                const isCompleted = completedRemediations[item.id];

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleRemediation(item.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-gray-300'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        isCompleted ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/30 bg-black/30'
                      }`}>
                        {isCompleted && <Check className="w-3.5 h-3.5 font-extrabold text-black" />}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-bold ${isCompleted ? 'line-through text-gray-400' : 'text-white'}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.2 rounded shrink-0">
                            +{item.points_gain} pts
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-snug">{item.action}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
