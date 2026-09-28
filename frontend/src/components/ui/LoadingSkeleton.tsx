import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-shimmer bg-[#E2DCD0]/70 rounded-xl ${className}`} />
  );
}