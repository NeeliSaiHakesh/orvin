"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Database, Upload, Eye, Trash2, FileSpreadsheet, FileJson } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { ModuleVersionBadge } from '@/components/ui/ModuleVersionBadge';

interface Dataset {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  file_hash?: string;
  version?: number;
  row_count: number | null;
  column_count: number | null;
  status: string;
  uploaded_at: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function DatasetsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<{ message: string; isDuplicate: boolean } | null>(null);

  useEffect(() => {
    loadDatasets();
  }, [projectId]);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const data = await api.datasets.list(projectId);
      setDatasets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    try {
      setUploading(true);
      setError(null);
      setUploadNotice(null);
      const results = await Promise.all(files.map(file => api.datasets.upload(projectId, file)));
      const lastResult = results[results.length - 1];
      if (lastResult && lastResult.message) {
        setUploadNotice({
          message: lastResult.message,
          isDuplicate: !!lastResult.is_duplicate
        });
      }
      await loadDatasets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (datasetId: string) => {
    try {
      await api.datasets.delete(datasetId);
      await loadDatasets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getFileIcon = (type: string) => {
    if (type === 'csv' || type === 'excel') return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
    if (type === 'json') return <FileJson className="w-5 h-5 text-yellow-400" />;
    return <Database className="w-5 h-5 text-blue-400" />;
  };

  const statusColor = (status: string): 'success' | 'warning' | 'info' | 'neutral' => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
      uploaded: 'info',
      analyzing: 'warning',
      analyzed: 'success',
      cleaning: 'warning',
      cleaned: 'success',
      training: 'warning',
      trained: 'success',
    };
    return map[status] || 'neutral';
  };

  const columns = [
    {
      key: 'version', header: 'Ver', sortable: true,
      render: (item: Dataset) => (
        <span className="px-2 py-0.5 rounded-md bg-purple-100 border border-purple-300 text-purple-900 font-mono font-bold text-xs">
          v{item.version || 1}
        </span>
      )
    },
    {
      key: 'filename', header: 'File & Checksum', sortable: true,
      render: (item: Dataset) => (
        <div className="flex items-center gap-3">
          {getFileIcon(item.file_type)}
          <div>
            <p className="font-semibold text-[#0F172A]">{item.filename}</p>
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <span>{formatFileSize(item.file_size)}</span>
              {item.file_hash && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[10px] text-cyan-800 bg-cyan-100 px-1.5 py-0.5 rounded border border-cyan-300" title={`SHA256: ${item.file_hash}`}>
                    SHA: {item.file_hash.substring(0, 10)}…
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )
    },
    { key: 'file_type', header: 'Type', render: (item: Dataset) => <span className="uppercase text-xs font-mono text-[#0F172A] font-bold">{item.file_type}</span> },
    { key: 'row_count', header: 'Rows', render: (item: Dataset) => <span className="text-[#0F172A] font-medium">{item.row_count?.toLocaleString() ?? '—'}</span> },
    { key: 'column_count', header: 'Columns', render: (item: Dataset) => <span className="text-[#0F172A] font-medium">{item.column_count ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (item: Dataset) => <Badge variant={statusColor(item.status)}>{item.status}</Badge> },
    {
      key: 'uploaded_at', header: 'Uploaded Date', sortable: true,
      render: (item: Dataset) => <span className="text-xs text-[#475569] font-mono font-medium">{formatUploadDate(item.uploaded_at)}</span>
    },
    {
      key: 'actions', header: 'Quick Actions',
      render: (item: Dataset) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Link href={`/projects/${projectId}/analysis`}>
            <button className="px-2.5 py-1 rounded-lg bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-900 text-xs font-bold transition-colors">
              Analyze
            </button>
          </Link>
          <Link href={`/projects/${projectId}/cleaning`}>
            <button className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-900 text-xs font-bold transition-colors">
              Clean
            </button>
          </Link>
          <Link href={`/projects/${projectId}/training`}>
            <button className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 text-xs font-bold transition-colors">
              Train
            </button>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} title="Delete Dataset" className="hover:bg-red-100">
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in text-[#0F172A]">
      <div>
        <h1 className="text-3xl font-bold font-heading mb-2 text-[#0F172A]">Datasets</h1>
        <p className="text-[#475569]">Upload and manage your project datasets.</p>
      </div>

      {datasets.length > 0 && (
        <ModuleVersionBadge
          moduleName="Datasets"
          currentVersion={Math.max(...datasets.map(d => d.version || 1))}
          availableVersions={datasets.map(d => ({
            version: d.version || 1,
            label: d.filename,
            sublabel: `${d.row_count ? d.row_count.toLocaleString() : '0'} rows • ${d.column_count || 0} cols`,
            timestamp: formatUploadDate(d.uploaded_at)
          }))}
          onSelectVersion={(v) => {
            const target = datasets.find(d => d.version === v);
            if (target) {
              // Version selected
            }
          }}
          projectId={projectId}
          artifactType="Dataset"
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">{error}</div>
      )}

      {uploadNotice && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 shadow-sm ${
          uploadNotice.isDuplicate 
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-emerald-300 bg-emerald-50 text-emerald-950'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${uploadNotice.isDuplicate ? 'bg-amber-500 animate-pulse' : 'bg-emerald-600'}`} />
            <span className="text-sm font-semibold">{uploadNotice.message}</span>
          </div>
          <button 
            onClick={() => setUploadNotice(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
        <CardHeader className="border-b border-[#E2DCD0]">
          <h3 className="font-bold flex items-center gap-2 text-[#0F172A]">
            <Upload className="w-5 h-5 text-purple-700" /> Upload Dataset
          </h3>
        </CardHeader>
        <CardBody>
          <FileUpload
            onDrop={handleUpload}
            accept={{ 'text/csv': ['.csv'], 'application/json': ['.json'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }}
            maxSize={100 * 1024 * 1024}
            loading={uploading}
          />
        </CardBody>
      </Card>

      <Card className="bg-[#FFFDF9] border border-[#E2DCD0] shadow-sm">
        <CardHeader className="border-b border-[#E2DCD0]">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2 text-[#0F172A]">
              <Database className="w-5 h-5 text-cyan-700" /> Dataset Files
            </h3>
            <span className="text-sm text-[#475569] font-medium">{datasets.length} file{datasets.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        {datasets.length > 0 ? (
          <DataTable data={datasets} columns={columns} />
        ) : (
          <CardBody>
            <div className="text-center py-12 text-[#64748B]">
              <Database className="w-12 h-12 mx-auto mb-4 text-[#94A3B8]" />
              <p className="text-lg font-semibold text-[#0F172A]">No datasets uploaded yet</p>
              <p className="text-sm mt-1 text-[#475569]">Upload a CSV, Excel, or JSON file to get started</p>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}