import Link from 'next/link';
import { 
  ShieldCheck, ArrowRight, Activity, Database, FileCode2, 
  LineChart, Wand2, Terminal, CheckCircle2, Cpu, Sparkles, 
  Layers, Lock, GitBranch, Cloud
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#0F172A] font-sans selection:bg-[#E2DCD0]">
      {/* Top Header */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-4 sticky top-0 z-50 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#E2DCD0] shadow-xs">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-black font-heading flex items-center gap-2 text-[#0F172A]">
            <span className="tracking-tight text-xl font-extrabold text-[#0F172A]">Orvin</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#0F172A] text-white">AI</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#475569]">
            <a href="#features" className="hover:text-[#0F172A] transition-colors">Capabilities</a>
            <a href="#workflow" className="hover:text-[#0F172A] transition-colors">Pre-Flight Architecture</a>
            <a href="#metrics" className="hover:text-[#0F172A] transition-colors">Enterprise Metrics</a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link 
            href="/auth/login" 
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#475569] hover:text-[#0F172A] hover:bg-[#FAF7F0] transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/dashboard" 
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>Launch Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center">
        <section className="w-full max-w-4xl px-6 pt-16 pb-12 text-center space-y-6 animate-slide-up">
          {/* Minimal Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFDF9] border border-[#E2DCD0] text-[#0F172A] text-xs font-medium shadow-xs">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
            </span>
            <span className="text-[#475569]">Pre-Flight Reliability Engine</span>
            <span className="text-[#CBD5E1]">/</span>
            <span className="text-[#0F172A] font-semibold">Enterprise Edition</span>
          </div>

          {/* Minimal Headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-[#0F172A] tracking-tight leading-snug max-w-2xl mx-auto">
            Autonomous Pre-Flight Gates for Mission-Critical Machine Learning
          </h1>

          {/* Concise Subtitle */}
          <p className="text-sm sm:text-base text-[#475569] max-w-xl mx-auto leading-relaxed">
            Eliminate ML deployment regressions before merge. Detect dependency breaks, memory overcommit, and schema drift automatically.
          </p>

          {/* Minimal Call to Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-xs transition-all"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link 
              href="/projects/proj-eqs1yte/devops-agent" 
              className="inline-flex items-center gap-2 bg-[#FFFDF9] hover:bg-[#FAF7F0] border border-[#CBD5E1] text-[#0F172A] font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Simulate Pre-Flight Gate</span>
            </Link>
          </div>
        </section>

        {/* Enterprise Metrics Strip */}
        <section className="w-full max-w-6xl px-6 py-8" id="metrics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 sm:p-8 rounded-3xl bg-[#FFFDF9] border border-[#E2DCD0] shadow-xs">
            <div className="text-center p-4 border-r last:border-r-0 border-[#E2DCD0]">
              <div className="text-3xl sm:text-4xl font-black font-heading text-[#0F172A]">99.98%</div>
              <div className="text-xs font-medium text-[#64748B] mt-1">Pre-Flight Gate Accuracy</div>
            </div>
            <div className="text-center p-4 sm:border-r border-[#E2DCD0]">
              <div className="text-3xl sm:text-4xl font-black font-heading text-[#0F172A]">&lt; 12s</div>
              <div className="text-xs font-medium text-[#64748B] mt-1">Automated Patch Synthesis</div>
            </div>
            <div className="text-center p-4 border-r last:border-r-0 border-[#E2DCD0]">
              <div className="text-3xl sm:text-4xl font-black font-heading text-[#0F172A]">8+</div>
              <div className="text-xs font-medium text-[#64748B] mt-1">AutoML Model Architectures</div>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl sm:text-4xl font-black font-heading text-[#0F172A]">100%</div>
              <div className="text-xs font-medium text-[#64748B] mt-1">Lineage &amp; Provenance Tracking</div>
            </div>
          </div>
        </section>

        {/* Pre-Flight Architecture Workflow */}
        <section className="w-full max-w-6xl px-6 py-16 text-left" id="workflow">
          <div className="mb-10 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] bg-[#EFF6FF] px-3 py-1 rounded-md border border-[#DBEAFE]">
              Deployment Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#0F172A] mt-3 tracking-tight">
              How the Orvin Pre-Flight Gate Operates
            </h2>
            <p className="text-sm text-[#475569] mt-1 max-w-2xl">
              An intelligent CI/CD evaluation step that intercepts pull requests, benchmarks regressions against historical incident memory, and patches root causes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#FFFDF9] border border-[#E2DCD0] rounded-3xl p-7 relative shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] flex items-center justify-center text-xs font-black text-[#0F172A] mb-5">
                01
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#2563EB]" />
                <span>Pull Request Ingestion</span>
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Analyzes dependency manifest diffs, hardware resource configurations, and schema mutations before build triggers.
              </p>
            </div>

            <div className="bg-[#FFFDF9] border border-[#E2DCD0] rounded-3xl p-7 relative shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] flex items-center justify-center text-xs font-black text-[#0F172A] mb-5">
                02
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Episodic Memory Recall</span>
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Queries Hindsight memory banks to cross-reference past post-mortems, ABI breakages, and memory exhaustion incidents.
              </p>
            </div>

            <div className="bg-[#FFFDF9] border border-[#E2DCD0] rounded-3xl p-7 relative shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] flex items-center justify-center text-xs font-black text-[#0F172A] mb-5">
                03
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Automated Remediation</span>
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Generates a verified, compiler-safe git patch diff and issues an automated merge veto or green clearance with rationale.
              </p>
            </div>
          </div>
        </section>

        {/* Platform Capabilities Bento Grid */}
        <section className="w-full max-w-6xl px-6 py-12" id="features">
          <div className="mb-10 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#059669] bg-[#ECFDF5] px-3 py-1 rounded-md border border-[#A7F3D0]">
              Unified MLOps Platform
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#0F172A] mt-3 tracking-tight">
              Comprehensive Intelligence for Machine Learning Engineering
            </h2>
            <p className="text-sm text-[#475569] mt-1 max-w-2xl">
              From dataset ingestion and automated model selection to explainable AI and cloud cost sizing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <ShieldCheck className="w-5 h-5 text-indigo-700" />,
                title: "Orvin Pre-Flight Gate",
                tag: "Reliability",
                desc: "Hindsight episodic memory (Retain, Recall, Reflect) intercepts and fixes production CI/CD regressions before merge."
              },
              {
                icon: <Activity className="w-5 h-5 text-emerald-700" />,
                title: "Multi-Model AutoML",
                tag: "Modeling",
                desc: "Parallel benchmarking across 8+ algorithms with 5-fold cross-validation and automated hyperparameter ranking."
              },
              {
                icon: <Database className="w-5 h-5 text-blue-700" />,
                title: "Dataset Intelligence & Cleaning",
                tag: "Data Ops",
                desc: "Statistical profiling, outlier capping, anomaly detection, and progressive versioning with SHA-256 lineage."
              },
              {
                icon: <Wand2 className="w-5 h-5 text-amber-700" />,
                title: "AI Feature Engineering",
                tag: "Transformations",
                desc: "Temporal extraction, high-cardinality target encoding, and variance optimization designed for high-scale features."
              },
              {
                icon: <LineChart className="w-5 h-5 text-purple-700" />,
                title: "Explainable AI & Governance",
                tag: "Compliance",
                desc: "SHAP value attributions, model fairness audits, ROC/AUC curves, and decision support radar matrix."
              },
              {
                icon: <Cloud className="w-5 h-5 text-sky-700" />,
                title: "Cost & Carbon Sizing",
                tag: "Infrastructure",
                desc: "Multi-cloud hardware provisioning, compute cost estimations, and carbon footprint (CO2) sustainability modeling."
              }
            ].map((f, i) => (
              <div 
                key={i} 
                className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-xs p-7 rounded-3xl text-left hover:border-[#CBD5E1] transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0] inline-block">
                      {f.icon}
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7F0] border border-[#E2DCD0] text-[#64748B]">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0F172A] mb-2 group-hover:text-[#2563EB] transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="w-full max-w-6xl px-6 py-16">
          <div className="bg-[#0F172A] text-white rounded-3xl p-8 sm:p-14 text-center space-y-6 shadow-md relative overflow-hidden">
            <div className="max-w-2xl mx-auto space-y-4 relative z-10">
              <h2 className="text-2xl sm:text-4xl font-extrabold font-heading tracking-tight">
                Ready to Deploy Reliable Machine Learning Pipelines?
              </h2>
              <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Launch the Orvin AI workspace to explore autonomous pre-flight validation, multi-model AutoML, and full governance lineage.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <Link 
                  href="/dashboard" 
                  className="inline-flex items-center gap-2 bg-white hover:bg-[#F1F5F9] text-[#0F172A] font-bold text-xs sm:text-sm px-7 py-3 rounded-xl shadow-xs transition-all"
                >
                  <span>Launch Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link 
                  href="/auth/register" 
                  className="inline-flex items-center gap-2 bg-[#1E293B] hover:bg-[#334155] text-white border border-[#475569] font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Global Minimal Footer */}
      <footer className="border-t border-[#E2DCD0] bg-[#FFFDF9] py-8 text-center text-xs text-[#64748B]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#0F172A] tracking-tight">Orvin AI</span>
            <span>&bull;</span>
            <span>Enterprise Autonomous MLOps &amp; Reliability Platform</span>
          </div>
          <p>&copy; {new Date().getFullYear()} Orvin AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}