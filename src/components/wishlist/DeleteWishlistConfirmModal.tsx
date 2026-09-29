import React from 'react';
import { WishlistItem } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { Button } from '../ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteWishlistConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  item: WishlistItem | null;
  isDeleting: boolean;
}

export function DeleteWishlistConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  item,
  isDeleting,
}: DeleteWishlistConfirmModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="delete-wishlist-modal-container"
        className="w-full max-w-sm bg-white dark:bg-[#1E2220] rounded-2xl shadow-xl border border-[#E2E8E4] dark:border-[#2E3532] overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8E4] dark:border-[#2E3532]">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-[#181B1A] dark:text-white">
              Excluir desejo
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="h-8 w-8 p-0 rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
            Excluir este desejo? Esta ação não poderá ser desfeita.
          </p>

          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs space-y-1">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
              {item.name}
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">
              Valor estimado:{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {formatCurrency(item.estimated_amount)}
              </span>
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">
              Categoria: <span className="font-medium">{item.category}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-end gap-2 bg-zinc-50/50 dark:bg-zinc-900/20">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir desejo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
