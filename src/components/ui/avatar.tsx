import React from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, name = 'User', className, size = 'md' }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden bg-[#075C45] text-[#F7F4EA] font-semibold border-2 border-[#16A66A]/30 shrink-0 select-none shadow-sm dark:bg-[#16A66A] dark:text-[#101614]',
        sizes[size],
        className
      )}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
