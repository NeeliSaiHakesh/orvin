import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'neutral', className = '', children, ...props }: BadgeProps) {
  const variants = {
    success: 'bg-emerald-100 text-emerald-950 border-emerald-300',
    warning: 'bg-amber-100 text-amber-950 border-amber-300',
    error: 'bg-rose-100 text-rose-950 border-rose-300',
    info: 'bg-indigo-100 text-indigo-950 border-indigo-300',
    neutral: 'bg-slate-100 text-slate-900 border-slate-300'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}