"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FolderGit2, Database, Cpu, Activity, Clock, ArrowRight, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.projects.list();
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        setProjects([]);
      }
    } catch {
      // If backend is fresh or empty
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const totalDatasets = projects.reduce((acc, p) => acc + (p.dataset_count || 0), 0);

  const stats = [
    { label: 'Total Projects', value: projects.length, icon: <FolderGit2 className="text-purple-400" /> },
    { label: 'Total Datasets', value: totalDatasets, icon: <Database className="text-cyan-400" /> },
    { label: 'Active Projects', value: projects.filter(p => p.status !== 'archived').length, icon: <Activity className="text-green-400" /> },
    { label: 'AutoML Engine', value: 'Ready', icon: <Cpu className="text-yellow-400" /> }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2 text-white">
            Welcome back, {user?.name || user?.email?.split('@')[0] || 'Engineer'}!
          </h1>
          <p className="text-gray-400">Manage your machine learning pipelines and models.</p>
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
          <h2 className="text-2xl font-bold font-heading text-white">Your Projects</h2>
          <Link href="/projects/new">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create Project
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span>Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <Card glow>
            <CardBody className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
                <FolderGit2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">No Projects Found</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  Get started by creating your first machine learning project to upload datasets and run AutoML.
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
            {projects.map((project, i) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="block group">
                <Card hover className="h-full flex flex-col justify-between transition-all duration-300">
                  <CardBody>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {project.name}
                      </h3>
                      <Badge variant={project.status === 'trained' ? 'success' : 'info'}>
                        {project.status || 'Active'}
                      </Badge>
                    </div>
                    <p className="text-gray-400 text-xs line-clamp-2 mb-4">
                      {project.description || 'Automated ML project workflow'}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-white/5 text-gray-300 uppercase font-mono">
                        {project.task_type || 'classification'}
                      </span>
                    </div>
                  </CardBody>
                  <CardFooter className="flex justify-between items-center text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{project.dataset_count || 0} Datasets</span>
                    </div>
                    <div className="flex items-center gap-1 group-hover:text-white transition-colors">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}

            {/* Create Card */}
            <Link href="/projects/new" className="block">
              <div className="h-full min-h-[180px] border-2 border-dashed border-white/10 hover:border-purple-500/50 rounded-2xl flex flex-col items-center justify-center p-6 text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer group">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-bold text-sm">Create New Project</h3>
                <p className="text-xs text-gray-500 mt-1">Upload data & train models</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}