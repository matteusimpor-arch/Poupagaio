import React, { useState, useEffect } from 'react';
import {
  ShoppingListItem,
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
} from '../../types';
import { MARKET_UNITS, MARKET_CATEGORIES } from '../../lib/services/market';
import { Button } from '../ui/button';
import { X, Plus, Edit2, AlertCircle, Tag, DollarSign, FileText } from 'lucide-react';

interface MarketItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    input: CreateShoppingListItemInput | UpdateShoppingListItemInput
  ) => Promise<{ success: boolean; error?: string }>;
  itemToEdit?: ShoppingListItem | null;
  listId: string;
  spaceId: string;
}

export function MarketItemModal({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
  listId,
  spaceId,
}: MarketItemModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>('un');
  const [category, setCategory] = useState<string>('Geral');
  const [estimatedUnitPrice, setEstimatedUnitPrice] = useState('');
  const [actualUnitPrice, setActualUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setQuantity(String(itemToEdit.quantity || 1));
      setUnit(itemToEdit.unit || 'un');
      setCategory(itemToEdit.category || 'Geral');
      setEstimatedUnitPrice(
        itemToEdit.estimated_unit_price !== null && itemToEdit.estimated_unit_price !== undefined
          ? String(itemToEdit.estimated_unit_price)
          : ''
      );
      setActualUnitPrice(
        itemToEdit.actual_unit_price !== null && itemToEdit.actual_unit_price !== undefined
          ? String(itemToEdit.actual_unit_price)
          : ''
      );
      setNotes(itemToEdit.notes || '');
    } else {
      setName('');
      setQuantity('1');
      setUnit('un');
      setCategory('Geral');
      setEstimatedUnitPrice('');
      setActualUnitPrice('');
      setNotes('');
    }
    setErrorMessage(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Por favor, informe o nome do produto.');
      return;
    }

    const parsedQty = parseFloat(quantity.replace(',', '.'));
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMessage('A quantidade deve ser um número maior que zero.');
      return;
    }

    let parsedEstimatedPrice: number | null = null;
    if (estimatedUnitPrice.trim()) {
      const p = parseFloat(estimatedUnitPrice.replace(',', '.'));
      if (isNaN(p) || p < 0) {
        setErrorMessage('O preço estimado unitário não pode ser negativo.');
        return;
      }
      parsedEstimatedPrice = p;
    }

    let parsedActualPrice: number | null = null;
    if (actualUnitPrice.trim()) {
      const p = parseFloat(actualUnitPrice.replace(',', '.'));
      if (isNaN(p) || p < 0) {
        setErrorMessage('O preço real unitário não pode ser negativo.');
        return;
      }
      parsedActualPrice = p;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let res;
      if (itemToEdit) {
        res = await onSave({
          name: trimmedName,
          quantity: parsedQty,
          unit: unit || 'un',
          category: category || 'Geral',
          estimated_unit_price: parsedEstimatedPrice,
          actual_unit_price: parsedActualPrice,
          notes: notes.trim() || null,
        });
      } else {
        res = await onSave({
          shopping_list_id: listId,
          space_id: spaceId,
          name: trimmedName,
          quantity: parsedQty,
          unit: unit || 'un',
          category: category || 'Geral',
          estimated_unit_price: parsedEstimatedPrice,
          actual_unit_price: parsedActualPrice,
          notes: notes.trim() || null,
        });
      }

      if (res.success) {
        onClose();
      } else {
        setErrorMessage(res.error || 'Erro ao salvar item.');
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
              {itemToEdit ? <Edit2 className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                {itemToEdit ? 'Editar Item' : 'Adicionar ao Carrinho/Lista'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Defina o produto, quantidade e preços
              </p>
            </div>
          </div>
          <button
            id="btn-close-market-item-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nome do Produto */}
          <div>
            <label
              htmlFor="market-item-name"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              Produto / Item *
            </label>
            <input
              id="market-item-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Arroz 5kg, Azeite Extra Virgem, Maçã Gala..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Quantidade e Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="market-item-quantity"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
              >
                Quantidade *
              </label>
              <input
                id="market-item-quantity"
                type="number"
                step="any"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="market-item-unit"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
              >
                Unidade de Medida
              </label>
              <select
                id="market-item-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
              >
                {MARKET_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label
              htmlFor="market-item-category"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              Categoria
            </label>
            <select
              id="market-item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
            >
              {MARKET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Preços Unitários (Estimado e Real) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="market-item-est-price"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1"
              >
                <DollarSign className="w-3 h-3 text-neutral-400" />
                Preço Estimado (un)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                  R$
                </span>
                <input
                  id="market-item-est-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedUnitPrice}
                  onChange={(e) => setEstimatedUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="market-item-act-price"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1"
              >
                <DollarSign className="w-3 h-3 text-neutral-400" />
                Preço Real (un)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                  R$
                </span>
                <input
                  id="market-item-act-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualUnitPrice}
                  onChange={(e) => setActualUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label
              htmlFor="market-item-notes"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              Observações (Opcional)
            </label>
            <input
              id="market-item-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Marca preferida, preferir maduro..."
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Rodapé de Ações */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button
              id="btn-cancel-market-item"
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 text-xs font-medium"
            >
              Cancelar
            </Button>
            <Button
              id="btn-save-market-item"
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl px-5 text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white shadow-xs"
            >
              {isSubmitting ? 'Salvando...' : itemToEdit ? 'Atualizar Item' : 'Adicionar Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
