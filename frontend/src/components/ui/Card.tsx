import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({ className = '', hover, glow, children, ...props }: CardProps) {
  return (
    <div 
      className={`bg-[#FFFFFF] border border-[#D6CEBE] rounded-2xl shadow-xs text-[#0F172A] ${hover ? 'hover:-translate-y-0.5 hover:shadow-md hover:border-[#94A3B8] transition-all duration-200' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 border-b border-[#E5DFD3] font-bold text-[#0F172A] ${className}`} {...props}>{children}</div>;
}

export function CardBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 text-[#0F172A] ${className}`} {...props}>{children}</div>;
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 border-t border-[#E5DFD3] bg-[#FAF7F0] rounded-b-2xl text-[#334155] ${className}`} {...props}>{children}</div>;
}