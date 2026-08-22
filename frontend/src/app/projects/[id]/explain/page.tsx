"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plot } from '@/components/ui/Plot';
import { BrainCircuit, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

export default function ExplainPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [explanation, setExplanation] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [projectId]);

  const loadModels = async () => {
    try {
      const data = await api.training.leaderboard(projectId);
      const list = data.models || [];
      setModels(list);
      if (list.length > 0) {
        const selected = list.find((m: any) => m.is_selected) || list[0];
        setSelectedModel(selected.id);
      }
    } catch {
      setModels([]);
    }
  };

  const loadExplanation = async () => {
    if (!selectedModel) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.explain.getReport(selectedModel);
      setExplanation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const darkLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#F9FAFB', size: 11 },
    margin: { t: 30, b: 40, l: 120, r: 20 },
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Explainable AI</h1>
          <p className="text-gray-400">Understand why your model makes predictions.</p>
        </div>
        <div className="flex items-center gap-3">
          {models.length > 0 && (
            <select
              value={selectedModel || ''}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
            >
              {models.map((m: any) => (
                <option key={m.id} value={m.id}>{m.algorithm} {m.is_selected ? '(Best)' : ''}</option>
              ))}
            </select>
          )}
          <Button onClick={loadExplanation} disabled={loading || !selectedModel}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Explaining...</> : <><BrainCircuit className="w-4 h-4" /> Explain Model</>}
          </Button>
        </div>
      </div>

      {error && <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">{error}</div>}

      {!explanation && !loading && (
        <Card>
          <CardBody className="text-center py-16">
            <BrainCircuit className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-lg text-gray-400">No explanation generated yet</p>
            <p className="text-sm text-gray-500 mt-1">Select a trained model and click &quot;Explain Model&quot;</p>
          </CardBody>
        </Card>
      )}

      {explanation && (
        <>
          {/* Feature Importance */}
          {explanation.feature_importance_chart?.plotly && (
            <Card glow>
              <CardHeader><h3 className="font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-purple-400" /> Feature Importance (SHAP)</h3></CardHeader>
              <CardBody className="h-[400px]">
                <Plot
                  data={explanation.feature_importance_chart.plotly.data}
                  layout={{ ...explanation.feature_importance_chart.plotly.layout, ...darkLayout }}
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
                <CardHeader><h3 className="font-bold">Confusion Matrix</h3></CardHeader>
                <CardBody className="h-[350px]">
                  <Plot
                    data={explanation.confusion_matrix.plotly.data}
                    layout={{ ...explanation.confusion_matrix.plotly.layout, ...darkLayout, margin: { ...darkLayout.margin, l: 50 } }}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            )}

            {/* ROC Curve */}
            {explanation.roc_curve?.plotly && (
              <Card>
                <CardHeader><h3 className="font-bold">ROC Curve</h3></CardHeader>
                <CardBody className="h-[350px]">
                  <Plot
                    data={explanation.roc_curve.plotly.data}
                    layout={{ ...explanation.roc_curve.plotly.layout, ...darkLayout, margin: { ...darkLayout.margin, l: 50 } }}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            )}

            {/* Precision-Recall Curve */}
            {explanation.precision_recall?.plotly && (
              <Card>
                <CardHeader><h3 className="font-bold">Precision-Recall Curve</h3></CardHeader>
                <CardBody className="h-[350px]">
                  <Plot
                    data={explanation.precision_recall.plotly.data}
                    layout={{ ...explanation.precision_recall.plotly.layout, ...darkLayout, margin: { ...darkLayout.margin, l: 50 } }}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            )}
          </div>

          {/* AI Explanation */}
          {explanation.ai_explanation && (
            <Card glow>
              <CardBody className="flex gap-4 items-start bg-gradient-to-r from-purple-900/20 to-cyan-900/20">
                <div className="p-3 bg-purple-500/20 rounded-full shrink-0">
                  <BrainCircuit className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">AI Model Explanation</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{explanation.ai_explanation}</p>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Feature Importance Table */}
          {explanation.feature_importance && Object.keys(explanation.feature_importance).length > 0 && (
            <Card>
              <CardHeader><h3 className="font-bold">Feature Importance Rankings</h3></CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {Object.entries(explanation.feature_importance).slice(0, 15).map(([feature, importance]: [string, any], i) => {
                    const topVal = Number((Object.values(explanation.feature_importance) as any[])[0]) || 1;
                    const val = Number(importance) || 0;
                    const widthPct = Math.min(100, Math.max(0, (val / topVal) * 100));
                    return (
                      <div key={feature} className="flex items-center gap-3 py-1">
                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                        <span className="text-sm truncate flex-1">{feature}</span>
                        <div className="w-48 bg-white/10 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
                            style={{ width: `${widthPct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-16 text-right">{typeof importance === 'number' ? importance.toFixed(4) : String(importance)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}