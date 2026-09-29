import React from 'react';
import { MonthlyClosureSummary } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { Button } from '../ui/button';
import {
  X,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface CloseMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  summary: MonthlyClosureSummary;
  billingCycleLabel: string;
  isSubmitting: boolean;
}

export function CloseMonthModal({
  isOpen,
  onClose,
  onConfirm,
  summary,
  billingCycleLabel,
  isSubmitting,
}: CloseMonthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#1E2220] rounded-2xl sm:rounded-3xl border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2E8E4] dark:border-[#2E3532] bg-[#F9FAF9] dark:bg-[#181B1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                Fechar {billingCycleLabel}
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Confirmação de encerramento de competência
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

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-3 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p>
              Você está prestes a fechar este mês. Depois do fechamento, o resultado desta competência ficará registrado no histórico.
            </p>
          </div>

          {/* Resumo Financeiro */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Resumo da Competência
            </h4>

            <div className="space-y-1.5 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] p-3 bg-[#F9FAF9] dark:bg-[#181B1A]">
              {/* Entradas */}
              <div className="flex items-center justify-between py-1 text-xs">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Entradas (Receitas)</span>
                </div>
                <span className="font-semibold font-display text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(summary.total_income)}
                </span>
              </div>

              {/* Gastos Fixos */}
              <div className="flex items-center justify-between py-1 text-xs border-t border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Gastos Fixos</span>
                </div>
                <span className="font-medium text-[#202724] dark:text-[#F4F4F5]">
                  {formatCurrency(summary.total_fixed_expenses)}
                </span>
              </div>

              {/* Gastos Variáveis */}
              <div className="flex items-center justify-between py-1 text-xs border-t border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <CreditCard className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Gastos Variáveis</span>
                </div>
                <span className="font-medium text-[#202724] dark:text-[#F4F4F5]">
                  {formatCurrency(summary.total_variable_expenses)}
                </span>
              </div>

              {/* Parcelamentos */}
              <div className="flex items-center justify-between py-1 text-xs border-t border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Parcelamentos</span>
                </div>
                <span className="font-medium text-[#202724] dark:text-[#F4F4F5]">
                  {formatCurrency(summary.total_installments)}
                </span>
              </div>

              {/* Total de Saídas */}
              <div className="flex items-center justify-between py-1.5 text-xs font-semibold border-t border-[#E2E8E4] dark:border-[#2E3532]">
                <div className="flex items-center gap-2 text-[#202724] dark:text-[#F4F4F5]">
                  <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Total de Saídas</span>
                </div>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(summary.total_expenses)}
                </span>
              </div>

              {/* Saldo Final */}
              <div className="flex items-center justify-between pt-2.5 mt-1 border-t-2 border-[#E2E8E4] dark:border-[#2E3532]">
                <span className="text-xs font-bold text-[#202724] dark:text-[#F4F4F5]">
                  Saldo Final da Competência
                </span>
                <span
                  className={`text-sm sm:text-base font-bold font-display ${
                    summary.final_balance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(summary.final_balance)}
                </span>
              </div>
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
            className="w-full sm:w-auto"
          >
            Voltar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-[#075C45] hover:bg-[#054433] text-white font-semibold flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Fechando...</span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Confirmar fechamento</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
