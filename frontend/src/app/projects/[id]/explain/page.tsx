"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plot } from '@/components/ui/Plot';
import { BrainCircuit, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
import { api } from '@/lib/api';

export default function ExplainPage() {
  const params = useParams();
  const projectId = (params?.id as string) || 'p-101';
  const [explanation, setExplanation] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = async (modelId: string) => {
    if (!modelId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.explain.getReport(modelId);
      setExplanation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch explanation');
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const data = await api.training.leaderboard(projectId);
      const list = data.models || [];
      setModels(list);
      if (list.length > 0) {
        const selected = list.find((m: any) => m.is_selected) || list[0];
        setSelectedModel(selected.id);
        fetchExplanation(selected.id);
      }
    } catch {
      setModels([]);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, [projectId]);

  const loadExplanation = () => {
    if (selectedModel) {
      fetchExplanation(selectedModel);
    }
  };

  const lightLayout = {
    paper_bgcolor: '#FFFDF9',
    plot_bgcolor: '#FFFDF9',
    font: { color: '#0F172A', size: 11 },
    margin: { t: 30, b: 40, l: 120, r: 20 },
  };

  const getModelLabel = (m: any, index: number) => {
    const metricScore = m.metrics?.accuracy 
      ? `Accuracy: ${(m.metrics.accuracy * 100).toFixed(1)}%` 
      : (m.metrics?.r2 ? `R²: ${m.metrics.r2.toFixed(3)}` : (m.metrics?.cv_score ? `CV: ${m.metrics.cv_score.toFixed(3)}` : `Model #${index + 1}`));
    
    const bestTag = m.is_selected ? ' (Best)' : '';
    const shortId = m.id ? `(ID: ${m.id.substring(0, 6)})` : '';
    return `${m.algorithm || 'Algorithm'} — ${metricScore} ${shortId}${bestTag}`;
  };

  if (!initialLoading && models.length === 0) {
    return <NoDatasetGate projectId={projectId} pageName="Explainable AI & SHAP" pageDescription="Understand feature contributions, decision boundaries, and model fairness." requiresModel />;
  }

  return (
    <div className="space-y-8 animate-fade-in text-[#0f172a]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFDF9] p-6 rounded-3xl border border-[#E2DCD0] shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold font-heading mb-1 text-[#0f172a]">Explainable AI & SHAP</h1>
          <p className="text-[#475569] text-sm">Understand feature contributions, decision boundaries, and model fairness.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {models.length > 0 ? (
            <div className="relative">
              <select
                value={selectedModel || ''}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  fetchExplanation(e.target.value);
                }}
                className="bg-[#FAF7F0] text-[#0f172a] border border-[#E2DCD0] rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm hover:border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 appearance-none pr-10 cursor-pointer min-w-[280px]"
              >
                {models.map((m: any, idx: number) => (
                  <option key={m.id || idx} value={m.id} className="bg-[#FFFDF9] text-[#0f172a] py-2">
                    {getModelLabel(m, idx)}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b]">
                ▼
              </div>
            </div>
          ) : (
            <span className="text-xs text-[#64748b] font-mono bg-[#FAF7F0] border border-[#E2DCD0] px-3 py-2 rounded-xl">
              No trained models available
            </span>
          )}
          
          <Button onClick={loadExplanation} disabled={loading || !selectedModel} className="flex items-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Explaining...</> : <><BrainCircuit className="w-4 h-4" /> Explain Model</>}
          </Button>
        </div>
      </div>

      {error && <div className="border border-rose-300 bg-rose-50 p-4 rounded-2xl text-rose-900 font-semibold text-sm">{error}</div>}

      {!explanation && !loading && (
        <Card>
          <CardBody className="text-center py-16">
            <BrainCircuit className="w-16 h-16 mx-auto mb-4 text-[#94a3b8]" />
            <p className="text-lg font-bold text-[#0f172a]">No explanation generated yet</p>
            <p className="text-sm text-[#475569] mt-1">Select a trained model and click &quot;Explain Model&quot;</p>
          </CardBody>
        </Card>
      )}

      {explanation && (
        <>
          {/* Feature Importance */}
          {explanation.feature_importance_chart?.plotly && (
            <Card>
              <CardHeader><h3 className="font-bold flex items-center gap-2 text-[#0f172a]"><BarChart3 className="w-5 h-5 text-indigo-700" /> Feature Importance (SHAP)</h3></CardHeader>
              <CardBody className="h-[400px]">
                <Plot
                  data={explanation.feature_importance_chart.plotly.data}
                  layout={{ ...explanation.feature_importance_chart.plotly.layout, ...lightLayout }}
                  useResizeHandler style={{ width: '100%', height: '100%' }}
                  config={{ displayModeBar: false }}
                />
              </CardBody>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Confusion Matrix */}
            {explanation.confusion_matrix?.plotly && (
              <Card>
                <CardHeader><h3 className="font-bold text-[#0f172a]">Confusion Matrix</h3></CardHeader>
                <CardBody className="h-[350px]">
                  <Plot
                    data={explanation.confusion_matrix.plotly.data}
                    layout={{ ...explanation.confusion_matrix.plotly.layout, ...lightLayout, margin: { ...lightLayout.margin, l: 50 } }}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            )}

            {/* ROC Curve */}
            {explanation.roc_curve?.plotly && (
              <Card>
                <CardHeader><h3 className="font-bold text-[#0f172a]">ROC Curve</h3></CardHeader>
                <CardBody className="h-[350px]">
                  <Plot
                    data={explanation.roc_curve.plotly.data}
                    layout={{ ...explanation.roc_curve.plotly.layout, ...lightLayout, margin: { ...lightLayout.margin, l: 50 } }}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            )}
          </div>

          {/* AI Explanation */}
          {explanation.ai_explanation && (
            <Card>
              <CardBody className="flex gap-4 items-start bg-[#FAF7F0] rounded-2xl">
                <div className="p-3 bg-[#E2DCD0] rounded-xl shrink-0 text-[#0f172a]">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold mb-1 text-[#0f172a]">AI Model Explanation</h3>
                  <p className="text-[#334155] text-sm leading-relaxed">{explanation.ai_explanation}</p>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}