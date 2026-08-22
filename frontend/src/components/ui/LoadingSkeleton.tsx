import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-shimmer bg-white/5 rounded-lg ${className}`} />
  );
}