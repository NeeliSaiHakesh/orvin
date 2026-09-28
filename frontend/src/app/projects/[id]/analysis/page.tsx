"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plot } from '@/components/ui/Plot';
import { Sparkles, AlertTriangle, BarChart3, Hash, Search, Loader2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDatasets();
  }, [projectId]);

  const loadDatasetReport = async (datasetId: string) => {
    try {
      setAnalyzing(true);
      setError(null);
      try {
        const reportData = await api.analysis.getReport(datasetId);
        setReport(reportData);
      } catch {
        setReport(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analysis for selected dataset');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDatasetSelect = (datasetId: string) => {
    setSelectedDataset(datasetId);
    loadDatasetReport(datasetId);
  };

  const loadDatasets = async () => {
    try {
      setAnalyzing(true);
      const data = await api.datasets.list(projectId);
      const list = Array.isArray(data) ? data : [];
      setDatasets(list);
      if (list.length > 0) {
        setSelectedDataset(list[0].id);
        await loadDatasetReport(list[0].id);
      }
    } catch {
      setDatasets([]);
    } finally {
      setAnalyzing(false);
      setInitialLoading(false);
    }
  };

  if (!initialLoading && datasets.length === 0) {
    return <NoDatasetGate projectId={projectId} pageName="Data Analysis" pageDescription="Automated dataset profiling, correlations, and distributions." />;
  }

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
    paper_bgcolor: '#FFFDF9',
    plot_bgcolor: '#FFFDF9',
    font: { color: '#0F172A', size: 11, family: 'inherit' },
    margin: { t: 30, b: 40, l: 50, r: 20 },
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#0F172A]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2 text-[#0F172A]">Data Analysis</h1>
          <p className="text-[#475569]">Automated dataset profiling, correlations, and distributions.</p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing || !selectedDataset} className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Profiling...</>
          ) : (
            <><Search className="w-4 h-4 text-amber-400" /> Re-Analyze Dataset</>
          )}
        </Button>
      </div>

      <DatasetSelector
        datasets={datasets}
        selectedDatasetId={selectedDataset}
        onSelect={handleDatasetSelect}
        projectId={projectId}
        label="Dataset Under Analysis"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">{error}</div>
      )}

      {analyzing && !report && (
        <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
          <CardBody className="text-center py-16">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-700 animate-spin" />
            <p className="text-[#475569]">Running automated dataset intelligence analysis...</p>
          </CardBody>
        </Card>
      )}

      {!report && !analyzing && (
        <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
          <CardBody className="text-center py-16">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-[#94A3B8]" />
            <p className="text-lg text-[#0F172A] font-bold">No Analysis Report Generated Yet</p>
            <p className="text-sm text-[#475569] mt-1 max-w-md mx-auto">
              Click &quot;Run Dataset Analysis&quot; to calculate summary statistics, data type distributions, missing value percentages, and cross-feature correlations.
            </p>
            <div className="mt-6">
              <Button onClick={runAnalysis} disabled={analyzing || !selectedDataset} className="mx-auto flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white">
                <Search className="w-4 h-4 text-amber-400" /> Run Dataset Analysis
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {report && (
        <>
          <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
            <CardBody className="flex gap-6 items-start p-6">
              <div className="p-4 bg-purple-100 rounded-2xl shrink-0">
                <Sparkles className="w-8 h-8 text-purple-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-[#0F172A]">AI Insights Summary</h3>
                {report.ai_summary ? (
                  <p className="text-[#334155] font-medium leading-relaxed">{report.ai_summary}</p>
                ) : (
                  <div className="space-y-2 text-[#334155] font-medium">
                    <p>Dataset contains <strong className="text-[#0F172A]">{Object.keys(report.data_types || {}).length} columns</strong> with the following characteristics:</p>
                    <ul className="space-y-1 text-sm">
                      {Object.entries(report.missing_values || {})
                        .filter(([k, v]: [string, any]) => k !== '__summary__' && v?.count > 0)
                        .slice(0, 5)
                        .map(([col, info]: [string, any]) => (
                          <li key={col} className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span><strong className="text-[#0F172A]">{col}:</strong> {info.count} missing ({info.percentage}%)</span>
                          </li>
                        ))
                      }
                    </ul>
                    {report.correlations?.high_correlations?.length > 0 && (
                      <p className="text-sm">
                        <strong className="text-amber-800 font-bold">{report.correlations.high_correlations.length}</strong> highly correlated feature pairs detected.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
              <CardHeader className="border-b border-[#E2DCD0]"><h3 className="font-bold flex items-center gap-2 text-[#0F172A]"><Hash className="w-4 h-4 text-cyan-700" /> Data Types</h3></CardHeader>
              <CardBody>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(report.data_types || {}).map(([col, dtype]) => (
                    <div key={col} className="flex justify-between items-center py-1.5 px-2.5 rounded bg-[#FAF7F2] border border-[#E2DCD0]/60">
                      <span className="text-sm font-semibold truncate mr-4 text-[#0F172A]">{col}</span>
                      <Badge variant={dtype === 'numeric' ? 'info' : dtype === 'categorical' ? 'warning' : 'neutral'}>{dtype}</Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
              <CardHeader className="border-b border-[#E2DCD0]"><h3 className="font-bold flex items-center gap-2 text-[#0F172A]"><AlertTriangle className="w-4 h-4 text-amber-600" /> Missing Values</h3></CardHeader>
              <CardBody>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(report.missing_values || {})
                    .filter(([k]) => k !== '__summary__')
                    .sort(([, a]: any, [, b]: any) => (b?.count || 0) - (a?.count || 0))
                    .map(([col, info]: [string, any]) => (
                      <div key={col} className="flex justify-between items-center py-1.5 px-2.5 rounded bg-[#FAF7F2] border border-[#E2DCD0]/60">
                        <span className="text-sm font-semibold truncate mr-4 text-[#0F172A]">{col}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-[#E2DCD0] rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full ${info.percentage > 10 ? 'bg-rose-600' : info.percentage > 0 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                              style={{ width: `${Math.max(info.percentage, 1)}%` }} />
                          </div>
                          <span className="text-xs text-[#475569] font-mono font-bold w-16 text-right">{info.percentage}%</span>
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
              <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
                <CardHeader className="border-b border-[#E2DCD0]"><h3 className="font-bold text-[#0F172A]">Correlation Heatmap</h3></CardHeader>
                <CardBody className="h-[350px]">
                  <Plot
                    data={[{ ...getCorrelationData(), type: 'heatmap', colorscale: [[0, '#EFF6FF'], [0.5, '#93C5FD'], [1, '#1E40AF']] }] as any}
                    layout={{ ...plotLayout, margin: { ...plotLayout.margin, l: 100 } }}
                    useResizeHandler style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </CardBody>
              </Card>
            )}

            {getDistributionCharts().map((chart, i) => (
              <Card key={i} className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
                <CardHeader className="border-b border-[#E2DCD0]"><h3 className="font-bold text-[#0F172A]">{chart.name} Distribution</h3></CardHeader>
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