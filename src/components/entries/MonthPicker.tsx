import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { getMonthNameBR } from '../../lib/formatters';

interface MonthPickerProps {
  year: number;
  month: number; // 1 - 12
  onChange: (year: number, month: number) => void;
}

export function MonthPicker({ year, month, onChange }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePrev = () => {
    if (month === 1) {
      onChange(year - 1, 12);
    } else {
      onChange(year, month - 1);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      onChange(year + 1, 1);
    } else {
      onChange(year, month + 1);
    }
  };

  const handleSelectMonth = (m: number) => {
    onChange(year, m);
    setIsOpen(false);
  };

  const handleYearChange = (newYear: number) => {
    onChange(newYear, month);
  };

  const handleResetCurrent = () => {
    const now = new Date();
    onChange(now.getFullYear(), now.getMonth() + 1);
    setIsOpen(false);
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

  return (
    <div className="relative inline-flex items-center gap-1 bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] rounded-2xl p-1 shadow-2xs">
      {/* Botão Anterior */}
      <button
        type="button"
        id="month-picker-prev"
        onClick={handlePrev}
        aria-label="Mês anterior"
        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Botão Principal do Mês */}
      <button
        type="button"
        id="month-picker-current"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-xs sm:text-sm font-bold text-[#202724] dark:text-[#F7F4EA] transition-colors cursor-pointer"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-[#075C45] dark:text-[#78D9A6]" />
        <span>{getMonthNameBR(month)} {year}</span>
      </button>

      {/* Botão Próximo */}
      <button
        type="button"
        id="month-picker-next"
        onClick={handleNext}
        aria-label="Próximo mês"
        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] transition-colors cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Menu Popover para Seleção Rápida */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64 p-3 rounded-2xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Controle de Ano */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E8E4D5] dark:border-[#24312B]">
            <button
              type="button"
              onClick={() => handleYearChange(year - 1)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
              {year}
            </span>
            <button
              type="button"
              onClick={() => handleYearChange(year + 1)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grade de 12 Meses */}
          <div className="grid grid-cols-3 gap-1.5">
            {months.map((m) => {
              const selected = m === month;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMonth(m)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#075C45] text-white font-bold dark:bg-[#16A66A] dark:text-[#101614]'
                      : 'text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#202724] dark:hover:text-[#F7F4EA]'
                  }`}
                >
                  {getMonthNameBR(m).slice(0, 3)}
                </button>
              );
            })}
          </div>

          {/* Botão Mês Atual se diferente */}
          {!isCurrentMonth && (
            <div className="pt-2 mt-2 border-t border-[#E8E4D5] dark:border-[#24312B] text-center">
              <button
                type="button"
                onClick={handleResetCurrent}
                className="text-[11px] font-semibold text-[#075C45] dark:text-[#78D9A6] hover:underline cursor-pointer"
              >
                Voltar para o mês atual
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
