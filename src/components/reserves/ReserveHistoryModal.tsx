import React, { useState, useEffect } from 'react';
import { X, History, ArrowDownRight, ArrowUpRight, ArrowRightLeft, ShieldCheck, Undo2 } from 'lucide-react';
import { Reserve, ReserveTransaction } from '../../types';
import { reservesService } from '../../lib/services/reserves';
import { formatCurrency } from '../../lib/formatters';

interface ReserveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserve: Reserve;
}

export function ReserveHistoryModal({
  isOpen,
  onClose,
  reserve,
}: ReserveHistoryModalProps) {
  const [transactions, setTransactions] = useState<ReserveTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && reserve.id) {
      setIsLoading(true);
      reservesService.getReserveTransactions(reserve.id).then((res) => {
        setTransactions(res.transactions);
        setIsLoading(false);
      });
    }
  }, [isOpen, reserve.id]);

  if (!isOpen) return null;

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'initial_allocation':
      case 'deposit':
        return {
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
          icon: ArrowUpRight,
          label: 'Aporte',
        };
      case 'withdraw':
        return {
          bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
          icon: ArrowDownRight,
          label: 'Retirada',
        };
      case 'expense_payment':
        return {
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
          icon: ArrowDownRight,
          label: 'Despesa Paga',
        };
      case 'transfer_in':
        return {
          bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
          icon: ArrowRightLeft,
          label: 'Transferência Recebida',
        };
      case 'transfer_out':
        return {
          bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
          icon: ArrowRightLeft,
          label: 'Transferência Enviada',
        };
      case 'refund':
        return {
          bg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
          icon: Undo2,
          label: 'Estorno',
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
          icon: ShieldCheck,
          label: 'Movimentação',
        };
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-[calc(100vw-24px)] max-w-lg bg-white dark:bg-[#18211D] border border-[#E2ECE6] dark:border-[#28322C] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#16A66A]/10 text-[#16A66A] flex items-center justify-center text-lg shrink-0">
              {reserve.icon || '💰'}
            </div>
            <div>
              <h2 id="history-modal-title" className="text-base sm:text-lg font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                Extrato: {reserve.name}
              </h2>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Saldo atual: <strong>{formatCurrency(reserve.current_balance)}</strong> de {formatCurrency(reserve.allocated_amount)}
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

        {/* Transactions List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[#5E6963]">
              Carregando movimentações...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-[#5E6963] dark:text-[#95A39B]">
              <History className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-semibold">Nenhuma movimentação registrada ainda.</p>
            </div>
          ) : (
            transactions.map((tx) => {
              const meta = getBadgeStyle(tx.type);
              const isPositive = ['initial_allocation', 'deposit', 'transfer_in', 'refund'].includes(tx.type);

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-[#F4F7F5] dark:bg-[#202723] border border-[#E2ECE6] dark:border-[#28322C] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                        {tx.transaction_date}
                      </span>
                    </div>
                    <p className="font-bold text-[#02402E] dark:text-[#78D9A6] truncate">
                      {tx.source_description}
                    </p>
                    {tx.notes && (
                      <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] italic">
                        "{tx.notes}"
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-extrabold ${
                        isPositive ? 'text-[#16A66A]' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : '-'} {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                      Saldo: {formatCurrency(tx.new_balance)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#02402E] dark:bg-[#16A66A] text-white dark:text-[#101614] font-bold text-xs sm:text-sm hover:bg-[#16A66A] transition-colors cursor-pointer"
          >
            Fechar Extrato
          </button>
        </div>

      </div>
    </div>
  );
}
