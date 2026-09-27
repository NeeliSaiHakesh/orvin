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
  const projectId = params.id as string;
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [featureInfo, setFeatureInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [engineering, setEngineering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    loadDatasets();
  }, [projectId]);

  const handleDatasetSelect = (datasetId: string) => {
    setSelectedDataset(datasetId);
    setSuccessNotice(null);
    fetchFeatures(datasetId);
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

  if (!initialLoading && datasets.length === 0) {
    return <NoDatasetGate projectId={projectId} pageName="Feature Engineering" pageDescription="Automated feature encoding, scaling, transformations, and importance ranking." />;
  }

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
        color: '#22D3EE',
      }
    };
  };

  const plotLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#F9FAFB', size: 11 },
    margin: { t: 20, b: 40, l: 150, r: 20 },
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Feature Engineering</h1>
          <p className="text-gray-400">Automated feature encoding, scaling, transformations, and importance ranking.</p>
        </div>
        <Button onClick={runEngineering} disabled={engineering || loading || !selectedDataset} className="flex items-center gap-2">
          {engineering ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Engineering...</>
          ) : (
            <><Wand2 className="w-4 h-4" /> Re-Engineer Features</>
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
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">{error}</div>
      )}

      {successNotice && (
        <div className="glass border-cyan-500/30 bg-cyan-500/10 p-4 rounded-xl text-cyan-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="font-bold">✓ Success:</span>
            <span>{successNotice}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href={`/projects/${projectId}/training`}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-semibold flex items-center gap-1 transition-colors"
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
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-spin" />
            <p className="text-gray-400">Loading feature analysis...</p>
          </CardBody>
        </Card>
      ) : !featureInfo ? (
        <Card>
          <CardBody className="text-center py-16">
            <Dna className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-lg text-white font-semibold">No Features Engineered Yet</p>
            <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
              Click &quot;Run Feature Engineering&quot; above to automatically detect column types, apply one-hot/label encoding, standardize numeric features, and calculate feature importance scores.
            </p>
            <div className="mt-6">
              <Button onClick={runEngineering} disabled={engineering || !selectedDataset} className="flex items-center gap-2 mx-auto">
                {engineering ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Engineering Features...</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Run Feature Engineering</>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><h3 className="font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-cyan-400" /> Feature Importance Ranking</h3></CardHeader>
            <CardBody className="h-[400px]">
              {getImportancePlotData() && typeof window !== 'undefined' ? (
                <Plot
                  data={[getImportancePlotData() as any]}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#F9FAFB', size: 11 },
                    margin: { t: 10, b: 40, l: 150, r: 20 },
                    yaxis: { autorange: 'reversed' }
                  }}
                  useResizeHandler style={{ width: '100%', height: '100%' }}
                  config={{ displayModeBar: false }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">Run feature engineering to calculate feature rankings</div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" /> Applied Transformations
            </h3>
            {featureInfo?.transformations?.map((t: any, i: number) => (
              <Card key={i} hover>
                <CardBody className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">{t.type}</span>
                    {t.column && <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-gray-300">{t.column}</span>}
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{t.explanation}</p>
                </CardBody>
              </Card>
            )) || (
              <Card><CardBody className="text-center py-8 text-sm text-gray-500">No transformations logged yet</CardBody></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}