"use client";
import React from 'react';
import Link from 'next/link';
import { Database, Upload, ArrowRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';

interface NoDatasetGateProps {
  projectId: string;
  pageName: string;       // e.g. "Data Analysis", "AI Cleaning"
  pageDescription: string; // e.g. "Run analysis on your dataset"
  requiresModel?: boolean; // Some pages need a trained model, not just a dataset
}

/**
 * Full-page empty state shown when a pipeline page is opened
 * but the project has no datasets (or no trained models) yet.
 */
export function NoDatasetGate({ projectId, pageName, pageDescription, requiresModel }: NoDatasetGateProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">{pageName}</h1>
        <p className="text-gray-400">{pageDescription}</p>
      </div>

      <Card className="border border-yellow-500/30 bg-gradient-to-br from-yellow-950/20 via-[#0d1527] to-amber-950/20 shadow-xl">
        <CardBody className="py-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-6">
            <Database className="w-10 h-10 text-yellow-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {requiresModel ? 'No Trained Models Yet' : 'No Dataset Uploaded Yet'}
          </h2>

          <p className="text-gray-400 text-sm max-w-md mb-8">
            {requiresModel
              ? 'This feature requires a trained model. Upload a dataset and run AutoML training first, then come back here.'
              : 'This pipeline stage requires an uploaded dataset to work with. Upload a CSV, Excel, or JSON file to get started.'
            }
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={`/projects/${projectId}/datasets`}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold text-sm flex items-center gap-2 shadow-lg hover:shadow-purple-500/25 transition-all hover:scale-[1.02]"
            >
              <Upload className="w-4 h-4" />
              Upload Dataset
            </Link>

            {requiresModel && (
              <Link
                href={`/projects/${projectId}/training`}
                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium text-sm flex items-center gap-2 transition-all"
              >
                Go to Training
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Pipeline progress hint */}
          <div className="mt-10 flex items-center gap-2 text-xs text-gray-500">
            <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/30 font-bold">1. Upload</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold">2. Analyze</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">3. Clean</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold">4. Features</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">5. Train</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
