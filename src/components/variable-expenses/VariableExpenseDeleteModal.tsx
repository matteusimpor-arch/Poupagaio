import React from 'react';
import { VariableExpense } from '../../types';
import { Button } from '../ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { formatCurrency, formatDateBR } from '../../lib/formatters';

interface VariableExpenseDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  expense: VariableExpense | null;
  isDeleting: boolean;
}

export function VariableExpenseDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  expense,
  isDeleting,
}: VariableExpenseDeleteModalProps) {
  if (!isOpen || !expense) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-variable-expense-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E4D5] dark:border-[#24312B]">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h2 id="delete-variable-expense-title" className="text-base font-bold font-display">
              Excluir gasto variável
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
            Tem certeza que deseja excluir o gasto{' '}
            <strong className="text-[#202724] dark:text-[#F7F4EA]">"{expense.description}"</strong> de{' '}
            <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(expense.amount)}</strong> lançado em{' '}
            <span>{formatDateBR(expense.date)}</span>?
          </p>

          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] bg-black/5 dark:bg-white/5 p-3 rounded-2xl">
            Esta ação removerá este lançamento do seu histórico financeiro e atualizará os totais do mês.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-2xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={onConfirm}
              isLoading={isDeleting}
              disabled={isDeleting}
              className="rounded-2xl font-bold cursor-pointer"
            >
              Sim, excluir gasto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
