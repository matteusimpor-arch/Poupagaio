import React, { useState } from 'react';
import { X, Plus, Minus, ArrowRightLeft, AlertCircle, Check, Wallet } from 'lucide-react';
import { Reserve } from '../../types';
import { reservesService } from '../../lib/services/reserves';
import { formatCurrency } from '../../lib/formatters';

export type ReserveActionType = 'deposit' | 'withdraw' | 'transfer';

interface ReserveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  userId: string;
  actionType: ReserveActionType;
  sourceReserve: Reserve;
  allReserves: Reserve[];
  freeBalance: number;
  onSuccess: () => void;
}

export function ReserveActionModal({
  isOpen,
  onClose,
  spaceId,
  userId,
  actionType,
  sourceReserve,
  allReserves,
  freeBalance,
  onSuccess,
}: ReserveActionModalProps) {
  const [amount, setAmount] = useState('');
  const [targetReserveId, setTargetReserveId] = useState<string>(() => {
    const other = allReserves.find((r) => r.id !== sourceReserve.id);
    return other ? other.id : '';
  });
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount.replace(',', '.')) || 0;
  const reserveBalance = Number(sourceReserve.current_balance) || 0;
  const otherReserves = allReserves.filter((r) => r.id !== sourceReserve.id);

  const title =
    actionType === 'deposit'
      ? `Adicionar Dinheiro em "${sourceReserve.name}"`
      : actionType === 'withdraw'
      ? `Retirar Dinheiro de "${sourceReserve.name}"`
      : `Transferir de "${sourceReserve.name}"`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Informe um valor válido maior que zero.');
      return;
    }

    if (actionType === 'deposit' && numAmount > freeBalance) {
      setErrorMessage(`Valor informado ultrapassa o Saldo Livre disponível (${formatCurrency(freeBalance)}).`);
      return;
    }

    if (actionType === 'withdraw' && numAmount > reserveBalance) {
      setErrorMessage(`Valor informado ultrapassa o saldo da reserva (${formatCurrency(reserveBalance)}).`);
      return;
    }

    if (actionType === 'transfer') {
      if (!targetReserveId) {
        setErrorMessage('Selecione a reserva de destino.');
        return;
      }
      if (numAmount > reserveBalance) {
        setErrorMessage(`Valor informado ultrapassa o saldo disponível na reserva de origem (${formatCurrency(reserveBalance)}).`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (actionType === 'deposit') {
        const res = await reservesService.addMoney(userId, {
          reserve_id: sourceReserve.id,
          space_id: spaceId,
          amount: numAmount,
          notes: notes.trim() || null,
        });
        if (res.error) throw new Error(res.error);
      } else if (actionType === 'withdraw') {
        const res = await reservesService.withdrawMoney(userId, {
          reserve_id: sourceReserve.id,
          space_id: spaceId,
          amount: numAmount,
          notes: notes.trim() || null,
        });
        if (res.error) throw new Error(res.error);
      } else if (actionType === 'transfer') {
        const res = await reservesService.transferMoney(userId, {
          from_reserve_id: sourceReserve.id,
          to_reserve_id: targetReserveId,
          space_id: spaceId,
          amount: numAmount,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error || 'Erro ao processar transferência.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao executar operação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-[calc(100vw-24px)] max-w-md bg-white dark:bg-[#18211D] border border-[#E2ECE6] dark:border-[#28322C] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                actionType === 'deposit'
                  ? 'bg-[#16A66A]/10 text-[#16A66A]'
                  : actionType === 'withdraw'
                  ? 'bg-rose-500/10 text-rose-600'
                  : 'bg-blue-500/10 text-blue-600'
              }`}
            >
              {actionType === 'deposit' && <Plus className="w-5 h-5" />}
              {actionType === 'withdraw' && <Minus className="w-5 h-5" />}
              {actionType === 'transfer' && <ArrowRightLeft className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="action-modal-title" className="text-sm sm:text-base font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                {title}
              </h2>
              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                {actionType === 'deposit' && 'Transfere valor do Saldo Livre para esta caixinha'}
                {actionType === 'withdraw' && 'Devolve valor desta caixinha para o Saldo Livre'}
                {actionType === 'transfer' && 'Transfere saldo entre duas caixinhas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
            
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Context Balance Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-[#F4F7F5] dark:bg-[#202723] border border-[#E2ECE6] dark:border-[#28322C]">
                <span className="text-[#5E6963] dark:text-[#95A39B] block text-[11px]">Reserva ({sourceReserve.icon || '💰'})</span>
                <span className="font-extrabold text-[#02402E] dark:text-[#78D9A6] text-sm">
                  {formatCurrency(reserveBalance)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F4F7F5] dark:bg-[#202723] border border-[#E2ECE6] dark:border-[#28322C]">
                <span className="text-[#5E6963] dark:text-[#95A39B] block text-[11px] flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-[#16A66A]" /> Saldo Livre
                </span>
                <span className="font-extrabold text-[#16A66A] text-sm">
                  {formatCurrency(freeBalance)}
                </span>
              </div>
            </div>

            {/* Target Reserve Selection for Transfer */}
            {actionType === 'transfer' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Transferir para qual reserva? *
                </label>
                {otherReserves.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Você não possui outras reservas criadas para transferir.
                  </p>
                ) : (
                  <select
                    value={targetReserveId}
                    onChange={(e) => setTargetReserveId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
                  >
                    {otherReserves.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.icon || '💰'} {r.name} — ({formatCurrency(r.current_balance)} atuais)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Valor do Aporte/Retirada/Transferência */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Valor da Operação (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
              />
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Motivo / Observação (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Aporte extra, Sobra do mês, Ajuste de meta"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
              />
            </div>

          </div>

          {/* Footer (Mobile First responsive) */}
          <div className="p-4 sm:p-5 border-t border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420] flex flex-col sm:flex-row gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B] font-bold text-xs sm:text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (actionType === 'transfer' && otherReserves.length === 0)}
              className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-[#02402E] dark:bg-[#16A66A] hover:bg-[#16A66A] dark:hover:bg-[#02402E] text-white dark:text-[#101614] font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Processando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
