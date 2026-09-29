import React, { useState, useEffect } from 'react';
import {
  ShoppingList,
  CreateShoppingListInput,
  UpdateShoppingListInput,
} from '../../types';
import { Button } from '../ui/button';
import { X, ShoppingBag, Calendar, FileText, AlertCircle, DollarSign } from 'lucide-react';

interface MarketListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    input: CreateShoppingListInput | UpdateShoppingListInput
  ) => Promise<{ success: boolean; error?: string }>;
  listToEdit?: ShoppingList | null;
  spaceId: string;
}

export function MarketListModal({
  isOpen,
  onClose,
  onSave,
  listToEdit,
  spaceId,
}: MarketListModalProps) {
  const [name, setName] = useState('');
  const [shoppingDate, setShoppingDate] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (listToEdit) {
      setName(listToEdit.name);
      setShoppingDate(listToEdit.shopping_date || '');
      setBudgetAmount(
        listToEdit.budget_amount !== undefined && listToEdit.budget_amount !== null
          ? String(listToEdit.budget_amount)
          : ''
      );
      setNotes(listToEdit.notes || '');
    } else {
      setName('');
      setShoppingDate(new Date().toISOString().split('T')[0]);
      setBudgetAmount('');
      setNotes('');
    }
    setErrorMessage(null);
  }, [listToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Por favor, informe o nome da lista de compras.');
      return;
    }

    const parsedBudget = budgetAmount.trim()
      ? parseFloat(budgetAmount.replace(',', '.'))
      : null;

    if (parsedBudget !== null && (isNaN(parsedBudget) || parsedBudget < 0)) {
      setErrorMessage('Por favor, informe um valor de orçamento válido (maior ou igual a zero).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let res;
      if (listToEdit) {
        res = await onSave({
          name: trimmedName,
          shopping_date: shoppingDate || null,
          budget_amount: parsedBudget,
          notes: notes.trim() || null,
        });
      } else {
        res = await onSave({
          space_id: spaceId,
          name: trimmedName,
          shopping_date: shoppingDate || null,
          budget_amount: parsedBudget,
          notes: notes.trim() || null,
        });
      }

      if (res.success) {
        onClose();
      } else {
        setErrorMessage(res.error || 'Erro ao salvar lista.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-[#1E2220] rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                {listToEdit ? 'Editar Lista de Compras' : 'Nova Lista de Compras'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Organize seus itens antes de ir ao mercado
              </p>
            </div>
          </div>
          <button
            id="btn-close-market-list-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nome da Lista */}
          <div>
            <label
              htmlFor="market-list-name"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              Nome da Lista *
            </label>
            <input
              id="market-list-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Compra do mês, Feira de sábado, Churrasco..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Data Prevista */}
          <div>
            <label
              htmlFor="market-list-date"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              Data Prevista da Compra (Opcional)
            </label>
            <input
              id="market-list-date"
              type="date"
              value={shoppingDate}
              onChange={(e) => setShoppingDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Orçamento da Compra */}
          <div>
            <label
              htmlFor="market-list-budget"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Orçamento da Compra (R$) (Opcional)
            </label>
            <input
              id="market-list-budget"
              type="text"
              inputMode="decimal"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              placeholder="Ex: 500,00"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
            />
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
              Defina um limite para acompanhar o valor restante durante as compras
            </p>
          </div>

          {/* Observações */}
          <div>
            <label
              htmlFor="market-list-notes"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              Observações (Opcional)
            </label>
            <textarea
              id="market-list-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Levar sacolas retornáveis, checar promoções de carne..."
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors resize-none"
            />
          </div>

          {/* Rodapé de Ações */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button
              id="btn-cancel-market-list"
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 text-xs font-medium"
            >
              Cancelar
            </Button>
            <Button
              id="btn-save-market-list"
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl px-5 text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white shadow-xs"
            >
              {isSubmitting ? 'Salvando...' : listToEdit ? 'Atualizar Lista' : 'Criar Lista'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
