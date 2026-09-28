"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('classification');
  const [targetColumn, setTargetColumn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const project = await api.projects.create({
        name: name.trim(),
        description: description.trim() || undefined,
        task_type: taskType,
        target_column: targetColumn.trim() || undefined,
      });

      if (project && project.id) {
        router.push(`/projects/${project.id}/datasets`);
      } else {
        throw new Error('Project was created but did not return a valid ID');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create project. Please verify you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pt-6 text-[#0F172A]">
      <div className="bg-[#FFFDF9] p-6 rounded-3xl border border-[#E2DCD0] shadow-sm">
        <h1 className="text-3xl font-extrabold font-heading mb-1 text-[#0F172A]">Create New Project</h1>
        <p className="text-[#475569] text-sm">Set up your automated machine learning project workspace.</p>
      </div>

      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 rounded-2xl text-rose-900 font-semibold text-sm">{error}</div>
      )}

      <Card>
        <CardHeader className="border-b border-[#E2DCD0] py-4">
          <h3 className="font-bold flex items-center gap-2 text-[#0F172A]">
            <FolderPlus className="w-5 h-5 text-indigo-700" /> Project Configuration
          </h3>
        </CardHeader>
        <CardBody className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Project Name *"
              placeholder="e.g. Enterprise Churn & Risk Guard"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">Description</label>
              <textarea
                rows={3}
                className="w-full bg-[#FAF7F0] border border-[#CBD5E1] rounded-xl p-3 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20 focus:border-[#0F172A] transition-colors text-sm font-medium"
                placeholder="Brief description of what this ML project aims to predict..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">Task Type</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full bg-[#FAF7F0] border border-[#CBD5E1] rounded-xl p-3 text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20 focus:border-[#0F172A] transition-colors text-sm cursor-pointer"
                >
                  <option value="classification" className="bg-[#FFFDF9] text-[#0F172A]">Classification</option>
                  <option value="regression" className="bg-[#FFFDF9] text-[#0F172A]">Regression</option>
                </select>
              </div>

              <div>
                <Input
                  label="Target Column (Optional)"
                  placeholder="e.g. churn, price, risk_tier"
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E2DCD0]">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  <>Create & Upload Dataset <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
