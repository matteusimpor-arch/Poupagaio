import React from 'react';
import { POUPAGAIO_ASSISTANTE_URL } from '../../assets/mascot';

export type PoupagaioLogoVariant = 'compact' | 'default' | 'hero' | 'assistant';

export interface PoupagaioLogoProps {
  className?: string;
  variant?: PoupagaioLogoVariant;
  compact?: boolean;
  alt?: string;
  showText?: boolean;
  subtitle?: string;
  textClassName?: string;
}

/**
 * Componente oficial e centralizado de marca do Poupagaio Finance.
 * Usa exatamente a mesma fonte/asset do mascote flutuante funcional.
 * Garante proporções perfeitas: object-fit: contain, width: auto, height proporcional, flex-shrink: 0.
 */
export function PoupagaioLogo({
  className = '',
  variant,
  compact = false,
  alt = 'Poupagaio Finance',
  showText = false,
  subtitle,
  textClassName = '',
}: PoupagaioLogoProps) {
  const effectiveVariant: PoupagaioLogoVariant = variant || (compact ? 'compact' : 'default');

  let defaultSizeClass = 'h-10 sm:h-12 md:h-14';
  if (effectiveVariant === 'compact') {
    defaultSizeClass = 'h-8 sm:h-9';
  } else if (effectiveVariant === 'default') {
    defaultSizeClass = 'h-10 sm:h-12 md:h-14';
  } else if (effectiveVariant === 'hero') {
    defaultSizeClass = 'h-20 sm:h-24 md:h-28';
  } else if (effectiveVariant === 'assistant') {
    defaultSizeClass = 'h-10 sm:h-12';
  }

  return (
    <div className="inline-flex items-center gap-2.5 sm:gap-3 select-none shrink-0">
      <img
        src={POUPAGAIO_ASSISTANTE_URL}
        alt={alt}
        referrerPolicy="no-referrer"
        className={`object-contain w-auto flex-shrink-0 filter drop-shadow-xs transition-transform duration-200 pointer-events-none ${className || defaultSizeClass}`.trim()}
        style={{ objectFit: 'contain', width: 'auto', flexShrink: 0 }}
        draggable={false}
      />
      {showText && (
        <div className="min-w-0 flex flex-col justify-center text-left">
          <div className={`font-bold text-sm sm:text-base md:text-lg tracking-tight font-display text-[#02402E] dark:text-[#78D9A6] leading-tight flex items-center gap-1 ${textClassName}`}>
            <span>Poupagaio</span>
            <span className="text-[#16A66A] dark:text-[#34D399] font-medium text-xs sm:text-sm">Finance</span>
          </div>
          {subtitle && (
            <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] leading-none hidden lg:block mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default PoupagaioLogo;
