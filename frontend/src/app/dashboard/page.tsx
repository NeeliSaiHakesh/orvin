"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FolderGit2, Database, Cpu, Activity, ArrowRight, Loader2, BrainCircuit } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { StatsCard } from '@/components/ui/StatsCard';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.projects.list();
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        setProjects([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects from server');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const totalDatasets = projects.reduce((acc, p) => acc + (p.dataset_count || 0), 0);

  const stats = [
    { label: 'Total Projects', value: projects.length, icon: <FolderGit2 className="text-[#0f172a]" /> },
    { label: 'Total Datasets', value: totalDatasets, icon: <Database className="text-blue-700" /> },
    { label: 'Active Projects', value: projects.filter(p => p.status !== 'archived').length, icon: <Activity className="text-emerald-700" /> },
    { label: 'Orvin AI', value: 'Ready', icon: <BrainCircuit className="text-indigo-700" /> }
  ];

  return (
    <div className="space-y-8 animate-fade-in text-[#0F172A]">
      {/* Welcome Banner - High Contrast Dark Text */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] p-7 rounded-3xl border border-[#D6CEBE] shadow-xs">
        <div>
          <h1 suppressHydrationWarning className="text-3xl font-extrabold font-heading mb-1 text-[#0F172A]">
            Welcome back, {user?.name || user?.email?.split('@')[0] || 'Engineer'}!
          </h1>
          <p className="text-[#475569] text-sm">Manage your machine learning pipelines, datasets, and Orvin pre-flight gates.</p>
        </div>
        <Link href="/projects/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <StatsCard key={i} {...stat} />
        ))}
      </div>

      {/* Recent Projects */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold font-heading text-[#0f172a]">Your Projects</h2>
          <Link href="/projects/new">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create Project
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#64748b] gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0f172a]" />
            <span className="font-semibold text-sm">Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardBody className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0] flex items-center justify-center mx-auto text-[#0f172a]">
                <FolderGit2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#0f172a] mb-1">No Projects Found</h3>
                <p className="text-[#475569] text-sm max-w-md mx-auto">
                  Get started by creating your first machine learning project to upload datasets, train models, and test the Orvin pre-flight gate.
                </p>
              </div>
              <div className="pt-2">
                <Link href="/projects/new">
                  <Button className="flex items-center gap-2 mx-auto">
                    <Plus className="w-4 h-4" /> Create Your First Project
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="block group">
                <Card hover className="h-full flex flex-col justify-between transition-all duration-200">
                  <CardBody>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-[#0f172a] group-hover:text-indigo-700 transition-colors">
                        {project.name}
                      </h3>
                      <Badge variant={project.status === 'trained' ? 'success' : 'info'}>
                        {project.status || 'Active'}
                      </Badge>
                    </div>
                    <p className="text-[#475569] text-xs line-clamp-2 mb-4 leading-relaxed">
                      {project.description || 'Automated ML project pipeline & pre-flight gate'}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-md bg-[#FAF7F0] border border-[#E2DCD0] text-[#0f172a] uppercase font-mono font-bold">
                        {project.task_type || 'classification'}
                      </span>
                    </div>
                  </CardBody>
                  <CardFooter className="flex justify-between items-center text-xs text-[#475569]">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Database className="w-3.5 h-3.5 text-blue-700" />
                      <span>{project.dataset_count || 0} Datasets</span>
                    </div>
                    <div className="flex items-center gap-1 font-bold text-[#0f172a] group-hover:text-indigo-700 transition-colors">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}

            {/* Create Project Card */}
            <Link href="/projects/new" className="block">
              <div className="h-full min-h-[180px] border-2 border-dashed border-[#CBD5E1] bg-[#FFFDF9]/60 hover:bg-[#FFFDF9] hover:border-[#94A3B8] rounded-3xl flex flex-col items-center justify-center p-6 text-[#475569] hover:text-[#0f172a] transition-all cursor-pointer group shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform text-[#0f172a]">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-[#0f172a]">Create New Project</h3>
                <p className="text-xs text-[#64748b] mt-1">Upload data & evaluate pre-flight risks</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}