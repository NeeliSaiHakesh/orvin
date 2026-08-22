import Link from 'next/link';
import { Activity, BrainCircuit, Database, FileCode2, LineChart, Sparkles, Wand2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/30 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/30 blur-[120px] rounded-full pointer-events-none"></div>

      <nav className="flex items-center justify-between p-6 glass sticky top-0 z-50 rounded-none border-t-0 border-x-0 border-b-white/10">
        <div className="text-2xl font-bold font-heading flex items-center gap-2">
          <BrainCircuit className="text-cyan-400" />
          <span className="gradient-text">AutoMLOps</span>
        </div>
        <div className="flex gap-4">
          <Link href="/auth/login" className="btn-secondary">Login</Link>
          <Link href="/auth/register" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-8 z-10 text-center space-y-12">
        <div className="space-y-6 max-w-4xl animate-slide-up">
          <h1 className="text-6xl md:text-8xl font-bold font-heading">
            <span className="gradient-text leading-tight">AI-Powered</span> <br /> MLOps Platform
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            From raw data to deployed model in minutes. Experience the next generation of machine learning automation.
          </p>
          <div className="flex gap-6 justify-center pt-8">
            <Link href="/auth/register" className="btn-primary text-lg px-8 py-4">Start Building</Link>
            <Link href="#features" className="btn-secondary text-lg px-8 py-4">Learn More</Link>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full pt-16" id="features">
          {[
            { icon: <Database className="w-8 h-8 text-blue-400" />, title: "Dataset Intelligence", desc: "Automated cleaning and analysis of your data." },
            { icon: <Wand2 className="w-8 h-8 text-purple-400" />, title: "Feature Engineering", desc: "AI-driven feature generation for optimal performance." },
            { icon: <Activity className="w-8 h-8 text-green-400" />, title: "AutoML Training", desc: "Find the best model automatically from dozens of algorithms." },
            { icon: <LineChart className="w-8 h-8 text-yellow-400" />, title: "Explainable AI", desc: "Understand why your models make decisions with SHAP." },
            { icon: <FileCode2 className="w-8 h-8 text-red-400" />, title: "API Generation", desc: "Instantly deployable API endpoints for your trained models." },
            { icon: <Sparkles className="w-8 h-8 text-cyan-400" />, title: "Docker Intelligence", desc: "Containerize your models automatically." }
          ].map((f, i) => (
            <div key={i} className="glass p-8 text-left hover:scale-105 transition-transform duration-300 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="bg-white/10 p-3 rounded-xl inline-block mb-4">{f.icon}</div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="glass rounded-none border-b-0 border-x-0 py-8 text-center text-gray-500 z-10">
        <p>&copy; 2026 AutoMLOps Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}