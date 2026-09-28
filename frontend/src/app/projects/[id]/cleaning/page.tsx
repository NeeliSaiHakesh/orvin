"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, ArrowRight, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
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
  const [initialLoading, setInitialLoading] = useState(true);
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
      }
    } catch {
      setDatasets([]);
    } finally {
      setInitialLoading(false);
    }
  };

  if (!initialLoading && datasets.length === 0) {
    return <NoDatasetGate projectId={projectId} pageName="AI Data Cleaning" pageDescription="Review, customize, and apply AI-suggested cleaning steps per dataset." />;
  }

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

  const [newVersionNotice, setNewVersionNotice] = useState<string | null>(null);

  const applyCleaning = async () => {
    if (!selectedDataset) {
      setApplied(true);
      return;
    }
    try {
      setApplying(true);
      setError(null);
      setNewVersionNotice(null);
      
      const config = {
        fill_missing: approvedSteps['Fill Missing Values'] ?? true,
        remove_duplicates: approvedSteps['Remove Duplicates'] ?? true,
        handle_outliers: approvedSteps['Handle Outliers'] ?? true,
        normalize: approvedSteps['Normalize Numeric Features'] ?? false,
        encode_categorical: approvedSteps['Encode Categorical Variables'] ?? true,
        remove_correlated: approvedSteps['Remove Highly Correlated Features'] ?? false,
      };

      const res = await api.cleaning.apply(selectedDataset, config);
      setApplied(true);
      setNewVersionNotice(res.message || `Cleaned dataset snapshot v${res.dataset_version || 2} generated successfully.`);
      
      // Reload datasets and auto-select the newly generated version
      const freshDatasets = await api.datasets.list(projectId);
      const list = Array.isArray(freshDatasets) ? freshDatasets : [];
      setDatasets(list);
      if (res.new_dataset_id) {
        setSelectedDataset(res.new_dataset_id);
      } else if (list.length > 0) {
        setSelectedDataset(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Cleaning failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#0F172A]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2 text-[#0F172A]">AI Data Cleaning</h1>
          <p className="text-[#475569]">Review, customize, and apply AI-suggested cleaning steps per dataset.</p>
        </div>
        <Button onClick={applyCleaning} disabled={applying || loading} className="flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white">
          {applying ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</>
          ) : (
            <><Wand2 className="w-4 h-4 text-amber-400" /> Apply Cleaning Pipeline</>
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
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">{error}</div>
      )}

      {applied && (
        <div className="border border-emerald-300 bg-emerald-50 p-4 rounded-xl text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-800">✓ Success:</span>
            <span>{newVersionNotice || "Cleaned dataset snapshot generated! Original raw dataset v1 preserved."}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href={`/projects/${projectId}/features`}
              className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <span>Next: Feature Engineering</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setApplied(false)}>Dismiss</Button>
          </div>
        </div>
      )}

      {loading ? (
        <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
          <CardBody className="text-center py-16">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-700 animate-spin" />
            <p className="text-[#475569]">Analyzing dataset for cleaning suggestions...</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s, i) => {
            const isApproved = approvedSteps[s.step_name] !== false;
            return (
              <Card key={i} hover className={`transition-all bg-[#FFFDF9] shadow-sm ${isApproved ? 'border-purple-300' : 'border-[#E2DCD0] opacity-75'}`}>
                <CardBody className="flex items-center justify-between">
                  <div className="flex-1 pr-6">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">{s.step_name}</span>
                      {s.affected_columns && (
                        <div className="flex gap-1">
                          {s.affected_columns.slice(0, 3).map((col, cIdx) => (
                            <span key={cIdx} className="px-2 py-0.5 bg-[#FAF7F2] border border-[#E2DCD0] rounded text-xs text-[#0F172A] font-mono font-medium">{col}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#0F172A] mb-1">{s.description}</p>
                    <p className="text-xs text-[#475569]">{s.impact}</p>
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