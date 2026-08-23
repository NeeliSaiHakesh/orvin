"use client";
import React from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { usePathname } from 'next/navigation';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  // Extract project ID if we are in a project route
  const match = pathname.match(/\/projects\/([^/]+)/);
  const projectId = match ? match[1] : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a1a] text-[#F9FAFB]">
      <Navbar />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar projectId={projectId} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gradient-to-br from-[#0a0a1a] via-[#0d1424] to-[#111827]">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}