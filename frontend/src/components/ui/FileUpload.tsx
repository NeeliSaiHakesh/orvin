"use client";
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface FileUploadProps {
  onUpload?: (file: File) => void | Promise<void>;
  onDrop?: (files: File[]) => void | Promise<void>;
  accept?: Record<string, string[]>;
  maxSize?: number;
  loading?: boolean;
}

export function FileUpload({ 
  onUpload,
  onDrop: onDropProp,
  accept = { 
    'text/csv': ['.csv'], 
    'application/json': ['.json'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] 
  },
  maxSize = 104857600, // 100MB
  loading = false,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setIsDone(false);
      setProgress(0);
      setErrorMessage(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage(null);
    setProgress(20);

    const interval = setInterval(() => {
      setProgress(p => (p < 90 ? p + 15 : p));
    }, 150);

    try {
      if (onUpload) {
        await onUpload(file);
      } else if (onDropProp) {
        await onDropProp([file]);
      }
      clearInterval(interval);
      setProgress(100);
      setIsDone(true);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMessage(err?.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {!file ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 
            ${isDragActive ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 hover:border-purple-400 hover:bg-white/5'}
            ${isDragReject ? 'border-red-400 bg-red-400/10' : ''}`}
        >
          <input {...getInputProps()} />
          <UploadCloud className={`mx-auto h-14 w-14 mb-3 ${isDragActive ? 'text-cyan-400' : 'text-gray-400'}`} />
          <h3 className="text-lg font-medium mb-1">Drag & Drop your dataset here</h3>
          <p className="text-gray-400 text-sm mb-4">Supports CSV, Excel (.xlsx), and JSON (max 100MB)</p>
          <Button variant="secondary" size="sm" type="button">Browse Files</Button>
        </div>
      ) : (
        <div className="glass p-5 w-full relative overflow-hidden rounded-xl border border-white/10">
          {(isUploading || loading) && (
            <div 
              className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300" 
              style={{ width: `${progress}%` }} 
            />
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg">
                {isDone ? <CheckCircle2 className="text-green-400 w-5 h-5" /> : <File className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-medium text-sm text-white">{file.name}</h4>
                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            
            {!isUploading && !loading && !isDone && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  <X className="w-4 h-4" />
                </Button>
                <Button onClick={handleUpload} size="sm">Upload</Button>
              </div>
            )}
            
            {(isUploading || loading) && (
              <span className="text-xs font-medium text-cyan-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
              </span>
            )}
            
            {isDone && (
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setIsDone(false); }}>
                Upload Another
              </Button>
            )}
          </div>

          {errorMessage && (
            <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}