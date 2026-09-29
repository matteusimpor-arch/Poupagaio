import React from 'react';
import { Entry } from '../../types';
import { Button } from '../ui/button';
import { ModalPortal } from '../ui/ModalPortal';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { formatCurrency, formatDateBR } from '../../lib/formatters';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  entry: Entry | null;
  isLoading?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  entry,
  isLoading = false,
}: DeleteConfirmModalProps) {
  if (!isOpen || !entry) return null;

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xl p-6 space-y-4 my-auto animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 id="delete-modal-title" className="text-base font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
            Excluir entrada?
          </h3>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
            Esta ação removerá permanentemente o lançamento financeiro abaixo do seu espaço.
          </p>
        </div>

        {/* Card Resumo do Lançamento */}
        <div className="p-3.5 rounded-2xl bg-[#F7F4EA]/60 dark:bg-[#121915] border border-[#E8E4D5] dark:border-[#24312B] flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA]">
              {entry.description}
            </p>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              {entry.category} • {formatDateBR(entry.date)}
            </p>
          </div>
          <span className="text-sm font-extrabold font-display text-emerald-600 dark:text-emerald-400">
            {formatCurrency(entry.amount)}
          </span>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            isLoading={isLoading}
            onClick={onConfirm}
            className="gap-2 font-bold cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Entrada
          </Button>
        </div>
      </div>
    </ModalPortal>
  );
}
