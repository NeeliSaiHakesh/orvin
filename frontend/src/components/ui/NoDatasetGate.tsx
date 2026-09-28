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
 * Styled in 100% Light Cream Ivory with zero dark gradients.
 */
export function NoDatasetGate({ projectId, pageName, pageDescription, requiresModel }: NoDatasetGateProps) {
  return (
    <div className="space-y-8 animate-fade-in text-[#1F2937]">
      <div>
        <h1 className="text-3xl font-bold font-heading mb-2 text-[#111827]">{pageName}</h1>
        <p className="text-[#6B7280] text-sm">{pageDescription}</p>
      </div>

      <Card className="border border-[#E5E0D8] bg-[#FFFDF9] shadow-sm rounded-3xl">
        <CardBody className="py-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center mb-6 shadow-sm">
            <Database className="w-10 h-10 text-[#92400E]" />
          </div>

          <h2 className="text-xl font-bold text-[#111827] mb-2">
            {requiresModel ? 'No Trained Models Yet' : 'No Dataset Uploaded Yet'}
          </h2>

          <p className="text-[#6B7280] text-sm max-w-md mb-8 leading-relaxed">
            {requiresModel
              ? 'This feature requires a trained model. Upload a dataset and run AutoML training first, then come back here.'
              : 'This pipeline stage requires an uploaded dataset to work with. Upload a CSV, Excel, or JSON file to get started.'
            }
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={`/projects/${projectId}/datasets`}
              className="px-6 py-3 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-sm flex items-center gap-2 shadow-md transition-all"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              Upload Dataset
            </Link>

            {requiresModel && (
              <Link
                href={`/projects/${projectId}/training`}
                className="px-6 py-3 rounded-xl bg-[#FAF7F0] hover:bg-[#EFEBE0] border border-[#E5E0D8] text-[#1F2937] font-semibold text-sm flex items-center gap-2 transition-all"
              >
                Go to Training
                <ArrowRight className="w-4 h-4 text-[#6B7280]" />
              </Link>
            )}
          </div>

          {/* Pipeline progress hint */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs text-[#6B7280]">
            <span className="px-3 py-1 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] font-bold">1. Upload</span>
            <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
            <span className="px-3 py-1 rounded-full bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D5FF] font-bold">2. Analyze</span>
            <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
            <span className="px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-bold">3. Clean</span>
            <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
            <span className="px-3 py-1 rounded-full bg-[#E0E7FF] text-[#3730A3] border border-[#C7D2FE] font-bold">4. Features</span>
            <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
            <span className="px-3 py-1 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] font-bold">5. Train</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
