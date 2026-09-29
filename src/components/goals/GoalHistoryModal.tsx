import React, { useState } from 'react';
import { GoalWithProgress, GoalContribution } from '../../types';
import { formatCurrency, formatDateBR } from '../../lib/formatters';
import { Button } from '../ui/button';
import {
  X,
  History,
  Trash2,
  AlertCircle,
  PlusCircle,
  Calendar,
  Sparkles,
  Coins,
} from 'lucide-react';

interface GoalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GoalWithProgress | null;
  onDeleteContribution: (contributionId: string) => Promise<{ success: boolean; error?: string }>;
  onOpenAddContribution: () => void;
}

export function GoalHistoryModal({
  isOpen,
  onClose,
  goal,
  onDeleteContribution,
  onOpenAddContribution,
}: GoalHistoryModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !goal) return null;

  const handleDelete = async (contributionId: string) => {
    setDeletingId(contributionId);
    setErrorMessage(null);

    try {
      const res = await onDeleteContribution(contributionId);
      if (!res.success) {
        setErrorMessage(res.error || 'Erro ao estornar aporte.');
      } else {
        setConfirmDeleteId(null);
      }
    } catch {
      setErrorMessage('Falha inesperada ao estornar aporte.');
    } finally {
      setDeletingId(null);
    }
  };

  const contributions = goal.contributions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E2220] border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E4] dark:border-[#2E3532]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                Histórico de Aportes
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B] truncate max-w-[220px] sm:max-w-xs">
                {goal.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5E6963] hover:text-[#202724] hover:bg-black/5 dark:text-[#95A39B] dark:hover:text-[#F4F4F5] dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Goal Summary Card */}
        <div className="px-6 py-3 bg-[#F3F4F4] dark:bg-[#232725] border-b border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-between text-xs">
          <div>
            <span className="text-[#5E6963] dark:text-[#95A39B] block">Total acumulado</span>
            <span className="font-bold text-[#075C45] dark:text-[#78D9A6] text-sm sm:text-base font-display">
              {formatCurrency(goal.accumulatedAmount)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#5E6963] dark:text-[#95A39B] block">Alvo da meta</span>
            <span className="font-semibold text-[#202724] dark:text-[#F4F4F5] text-sm">
              {formatCurrency(goal.target_amount)} ({goal.progressPercentage.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Content / Contributions List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 mb-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {contributions.length === 0 ? (
            <div className="text-center py-8 px-4 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#202724] dark:text-[#F4F4F5]">
                  Nenhum aporte registrado ainda
                </p>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B] max-w-xs mx-auto">
                  Faça seu primeiro aporte para começar a transformar este objetivo em conquista.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenAddContribution();
                }}
                className="gap-1.5 text-xs font-semibold cursor-pointer mt-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Fazer primeiro aporte</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B]">
                  {contributions.length} {contributions.length === 1 ? 'aporte realizado' : 'aportes realizados'}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenAddContribution();
                  }}
                  className="gap-1 text-xs cursor-pointer py-1 px-2.5 h-7"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#16A66A]" />
                  <span>Novo aporte</span>
                </Button>
              </div>

              <div className="divide-y divide-[#E2E8E4] dark:divide-[#2E3532] rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] overflow-hidden">
                {contributions.map((c) => {
                  const isConfirming = confirmDeleteId === c.id;
                  const isBusy = deletingId === c.id;

                  return (
                    <div
                      key={c.id}
                      className="p-3 bg-white dark:bg-[#1E2220] hover:bg-[#F9FAF9] dark:hover:bg-[#232725] transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#075C45] dark:text-[#78D9A6]">
                            +{formatCurrency(c.amount)}
                          </span>
                          <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#5E6963]/70" />
                            {formatDateBR(c.contribution_date)}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] font-medium">
                            Origem: {c.source_name || (c.source_type === 'reserve' ? 'Reserva' : 'Saldo Livre')}
                          </span>
                        </div>
                        {c.notes && (
                          <p className="text-xs text-[#5E6963] dark:text-[#95A39B] truncate">
                            {c.notes}
                          </p>
                        )}
                      </div>

                      {/* Ação de exclusão / estorno */}
                      <div className="shrink-0 flex items-center">
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                              Estornar?
                            </span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(c.id)}
                              className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {isBusy ? '...' : 'Sim'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-md bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-[#5E6963] dark:text-[#95A39B] text-[11px] cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(c.id)}
                            title="Estornar/Excluir aporte"
                            className="p-1.5 rounded-lg text-[#5E6963] hover:text-rose-600 hover:bg-rose-50 dark:text-[#95A39B] dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8E4] dark:border-[#2E3532] bg-[#F9FAF9] dark:bg-[#1A1D1C] flex items-center justify-between">
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            O valor acumulado é derivado da soma destes registros.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="cursor-pointer text-xs"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
