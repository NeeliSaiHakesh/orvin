"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, 
  Activity, Server, Cpu, Layers, CheckCircle2, 
  Play, RotateCcw, Zap, Terminal, Clock, HeartPulse, Sparkles
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
import { api } from '@/lib/api';

interface SubsystemHealth {
  id: string;
  name: string;
  category: string;
  status: string;
  uptime_percentage: number;
  current_latency_ms: number;
  current_error_rate: number;
  active_replicas: number;
  last_healed_at?: string;
  description: string;
}

interface IncidentEvent {
  id: string;
  timestamp: string;
  failure_type: string;
  severity: string;
  trigger_metric: string;
  remediation_action: string;
  status: string;
  recovery_duration_seconds: number;
  details: string;
}

interface CircuitBreakerState {
  is_tripped: boolean;
  state: string;
  failure_count: number;
  max_retries: number;
  cooldown_seconds_remaining: number;
  last_state_change: string;
}

interface SelfHealingStatus {
  project_id: string;
  overall_health_status: string;
  health_score: number;
  active_workers_count: number;
  total_auto_recoveries: number;
  recovery_success_rate: number;
  subsystems: SubsystemHealth[];
  circuit_breaker: CircuitBreakerState;
  incident_history: IncidentEvent[];
  system_metrics: Record<string, any>;
}

export default function SelfHealingPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [status, setStatus] = useState<SelfHealingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [healingInProgress, setHealingInProgress] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [activeSimulationToast, setActiveSimulationToast] = useState<string | null>(null);
  const [hasDatasets, setHasDatasets] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, [projectId]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      // Check datasets first
      const dsData = await api.datasets.list(projectId);
      const dsList = Array.isArray(dsData) ? dsData : [];
      setHasDatasets(dsList.length > 0);
      if (dsList.length > 0) {
        const data = await api.selfHealing.getStatus(projectId);
        setStatus(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load self-healing status');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  if (!initialLoading && !hasDatasets) {
    return <NoDatasetGate projectId={projectId} pageName="Self-Healing & Resilience" pageDescription="Autonomous failure detection, circuit breakers, and automated recovery." />;
  }

  const handleSimulateFailure = async (failureType: string, label: string) => {
    try {
      setHealingInProgress(failureType);
      setActiveSimulationToast(`Triggering simulated failure: ${label}...`);
      setError(null);

      // Brief delay to simulate telemetry detection lag
      await new Promise(r => setTimeout(r, 600));

      const updated = await api.selfHealing.trigger(projectId, failureType);
      setStatus(updated);
      setActiveSimulationToast(`✅ Self-Healing successful! Action completed for ${label}.`);
      setTimeout(() => setActiveSimulationToast(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to execute self-healing sequence');
    } finally {
      setHealingInProgress(null);
    }
  };

  const handleResetCircuitBreaker = async () => {
    try {
      setLoading(true);
      const updated = await api.selfHealing.resetCircuitBreaker(projectId);
      setStatus(updated);
      setActiveSimulationToast('Circuit breaker manually reset to CLOSED (Healthy)');
      setTimeout(() => setActiveSimulationToast(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset circuit breaker');
    } finally {
      setLoading(false);
    }
  };

  const filteredIncidents = (status?.incident_history || []).filter(inc => {
    if (selectedSeverity === 'all') return true;
    return inc.severity === selectedSeverity;
  });

  const getSubsystemIcon = (cat: string) => {
    switch (cat) {
      case 'container':
        return <Server className="w-4 h-4 text-cyan-400" />;
      case 'scaling':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'retraining':
        return <RefreshCw className="w-4 h-4 text-emerald-400" />;
      case 'schema':
        return <ShieldCheck className="w-4 h-4 text-amber-400" />;
      default:
        return <Activity className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#0F172A]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-emerald-100 border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">AI-Driven Reliability</span>
          </div>
          <h1 className="text-3xl font-bold font-heading text-[#0F172A]">Self-Healing Pipeline</h1>
          <p className="text-[#475569] text-sm">
            Automated fault detection, container OOM recovery, dynamic autoscaling, and drift retraining guardrails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={loadStatus} 
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-[#FFFDF9] hover:bg-[#FAF7F2] text-[#0F172A] border border-[#E2DCD0]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {activeSimulationToast && (
        <div className="border border-cyan-300 bg-cyan-50 p-3.5 rounded-xl text-cyan-950 text-xs flex items-center gap-2 shadow-sm font-semibold animate-slide-up">
          <Sparkles className="w-4 h-4 shrink-0 text-cyan-700" />
          <span>{activeSimulationToast}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* System Health Hero Banner */}
      {status && (
        <div className="rounded-2xl p-6 border border-[#E2DCD0] bg-[#FFFDF9] shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-700 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Autonomous Operations Status</span>
              </div>
              <h2 className="text-2xl font-bold text-[#0F172A] flex items-center gap-3">
                <span>{status.overall_health_status}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Zero Downtime
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] max-w-xl font-medium">
                Real-time autonomous supervisor is actively probing containers, queuing latencies, feature drift metrics, and payload schemas.
              </p>
            </div>

            {/* Quick Metrics KPI Cluster */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2DCD0] text-center">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Health Score</span>
                <div className="text-xl font-extrabold text-emerald-700">
                  {status.health_score}%
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2DCD0] text-center">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Auto-Healed</span>
                <div className="text-xl font-extrabold text-[#0F172A]">
                  {status.total_auto_recoveries}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2DCD0] text-center">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Success Rate</span>
                <div className="text-xl font-extrabold text-emerald-700 font-mono">
                  {status.recovery_success_rate}%
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2DCD0] text-center">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Cluster P95</span>
                <div className="text-xl font-extrabold text-cyan-800 font-mono">
                  {status.system_metrics?.p95_cluster_latency_ms}ms
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Subsystem Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {status?.subsystems?.map((sub) => (
          <div 
            key={sub.id} 
            className="rounded-2xl p-4 border border-[#E2DCD0] bg-[#FFFDF9] shadow-sm space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#FAF7F2] border border-[#E2DCD0]">
                  {getSubsystemIcon(sub.category)}
                </div>
                <span className="text-xs font-bold text-[#0F172A] truncate max-w-[130px]" title={sub.name}>
                  {sub.name}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                {sub.status}
              </span>
            </div>

            <p className="text-[11px] text-[#475569] leading-relaxed line-clamp-2 font-medium" title={sub.description}>
              {sub.description}
            </p>

            <div className="pt-2 border-t border-[#E2DCD0] flex items-center justify-between text-[11px] text-[#334155] font-mono">
              <span>Uptime: <strong className="text-emerald-800">{sub.uptime_percentage}%</strong></span>
              <span>Replicas: <strong className="text-[#0F172A]">{sub.active_replicas}</strong></span>
              <span>Latency: <strong className="text-cyan-800">{sub.current_latency_ms}ms</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Fault Simulation & Recovery Playground */}
      <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2DCD0]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-700" />
            <h3 className="font-bold text-sm sm:text-base text-[#0F172A]">Simulate Fault & Test Autonomous Recovery</h3>
          </div>
          <span className="text-xs text-[#475569] font-medium">Trigger simulated production anomalies to test self-healing loop</span>
        </CardHeader>

        <CardBody className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                type: 'oom_crash',
                label: 'Container OOM Crash',
                desc: 'Simulates memory exhaustion (Exit 137). Auto-spawns container with +25% RAM.',
                color: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-950'
              },
              {
                type: 'cpu_spike',
                label: 'CPU Surge (95%)',
                desc: 'Simulates traffic spike. Dynamically auto-scales horizontal workers from 1 → 3.',
                color: 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-950'
              },
              {
                type: 'drift_violation',
                label: 'Feature Drift Spike',
                desc: 'Simulates PSI > 0.20 violation. Triggers automated warm-start retraining.',
                color: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-950'
              },
              {
                type: 'schema_corruption',
                label: 'Malformed Payload',
                desc: 'Simulates missing columns. Schema Guardian intercepts & applies median fallback.',
                color: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-950'
              }
            ].map((sim) => (
              <button
                key={sim.type}
                onClick={() => handleSimulateFailure(sim.type, sim.label)}
                disabled={healingInProgress !== null}
                className={`p-3.5 rounded-xl border transition-all duration-200 text-left flex flex-col justify-between gap-2.5 shadow-sm ${sim.color} ${
                  healingInProgress === sim.type ? 'ring-2 ring-cyan-600' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#0F172A]">{sim.label}</span>
                    <Play className="w-3 h-3 text-[#475569]" />
                  </div>
                  <p className="text-[11px] text-[#334155] leading-snug font-medium">{sim.desc}</p>
                </div>

                <div className="pt-2 border-t border-[#E2DCD0] flex items-center justify-between text-[10px] font-bold text-cyan-900">
                  <span>{healingInProgress === sim.type ? 'Self-Healing...' : 'Trigger Fault'}</span>
                  {healingInProgress === sim.type && <RefreshCw className="w-3 h-3 animate-spin text-cyan-700" />}
                </div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Incident Audit Ledger & Circuit Breaker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Incident Audit Trail Table (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2DCD0]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-700" />
                <h3 className="font-bold text-sm sm:text-base text-[#0F172A]">Incident Audit Ledger</h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#475569] font-medium">Severity:</span>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="bg-[#FAF7F2] border border-[#E2DCD0] rounded-lg px-2.5 py-1 text-xs text-[#0F172A] font-semibold focus:outline-none focus:border-cyan-600 cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
            </CardHeader>

            <CardBody className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {filteredIncidents.map((inc) => (
                <div 
                  key={inc.id} 
                  className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2DCD0] space-y-2 hover:border-[#CBD5E1] transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        inc.severity === 'critical'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : inc.severity === 'high'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className="text-xs font-bold text-[#0F172A]">{inc.trigger_metric}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-[#64748B] font-mono">
                      <Clock className="w-3 h-3" />
                      <span>Healed in {inc.recovery_duration_seconds}s</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFDF9] border border-[#E2DCD0] text-xs text-[#334155] flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-900 font-semibold">Action:</strong> {inc.remediation_action}
                    </div>
                  </div>

                  <div className="text-[11px] text-[#475569] flex items-center justify-between pt-1 font-medium">
                    <span>{inc.details}</span>
                    <span className="font-mono text-[10px] text-[#64748B]">{new Date(inc.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}

              {filteredIncidents.length === 0 && (
                <div className="text-center py-8 text-[#64748B] text-xs font-medium">
                  No incidents recorded for selected filter.
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: Circuit Breaker & Safety Guardrails (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
            <CardHeader className="pb-3 border-b border-[#E2DCD0]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm sm:text-base text-[#0F172A]">Circuit Breaker & Guardrails</h3>
              </div>
            </CardHeader>

            <CardBody className="p-4 space-y-4">
              {status?.circuit_breaker && (
                <>
                  <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2DCD0] space-y-2">
                    <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Breaker Status</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        status.circuit_breaker.is_tripped ? 'bg-rose-600 animate-ping' : 'bg-emerald-600'
                      }`} />
                      <span className="text-sm font-bold text-[#0F172A]">
                        {status.circuit_breaker.state}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#475569] font-medium">
                      Prevents cascading recovery loops by tripping into safe fallback mode if failures exceed threshold.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-[#FAF7F2] border border-[#E2DCD0]">
                      <span className="text-[#475569]">Retry Ceiling:</span>
                      <strong className="text-[#0F172A] font-mono">{status.circuit_breaker.max_retries} attempts / hr</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#FAF7F2] border border-[#E2DCD0]">
                      <span className="text-[#475569]">Failure Count:</span>
                      <strong className="text-cyan-800 font-mono font-bold">{status.circuit_breaker.failure_count} / {status.circuit_breaker.max_retries}</strong>
                    </div>
                  </div>

                  <Button 
                    variant="secondary" 
                    onClick={handleResetCircuitBreaker} 
                    className="w-full flex items-center justify-center gap-1.5 text-xs bg-[#FFFDF9] border border-[#E2DCD0] text-[#0F172A] hover:bg-[#FAF7F2]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    Reset Circuit Breaker
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
