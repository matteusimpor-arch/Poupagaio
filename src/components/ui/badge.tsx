import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'gold' | 'muted' | 'success';
  className?: string;
  children?: React.ReactNode;
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-[#16A66A]/15 text-[#075C45] border-[#16A66A]/30 dark:bg-[#16A66A]/20 dark:text-[#78D9A6]',
    outline: 'border border-[#E8E4D5] text-[#5E6963] dark:border-[#24312B] dark:text-[#95A39B]',
    gold: 'bg-[#D6A84B]/15 text-[#8A6318] border-[#D6A84B]/30 dark:bg-[#F2D58A]/15 dark:text-[#F2D58A]',
    muted: 'bg-black/5 text-[#5E6963] dark:bg-white/5 dark:text-[#95A39B]',
    success: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
