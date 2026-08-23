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

  useEffect(() => {
    loadStatus();
  }, [projectId]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.selfHealing.getStatus(projectId);
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load self-healing status');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">AI-Driven Reliability</span>
          </div>
          <h1 className="text-3xl font-bold font-heading">Self-Healing Pipeline</h1>
          <p className="text-gray-400 text-sm">
            Automated fault detection, container OOM recovery, dynamic autoscaling, and drift retraining guardrails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={loadStatus} 
            disabled={loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {activeSimulationToast && (
        <div className="glass border-cyan-500/40 bg-cyan-500/10 p-3.5 rounded-xl text-cyan-300 text-xs flex items-center gap-2 animate-slide-up">
          <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
          <span>{activeSimulationToast}</span>
        </div>
      )}

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* System Health Hero Banner */}
      {status && (
        <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-[#0c1824] via-[#0d1424] to-[#0a0f1d] shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Autonomous Operations Status</span>
              </div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span>{status.overall_health_status}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Zero Downtime
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 max-w-xl">
                Real-time autonomous supervisor is actively probing containers, queuing latencies, feature drift metrics, and payload schemas.
              </p>
            </div>

            {/* Quick Metrics KPI Cluster */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Health Score</span>
                <div className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  {status.health_score}%
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Auto-Healed</span>
                <div className="text-xl font-extrabold text-white">
                  {status.total_auto_recoveries}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Success Rate</span>
                <div className="text-xl font-extrabold text-emerald-400 font-mono">
                  {status.recovery_success_rate}%
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Cluster P95</span>
                <div className="text-xl font-extrabold text-cyan-300 font-mono">
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
            className="glass rounded-2xl p-4 border border-white/10 bg-[#0d1424]/80 space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
                  {getSubsystemIcon(sub.category)}
                </div>
                <span className="text-xs font-bold text-white truncate max-w-[130px]" title={sub.name}>
                  {sub.name}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {sub.status}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2" title={sub.description}>
              {sub.description}
            </p>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-300 font-mono">
              <span>Uptime: <strong className="text-emerald-400">{sub.uptime_percentage}%</strong></span>
              <span>Replicas: <strong className="text-white">{sub.active_replicas}</strong></span>
              <span>Latency: <strong className="text-cyan-300">{sub.current_latency_ms}ms</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Fault Simulation & Recovery Playground */}
      <Card glow>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">Simulate Fault & Test Autonomous Recovery</h3>
          </div>
          <span className="text-xs text-gray-400">Trigger simulated production anomalies to test self-healing loop</span>
        </CardHeader>

        <CardBody className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                type: 'oom_crash',
                label: 'Container OOM Crash',
                desc: 'Simulates memory exhaustion (Exit 137). Auto-spawns container with +25% RAM.',
                color: 'from-red-500/20 to-orange-500/20 border-red-500/30 hover:border-red-500/60 text-red-300'
              },
              {
                type: 'cpu_spike',
                label: 'CPU Surge (95%)',
                desc: 'Simulates traffic spike. Dynamically auto-scales horizontal workers from 1 → 3.',
                color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30 hover:border-purple-500/60 text-purple-300'
              },
              {
                type: 'drift_violation',
                label: 'Feature Drift Spike',
                desc: 'Simulates PSI > 0.20 violation. Triggers automated warm-start retraining.',
                color: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300'
              },
              {
                type: 'schema_corruption',
                label: 'Malformed Payload',
                desc: 'Simulates missing columns. Schema Guardian intercepts & applies median fallback.',
                color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 hover:border-amber-500/60 text-amber-300'
              }
            ].map((sim) => (
              <button
                key={sim.type}
                onClick={() => handleSimulateFailure(sim.type, sim.label)}
                disabled={healingInProgress !== null}
                className={`p-3.5 rounded-xl border bg-gradient-to-br transition-all duration-200 text-left flex flex-col justify-between gap-2.5 ${sim.color} ${
                  healingInProgress === sim.type ? 'ring-2 ring-cyan-400 animate-pulse' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{sim.label}</span>
                    <Play className="w-3 h-3 opacity-60" />
                  </div>
                  <p className="text-[11px] text-gray-300 leading-snug">{sim.desc}</p>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-semibold text-cyan-300">
                  <span>{healingInProgress === sim.type ? 'Self-Healing...' : 'Trigger Fault'}</span>
                  {healingInProgress === sim.type && <RefreshCw className="w-3 h-3 animate-spin" />}
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
          <Card glow>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">Incident Audit Ledger</h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Severity:</span>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="bg-[#0e1628] border border-white/15 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
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
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:border-white/20 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        inc.severity === 'critical'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : inc.severity === 'high'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className="text-xs font-bold text-white">{inc.trigger_metric}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>Healed in {inc.recovery_duration_seconds}s</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-xs text-gray-300 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-300">Action:</strong> {inc.remediation_action}
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1">
                    <span>{inc.details}</span>
                    <span className="font-mono text-[10px] text-gray-500">{new Date(inc.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}

              {filteredIncidents.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No incidents recorded for selected filter.
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: Circuit Breaker & Safety Guardrails (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card glow>
            <CardHeader className="pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">Circuit Breaker & Guardrails</h3>
              </div>
            </CardHeader>

            <CardBody className="p-4 space-y-4">
              {status?.circuit_breaker && (
                <>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Breaker Status</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        status.circuit_breaker.is_tripped ? 'bg-red-500 animate-ping' : 'bg-emerald-400'
                      }`} />
                      <span className="text-sm font-bold text-white">
                        {status.circuit_breaker.state}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Prevents cascading recovery loops by tripping into safe fallback mode if failures exceed threshold.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-black/20 border border-white/5">
                      <span className="text-gray-400">Retry Ceiling:</span>
                      <strong className="text-white font-mono">{status.circuit_breaker.max_retries} attempts / hr</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-black/20 border border-white/5">
                      <span className="text-gray-400">Failure Count:</span>
                      <strong className="text-cyan-300 font-mono">{status.circuit_breaker.failure_count} / {status.circuit_breaker.max_retries}</strong>
                    </div>
                  </div>

                  <Button 
                    variant="secondary" 
                    onClick={handleResetCircuitBreaker} 
                    className="w-full flex items-center justify-center gap-1.5 text-xs border-amber-500/30 hover:border-amber-500/60"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
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
