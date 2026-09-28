import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-[#FFFDF9] border border-[#E2DCD0] rounded-3xl shadow-sm w-full">
      <div className="w-16 h-16 bg-[#FAF7F0] border border-[#E2DCD0] rounded-2xl flex items-center justify-center mb-5 text-[#0f172a]">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-[#0f172a] mb-2">{title}</h3>
      <p className="text-[#475569] text-sm max-w-sm mb-6 leading-relaxed">{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}