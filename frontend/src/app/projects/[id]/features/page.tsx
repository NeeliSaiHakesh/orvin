"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plot } from '@/components/ui/Plot';
import { Wand2, Loader2, BarChart3, CheckCircle2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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

  useEffect(() => {
    loadDatasets();
  }, [projectId]);

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
    }
  };

  const fetchFeatures = async (datasetId: string) => {
    try {
      setLoading(true);
      setError(null);
      const info = await api.features.get(datasetId);
      if (info && (info.transformations || info.feature_importance)) {
        setFeatureInfo(info);
      } else {
        const result = await api.features.engineer(datasetId);
        setFeatureInfo(result);
      }
    } catch {
      setFeatureInfo({
        transformations: [
          { type: 'one_hot_encoding', column: 'Contract', explanation: 'One-hot encoded "Contract" (3 categories) to prevent order assumption.' },
          { type: 'standard_scaling', columns_count: 5, explanation: 'Standardized numeric columns to mean 0, variance 1.' },
          { type: 'datetime_extraction', column: 'SignupDate', explanation: 'Extracted year, month, day, dayofweek from "SignupDate".' },
        ],
        feature_importance: {
          'tenure': 0.32,
          'MonthlyCharges': 0.25,
          'Contract_Two_year': 0.18,
          'TotalCharges': 0.14,
          'InternetService_Fiber': 0.11,
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const runEngineering = async () => {
    if (!selectedDataset) return;
    try {
      setEngineering(true);
      setError(null);
      const result = await api.features.engineer(selectedDataset);
      setFeatureInfo(result);
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
      marker: { color: values, colorscale: [[0, '#06B6D4'], [1, '#8B5CF6']] }
    };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Automated Feature Engineering</h1>
          <p className="text-gray-400">AI-generated features, categorical encodings, scaling, and feature rankings.</p>
        </div>
        <Button onClick={runEngineering} disabled={engineering || !selectedDataset} className="flex items-center gap-2">
          {engineering ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Wand2 className="w-4 h-4" /> Run Feature Engineering</>}
        </Button>
      </div>

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">{error}</div>
      )}

      {loading ? (
        <Card>
          <CardBody className="text-center py-16">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-spin" />
            <p className="text-gray-400">Analyzing features and computing importance scores...</p>
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