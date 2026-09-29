import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, Check } from 'lucide-react';
import { Reserve } from '../../types';
import { reservesService } from '../../lib/services/reserves';
import { formatCurrency } from '../../lib/formatters';

interface DeleteReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  reserve: Reserve;
  onSuccess: () => void;
}

export function DeleteReserveModal({
  isOpen,
  onClose,
  spaceId,
  reserve,
  onSuccess,
}: DeleteReserveModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentBal = Number(reserve.current_balance) || 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await reservesService.deleteReserve(reserve.id, spaceId);
      if (!res.success) throw new Error(res.error || 'Erro ao excluir reserva.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao excluir reserva.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-[calc(100vw-24px)] max-w-md bg-white dark:bg-[#18211D] border border-[#E2ECE6] dark:border-[#28322C] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2ECE6] dark:border-[#28322C] bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-modal-title" className="text-base font-bold text-red-700 dark:text-red-400 font-display">
                Excluir Reserva
              </h2>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Confirmação de exclusão permanente
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

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs sm:text-sm">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <p className="text-[#202724] dark:text-[#F4F4F5]">
            Tem certeza que deseja excluir a reserva <strong>"{reserve.name}"</strong>?
          </p>

          {currentBal > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
              <p className="font-bold">Saldo restante: {formatCurrency(currentBal)}</p>
              <p className="text-[11px] mt-0.5">
                Ao excluir, o valor restante deixará de estar reservado e retornará automaticamente ao seu <strong>Saldo Livre</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer (Mobile First) */}
        <div className="p-4 sm:p-5 border-t border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420] flex flex-col sm:flex-row gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B] font-bold text-xs sm:text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isDeleting ? <span>Excluindo...</span> : <span>Confirmar Exclusão</span>}
          </button>
        </div>

      </div>
    </div>
  );
}
