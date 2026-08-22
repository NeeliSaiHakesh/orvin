"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Database, Upload, Eye, Trash2, FileSpreadsheet, FileJson } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Dataset {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
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
      await Promise.all(files.map(file => api.datasets.upload(projectId, file)));
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
      key: 'filename', header: 'File', sortable: true,
      render: (item: Dataset) => (
        <div className="flex items-center gap-3">
          {getFileIcon(item.file_type)}
          <div>
            <p className="font-medium">{item.filename}</p>
            <p className="text-xs text-gray-500">{formatFileSize(item.file_size)}</p>
          </div>
        </div>
      )
    },
    { key: 'file_type', header: 'Type', render: (item: Dataset) => <span className="uppercase text-xs font-mono">{item.file_type}</span> },
    { key: 'row_count', header: 'Rows', render: (item: Dataset) => item.row_count?.toLocaleString() ?? '—' },
    { key: 'column_count', header: 'Columns', render: (item: Dataset) => item.column_count ?? '—' },
    { key: 'status', header: 'Status', render: (item: Dataset) => <Badge variant={statusColor(item.status)}>{item.status}</Badge> },
    {
      key: 'uploaded_at', header: 'Uploaded Date', sortable: true,
      render: (item: Dataset) => <span className="text-xs text-gray-300 font-mono">{formatUploadDate(item.uploaded_at)}</span>
    },
    {
      key: 'actions', header: '',
      render: (item: Dataset) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Datasets</h1>
        <p className="text-gray-400">Upload and manage your project datasets.</p>
      </div>

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">{error}</div>
      )}

      <Card glow>
        <CardHeader>
          <h3 className="font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" /> Upload Dataset
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" /> Dataset Files
            </h3>
            <span className="text-sm text-gray-400">{datasets.length} file{datasets.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        {datasets.length > 0 ? (
          <DataTable data={datasets} columns={columns} />
        ) : (
          <CardBody>
            <div className="text-center py-12 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-lg">No datasets uploaded yet</p>
              <p className="text-sm mt-1">Upload a CSV, Excel, or JSON file to get started</p>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}