"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plot } from '@/components/ui/Plot';
import { Sparkles, AlertTriangle, BarChart3, Hash, Search, Loader2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface AnalysisReport {
  statistics: Record<string, any>;
  data_types: Record<string, string>;
  missing_values: Record<string, any>;
  outliers: Record<string, any>;
  correlations: Record<string, any>;
  distributions: Record<string, any>;
  class_balance: Record<string, any>;
  ai_summary?: string;
}

export default function AnalysisPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDatasets();
  }, [projectId]);

  const loadDatasets = async () => {
    try {
      setAnalyzing(true);
      const data = await api.datasets.list(projectId);
      const list = Array.isArray(data) ? data : [];
      setDatasets(list);
      if (list.length > 0) {
        setSelectedDataset(list[0].id);
        try {
          const reportData = await api.analysis.getReport(list[0].id);
          setReport(reportData);
        } catch {
          // Auto-analyze on the fly if report not generated yet
          const result = await api.analysis.analyze(list[0].id);
          setReport(result);
        }
      }
    } catch {
      setDatasets([]);
    } finally {
      setAnalyzing(false);
    }
  };

  const runAnalysis = async () => {
    if (!selectedDataset) return;
    try {
      setAnalyzing(true);
      setError(null);
      const result = await api.analysis.analyze(selectedDataset);
      setReport(result);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const getCorrelationData = () => {
    if (!report?.correlations?.matrix) return null;
    const matrix = report.correlations.matrix;
    const keys = Object.keys(matrix);
    if (keys.length === 0) return null;
    const z = keys.map(row => keys.map(col => matrix[row]?.[col] ?? 0));
    return { z, x: keys, y: keys };
  };

  const getDistributionCharts = () => {
    if (!report?.distributions) return [];
    return Object.entries(report.distributions).slice(0, 6).map(([col, dist]: [string, any]) => ({
      name: col,
      data: dist.type === 'histogram'
        ? [{ type: 'bar' as const, x: dist.bin_edges?.slice(0, -1), y: dist.counts, marker: { color: '#8B5CF6' } }]
        : [{ type: 'bar' as const, x: dist.labels, y: dist.values, marker: { color: '#06B6D4' } }],
    }));
  };

  const plotLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#F9FAFB', size: 11 },
    margin: { t: 30, b: 40, l: 50, r: 20 },
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Data Analysis</h1>
          <p className="text-gray-400">Automated dataset profiling and insights.</p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing || !selectedDataset}>
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Profiling...</>
          ) : (
            <><Search className="w-4 h-4" /> Run Analysis</>
          )}
        </Button>
      </div>

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">{error}</div>
      )}

      {analyzing && !report && (
        <Card>
          <CardBody className="text-center py-16">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-spin" />
            <p className="text-gray-400">Running automated dataset intelligence analysis...</p>
          </CardBody>
        </Card>
      )}

      {!report && !analyzing && (
        <Card>
          <CardBody className="text-center py-16">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-lg text-gray-400">No analysis report available</p>
            <p className="text-sm text-gray-500 mt-1">Upload a dataset and click &quot;Run Analysis&quot; to generate insights</p>
          </CardBody>
        </Card>
      )}

      {report && (
        <>
          <Card glow>
            <CardBody className="flex gap-6 items-start bg-gradient-to-r from-purple-900/20 to-cyan-900/20">
              <div className="p-4 bg-purple-500/20 rounded-full shrink-0">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white">AI Insights Summary</h3>
                {report.ai_summary ? (
                  <p className="text-gray-300">{report.ai_summary}</p>
                ) : (
                  <div className="space-y-2 text-gray-300">
                    <p>Dataset contains <strong className="text-white">{Object.keys(report.data_types || {}).length} columns</strong> with the following characteristics:</p>
                    <ul className="space-y-1 text-sm">
                      {Object.entries(report.missing_values || {})
                        .filter(([k, v]: [string, any]) => k !== '__summary__' && v?.count > 0)
                        .slice(0, 5)
                        .map(([col, info]: [string, any]) => (
                          <li key={col} className="flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            <span>{col}: {info.count} missing ({info.percentage}%)</span>
                          </li>
                        ))
                      }
                    </ul>
                    {report.correlations?.high_correlations?.length > 0 && (
                      <p className="text-sm">
                        <strong className="text-yellow-400">{report.correlations.high_correlations.length}</strong> highly correlated feature pairs detected.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="font-bold flex items-center gap-2"><Hash className="w-4 h-4 text-cyan-400" /> Data Types</h3></CardHeader>
              <CardBody>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(report.data_types || {}).map(([col, dtype]) => (
                    <div key={col} className="flex justify-between items-center py-1 px-2 rounded hover:bg-white/5">
                      <span className="text-sm truncate mr-4">{col}</span>
                      <Badge variant={dtype === 'numeric' ? 'info' : dtype === 'categorical' ? 'warning' : 'neutral'}>{dtype}</Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Missing Values</h3></CardHeader>
              <CardBody>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(report.missing_values || {})
                    .filter(([k]) => k !== '__summary__')
                    .sort(([, a]: any, [, b]: any) => (b?.count || 0) - (a?.count || 0))
                    .map(([col, info]: [string, any]) => (
                      <div key={col} className="flex justify-between items-center py-1 px-2 rounded hover:bg-white/5">
                        <span className="text-sm truncate mr-4">{col}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-white/10 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full ${info.percentage > 10 ? 'bg-red-500' : info.percentage > 0 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.max(info.percentage, 1)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-16 text-right">{info.percentage}%</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {getCorrelationData() && (
              <Card>
                <CardHeader><h3 className="font-bold">Correlation Heatmap</h3></CardHeader>
                <CardBody className="h-[350px]">
                  <Plot
                    data={[{ ...getCorrelationData(), type: 'heatmap', colorscale: [[0, '#1a1a3e'], [0.5, '#4a1a6b'], [1, '#22D3EE']] }] as any}
                    layout={{ ...plotLayout, margin: { ...plotLayout.margin, l: 100 } }}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            )}

            {getDistributionCharts().map((chart, i) => (
              <Card key={i}>
                <CardHeader><h3 className="font-bold">{chart.name} Distribution</h3></CardHeader>
                <CardBody className="h-[300px]">
                  <Plot
                    data={chart.data as any}
                    layout={plotLayout}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}