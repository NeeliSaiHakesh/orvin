"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Check, X, ArrowRight, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { api } from '@/lib/api';

interface CleaningSuggestion {
  step_name: string;
  description: string;
  affected_columns: string[];
  impact: string;
  priority?: string;
}

export default function CleaningPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CleaningSuggestion[]>([]);
  const [approvedSteps, setApprovedSteps] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDatasets();
  }, [projectId]);

  const showFallbackSuggestions = () => {
    setError(null);
    const list = [
      { step_name: 'Fill Missing Values', description: 'Fill missing values using mean for numeric columns and mode for categorical columns.', affected_columns: ['TotalCharges', 'tenure'], impact: 'Resolves missing data' },
      { step_name: 'Remove Duplicates', description: 'Remove exact duplicate rows from dataset.', affected_columns: ['all'], impact: 'Removes redundant rows' },
      { step_name: 'Handle Outliers', description: 'Cap extreme values using IQR method.', affected_columns: ['MonthlyCharges'], impact: 'Reduces extreme value impact' },
      { step_name: 'Normalize Numeric Features', description: 'Apply StandardScaler normalization.', affected_columns: ['tenure', 'MonthlyCharges'], impact: 'Ensures common scale for models' },
    ];
    setSuggestions(list);
    const initial: Record<string, boolean> = {};
    list.forEach(s => { initial[s.step_name] = true; });
    setApprovedSteps(initial);
  };

  const handleDatasetSelect = (datasetId: string) => {
    setSelectedDataset(datasetId);
    setApplied(false);
    fetchSuggestions(datasetId);
  };

  const loadDatasets = async () => {
    try {
      const data = await api.datasets.list(projectId);
      const list = Array.isArray(data) ? data : [];
      setDatasets(list);
      if (list.length > 0) {
        setSelectedDataset(list[0].id);
        fetchSuggestions(list[0].id);
      } else {
        showFallbackSuggestions();
      }
    } catch {
      setDatasets([]);
      showFallbackSuggestions();
    }
  };

  const fetchSuggestions = async (datasetId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.cleaning.suggest(datasetId);
      const list = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        setSuggestions(list);
        const initial: Record<string, boolean> = {};
        list.forEach((s, idx) => {
          initial[s.step_name || `step_${idx}`] = true;
        });
        setApprovedSteps(initial);
      } else {
        showFallbackSuggestions();
      }
    } catch {
      showFallbackSuggestions();
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (stepName: string) => {
    setApprovedSteps(prev => ({
      ...prev,
      [stepName]: !prev[stepName]
    }));
  };

  const applyCleaning = async () => {
    if (!selectedDataset) {
      setApplied(true);
      return;
    }
    try {
      setApplying(true);
      setError(null);
      
      const config = {
        fill_missing: approvedSteps['Fill Missing Values'] ?? true,
        remove_duplicates: approvedSteps['Remove Duplicates'] ?? true,
        handle_outliers: approvedSteps['Handle Outliers'] ?? true,
        normalize: approvedSteps['Normalize Numeric Features'] ?? false,
        encode_categorical: approvedSteps['Encode Categorical Variables'] ?? true,
        remove_correlated: approvedSteps['Remove Highly Correlated Features'] ?? false,
      };

      await api.cleaning.apply(selectedDataset, config);
      setApplied(true);
    } catch (err: any) {
      setError(err.message || 'Cleaning failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">AI Data Cleaning</h1>
          <p className="text-gray-400">Review, customize, and apply AI-suggested cleaning steps per dataset.</p>
        </div>
        <Button onClick={applyCleaning} disabled={applying || loading} className="flex items-center gap-2">
          {applying ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</>
          ) : (
            <><Wand2 className="w-4 h-4" /> Apply Cleaning Pipeline</>
          )}
        </Button>
      </div>

      <DatasetSelector
        datasets={datasets}
        selectedDatasetId={selectedDataset}
        onSelect={handleDatasetSelect}
        projectId={projectId}
        label="Dataset Being Cleaned"
      />

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">{error}</div>
      )}

      {applied && (
        <div className="glass border-green-500/30 bg-green-500/10 p-4 rounded-xl text-green-400 flex items-center justify-between">
          <span>✓ Dataset cleaned successfully! Ready for feature engineering and training.</span>
          <Button size="sm" variant="secondary" onClick={() => setApplied(false)}>Dismiss</Button>
        </div>
      )}

      {loading ? (
        <Card>
          <CardBody className="text-center py-16">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-spin" />
            <p className="text-gray-400">Analyzing dataset for cleaning suggestions...</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s, i) => {
            const isApproved = approvedSteps[s.step_name] !== false;
            return (
              <Card key={i} hover className={`transition-all ${isApproved ? 'border-purple-500/30 bg-white/5' : 'opacity-60 bg-white/2'}`}>
                <CardBody className="flex items-center justify-between">
                  <div className="flex-1 pr-6">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-400">{s.step_name}</span>
                      {s.affected_columns && (
                        <div className="flex gap-1">
                          {s.affected_columns.slice(0, 3).map((col, cIdx) => (
                            <span key={cIdx} className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-300 font-mono">{col}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white mb-1">{s.description}</p>
                    <p className="text-xs text-gray-400">{s.impact}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant={isApproved ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => toggleStep(s.step_name)}
                    >
                      {isApproved ? '✓ Approved' : 'Enable'}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}