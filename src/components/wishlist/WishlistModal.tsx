import React, { useState, useEffect } from 'react';
import {
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
} from '../../types';
import { WISHLIST_CATEGORIES } from '../../lib/services/wishlist';
import { Button } from '../ui/button';
import { X, Gift, AlertCircle, Calendar, Tag, FileText, Sparkles } from 'lucide-react';

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    input: CreateWishlistItemInput | UpdateWishlistItemInput
  ) => Promise<{ success: boolean; error?: string }>;
  itemToEdit?: WishlistItem | null;
  spaceId: string;
}

export function WishlistModal({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
  spaceId,
}: WishlistModalProps) {
  const [name, setName] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [category, setCategory] = useState<string>('Geral');
  const [priority, setPriority] = useState<WishlistPriority>('medium');
  const [status, setStatus] = useState<WishlistStatus>('active');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setEstimatedAmount(String(itemToEdit.estimated_amount));
      setDesiredDate(itemToEdit.desired_date || '');
      setCategory(itemToEdit.category || 'Geral');
      setPriority(itemToEdit.priority || 'medium');
      setStatus(itemToEdit.status || 'active');
      setNotes(itemToEdit.notes || '');
    } else {
      setName('');
      setEstimatedAmount('');
      setDesiredDate('');
      setCategory('Geral');
      setPriority('medium');
      setStatus('active');
      setNotes('');
    }
    setErrorMessage(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Por favor, informe o nome do desejo.');
      return;
    }

    const numericAmount = parseFloat(estimatedAmount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Informe um valor estimado válido maior que zero.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (itemToEdit) {
        const payload: UpdateWishlistItemInput = {
          name: trimmedName,
          estimated_amount: numericAmount,
          category,
          priority,
          desired_date: desiredDate ? desiredDate : null,
          status,
          notes: notes ? notes : null,
        };
        const res = await onSave(payload);
        if (!res.success) {
          setErrorMessage(res.error || 'Erro ao salvar alterações do desejo.');
          setIsSubmitting(false);
          return;
        }
      } else {
        const payload: CreateWishlistItemInput = {
          space_id: spaceId,
          name: trimmedName,
          estimated_amount: numericAmount,
          category,
          priority,
          desired_date: desiredDate ? desiredDate : null,
          status: 'active',
          notes: notes ? notes : null,
        };
        const res = await onSave(payload);
        if (!res.success) {
          setErrorMessage(res.error || 'Erro ao criar item na lista de desejos.');
          setIsSubmitting(false);
          return;
        }
      }

      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="wishlist-modal-container"
        className="w-full max-w-md bg-white dark:bg-[#1E2220] rounded-2xl shadow-xl border border-[#E2E8E4] dark:border-[#2E3532] overflow-hidden"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2E8E4] dark:border-[#2E3532]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-[#181B1A] dark:text-white">
                {itemToEdit ? 'Editar desejo' : 'Novo desejo'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {itemToEdit
                  ? 'Atualize os dados e valor estimado'
                  : 'Guarde o que você planeja comprar no futuro'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nome do Desejo */}
          <div>
            <label
              htmlFor="wishlist-name"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Nome do que você quer comprar / conquistar *
            </label>
            <input
              id="wishlist-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Notebook novo, Fone bluetooth, Sofá..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#181B1A] text-[#181B1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
            />
          </div>

          {/* Valor Estimado */}
          <div>
            <label
              htmlFor="wishlist-estimated-amount"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Valor estimado (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                R$
              </span>
              <input
                id="wishlist-estimated-amount"
                type="text"
                required
                inputMode="decimal"
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-2 text-sm font-medium rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#181B1A] text-[#181B1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Lista de Desejos não gera lançamento nem movimenta saldo.
            </p>
          </div>

          {/* Categoria e Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="wishlist-category"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Categoria
              </label>
              <div className="relative">
                <select
                  id="wishlist-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#181B1A] text-[#181B1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
                >
                  {WISHLIST_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="wishlist-priority"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Prioridade
              </label>
              <select
                id="wishlist-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as WishlistPriority)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#181B1A] text-[#181B1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
              >
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>

          {/* Data Desejada e Status (se edição) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="wishlist-desired-date"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Data desejada (opcional)
              </label>
              <input
                id="wishlist-desired-date"
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#181B1A] text-[#181B1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
              />
            </div>

            {itemToEdit && (
              <div>
                <label
                  htmlFor="wishlist-status"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Status
                </label>
                <select
                  id="wishlist-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WishlistStatus)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#181B1A] text-[#181B1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
                >
                  <option value="active">Ativo</option>
                  <option value="purchased">Comprado</option>
                  <option value="archived">Arquivado</option>
                </select>
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label
              htmlFor="wishlist-notes"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Observações / Links (opcional)
            </label>
            <textarea
              id="wishlist-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Marca recomendada, link da loja, cor preferida..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#181B1A] text-[#181B1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] resize-none"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs bg-[#16A34A] hover:bg-[#15803D] text-white"
            >
              {isSubmitting ? 'Salvando...' : itemToEdit ? 'Salvar alterações' : 'Adicionar desejo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
