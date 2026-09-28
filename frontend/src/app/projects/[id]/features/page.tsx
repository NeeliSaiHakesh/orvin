"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plot } from '@/components/ui/Plot';
import { Wand2, Loader2, BarChart3, CheckCircle2, ArrowRight, Dna } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
import { api } from '@/lib/api';

export default function FeaturesPage() {
  const params = useParams();
  const projectId = (params?.id as string) || 'p-101';
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [featureInfo, setFeatureInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [engineering, setEngineering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fetchFeatures = async (datasetId: string) => {
    try {
      setLoading(true);
      setError(null);
      const info = await api.features.get(datasetId);
      if (info && (info.transformations?.length > 0 || (info.feature_importance && Object.keys(info.feature_importance).length > 0))) {
        setFeatureInfo(info);
      } else {
        setFeatureInfo(null);
      }
    } catch {
      setFeatureInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDatasets = async () => {
    try {
      const data = await api.datasets.list(projectId);
      const list = Array.isArray(data) ? data : [];
      setDatasets(list);
      if (list.length > 0) {
        setSelectedDataset(list[0].id);
        fetchFeatures(list[0].id);
      }
    } catch {
      setDatasets([]);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, [projectId]);

  const handleDatasetSelect = (datasetId: string) => {
    setSelectedDataset(datasetId);
    setSuccessNotice(null);
    fetchFeatures(datasetId);
  };

  const runEngineering = async () => {
    if (!selectedDataset) return;
    try {
      setEngineering(true);
      setError(null);
      setSuccessNotice(null);
      const result = await api.features.engineer(selectedDataset);
      setFeatureInfo(result);
      setSuccessNotice(result?.message || `Feature engineered snapshot v${result?.dataset_version || 3} generated successfully.`);
      
      // Reload datasets and auto-select the newly generated version
      const freshDatasets = await api.datasets.list(projectId);
      const list = Array.isArray(freshDatasets) ? freshDatasets : [];
      setDatasets(list);
      if (result?.new_dataset_id) {
        setSelectedDataset(result.new_dataset_id);
      } else if (list.length > 0) {
        setSelectedDataset(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Feature engineering failed');
    } finally {
      setEngineering(false);
    }
  };

  const getImportancePlotData = () => {
    if (!featureInfo?.feature_importance) return null;
    const items = Object.entries(featureInfo.feature_importance).slice(0, 10);
    if (items.length === 0) return null;
    const names = items.map(([k]) => k);
    const values = items.map(([, v]: any) => v);
    return {
      x: values,
      y: names,
      type: 'bar' as const,
      orientation: 'h' as const,
      marker: {
        color: '#0F172A',
      }
    };
  };

  const plotLayout = {
    paper_bgcolor: '#FFFDF9',
    plot_bgcolor: '#FFFDF9',
    font: { color: '#0F172A', size: 11 },
    margin: { t: 20, b: 40, l: 150, r: 20 },
  };

  if (!initialLoading && datasets.length === 0) {
    return <NoDatasetGate projectId={projectId} pageName="Feature Engineering" pageDescription="Automated feature encoding, scaling, transformations, and importance ranking." />;
  }

  return (
    <div className="space-y-8 animate-fade-in text-[#0f172a]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFDF9] p-6 rounded-3xl border border-[#E2DCD0] shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold font-heading mb-1 text-[#0f172a]">Feature Engineering</h1>
          <p className="text-[#475569] text-sm">Automated feature encoding, scaling, transformations, and importance ranking.</p>
        </div>
        <Button onClick={runEngineering} disabled={engineering || loading || !selectedDataset} className="flex items-center gap-2">
          {engineering ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Engineering...</>
          ) : (
            <><Wand2 className="w-4 h-4 text-amber-400" /> Re-Engineer Features</>
          )}
        </Button>
      </div>

      <DatasetSelector
        datasets={datasets}
        selectedDatasetId={selectedDataset}
        onSelect={handleDatasetSelect}
        projectId={projectId}
        label="Dataset For Feature Pipeline"
      />

      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 rounded-2xl text-rose-950 font-semibold text-sm">{error}</div>
      )}

      {successNotice && (
        <div className="border border-emerald-300 bg-emerald-50 p-4 rounded-2xl text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-800">✓ Success:</span>
            <span>{successNotice}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href={`/projects/${projectId}/training`}
              className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <span>Next: AutoML Training</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setSuccessNotice(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {loading ? (
        <Card>
          <CardBody className="text-center py-16">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-[#0f172a] animate-spin" />
            <p className="text-[#475569] font-medium text-sm">Loading feature analysis...</p>
          </CardBody>
        </Card>
      ) : !featureInfo ? (
        <Card>
          <CardBody className="text-center py-16">
            <Dna className="w-16 h-16 mx-auto mb-4 text-[#94a3b8]" />
            <p className="text-lg text-[#0f172a] font-bold">No Features Engineered Yet</p>
            <p className="text-sm text-[#475569] mt-1 max-w-md mx-auto">
              Click &quot;Run Feature Engineering&quot; above to automatically detect column types, apply one-hot/label encoding, standardize numeric features, and calculate feature importance scores.
            </p>
            <div className="mt-6">
              <Button onClick={runEngineering} disabled={engineering || !selectedDataset} className="flex items-center gap-2 mx-auto">
                {engineering ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Engineering Features...</>
                ) : (
                  <><Wand2 className="w-4 h-4 text-amber-400" /> Run Feature Engineering</>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><h3 className="font-bold flex items-center gap-2 text-[#0f172a]"><BarChart3 className="w-5 h-5 text-indigo-700" /> Feature Importance Ranking</h3></CardHeader>
            <CardBody className="h-[400px]">
              {getImportancePlotData() && typeof window !== 'undefined' ? (
                <Plot
                  data={[getImportancePlotData() as any]}
                  layout={{
                    ...plotLayout,
                    yaxis: { autorange: 'reversed' }
                  }}
                  useResizeHandler style={{ width: '100%', height: '100%' }}
                  config={{ displayModeBar: false }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[#64748b] font-medium text-sm">Run feature engineering to calculate feature rankings</div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <h3 className="font-extrabold text-lg text-[#0f172a] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" /> Applied Transformations
            </h3>
            {featureInfo?.transformations?.map((t: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {t.type}
                  </span>
                  {t.column && <span className="text-xs font-mono font-bold bg-[#FAF7F0] border border-[#E2DCD0] px-2 py-0.5 rounded text-[#0f172a]">{t.column}</span>}
                </div>
                <p className="text-xs text-[#1e293b] leading-relaxed font-medium">{t.explanation}</p>
              </div>
            )) || (
              <Card><CardBody className="text-center py-8 text-sm text-[#64748b]">No transformations logged yet</CardBody></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}