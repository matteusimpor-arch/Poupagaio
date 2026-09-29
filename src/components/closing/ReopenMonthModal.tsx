import React from 'react';
import { Button } from '../ui/button';
import { X, AlertTriangle, Unlock } from 'lucide-react';

interface ReopenMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  billingCycleLabel: string;
  isSubmitting: boolean;
}

export function ReopenMonthModal({
  isOpen,
  onClose,
  onConfirm,
  billingCycleLabel,
  isSubmitting,
}: ReopenMonthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#1E2220] rounded-2xl sm:rounded-3xl border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2E8E4] dark:border-[#2E3532] bg-[#F9FAF9] dark:bg-[#181B1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                Reabrir este mês?
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Competência {billingCycleLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-[#5E6963] dark:text-[#95A39B] hover:bg-[#E2E8E4] dark:hover:bg-[#2E3532] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold mb-1">Confirmação de Reabertura</p>
              <p>
                O fechamento salvo será removido e a competência voltará a ficar aberta. Seus lançamentos financeiros não serão excluídos.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-[#E2E8E4] dark:border-[#2E3532] bg-[#F9FAF9] dark:bg-[#181B1A]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Reabrindo...</span>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Reabrir mês</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
