import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A66A] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none cursor-pointer';

    const variants = {
      primary:
        'bg-[#075C45] hover:bg-[#064e3b] text-white shadow-sm dark:bg-[#16A66A] dark:hover:bg-[#138e5a] dark:text-[#101614] font-semibold',
      secondary:
        'bg-[#16A66A] hover:bg-[#138e5a] text-white shadow-sm dark:bg-[#78D9A6] dark:hover:bg-[#62c490] dark:text-[#075C45]',
      outline:
        'border border-[#E8E4D5] hover:bg-black/5 text-[#202724] dark:border-[#24312B] dark:hover:bg-white/5 dark:text-[#F7F4EA]',
      ghost:
        'hover:bg-black/5 text-[#202724] dark:hover:bg-white/5 dark:text-[#F7F4EA]',
      gold:
        'bg-[#D6A84B] hover:bg-[#c2963f] text-[#202724] font-semibold shadow-sm dark:bg-[#F2D58A] dark:hover:bg-[#e4c473]',
      danger:
        'bg-red-600 hover:bg-red-700 text-white shadow-sm dark:bg-red-500 dark:hover:bg-red-600',
    };

    const sizes = {
      sm: 'text-xs h-9 px-3 gap-1.5',
      md: 'text-sm h-11 px-4 gap-2',
      lg: 'text-base h-13 px-6 gap-2.5',
      icon: 'h-10 w-10 p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
