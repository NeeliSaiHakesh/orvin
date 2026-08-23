"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Database, BarChart2, Wand2, 
  Dna, Cpu, Share2, FileCode2, Settings, Bot,
  Plus, ArrowLeft, FolderPlus, BrainCircuit, Sparkles, Sliders, ShieldCheck
} from 'lucide-react';
import { useUIStore } from '@/lib/store';

export function Sidebar({ projectId }: { projectId?: string }) {
  const { sidebarOpen } = useUIStore();
  const pathname = usePathname();

  const generalLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard /> },
    { name: '+ New Project', href: '/projects/new', icon: <Plus className="text-cyan-400" /> },
  ];

  const projectLinks = projectId ? [
    { name: 'Overview', href: `/projects/${projectId}`, icon: <LayoutDashboard /> },
    { name: 'Datasets', href: `/projects/${projectId}/datasets`, icon: <Database /> },
    { name: 'AI Decision', href: `/projects/${projectId}/decision`, icon: <BrainCircuit className="text-cyan-400" /> },
    { name: 'Analysis', href: `/projects/${projectId}/analysis`, icon: <BarChart2 /> },
    { name: 'Cleaning', href: `/projects/${projectId}/cleaning`, icon: <Wand2 /> },
    { name: 'Features', href: `/projects/${projectId}/features`, icon: <Dna /> },
    { name: 'Training', href: `/projects/${projectId}/training`, icon: <Cpu /> },
    { name: 'Simulator', href: `/projects/${projectId}/simulator`, icon: <Sliders className="text-purple-400" /> },
    { name: 'Self-Healing', href: `/projects/${projectId}/self-healing`, icon: <ShieldCheck className="text-emerald-400" /> },
    { name: 'Explain', href: `/projects/${projectId}/explain`, icon: <Share2 /> },
    { name: 'API Gen', href: `/projects/${projectId}/api-gen`, icon: <FileCode2 /> },
    { name: 'Assistant', href: `/projects/${projectId}/assistant`, icon: <Bot /> },
  ] : [];

  return (
    <aside 
      className={`fixed lg:static top-16 left-0 h-[calc(100vh-4rem)] z-30 glass rounded-none border-y-0 border-l-0 transition-all duration-300 overflow-hidden flex flex-col ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 lg:w-20 -translate-x-full lg:translate-x-0'}`}
    >
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {projectId && (
          <div className="pb-3 mb-2 border-b border-white/10 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all group text-sm font-medium"
              title="All Projects"
            >
              <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <span className={`transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                All Projects
              </span>
            </Link>

            <Link
              href="/projects/new"
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:text-white transition-all text-xs font-semibold"
              title="Create New Project"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className={`transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                + Create Project
              </span>
            </Link>
          </div>
        )}

        {projectId && (
          <div className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 ${sidebarOpen ? 'block' : 'hidden'}`}>
            Pipeline Stages
          </div>
        )}

        {(projectId ? projectLinks : generalLinks).map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link 
              key={link.name} 
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white border border-cyan-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
              title={!sidebarOpen ? link.name : undefined}
            >
              <div className={`${isActive ? 'text-cyan-400' : 'group-hover:text-cyan-400'} transition-colors [&>svg]:w-5 [&>svg]:h-5 shrink-0`}>
                {link.icon}
              </div>
              <span className={`font-medium whitespace-nowrap text-sm transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                {link.name}
              </span>
              {isActive && sidebarOpen && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22D3EE]"></div>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}