import React from 'react';
import { ThemeSelector } from './ThemeSelector';
import { ModalPortal } from '../ui/ModalPortal';
import { X } from 'lucide-react';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppearanceModal({ isOpen, onClose }: AppearanceModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1C211E] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#D2DDD6] dark:border-[#28322C] shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2ECE6] dark:border-[#28322C] pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
              Aparência & Temas
            </h3>
            <p className="text-[11px] sm:text-xs text-[#5E6963] dark:text-[#95A39B]">
              Selecione o estilo visual de sua preferência para o Poupagaio Finance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5E6963] hover:text-[#02402E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ThemeSelector />

        <div className="flex justify-end pt-2 border-t border-[#E2ECE6] dark:border-[#28322C]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-xl bg-[#075C45] text-white dark:bg-[#16A66A] dark:text-[#101614] text-xs font-bold hover:opacity-90 cursor-pointer shadow-xs transition-opacity"
          >
            Concluído
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
