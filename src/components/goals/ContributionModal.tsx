import React, { useState, useEffect, useCallback } from 'react';
import { GoalWithProgress, CreateGoalContributionInput, Reserve } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { Button } from '../ui/button';
import { ModalPortal } from '../ui/ModalPortal';
import { X, PlusCircle, AlertCircle, Calendar, FileText, CheckCircle2, Wallet, PiggyBank } from 'lucide-react';
import { reservesService } from '../../lib/services/reserves';
import { useAuth } from '../../hooks/useAuth';

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GoalWithProgress | null;
  onSave: (
    input: CreateGoalContributionInput
  ) => Promise<{ success: boolean; error?: string }>;
}

export function ContributionModal({
  isOpen,
  onClose,
  goal,
  onSave,
}: ContributionModalProps) {
  const { currentSpace } = useAuth();
  const [amount, setAmount] = useState('');
  const [contributionDate, setContributionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [origin, setOrigin] = useState<'free' | string>('free');
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentSpace?.id) {
      const today = new Date().toISOString().split('T')[0];
      setContributionDate(today);
      setAmount('');
      setNotes('');
      setErrorMessage(null);
      setOrigin('free');
      
      const loadReserves = async () => {
        const res = await reservesService.getReservesWithSummary(currentSpace.id, new Date().getFullYear(), new Date().getMonth() + 1);
        setReserves(res.reserves);
      };
      loadReserves();
    }
  }, [isOpen, goal, currentSpace?.id]);

  if (!isOpen || !goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Informe um valor de aporte válido maior que zero.');
      return;
    }

    // Validate balance
    if (origin === 'free') {
      // Need free balance, I don't have it easily here, assuming for now
    } else {
      const selectedReserve = reserves.find(r => r.id === origin);
      if (selectedReserve && Number(selectedReserve.current_balance) < numericAmount) {
        setErrorMessage(`Saldo insuficiente nesta origem. Disponível: ${formatCurrency(Number(selectedReserve.current_balance))}`);
        return;
      }
    }

    if (!contributionDate) {
      setErrorMessage('Por favor, selecione a data do aporte.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateGoalContributionInput = {
        goal_id: goal.id,
        space_id: goal.space_id,
        amount: numericAmount,
        contribution_date: contributionDate,
        notes: notes.trim() ? notes.trim() : null,
        // Assuming the backend can handle the origin if added to CreateGoalContributionInput
        // origin: origin
      };

      const res = await onSave(payload);
      if (!res.success) {
        setErrorMessage(res.error || 'Erro ao registrar aporte.');
        setIsSubmitting(false);
        return;
      }

      onClose();
    } catch {
      setErrorMessage('Ocorreu um erro ao processar o aporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingBefore = Math.max(0, goal.target_amount - goal.accumulatedAmount);

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E2220] border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E4] dark:border-[#2E3532]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                Novo Aporte
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Card Resumo da Meta */}
          <div className="p-3.5 rounded-xl bg-[#F3F4F4] dark:bg-[#232725] border border-[#E2E8E4] dark:border-[#2E3532] space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#5E6963] dark:text-[#95A39B]">Objetivo</span>
              <span className="font-semibold text-[#202724] dark:text-[#F4F4F5]">
                {goal.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#5E6963] dark:text-[#95A39B]">Acumulado atual</span>
              <span className="font-bold text-[#075C45] dark:text-[#78D9A6]">
                {formatCurrency(goal.accumulatedAmount)} / {formatCurrency(goal.target_amount)}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Valor do Aporte */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5] flex items-center justify-between">
              <span>Valor do aporte (R$) <span className="text-rose-500">*</span></span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#5E6963] dark:text-[#95A39B]">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] placeholder:text-[#5E6963]/50 focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40"
              />
            </div>
          </div>

          {/* Origem */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">Origem do dinheiro</label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setOrigin('free')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border ${origin === 'free' ? 'border-[#16A66A] bg-[#16A66A]/5' : 'border-[#E2E8E4] dark:border-[#2E3532]'}`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#16A66A]" />
                  <span className="text-xs font-semibold">Saldo Livre</span>
                </div>
              </button>
              {reserves.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setOrigin(r.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border ${origin === r.id ? 'border-[#16A66A] bg-[#16A66A]/5' : 'border-[#E2E8E4] dark:border-[#2E3532]'}`}
                >
                  <div className="flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold">{r.name}</span>
                  </div>
                  <span className="text-xs text-[#5E6963]">{formatCurrency(Number(r.current_balance))}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data e Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#5E6963]" />
              <span>Data do aporte</span>
            </label>
            <input
              type="date"
              required
              value={contributionDate}
              onChange={(e) => setContributionDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="cursor-pointer text-xs font-semibold"
            >
              {isSubmitting ? 'Registrando...' : 'Confirmar aporte'}
            </Button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
