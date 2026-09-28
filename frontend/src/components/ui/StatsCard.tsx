import React, { useEffect, useState } from 'react';
import { Card, CardBody } from './Card';

interface StatsCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
}

export function StatsCard({ label, value, icon, trend }: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const duration = 1000;
    const incrementTime = 20;
    const steps = duration / incrementTime;
    const increment = end / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, incrementTime);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <Card hover>
      <CardBody className="flex items-center gap-4">
        <div className="p-4 bg-[#FAF7F0] border border-[#E2DCD0] rounded-xl shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-[#475569] text-xs font-semibold uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h3 className="text-3xl font-extrabold font-heading text-[#0f172a]">{displayValue.toLocaleString()}</h3>
            {trend && (
              <span className={`text-xs font-bold ${trend.isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
              </span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}