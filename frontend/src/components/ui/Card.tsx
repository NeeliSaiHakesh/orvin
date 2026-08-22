import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({ className = '', hover, glow, children, ...props }: CardProps) {
  return (
    <div 
      className={`glass ${hover ? 'hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 cursor-pointer' : ''} ${glow ? 'glow-border' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 border-b border-white/10 ${className}`} {...props}>{children}</div>;
}

export function CardBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 ${className}`} {...props}>{children}</div>;
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 border-t border-white/10 bg-black/20 rounded-b-2xl ${className}`} {...props}>{children}</div>;
}