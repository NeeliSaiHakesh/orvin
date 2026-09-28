import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">{label}</label>}
        <div className="relative">
          {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]">{icon}</div>}
          <input
            ref={ref}
            className={`w-full bg-[#FFFDF9] border border-[#E2DCD0] rounded-xl px-4 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] transition-all ${icon ? 'pl-10' : ''} ${error ? 'border-rose-500 focus:ring-rose-500/20' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs font-semibold text-rose-700 mt-1">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';