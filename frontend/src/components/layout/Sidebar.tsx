"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Database, BarChart2, Wand2, 
  Dna, Cpu, Share2, FileCode2, Bot,
  Plus, ArrowLeft, BrainCircuit, Sliders, ShieldCheck, Leaf, Award, GitBranch
} from 'lucide-react';
import { useUIStore } from '@/lib/store';

export function Sidebar({ projectId }: { projectId?: string }) {
  const { sidebarOpen } = useUIStore();
  const pathname = usePathname();

  const generalLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard /> },
    { name: '+ New Project', href: '/projects/new', icon: <Plus className="text-amber-700" /> },
  ];

  const projectLinks = projectId ? [
    { name: 'Overview', href: `/projects/${projectId}`, icon: <LayoutDashboard /> },
    { name: 'Orvin Gate', href: `/projects/${projectId}/devops-agent`, icon: <BrainCircuit className="text-indigo-600" /> },
    { name: 'Datasets', href: `/projects/${projectId}/datasets`, icon: <Database /> },
    { name: 'AI Decision', href: `/projects/${projectId}/decision`, icon: <BrainCircuit className="text-amber-700" /> },
    { name: 'Analysis', href: `/projects/${projectId}/analysis`, icon: <BarChart2 /> },
    { name: 'Cleaning', href: `/projects/${projectId}/cleaning`, icon: <Wand2 /> },
    { name: 'Features', href: `/projects/${projectId}/features`, icon: <Dna /> },
    { name: 'Training', href: `/projects/${projectId}/training`, icon: <Cpu /> },
    { name: 'Version History', href: `/projects/${projectId}/versions`, icon: <GitBranch className="text-purple-600" /> },
    { name: 'Simulator', href: `/projects/${projectId}/simulator`, icon: <Sliders className="text-purple-600" /> },
    { name: 'Self-Healing', href: `/projects/${projectId}/self-healing`, icon: <ShieldCheck className="text-emerald-600" /> },
    { name: 'Cost & Carbon', href: `/projects/${projectId}/cost-carbon`, icon: <Leaf className="text-emerald-700" /> },
    { name: 'Readiness', href: `/projects/${projectId}/readiness`, icon: <Award className="text-amber-600" /> },
    { name: 'Explain', href: `/projects/${projectId}/explain`, icon: <Share2 /> },
    { name: 'API Gen', href: `/projects/${projectId}/api-gen`, icon: <FileCode2 /> },
    { name: 'Assistant', href: `/projects/${projectId}/assistant`, icon: <Bot /> },
  ] : [];

  return (
    <aside 
      className={`fixed lg:static top-16 left-0 h-[calc(100vh-4rem)] z-30 bg-[#EFEAE1] border-r border-[#D6CEBE] transition-all duration-300 overflow-hidden flex flex-col text-[#0F172A] ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 lg:w-20 -translate-x-full lg:translate-x-0'}`}
    >
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {projectId && (
          <div className="pb-3 mb-2 border-b border-[#D6CEBE] space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#334155] hover:text-[#0F172A] hover:bg-[#E5DFD3] transition-all group text-sm font-bold"
              title="All Projects"
            >
              <ArrowLeft className="w-4 h-4 text-[#475569] group-hover:text-[#0F172A] group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <span className={`transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                All Projects
              </span>
            </Link>

            <Link
              href="/projects/new"
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B] transition-all text-xs font-bold shadow-sm"
              title="Create New Project"
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              <span className={`transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                + Create Project
              </span>
            </Link>
          </div>
        )}

        {projectId && (
          <div className={`px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#475569] ${sidebarOpen ? 'block' : 'hidden'}`}>
            Pipeline Modules
          </div>
        )}

        {(projectId ? projectLinks : generalLinks).map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link 
              key={link.name} 
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                isActive 
                  ? 'bg-[#0F172A] text-white font-bold shadow-sm' 
                  : 'text-[#334155] hover:bg-[#E5DFD3] hover:text-[#0F172A] font-semibold'
              }`}
              title={!sidebarOpen ? link.name : undefined}
            >
              <div className={`${isActive ? 'text-white' : 'text-[#475569] group-hover:text-[#0F172A]'} transition-colors [&>svg]:w-5 [&>svg]:h-5 shrink-0`}>
                {link.icon}
              </div>
              <span className={`whitespace-nowrap text-sm transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                {link.name}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}