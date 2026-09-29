import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'w-full h-11 px-3.5 rounded-xl border border-[#E8E4D5] bg-white text-[#111827] placeholder:text-gray-400 font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#16A66A] focus:border-[#16A66A] dark:bg-[#222226] dark:border-white/20 dark:text-white dark:placeholder:text-zinc-400 text-sm shadow-sm',
              error && 'border-red-500 focus:ring-red-500 dark:border-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
