import React from 'react';
import { GoalWithProgress } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { Button } from '../ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteGoalConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GoalWithProgress | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteGoalConfirmModal({
  isOpen,
  onClose,
  goal,
  onConfirm,
  isDeleting,
}: DeleteGoalConfirmModalProps) {
  if (!isOpen || !goal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E2220] border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E4] dark:border-[#2E3532]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
              Excluir Meta
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-[#5E6963] hover:text-[#202724] hover:bg-black/5 dark:text-[#95A39B] dark:hover:text-[#F4F4F5] dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-[#202724] dark:text-[#F4F4F5]">
            Tem certeza que deseja excluir a meta <strong>"{goal.name}"</strong>?
          </p>

          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 space-y-1.5 text-xs text-rose-800 dark:text-rose-300">
            <p className="font-semibold">Atenção:</p>
            <p>
              Excluir esta meta também removerá o histórico de{' '}
              <strong>{goal.contributionsCount} aporte(s)</strong> (total de{' '}
              <strong>{formatCurrency(goal.accumulatedAmount)}</strong>) registrado(s).
            </p>
            <p className="text-[11px] opacity-80 pt-0.5">
              Esta ação não poderá ser desfeita.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
              className="cursor-pointer text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={onConfirm}
              disabled={isDeleting}
              className="cursor-pointer text-xs font-semibold"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, excluir meta'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
