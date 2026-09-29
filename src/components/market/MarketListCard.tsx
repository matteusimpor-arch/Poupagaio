import React, { useState } from 'react';
import {
  ShoppingListWithItems,
  ShoppingListItem,
  ShoppingListStatus,
  CreateShoppingListItemInput,
} from '../../types';
import { formatCurrency, formatDateBR } from '../../lib/formatters';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  Check,
  CheckCircle2,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  ShoppingCart,
  MoreVertical,
  CheckSquare,
  Square,
  Tag,
  DollarSign,
  Play,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

interface MarketListCardProps {
  key?: React.Key;
  list: ShoppingListWithItems;
  onToggleItem: (item: ShoppingListItem, isChecked: boolean) => void;
  onQuickAddItem: (input: CreateShoppingListItemInput) => Promise<{ success: boolean; error?: string }>;
  onOpenAddItemModal: (list: ShoppingListWithItems) => void;
  onEditItem: (item: ShoppingListItem) => void;
  onDeleteItem: (item: ShoppingListItem) => void;
  onEditList: (list: ShoppingListWithItems) => void;
  onDeleteList: (list: ShoppingListWithItems) => void;
  onArchiveList: (list: ShoppingListWithItems) => void;
  onReopenList: (list: ShoppingListWithItems) => void;
  onStartShopping: (list: ShoppingListWithItems) => void;
  onCompleteList: (list: ShoppingListWithItems) => void;
  onUpdateItemActualPrice: (item: ShoppingListItem, newPrice: number) => void;
  onUpdateItemQuantity: (item: ShoppingListItem, newQty: number) => void;
}

export function MarketListCard({
  list,
  onToggleItem,
  onQuickAddItem,
  onOpenAddItemModal,
  onEditItem,
  onDeleteItem,
  onEditList,
  onDeleteList,
  onArchiveList,
  onReopenList,
  onStartShopping,
  onCompleteList,
  onUpdateItemActualPrice,
  onUpdateItemQuantity,
}: MarketListCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemQty, setQuickItemQty] = useState('1');
  const [isAddingQuick, setIsAddingQuick] = useState(false);

  const isCompleted = list.status === 'completed';
  const isArchived = list.status === 'archived';
  const isActive = list.status === 'active';
  const isShopping = list.status === 'shopping';

  const { totalEstimated, totalActual, totalItems, checkedItems } = list.totals;
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  const hasBudget = list.budget_amount !== null && list.budget_amount !== undefined && list.budget_amount >= 0;
  const budget = hasBudget ? (list.budget_amount as number) : null;

  // Em Planejamento: Disponível Previsto = Orçamento - Total Estimado
  const availableEstimated = budget !== null ? budget - totalEstimated : null;

  // No Mercado (Carrinho): Restante ou Acima do Orçamento
  const isOverBudget = budget !== null && totalActual > budget;
  const budgetRemaining = budget !== null ? budget - totalActual : null;
  const budgetOverAmount = budget !== null && totalActual > budget ? totalActual - budget : null;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = quickItemName.trim();
    if (!name) return;
    const qty = parseFloat(quickItemQty.replace(',', '.')) || 1;

    setIsAddingQuick(true);
    const res = await onQuickAddItem({
      shopping_list_id: list.id,
      space_id: list.space_id,
      name,
      quantity: Math.max(0.01, qty),
      unit: 'un',
      is_checked: false,
    });
    setIsAddingQuick(false);

    if (res.success) {
      setQuickItemName('');
      setQuickItemQty('1');
    }
  };

  return (
    <Card
      id={`market-list-card-${list.id}`}
      className={`bg-white dark:bg-[#1E2220] border transition-all duration-200 overflow-hidden ${
        isShopping
          ? 'border-amber-300 dark:border-amber-700/80 shadow-md ring-1 ring-amber-500/20'
          : 'border-neutral-200 dark:border-neutral-800 shadow-xs hover:shadow-md'
      }`}
    >
      <CardContent className="p-0">
        {/* Cabeçalho da Lista */}
        <div
          className={`p-4 sm:p-5 border-b ${
            isShopping
              ? 'bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-amber-50/80 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30 border-amber-200 dark:border-amber-800/60'
              : 'border-neutral-100 dark:border-neutral-800/80'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h3 className="font-semibold text-base sm:text-lg text-neutral-900 dark:text-neutral-100 break-words">
                  {list.name}
                </h3>

                {/* Status Badges */}
                {isActive && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    Planejamento
                  </span>
                )}
                {isShopping && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500 text-white shadow-2xs animate-pulse">
                    <ShoppingCart className="w-3 h-3" />
                    Em Compra
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                    <CheckCircle2 className="w-3 h-3" />
                    Concluída
                  </span>
                )}
                {isArchived && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                    <Archive className="w-3 h-3" />
                    Arquivada
                  </span>
                )}
              </div>

              {/* Informações adicionais (Data, notas) */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                {list.shopping_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>Prevista: {formatDateBR(list.shopping_date)}</span>
                  </div>
                )}
                {list.completed_at && (
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Finalizada em {formatDateBR(list.completed_at.split('T')[0])}</span>
                  </div>
                )}
                {list.notes && (
                  <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
                    <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate max-w-xs">{list.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Menu de Ações Principais da Lista */}
            <div className="flex items-center gap-1.5 shrink-0 relative">
              {/* Botão DESTACADO "Iniciar Compra" em Modo Planejamento */}
              {isActive && (
                <Button
                  id={`btn-start-shopping-${list.id}`}
                  variant="default"
                  size="sm"
                  onClick={() => onStartShopping(list)}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8.5 px-3.5 rounded-xl shadow-xs font-semibold flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Iniciar compra</span>
                </Button>
              )}

              {/* Botão DESTACADO "Finalizar Compra" em Modo Compra */}
              {isShopping && (
                <Button
                  id={`btn-complete-list-${list.id}`}
                  variant="default"
                  size="sm"
                  onClick={() => onCompleteList(list)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8.5 px-3.5 rounded-xl shadow-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Finalizar compra</span>
                </Button>
              )}

              {/* Botão de Menu Dropdown */}
              <div className="relative">
                <Button
                  id={`btn-menu-list-${list.id}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMenu(!showMenu)}
                  className="h-8 w-8 p-0 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>

                {showMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1E2220] rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                    onClick={() => setShowMenu(false)}
                  >
                    {(isActive || isShopping) && (
                      <>
                        <button
                          id={`btn-add-item-modal-${list.id}`}
                          onClick={() => onOpenAddItemModal(list)}
                          className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                        >
                          <Plus className="w-3.5 h-3.5 text-orange-600" />
                          Adicionar item detalhado
                        </button>
                        <button
                          id={`btn-edit-list-${list.id}`}
                          onClick={() => onEditList(list)}
                          className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
                          Editar dados da lista
                        </button>
                        {isShopping && (
                          <button
                            id={`btn-pause-shopping-${list.id}`}
                            onClick={() => onReopenList(list)}
                            className="w-full text-left px-3 py-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Voltar ao planejamento
                          </button>
                        )}
                      </>
                    )}

                    {(isActive || isShopping || isCompleted) && (
                      <button
                        id={`btn-archive-list-${list.id}`}
                        onClick={() => onArchiveList(list)}
                        className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                      >
                        <Archive className="w-3.5 h-3.5 text-neutral-500" />
                        Arquivar lista
                      </button>
                    )}

                    {(isCompleted || isArchived) && (
                      <button
                        id={`btn-reopen-list-${list.id}`}
                        onClick={() => onReopenList(list)}
                        className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                        Reabrir no Planejamento
                      </button>
                    )}

                    <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />

                    <button
                      id={`btn-delete-list-${list.id}`}
                      onClick={() => onDeleteList(list)}
                      className="w-full text-left px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir lista
                    </button>
                  </div>
                )}
              </div>

              {/* Botão de Expandir/Recolher Itens */}
              <Button
                id={`btn-toggle-expand-${list.id}`}
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 rounded-lg text-neutral-500"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* RESUMO DE ACORDO COM O STATUS DA LISTA */}
          {isShopping ? (
            /* 1. MODO COMPRA (status === 'shopping') */
            <div className="mt-3 p-3 sm:p-4 rounded-xl bg-white dark:bg-[#1E2220] border border-amber-200 dark:border-amber-800/80 shadow-xs grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Orçamento */}
              <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Orçamento
                </span>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {budget !== null ? formatCurrency(budget) : 'Sem orçamento'}
                </p>
              </div>

              {/* Carrinho (Total Real Atual) */}
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Carrinho
                </span>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {formatCurrency(totalActual)}
                </p>
              </div>

              {/* Restante ou Acima do Orçamento */}
              <div
                className={`p-2.5 rounded-lg border col-span-2 sm:col-span-1 ${
                  budget === null
                    ? 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-100 dark:border-neutral-800'
                    : isOverBudget
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
                    : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    budget === null
                      ? 'text-neutral-500'
                      : isOverBudget
                      ? 'text-rose-700 dark:text-rose-300 flex items-center gap-1'
                      : 'text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {budget === null ? (
                    'Restante'
                  ) : isOverBudget ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      Acima do Orçamento
                    </>
                  ) : (
                    'Restante'
                  )}
                </span>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    budget === null
                      ? 'text-neutral-400 dark:text-neutral-500 text-xs font-normal'
                      : isOverBudget
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {budget === null
                    ? 'Ilimitado'
                    : isOverBudget
                    ? `${formatCurrency(budgetOverAmount!)} acima`
                    : formatCurrency(budgetRemaining!)}
                </p>
              </div>
            </div>
          ) : isCompleted || isArchived ? (
            /* 2. MODO CONCLUÍDA / HISTÓRICO (status === 'completed' || status === 'archived') */
            <div className="mt-4 pt-3.5 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Orçamento */}
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Orçamento
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {budget !== null ? formatCurrency(budget) : '—'}
                </p>
              </div>

              {/* Total Gasto */}
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Total Gasto
                </span>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {formatCurrency(totalActual)}
                </p>
              </div>

              {/* Economia / Resultado do Orçamento */}
              <div
                className={`p-2.5 rounded-xl border ${
                  budget === null
                    ? 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-100 dark:border-neutral-800'
                    : totalActual > budget
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50'
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {budget === null
                    ? 'Resultado'
                    : totalActual < budget
                    ? 'Economia'
                    : totalActual > budget
                    ? 'Resultado'
                    : 'Resultado'}
                </span>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    budget === null
                      ? 'text-neutral-400 dark:text-neutral-500 text-xs font-normal'
                      : totalActual < budget
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : totalActual > budget
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-300 text-xs font-medium'
                  }`}
                >
                  {budget === null
                    ? '—'
                    : totalActual < budget
                    ? formatCurrency(budget - totalActual)
                    : totalActual > budget
                    ? `Acima do orçamento: ${formatCurrency(totalActual - budget)}`
                    : 'Orçamento utilizado integralmente'}
                </p>
              </div>

              {/* Progresso de Itens Comprados */}
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 flex flex-col justify-center">
                <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  <span>Itens Comprados</span>
                  <span>{checkedItems}/{totalItems}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* 3. MODO PLANEJAMENTO (status === 'active') */
            <div className="mt-4 pt-3.5 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Orçamento */}
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Orçamento
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {budget !== null ? formatCurrency(budget) : '—'}
                </p>
              </div>

              {/* Total Estimado */}
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Total Estimado
                </span>
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5">
                  {formatCurrency(totalEstimated)}
                </p>
              </div>

              {/* Disponível Previsto (Orçamento - Total Estimado) */}
              <div
                className={`p-2.5 rounded-xl border ${
                  availableEstimated !== null && availableEstimated < 0
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50'
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Disponível Previsto
                </span>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    availableEstimated === null
                      ? 'text-neutral-400'
                      : availableEstimated < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {availableEstimated !== null ? formatCurrency(availableEstimated) : '—'}
                </p>
              </div>

              {/* Progresso de Itens */}
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 flex flex-col justify-center">
                <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  <span>Itens no Carrinho</span>
                  <span>{checkedItems}/{totalItems}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Corpo: Lista de Itens (Expandível) */}
        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-3">
            {/* Adicionar Item Rápido (Somente quando em Planejamento ou Compra) */}
            {(isActive || isShopping) && (
              <form onSubmit={handleQuickAdd} className="space-y-2 pb-3">
                {/* Linha 1: Nome do produto ocupando 100% da largura útil */}
                <div className="w-full">
                  <input
                    id={`input-quick-item-name-${list.id}`}
                    type="text"
                    placeholder="Nome do produto (ex: Arroz, Feijão, Leite)..."
                    value={quickItemName}
                    onChange={(e) => setQuickItemName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors placeholder:text-neutral-400"
                  />
                </div>

                {/* Linha 2: Quantidade e Botão Adicionar sempre 100% visível sem cortar */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Qtd:</span>
                    <input
                      id={`input-quick-item-qty-${list.id}`}
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="1"
                      value={quickItemQty}
                      onChange={(e) => setQuickItemQty(e.target.value)}
                      className="w-18 sm:w-20 px-2.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-xs text-center font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
                    />
                  </div>

                  <Button
                    id={`btn-quick-add-${list.id}`}
                    type="submit"
                    size="sm"
                    disabled={isAddingQuick || !quickItemName.trim()}
                    className="flex-1 sm:flex-none sm:px-4 h-9 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar produto</span>
                  </Button>
                </div>
              </form>
            )}

            {/* Banner de Aviso de Conclusão */}
            {isCompleted && (
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
                <span>Esta compra foi finalizada. Os itens estão salvos no histórico.</span>
                <button
                  id={`btn-reopen-list-inline-${list.id}`}
                  onClick={() => onReopenList(list)}
                  className="text-xs font-medium text-blue-800 dark:text-blue-200 underline hover:no-underline ml-2 shrink-0"
                >
                  Reabrir no Planejamento
                </button>
              </div>
            )}

            {/* Lista vazia de itens */}
            {list.items.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
                Nenhum item adicionado nesta lista ainda.
              </div>
            ) : (
              <div className="space-y-2.5">
                {list.items.map((item) => {
                  const hasEst =
                    item.estimated_unit_price !== null && item.estimated_unit_price !== undefined;
                  const hasAct =
                    item.actual_unit_price !== null && item.actual_unit_price !== undefined;

                  const lineTotalActual =
                    hasAct ? Math.round(item.quantity * Math.round(item.actual_unit_price! * 100)) / 100 : null;

                  return (
                    <div
                      key={item.id}
                      id={`market-item-row-${item.id}`}
                      className={`p-3 rounded-2xl transition-all ${
                        item.is_checked
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30'
                          : 'bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-900/80 border border-neutral-100 dark:border-neutral-800'
                      }`}
                    >
                      {/* Linha Superior: Checkbox + Nome Completo + Ações */}
                      <div className="flex items-start gap-2.5">
                        {/* Checkbox Otimizado para Toque no Celular (Min 40x40px) */}
                        <button
                          id={`btn-toggle-item-${item.id}`}
                          type="button"
                          onClick={() => onToggleItem(item, !item.is_checked)}
                          className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 -mt-0.5 cursor-pointer"
                          title={item.is_checked ? 'Desmarcar produto' : 'Marcar como comprado'}
                        >
                          {item.is_checked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-neutral-400 hover:text-emerald-500" />
                          )}
                        </button>

                        {/* Nome Completo do Produto (NUNCA cortado!) */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p
                            className={`text-sm font-semibold break-words leading-snug ${
                              item.is_checked
                                ? 'line-through text-neutral-400 dark:text-neutral-500'
                                : 'text-neutral-900 dark:text-neutral-100'
                            }`}
                          >
                            {item.name}
                          </p>

                          {/* Detalhes, Categoria, Preço Estimado e Notas */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {item.category && item.category !== 'Geral' && (
                              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                {item.category}
                              </span>
                            )}
                            {hasEst && (
                              <span className="text-[11px] text-neutral-400">
                                Est: {formatCurrency(item.estimated_unit_price!)}/{item.unit || 'un'}
                              </span>
                            )}
                            {item.notes && <span className="italic text-[11px]">"{item.notes}"</span>}
                          </div>
                        </div>

                        {/* Botões de Ação do Item (Editar & Excluir) */}
                        {!isCompleted && (
                          <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                            <button
                              id={`btn-edit-item-${item.id}`}
                              type="button"
                              onClick={() => onEditItem(item)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                              title="Editar item detalhado"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`btn-delete-item-${item.id}`}
                              type="button"
                              onClick={() => onDeleteItem(item)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Remover produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Linha Inferior: Quantidade, Preço Unitário e Subtotal */}
                      <div className="mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 pl-0 sm:pl-12">
                        {/* Controles de Quantidade */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Qtd:</span>
                          {(isActive || isShopping) ? (
                            <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => onUpdateItemQuantity(item, Math.max(0.5, item.quantity - 1))}
                                className="w-7 h-7 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-bold"
                                title="Diminuir quantidade"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200 min-w-[28px] text-center">
                                {item.quantity} {item.unit || 'un'}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateItemQuantity(item, item.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-bold"
                                title="Aumentar quantidade"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                              {item.quantity} {item.unit || 'un'}
                            </span>
                          )}
                        </div>

                        {/* Preço Unitário e Subtotal */}
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Preço:</span>
                            {!isCompleted ? (
                              <div className="flex items-center gap-0.5">
                                <span className="text-[10px] text-neutral-400 font-medium">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  defaultValue={hasAct ? item.actual_unit_price! : ''}
                                  key={`price-${item.id}-${item.actual_unit_price}`}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value.replace(',', '.'));
                                    if (!isNaN(val) && val >= 0) {
                                      onUpdateItemActualPrice(item, val);
                                    }
                                  }}
                                  placeholder="0,00"
                                  className="w-18 px-2 py-1 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                />
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                {hasAct ? formatCurrency(item.actual_unit_price!) : '—'}
                              </span>
                            )}
                          </div>

                          {/* Subtotal da linha */}
                          <div className="text-right">
                            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                              Subtotal: <strong className="text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">{lineTotalActual !== null && lineTotalActual > 0 ? formatCurrency(lineTotalActual) : 'R$ 0,00'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

