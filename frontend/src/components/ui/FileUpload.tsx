"use client";
import React, { useCallback, useState, useEffect } from 'react';
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

  const startUpload = async (targetFile: File) => {
    setIsUploading(true);
    setErrorMessage(null);
    setProgress(25);

    const interval = setInterval(() => {
      setProgress(p => (p < 90 ? p + 15 : p));
    }, 150);

    try {
      if (onUpload) {
        await onUpload(targetFile);
      } else if (onDropProp) {
        await onDropProp([targetFile]);
      }
      clearInterval(interval);
      setProgress(100);
      setIsDone(true);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMessage(err?.message || "Upload failed. Please retry.");
      setIsDone(false);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selected = acceptedFiles[0];
      setFile(selected);
      setIsDone(false);
      setProgress(0);
      setErrorMessage(null);
      // Auto-trigger upload immediately
      startUpload(selected);
    }
  }, [onUpload, onDropProp]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false
  });

  return (
    <div className="w-full space-y-3">
      {!file ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-200 
            ${isDragActive ? 'border-[#0F172A] bg-[#F4EFE6]' : 'border-[#CBD5E1] bg-[#FAF7F0] hover:border-[#0F172A] hover:bg-[#F4EFE6]'}
            ${isDragReject ? 'border-rose-400 bg-rose-50' : ''}`}
        >
          <input {...getInputProps()} />
          <UploadCloud className={`mx-auto h-12 w-12 mb-3 ${isDragActive ? 'text-[#0F172A]' : 'text-[#64748B]'}`} />
          <h3 className="text-base font-bold text-[#0F172A] mb-1">Drag & Drop your dataset here</h3>
          <p className="text-[#64748B] text-xs mb-4">Supports CSV, Excel (.xlsx), and JSON (max 100MB)</p>
          <Button variant="secondary" size="sm" type="button">Browse Files</Button>
        </div>
      ) : (
        <div className="p-5 w-full relative overflow-hidden rounded-2xl border border-[#E2DCD0] bg-[#FFFDF9] shadow-sm">
          {(isUploading || loading) && (
            <div 
              className="absolute top-0 left-0 h-1 bg-[#0F172A] transition-all duration-300" 
              style={{ width: `${progress}%` }} 
            />
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#FAF7F0] border border-[#E2DCD0] text-[#0F172A] rounded-xl">
                {isDone ? <CheckCircle2 className="text-emerald-700 w-5 h-5" /> : (isUploading ? <Loader2 className="w-5 h-5 animate-spin text-blue-700" /> : <File className="w-5 h-5" />)}
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#0F172A]">{file.name}</h4>
                <p className="text-xs text-[#64748B]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isDone ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Uploaded & Ingested
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => { setFile(null); setIsDone(false); }}>
                    Upload Another
                  </Button>
                </div>
              ) : (isUploading || loading) ? (
                <span className="text-xs font-bold text-blue-800 flex items-center gap-2 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-700" /> Ingesting Data...
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                    <X className="w-4 h-4 text-[#64748B]" />
                  </Button>
                  <Button onClick={() => startUpload(file)} size="sm">Retry Upload</Button>
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl mt-3 text-xs text-rose-900 font-semibold">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FileUpload;