"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { 
  Sliders, Zap, RefreshCw, RotateCcw, TrendingUp, 
  Layers, DollarSign, Clock, ShieldCheck, AlertCircle, 
  Cpu, ArrowRight, Dna, Play, Sparkles
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatasetSelector } from '@/components/ui/DatasetSelector';
import { Plot } from '@/components/ui/Plot';
import { api } from '@/lib/api';

interface FeatureSchemaItem {
  name: string;
  data_type: string;
  min_value?: number;
  max_value?: number;
  mean_value?: number;
  step?: number;
  categories?: string[];
  default_value: any;
}

interface MetricComparison {
  metric_name: string;
  baseline_value: number;
  hypothetical_value: number;
  unit: string;
  delta: number;
  is_improvement: boolean;
}

interface SensitivityPoint {
  perturbation_percentage: number;
  feature_name: string;
  predicted_probability: number;
}

interface ArchitectureComparison {
  algorithm: string;
  accuracy_score: number;
  p95_latency_ms: number;
  memory_mb: number;
  monthly_cost_usd: number;
  is_recommended: boolean;
}

interface SimulationResponse {
  baseline_prediction: any;
  baseline_probability: number;
  hypothetical_prediction: any;
  hypothetical_probability: number;
  probability_delta: number;
  risk_level: string;
  explanation: string;
  metrics_comparison: MetricComparison[];
  sensitivity_curves: SensitivityPoint[];
  architecture_matrix: ArchitectureComparison[];
}

export default function SimulatorPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureSchemaItem[]>([]);
  const [baselineInstance, setBaselineInstance] = useState<Record<string, any>>({});
  const [scenarioValues, setScenarioValues] = useState<Record<string, any>>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [baselineModel, setBaselineModel] = useState<string>("Best Model (LightGBM)");
  const [hypotheticalModel, setHypotheticalModel] = useState<string>("XGBoost (Deep Trees)");

  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    loadDatasetsAndSchema();
  }, [projectId]);

  const loadDatasetsAndSchema = async () => {
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

      await loadSchema(defaultDsId);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize simulator');
    } finally {
      setLoading(false);
    }
  };

  const loadSchema = async (datasetId?: string) => {
    try {
      const schema = await api.simulator.getSchema(projectId, datasetId);
      setFeatures(schema.features || []);
      setBaselineInstance(schema.baseline_instance || {});
      setScenarioValues(schema.baseline_instance || {});
      setAvailableModels(schema.available_models || []);

      // Run initial simulation
      await triggerSimulation(schema.baseline_instance, datasetId, baselineModel, hypotheticalModel);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature schema');
    }
  };

  const triggerSimulation = async (
    values: Record<string, any>, 
    dsId?: string,
    bModel?: string,
    hModel?: string
  ) => {
    try {
      setSimulating(true);
      const res = await api.simulator.run(projectId, {
        dataset_id: dsId || selectedDataset || undefined,
        feature_values: values,
        baseline_model: bModel || baselineModel,
        hypothetical_model: hModel || hypotheticalModel,
      });
      setSimulation(res);
    } catch (err: any) {
      setError(err.message || 'Simulation execution failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleDatasetSelect = async (datasetId: string) => {
    setSelectedDataset(datasetId);
    setLoading(true);
    await loadSchema(datasetId);
    setLoading(false);
  };

  const handleFeatureChange = (name: string, value: any) => {
    const updated = { ...scenarioValues, [name]: value };
    setScenarioValues(updated);
    triggerSimulation(updated);
  };

  const handleResetToBaseline = () => {
    setScenarioValues({ ...baselineInstance });
    triggerSimulation(baselineInstance);
  };

  const handleRandomize = () => {
    const randomized: Record<string, any> = {};
    features.forEach(f => {
      if (f.data_type === 'numeric' && f.min_value !== undefined && f.max_value !== undefined) {
        const rand = f.min_value + Math.random() * (f.max_value - f.min_value);
        randomized[f.name] = Number(rand.toFixed(2));
      } else if (f.categories && f.categories.length > 0) {
        const idx = Math.floor(Math.random() * f.categories.length);
        randomized[f.name] = f.categories[idx];
      } else {
        randomized[f.name] = f.default_value;
      }
    });
    setScenarioValues(randomized);
    triggerSimulation(randomized);
  };

  const filteredFeatures = features.filter(f => 
    f.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Group sensitivity curves for Plotly
  const getSensitivityPlotData = () => {
    if (!simulation?.sensitivity_curves) return [];
    const grouped: Record<string, { x: number[]; y: number[] }> = {};

    simulation.sensitivity_curves.forEach(pt => {
      if (!grouped[pt.feature_name]) {
        grouped[pt.feature_name] = { x: [], y: [] };
      }
      grouped[pt.feature_name].x.push(pt.perturbation_percentage);
      grouped[pt.feature_name].y.push(pt.predicted_probability * 100);
    });

    const colors = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B'];
    return Object.entries(grouped).map(([name, data], idx) => ({
      x: data.x,
      y: data.y,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: name,
      line: { color: colors[idx % colors.length], width: 2.5 },
      marker: { size: 6 }
    }));
  };

  const plotLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#F9FAFB', size: 11 },
    xaxis: { title: 'Perturbation Shift (%)', gridcolor: '#1f293d', zerolinecolor: '#374151' },
    yaxis: { title: 'Predicted Probability (%)', gridcolor: '#1f293d' },
    margin: { t: 20, b: 40, l: 50, r: 20 },
    legend: { orientation: 'h' as const, y: -0.2 }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40">
              <Sliders className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">AI-Driven Optimization</span>
          </div>
          <h1 className="text-3xl font-bold font-heading">What-If Model Simulator</h1>
          <p className="text-gray-400 text-sm">
            Test hypothetical feature perturbations and compare model performance, latency, and cloud serving costs in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleResetToBaseline} className="flex items-center gap-1.5 text-xs">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </Button>

          <Button variant="secondary" onClick={handleRandomize} className="flex items-center gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Randomize Instance
          </Button>
        </div>
      </div>

      {/* Dataset Selector */}
      <DatasetSelector
        datasets={datasets}
        selectedDatasetId={selectedDataset}
        onSelect={handleDatasetSelect}
        projectId={projectId}
        label="Dataset For Simulation"
      />

      {/* Model Benchmark Selector Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl glass border-cyan-500/30 bg-cyan-500/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-cyan-300">Baseline Production Model:</span>
            <span className="font-mono text-[10px] text-gray-400">Reference Baseline</span>
          </div>
          <select
            value={baselineModel}
            onChange={(e) => {
              const val = e.target.value;
              setBaselineModel(val);
              triggerSimulation(scenarioValues, selectedDataset || undefined, val, hypotheticalModel);
            }}
            className="w-full bg-[#0f172a] text-white border border-cyan-500/40 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
          >
            {(availableModels.length > 0 ? availableModels : ["Best Model (LightGBM)", "RandomForest (85.7% Acc)", "XGBoost (87.2% Acc)", "LogisticRegression (79.1% Acc)"]).map((m) => (
              <option key={m} value={m} className="bg-[#0f172a] text-white py-1">
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 rounded-xl glass border-purple-500/30 bg-purple-500/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-purple-300">Challenger / Hypothetical Architecture:</span>
            <span className="font-mono text-[10px] text-gray-400">Simulated Target</span>
          </div>
          <select
            value={hypotheticalModel}
            onChange={(e) => {
              const val = e.target.value;
              setHypotheticalModel(val);
              triggerSimulation(scenarioValues, selectedDataset || undefined, baselineModel, val);
            }}
            className="w-full bg-[#0f172a] text-white border border-purple-500/40 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
          >
            {(availableModels.length > 0 ? availableModels : ["XGBoost (Deep Trees)", "Neural Network (MLP)", "CatBoost Classifier", "Ensemble Stacking"]).map((m) => (
              <option key={m} value={m} className="bg-[#0f172a] text-white py-1">
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Feature Perturbation Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card glow className="h-full">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">Scenario Inputs</h3>
              </div>
              <input
                type="text"
                placeholder="Search features..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#0e1628] border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 w-full sm:w-36"
              />
            </CardHeader>

            <CardBody className="p-4 space-y-5 max-h-[700px] overflow-y-auto">
              {filteredFeatures.map((feat) => {
                const isNumeric = feat.data_type === 'numeric';
                const currentVal = scenarioValues[feat.name] ?? feat.default_value;
                const baselineVal = baselineInstance[feat.name] ?? feat.default_value;
                const isChanged = currentVal !== baselineVal;

                return (
                  <div 
                    key={feat.name} 
                    className={`p-3.5 rounded-xl border transition-colors ${
                      isChanged 
                        ? 'bg-purple-500/10 border-purple-500/40' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-white truncate max-w-[180px]" title={feat.name}>
                        {feat.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isChanged && (
                          <span className="text-[10px] text-purple-300 font-mono bg-purple-500/20 px-1.5 py-0.2 rounded">
                            Δ from {baselineVal}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-cyan-300">
                          {currentVal}
                        </span>
                      </div>
                    </div>

                    {isNumeric ? (
                      <div className="space-y-1.5">
                        <input
                          type="range"
                          min={feat.min_value ?? 0}
                          max={feat.max_value ?? 100}
                          step={feat.step ?? 1}
                          value={currentVal}
                          onChange={(e) => handleFeatureChange(feat.name, parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                          <span>Min: {feat.min_value}</span>
                          <span>Mean: {feat.mean_value}</span>
                          <span>Max: {feat.max_value}</span>
                        </div>
                      </div>
                    ) : (
                      <select
                        value={currentVal}
                        onChange={(e) => handleFeatureChange(feat.name, e.target.value)}
                        className="w-full bg-[#10182b] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        {feat.categories?.map(cat => (
                          <option key={cat} value={cat} className="bg-[#0e1628] text-white">
                            {cat}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}

              {filteredFeatures.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No features matching &quot;{searchFilter}&quot;
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Simulation Outcomes & Tradeoffs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dual Outcome Comparison Hero */}
          {simulation && (
            <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-[#12192e] via-[#0d1424] to-[#0a0f1d] shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Real-Time Prediction Delta</span>
                  <h3 className="text-lg font-bold text-white">What-If Outcome Synthesis</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    simulation.risk_level === 'Low'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : simulation.risk_level === 'Moderate'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : simulation.risk_level === 'High'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}>
                    {simulation.risk_level} Risk Tier
                  </span>
                </div>
              </div>

              {/* Gauges Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Baseline Outcome */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Baseline Instance</span>
                  <div className="text-2xl font-extrabold text-white">
                    {Math.round(simulation.baseline_probability * 100)}%
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gray-400 h-2 rounded-full" 
                      style={{ width: `${simulation.baseline_probability * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{simulation.baseline_prediction}</span>
                </div>

                {/* What-If Scenario Outcome */}
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Hypothetical Scenario</span>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {simulation.probability_delta >= 0 ? '+' : ''}{Math.round(simulation.probability_delta * 100)}%
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                    {Math.round(simulation.hypothetical_probability * 100)}%
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-cyan-400 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${simulation.hypothetical_probability * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-purple-200 font-medium">{simulation.hypothetical_prediction}</span>
                </div>
              </div>

              {/* Metric Delta Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {simulation.metrics_comparison?.map((m) => (
                  <div key={m.metric_name} className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block truncate">
                      {m.metric_name}
                    </span>
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-base font-bold text-white">
                        {m.hypothetical_value}{m.unit}
                      </span>
                      <span className={`text-xs font-semibold ${m.is_improvement ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {m.delta >= 0 ? '+' : ''}{m.delta}{m.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed">
                💡 <strong className="text-white">Simulator Insight:</strong> {simulation.explanation}
              </p>
            </div>
          )}

          {/* Model Architecture Switcher & Trade-Off Matrix */}
          <Card glow>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">Algorithm Trade-Off Simulator</h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap">Compare With:</span>
                <select
                  value={hypotheticalModel}
                  onChange={(e) => {
                    setHypotheticalModel(e.target.value);
                    triggerSimulation(scenarioValues, selectedDataset || undefined, baselineModel, e.target.value);
                  }}
                  className="bg-[#0e1628] border border-cyan-500/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {availableModels.map(m => (
                    <option key={m} value={m} className="bg-[#0e1628] text-white">{m}</option>
                  ))}
                </select>
              </div>
            </CardHeader>

            <CardBody className="p-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
                      <th className="pb-2 font-bold">Algorithm</th>
                      <th className="pb-2 font-bold">Accuracy</th>
                      <th className="pb-2 font-bold">P95 Latency</th>
                      <th className="pb-2 font-bold">RAM</th>
                      <th className="pb-2 font-bold">Cloud Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {simulation?.architecture_matrix?.map((arch) => {
                      const isSelected = arch.algorithm === hypotheticalModel;
                      return (
                        <tr 
                          key={arch.algorithm} 
                          className={`hover:bg-white/5 transition-colors ${
                            isSelected ? 'bg-cyan-500/10 font-bold text-white' : 'text-gray-300'
                          }`}
                        >
                          <td className="py-2.5 pr-2 flex items-center gap-1.5">
                            {arch.is_recommended && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] uppercase font-bold">
                                Rec
                              </span>
                            )}
                            <span>{arch.algorithm}</span>
                          </td>
                          <td className="py-2.5 text-emerald-400 font-semibold">{arch.accuracy_score}%</td>
                          <td className="py-2.5 font-mono">{arch.p95_latency_ms}ms</td>
                          <td className="py-2.5 font-mono text-gray-400">{arch.memory_mb}MB</td>
                          <td className="py-2.5 font-mono text-cyan-300">${arch.monthly_cost_usd}/mo</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Feature Sensitivity Curve Plot */}
          <Card glow>
            <CardHeader className="pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">Feature Sensitivity Analysis</h3>
              </div>
            </CardHeader>
            <CardBody className="h-[280px]">
              <Plot
                data={getSensitivityPlotData()}
                layout={plotLayout}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
