import React from 'react';
import { MonthlyClosure } from '../../types';
import { formatCurrency, formatDateBR } from '../../lib/formatters';
import { Button } from '../ui/button';
import {
  X,
  Lock,
  Unlock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
  Calendar,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface ClosureDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  closure: MonthlyClosure | null;
  billingCycleLabel: string;
  canReopen: boolean;
  onOpenReopenConfirm: () => void;
}

export function ClosureDetailModal({
  isOpen,
  onClose,
  closure,
  billingCycleLabel,
  canReopen,
  onOpenReopenConfirm,
}: ClosureDetailModalProps) {
  if (!isOpen || !closure) return null;

  const formatClosedAt = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${formatDateBR(isoString)} às ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;
    } catch {
      return formatDateBR(isoString);
    }
  };

  const totalIncome = Number(closure.total_income) || 0;
  const totalFixed = Number(closure.total_fixed_expenses) || 0;
  const totalVariable = Number(closure.total_variable_expenses) || 0;
  const totalInstallments = Number(closure.total_installments) || 0;
  const totalExpenses = Number(closure.total_expenses) || 0;
  const finalBalance = Number(closure.final_balance) || 0;

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
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                  Resumo: {billingCycleLabel}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30">
                  <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Fechado
                </span>
              </div>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Snapshot histórico registrado do encerramento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5E6963] dark:text-[#95A39B] hover:bg-[#E2E8E4] dark:hover:bg-[#2E3532] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Metadados de Fechamento */}
          <div className="p-3 rounded-xl bg-[#F9FAF9] dark:bg-[#181B1A] border border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Data do Fechamento:</span>
            </div>
            <span className="font-semibold text-[#202724] dark:text-[#F4F4F5]">
              {formatClosedAt(closure.closed_at)}
            </span>
          </div>

          {/* Resumo Financeiro Persistido */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Valores Consolidados do Snapshot
            </h4>

            <div className="space-y-1.5 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] p-3.5 bg-white dark:bg-[#232725]">
              {/* Entradas */}
              <div className="flex items-center justify-between py-1 text-xs">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Entradas (Receitas)</span>
                </div>
                <span className="font-semibold font-display text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalIncome)}
                </span>
              </div>

              {/* Gastos Fixos */}
              <div className="flex items-center justify-between py-1 text-xs border-t border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Gastos Fixos</span>
                </div>
                <span className="font-medium text-[#202724] dark:text-[#F4F4F5]">
                  {formatCurrency(totalFixed)}
                </span>
              </div>

              {/* Gastos Variáveis */}
              <div className="flex items-center justify-between py-1 text-xs border-t border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <CreditCard className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Gastos Variáveis</span>
                </div>
                <span className="font-medium text-[#202724] dark:text-[#F4F4F5]">
                  {formatCurrency(totalVariable)}
                </span>
              </div>

              {/* Parcelamentos */}
              <div className="flex items-center justify-between py-1 text-xs border-t border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B]">
                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Parcelamentos</span>
                </div>
                <span className="font-medium text-[#202724] dark:text-[#F4F4F5]">
                  {formatCurrency(totalInstallments)}
                </span>
              </div>

              {/* Total de Saídas */}
              <div className="flex items-center justify-between py-1.5 text-xs font-semibold border-t border-[#E2E8E4] dark:border-[#2E3532]">
                <div className="flex items-center gap-2 text-[#202724] dark:text-[#F4F4F5]">
                  <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Total de Saídas</span>
                </div>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(totalExpenses)}
                </span>
              </div>

              {/* Saldo Final */}
              <div className="flex items-center justify-between pt-2.5 mt-1 border-t-2 border-[#E2E8E4] dark:border-[#2E3532]">
                <span className="text-xs font-bold text-[#202724] dark:text-[#F4F4F5]">
                  Saldo Final Registrado
                </span>
                <span
                  className={`text-sm sm:text-base font-bold font-display ${
                    finalBalance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(finalBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2.5 p-4 sm:p-5 border-t border-[#E2E8E4] dark:border-[#2E3532] bg-[#F9FAF9] dark:bg-[#181B1A]">
          {canReopen ? (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenReopenConfirm}
              className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold flex items-center gap-1.5 text-xs"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Reabrir mês</span>
            </Button>
          ) : (
            <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B] italic">
              Apenas administradores podem reabrir este mês.
            </span>
          )}

          <Button
            type="button"
            onClick={onClose}
            className="bg-[#202724] dark:bg-[#F4F4F5] text-white dark:text-[#202724] font-semibold text-xs px-5"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
