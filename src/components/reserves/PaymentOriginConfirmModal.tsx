import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Wallet, ShieldCheck } from 'lucide-react';
import { Reserve, PaymentOriginType } from '../../types';
import { reservesService } from '../../lib/services/reserves';
import { formatCurrency } from '../../lib/formatters';
import { ModalPortal } from '../ui/ModalPortal';

interface PaymentOriginConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  userId: string;
  item: {
    id: string;
    sourceType: 'fixed' | 'variable' | 'installment';
    sourceId: string;
    title: string;
    amount: number;
    dueDate: string;
    category?: string;
  } | null;
  onSuccess: () => void;
}

export function PaymentOriginConfirmModal({
  isOpen,
  onClose,
  spaceId,
  userId,
  item,
  onSuccess,
}: PaymentOriginConfirmModalProps) {
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [originType, setOriginType] = useState<PaymentOriginType>('free_balance');
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null);
  const [allowSplit, setAllowSplit] = useState(false);
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [freeBalance, setFreeBalance] = useState<number>(0);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && spaceId && item) {
      const [y, m] = (item.dueDate || new Date().toISOString().split('T')[0]).split('-').map(Number);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setErrorMessage(null);
      setAllowSplit(false);

      setIsLoading(true);
      reservesService.getReservesWithSummary(spaceId, y, m).then((res) => {
        setReserves(res.reserves);
        setFreeBalance(res.summary.freeBalance);
        setTotalBalance(res.summary.totalBalance);

        // Auto suggest preferred reserve matching category
        if (item.category && res.reserves.length > 0) {
          const match = res.reserves.find(
            (r) =>
              (r.category && r.category.toLowerCase() === item.category?.toLowerCase()) ||
              (r.name.toLowerCase().includes(item.category?.toLowerCase() || ''))
          );
          if (match) {
            setSelectedReserveId(match.id);
            setOriginType('reserve');
          } else {
            setOriginType('free_balance');
            setSelectedReserveId(null);
          }
        } else {
          setOriginType('free_balance');
          setSelectedReserveId(null);
        }
        setIsLoading(false);
      });
    }
  }, [isOpen, spaceId, item]);

  if (!isOpen || !item) return null;

  const selectedReserve = reserves.find((r) => r.id === selectedReserveId) || null;
  const reserveBalance = selectedReserve ? Number(selectedReserve.current_balance) || 0 : 0;
  const isReserveInsufficient = originType === 'reserve' && selectedReserve && reserveBalance < item.amount;
  const shortfall = isReserveInsufficient ? item.amount - reserveBalance : 0;

  const handleConfirm = async () => {
    if (!spaceId || isSubmitting) return;

    // Check if insufficient and split was not accepted
    if (isReserveInsufficient && !allowSplit) {
      setErrorMessage(`Saldo insuficiente na reserva "${selectedReserve?.name}". Faltam ${formatCurrency(shortfall)}.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalOrigin: PaymentOriginType = originType;
      let reserveAmt: number | undefined = undefined;
      let freeBalAmt: number | undefined = undefined;

      if (originType === 'reserve' && isReserveInsufficient && allowSplit) {
        finalOrigin = 'split';
        reserveAmt = reserveBalance;
        freeBalAmt = shortfall;
      } else if (originType === 'reserve') {
        reserveAmt = item.amount;
      } else {
        freeBalAmt = item.amount;
      }

      const res = await reservesService.payExpenseWithOrigin(userId, {
        space_id: spaceId,
        expense_type: item.sourceType,
        expense_id: item.sourceId,
        amount: item.amount,
        payment_date: paymentDate,
        origin_type: finalOrigin,
        primary_reserve_id: finalOrigin === 'free_balance' ? null : selectedReserveId,
        reserve_amount: reserveAmt,
        free_balance_amount: freeBalAmt,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Não foi possível registrar o pagamento.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado ao confirmar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="w-[calc(100vw-24px)] max-w-lg bg-white dark:bg-[#18211D] border border-[#E2ECE6] dark:border-[#28322C] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#16A66A]/10 text-[#16A66A] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="confirm-payment-title" className="text-base sm:text-lg font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                Confirmar Pagamento
              </h2>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Informe a data e a origem do dinheiro
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

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Item Highlight Card */}
          <div className="p-3.5 rounded-2xl bg-[#F4F7F5] dark:bg-[#202723] border border-[#E2ECE6] dark:border-[#28322C] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B] font-medium">{item.category || 'Despesa'}</p>
              <h3 className="text-sm sm:text-base font-bold text-[#02402E] dark:text-[#78D9A6] truncate font-display">
                {item.title}
              </h3>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-[#5E6963] dark:text-[#95A39B]">Valor</span>
              <p className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400">
                {formatCurrency(item.amount)}
              </p>
            </div>
          </div>

          {/* Payment Date Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
              Pago em:
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
            />
          </div>

          {/* Origin Selection */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] block">
              De onde saiu o dinheiro?
            </label>

            {isLoading ? (
              <div className="py-4 text-center text-xs text-[#5E6963]">Carregando origens...</div>
            ) : (
              <div className="space-y-2">
                {/* Option: Saldo Livre */}
                <label
                  onClick={() => {
                    setOriginType('free_balance');
                    setSelectedReserveId(null);
                    setAllowSplit(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    originType === 'free_balance'
                      ? 'border-[#16A66A] bg-[#16A66A]/10 text-[#02402E] dark:text-[#78D9A6] shadow-2xs'
                      : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] hover:bg-black/5 text-[#202724] dark:text-[#F4F4F5]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment_origin"
                      checked={originType === 'free_balance'}
                      onChange={() => {
                        setOriginType('free_balance');
                        setSelectedReserveId(null);
                        setAllowSplit(false);
                      }}
                      className="w-4 h-4 text-[#16A66A] accent-[#16A66A]"
                    />
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#16A66A]" />
                      <span className="font-bold text-xs sm:text-sm">Saldo Livre</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-xs text-[#16A66A]">
                    {formatCurrency(freeBalance)} disponíveis
                  </span>
                </label>

                {/* Option: Reserves list */}
                {reserves.map((res) => {
                  const isSelected = originType === 'reserve' && selectedReserveId === res.id;
                  const resBal = Number(res.current_balance) || 0;
                  const isSuggested =
                    item.category &&
                    res.category &&
                    res.category.toLowerCase() === item.category.toLowerCase();

                  return (
                    <label
                      key={res.id}
                      onClick={() => {
                        setOriginType('reserve');
                        setSelectedReserveId(res.id);
                        setAllowSplit(false);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#16A66A] bg-[#16A66A]/10 text-[#02402E] dark:text-[#78D9A6] shadow-2xs'
                          : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] hover:bg-black/5 text-[#202724] dark:text-[#F4F4F5]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment_origin"
                          checked={isSelected}
                          onChange={() => {
                            setOriginType('reserve');
                            setSelectedReserveId(res.id);
                            setAllowSplit(false);
                          }}
                          className="w-4 h-4 text-[#16A66A] accent-[#16A66A]"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-base">{res.icon || '💰'}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs sm:text-sm">{res.name}</span>
                              {isSuggested && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#16A66A]/20 text-[#16A66A] font-bold">
                                  Sugerida
                                </span>
                              )}
                            </div>
                            {res.category && (
                              <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                                Categoria: {res.category}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="font-extrabold text-xs text-[#02402E] dark:text-[#78D9A6]">
                        {formatCurrency(resBal)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Insufficient balance & split payment helper */}
          {isReserveInsufficient && selectedReserve && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2.5">
              <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Saldo insuficiente nesta reserva.</p>
                  <p>
                    A reserva possui <strong>{formatCurrency(reserveBalance)}</strong> disponíveis e faltam{' '}
                    <strong>{formatCurrency(shortfall)}</strong> para pagar o valor total.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#161B18] border border-amber-300 dark:border-amber-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSplit}
                    onChange={(e) => setAllowSplit(e.target.checked)}
                    className="w-4 h-4 text-[#16A66A] accent-[#16A66A]"
                  />
                  <span className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">
                    Completar <strong>{formatCurrency(shortfall)}</strong> com Saldo Livre (Pagamento Dividido)
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer (Mobile First stacked layout) */}
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
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || isLoading || (isReserveInsufficient && !allowSplit)}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-[#16A66A] hover:bg-[#02402E] text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>Salvando...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Pagamento</span>
              </>
            )}
          </button>
        </div>

      </div>
    </ModalPortal>
  );
}
