import React from 'react';
import { useTheme, ThemeMode } from '../../hooks/useTheme';
import { Check, Sparkles, Palette } from 'lucide-react';

interface ThemeOptionConfig {
  id: ThemeMode;
  label: string;
  badge: string;
  description: string;
  preview: {
    bg: string;
    header: string;
    card: string;
    cardBorder: string;
    accent: string;
    text: string;
    secondaryText: string;
  };
}

const THEME_OPTIONS: ThemeOptionConfig[] = [
  {
    id: 'poupagaio',
    label: 'Oficial',
    badge: '🌿 Poupagaio',
    description: 'Verde institucional clássico com detalhes botânicos da marca.',
    preview: {
      bg: '#F3F4F4',
      header: '#075C45',
      card: '#FFFFFF',
      cardBorder: '#D2DDD6',
      accent: '#16A66A',
      text: '#1F2421',
      secondaryText: '#5E6963',
    },
  },
  {
    id: 'ocean',
    label: 'Oceano',
    badge: '🌊 Oceano',
    description: 'Sensação moderna e tranquila em azul oceânico e turquesa.',
    preview: {
      bg: '#F0F9FF',
      header: '#0284C7',
      card: '#FFFFFF',
      cardBorder: '#BAE6FD',
      accent: '#06B6D4',
      text: '#0C4A6E',
      secondaryText: '#0369A1',
    },
  },
  {
    id: 'nature',
    label: 'Natureza',
    badge: '🍃 Natureza',
    description: 'Interpretação orgânica em verde floresta e tons terrosos suaves.',
    preview: {
      bg: '#F4F6F0',
      header: '#2D5A27',
      card: '#FFFFFF',
      cardBorder: '#C8D6B9',
      accent: '#558B2F',
      text: '#1C2E19',
      secondaryText: '#42573B',
    },
  },
];

export function ThemeSelector() {
  const { themeMode, setThemeMode } = useTheme();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#D2DDD6] dark:border-[#28322C] pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold font-display text-[#075C45] dark:text-[#78D9A6] flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#16A66A]" />
            Personalização de Temas
          </h2>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            Escolha o tema visual. As cores financeiras semânticas permanecem inalteradas.
          </p>
        </div>
      </div>

      {/* Grid of 3 Themes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {THEME_OPTIONS.map((opt) => {
          const isSelected = themeMode === opt.id;
          const { preview } = opt;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setThemeMode(opt.id)}
              className={`relative flex flex-col text-left rounded-2xl p-3.5 transition-all duration-200 cursor-pointer overflow-hidden group ${
                isSelected
                  ? 'bg-white dark:bg-[#232725] border-2 border-[#16A66A] shadow-md ring-2 ring-[#16A66A]/20 scale-[1.01]'
                  : 'bg-white/80 dark:bg-[#1C211E]/80 border border-[#D2DDD6] dark:border-[#28322C] hover:border-[#16A66A]/50 hover:bg-white dark:hover:bg-[#232725] shadow-2xs'
              }`}
            >
              {/* Card Header & Title */}
              <div className="flex items-center justify-between w-full mb-2.5">
                <span className="text-xs sm:text-sm font-bold font-display text-[#1F2421] dark:text-[#F4F4F5] flex items-center gap-1">
                  {opt.label}
                </span>
                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-[#16A66A] text-white flex items-center justify-center shadow-xs shrink-0 animate-in zoom-in duration-150">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <span className="text-[10px] font-medium text-[#5E6963] dark:text-[#95A39B] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 shrink-0">
                    {opt.badge}
                  </span>
                )}
              </div>

              {/* Pure CSS Real Theme Visual Preview */}
              <div
                className="w-full h-20 rounded-xl p-2 flex flex-col justify-between border shadow-inner mb-2.5 transition-transform group-hover:scale-[1.02] duration-200 relative overflow-hidden select-none"
                style={{
                  background: preview.bg,
                  borderColor: preview.cardBorder,
                }}
              >
                {/* Header preview bar */}
                <div
                  className="w-full h-3.5 rounded-md flex items-center justify-between px-1.5 shadow-2xs"
                  style={{ background: preview.header }}
                >
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                    <div className="w-6 h-1 rounded-full bg-white/60" />
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: preview.accent }} />
                </div>

                {/* Sub cards preview row */}
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                  <div
                    className="p-1 rounded-md border shadow-2xs flex flex-col justify-between"
                    style={{
                      backgroundColor: preview.card,
                      borderColor: preview.cardBorder,
                    }}
                  >
                    <div className="w-5 h-1 rounded-full" style={{ backgroundColor: preview.accent }} />
                    <div className="w-8 h-1.5 rounded-xs mt-1" style={{ backgroundColor: preview.text }} />
                  </div>

                  <div
                    className="p-1 rounded-md border shadow-2xs flex flex-col justify-between"
                    style={{
                      backgroundColor: preview.card,
                      borderColor: preview.cardBorder,
                    }}
                  >
                    <div className="w-6 h-1 rounded-full" style={{ backgroundColor: preview.secondaryText }} />
                    <div className="w-5 h-1.5 rounded-xs mt-1" style={{ backgroundColor: preview.accent }} />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] leading-tight">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Financial Colors Standard Legend */}
      <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#16A66A]" />
          <span className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
            Cores Financeiras Semânticas Preservadas
          </span>
        </div>
        <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
          O tema altera a estética da interface. O significado das suas movimentações continua idêntico em qualquer tema:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-xs font-bold">
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A66A] shrink-0" />
            <span>Entrada</span>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] shrink-0" />
            <span>Gasto Variável</span>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] shrink-0" />
            <span>Gasto Fixo</span>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
            <span>Parcelamento</span>
          </div>
        </div>
      </div>
    </div>
  );
}
