import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  ShoppingListWithItems,
  ShoppingListItem,
  ShoppingListStatus,
  CreateShoppingListInput,
  UpdateShoppingListInput,
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
} from '../../types';
import { marketService } from '../../lib/services/market';
import { MARKET_MIGRATION_SQL } from '../../lib/market-sql';
import { formatCurrency } from '../../lib/formatters';
import { MarketListCard } from './MarketListCard';
import { MarketListModal } from './MarketListModal';
import { MarketItemModal } from './MarketItemModal';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import {
  ShoppingBag,
  Plus,
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  Trash2,
  Calendar,
  DollarSign,
  ShoppingCart,
  Archive,
} from 'lucide-react';

export function MarketScreen() {
  const { currentSpace } = useAuth();

  // Estados principais
  const [lists, setLists] = useState<ShoppingListWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [userFriendlyError, setUserFriendlyError] = useState<string | null>(null);

  // Filtro de status: 'active' | 'shopping' | 'completed' | 'archived' | 'all'
  const [statusFilter, setStatusFilter] = useState<ShoppingListStatus | 'all'>('active');

  // Modais de Lista
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<ShoppingListWithItems | null>(null);
  const [listToDelete, setListToDelete] = useState<ShoppingListWithItems | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);

  // Modais de Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [targetListForNewItem, setTargetListForNewItem] = useState<ShoppingListWithItems | null>(null);
  const [itemToEdit, setItemToEdit] = useState<ShoppingListItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ShoppingListItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Modal de Finalizar Compra
  const [listToComplete, setListToComplete] = useState<ShoppingListWithItems | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Copiar SQL caso tabela não exista
  const [copiedSql, setCopiedSql] = useState(false);

  // Carregar listas e itens
  const loadMarketData = useCallback(async () => {
    if (!currentSpace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setUserFriendlyError(null);

    try {
      const res = await marketService.getShoppingLists(currentSpace.id, {
        filterStatus: statusFilter,
      });

      if (res.isTableMissing) {
        setIsTableMissing(true);
        setLists([]);
      } else if (res.error) {
        setUserFriendlyError(res.error);
      } else {
        setIsTableMissing(false);
        setLists(res.lists);
      }
    } catch {
      setUserFriendlyError('Não foi possível carregar as listas de compras no momento.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, statusFilter]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  // Salvar Lista de Compras (Criar ou Atualizar)
  const handleSaveList = async (
    input: CreateShoppingListInput | UpdateShoppingListInput
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentSpace?.id) return { success: false, error: 'Espaço não selecionado.' };

    if (listToEdit) {
      const res = await marketService.updateShoppingList(listToEdit.id, currentSpace.id, input);
      if (res.list) {
        await loadMarketData();
        return { success: true };
      }
      return { success: false, error: res.error };
    } else {
      const res = await marketService.createShoppingList(input as CreateShoppingListInput);
      if (res.list) {
        await loadMarketData();
        return { success: true };
      }
      return { success: false, error: res.error };
    }
  };

  // Excluir Lista
  const handleConfirmDeleteList = async () => {
    if (!listToDelete || !currentSpace?.id) return;
    setIsDeletingList(true);
    try {
      const res = await marketService.deleteShoppingList(listToDelete.id, currentSpace.id);
      if (res.success) {
        setListToDelete(null);
        await loadMarketData();
      } else if (res.error) {
        setUserFriendlyError(res.error);
      }
    } catch {
      setUserFriendlyError('Falha ao excluir a lista de compras.');
    } finally {
      setIsDeletingList(false);
    }
  };

  // Arquivar Lista
  const handleArchiveList = async (list: ShoppingListWithItems) => {
    if (!currentSpace?.id) return;
    try {
      const res = await marketService.archiveShoppingList(list.id, currentSpace.id);
      if (res.success) {
        await loadMarketData();
      } else if (res.error) {
        setUserFriendlyError(res.error);
      }
    } catch {
      setUserFriendlyError('Falha ao arquivar lista.');
    }
  };

  // Reabrir Lista (ou Voltar ao Planejamento)
  const handleReopenList = async (list: ShoppingListWithItems) => {
    if (!currentSpace?.id) return;
    try {
      const res = await marketService.reopenShoppingList(list.id, currentSpace.id);
      if (res.success) {
        await loadMarketData();
      } else if (res.error) {
        setUserFriendlyError(res.error);
      }
    } catch {
      setUserFriendlyError('Falha ao reabrir lista.');
    }
  };

  // Iniciar Compra no Mercado
  const handleStartShopping = async (list: ShoppingListWithItems) => {
    if (!currentSpace?.id) return;
    try {
      const res = await marketService.startShoppingList(list.id, currentSpace.id);
      if (res.success) {
        setStatusFilter('shopping'); // Alterna para aba "Em Compra" para foco imediato
        await loadMarketData();
      } else if (res.error) {
        setUserFriendlyError(res.error);
      }
    } catch {
      setUserFriendlyError('Falha ao iniciar compra.');
    }
  };

  // Atualizar Quantidade de um Item
  const handleUpdateItemQuantity = async (item: ShoppingListItem, newQty: number) => {
    if (!currentSpace?.id || newQty <= 0) return;
    try {
      const res = await marketService.updateShoppingListItem(
        item.id,
        item.shopping_list_id,
        currentSpace.id,
        { quantity: newQty }
      );
      if (res.item) {
        await loadMarketData();
      }
    } catch {
      await loadMarketData();
    }
  };

  // Finalizar Compra
  const handleConfirmComplete = async () => {
    if (!listToComplete || !currentSpace?.id) return;
    setIsCompleting(true);
    try {
      const res = await marketService.completeShoppingList(listToComplete.id, currentSpace.id);
      if (res.success) {
        setListToComplete(null);
        await loadMarketData();
      } else if (res.error) {
        setUserFriendlyError(res.error);
      }
    } catch {
      setUserFriendlyError('Falha ao finalizar compra.');
    } finally {
      setIsCompleting(false);
    }
  };

  // Salvar Item (Criar ou Atualizar)
  const handleSaveItem = async (
    input: CreateShoppingListItemInput | UpdateShoppingListItemInput
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentSpace?.id) return { success: false, error: 'Espaço não selecionado.' };

    if (itemToEdit) {
      const res = await marketService.updateShoppingListItem(
        itemToEdit.id,
        itemToEdit.shopping_list_id,
        currentSpace.id,
        input
      );
      if (res.item) {
        await loadMarketData();
        return { success: true };
      }
      return { success: false, error: res.error };
    } else {
      const res = await marketService.createShoppingListItem(input as CreateShoppingListItemInput);
      if (res.item) {
        await loadMarketData();
        return { success: true };
      }
      return { success: false, error: res.error };
    }
  };

  // Adição rápida de item (inline no card)
  const handleQuickAddItem = async (input: CreateShoppingListItemInput) => {
    const res = await marketService.createShoppingListItem(input);
    if (res.item) {
      await loadMarketData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Alternar checkbox de item
  const handleToggleItem = async (item: ShoppingListItem, isChecked: boolean) => {
    if (!currentSpace?.id) return;
    // Otimização de estado local imediata para sensação instantânea no mobile
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== item.shopping_list_id) return l;
        const updatedItems = l.items.map((it) =>
          it.id === item.id ? { ...it, is_checked: isChecked } : it
        );
        return {
          ...l,
          items: updatedItems,
          totals: {
            ...l.totals,
            checkedItems: updatedItems.filter((i) => i.is_checked).length,
          },
        };
      })
    );

    try {
      const res = await marketService.toggleItemChecked(
        item.id,
        item.shopping_list_id,
        currentSpace.id,
        isChecked
      );
      if (!res.success) {
        await loadMarketData();
      }
    } catch {
      await loadMarketData();
    }
  };

  // Atualizar Preço Real Unitário de um item
  const handleUpdateItemActualPrice = async (item: ShoppingListItem, newPrice: number) => {
    if (!currentSpace?.id) return;
    try {
      const res = await marketService.updateShoppingListItem(
        item.id,
        item.shopping_list_id,
        currentSpace.id,
        { actual_unit_price: newPrice }
      );
      if (res.item) {
        await loadMarketData();
      }
    } catch {
      await loadMarketData();
    }
  };

  // Excluir Item
  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete || !currentSpace?.id) return;
    setIsDeletingItem(true);
    try {
      const res = await marketService.deleteShoppingListItem(
        itemToDelete.id,
        itemToDelete.shopping_list_id,
        currentSpace.id
      );
      if (res.success) {
        setItemToDelete(null);
        await loadMarketData();
      } else if (res.error) {
        setUserFriendlyError(res.error);
      }
    } catch {
      setUserFriendlyError('Falha ao remover item.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Copiar SQL de migration
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(MARKET_MIGRATION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (err) {
      console.error('Falha ao copiar SQL:', err);
    }
  };

  // Totais agregados das listas visíveis
  const aggregatedTotals = lists.reduce(
    (acc, l) => ({
      totalEst: acc.totalEst + l.totals.totalEstimated,
      totalAct: acc.totalAct + l.totals.totalActual,
      totalItems: acc.totalItems + l.totals.totalItems,
      checkedItems: acc.checkedItems + l.totals.checkedItems,
    }),
    { totalEst: 0, totalAct: 0, totalItems: 0, checkedItems: 0 }
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-4">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-2xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-display">
                Mercado
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Planeje suas compras e acompanhe o que vai para o carrinho.
              </p>
            </div>
          </div>
        </div>

        <Button
          id="btn-new-market-list"
          onClick={() => {
            setListToEdit(null);
            setIsListModalOpen(true);
          }}
          className="h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova lista
        </Button>
      </div>

      {/* Banner de Aviso de Tabela Ausente (Se a migration não foi executada) */}
      {isTableMissing && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Tabelas de Mercado ainda não criadas</h3>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                A migration SQL da Etapa 3.6 (Mercado) precisa ser executada no Supabase para
                habilitar listas e itens de compras.
              </p>
            </div>
          </div>
          <div className="pt-1">
            <Button
              id="btn-copy-market-migration"
              variant="outline"
              size="sm"
              onClick={handleCopySql}
              className="bg-white dark:bg-neutral-900 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-xs h-8 px-3 rounded-xl flex items-center gap-1.5"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  SQL Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar script SQL de Mercado
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Mensagem de Erro Amigável */}
      {userFriendlyError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{userFriendlyError}</span>
          </div>
          <button
            onClick={() => setUserFriendlyError(null)}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Filtros de Status (Abas Simplificadas) */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 w-full sm:w-fit">
        <button
          id="tab-market-active"
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-white dark:bg-[#1E2220] text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          Planejamento
        </button>
        <button
          id="tab-market-shopping"
          type="button"
          onClick={() => setStatusFilter('shopping')}
          className={`flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
            statusFilter === 'shopping'
              ? 'bg-amber-500 text-white shadow-2xs font-semibold'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
          Em Compra
        </button>
        <button
          id="tab-market-completed"
          type="button"
          onClick={() => setStatusFilter('completed')}
          className={`flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
            statusFilter === 'completed'
              ? 'bg-white dark:bg-[#1E2220] text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          Concluídas
        </button>
        <button
          id="tab-market-archived"
          type="button"
          onClick={() => setStatusFilter('archived')}
          className={`flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
            statusFilter === 'archived'
              ? 'bg-white dark:bg-[#1E2220] text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          Arquivadas
        </button>
        <button
          id="tab-market-all"
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-white dark:bg-[#1E2220] text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          Todas
        </button>
      </div>

      {/* Visão de Listas */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : lists.length === 0 ? (
        /* Estado Vazio */
        <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Sua lista de mercado está vazia.
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Crie uma lista para organizar sua próxima compra.
            </p>
          </div>
          <Button
            id="btn-empty-create-market-list"
            onClick={() => {
              setListToEdit(null);
              setIsListModalOpen(true);
            }}
            className="mt-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium px-4 h-9 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Criar primeira lista
          </Button>
        </div>
      ) : (
        /* Listas de Mercado */
        <div className="space-y-4">
          {lists.map((list) => (
            <MarketListCard
              key={list.id}
              list={list}
              onToggleItem={handleToggleItem}
              onQuickAddItem={handleQuickAddItem}
              onOpenAddItemModal={(l) => {
                setTargetListForNewItem(l);
                setItemToEdit(null);
                setIsItemModalOpen(true);
              }}
              onEditItem={(item) => {
                const parent = lists.find((l) => l.id === item.shopping_list_id);
                if (parent) setTargetListForNewItem(parent);
                setItemToEdit(item);
                setIsItemModalOpen(true);
              }}
              onDeleteItem={(item) => setItemToDelete(item)}
              onEditList={(l) => {
                setListToEdit(l);
                setIsListModalOpen(true);
              }}
              onDeleteList={(l) => setListToDelete(l)}
              onArchiveList={handleArchiveList}
              onReopenList={handleReopenList}
              onStartShopping={handleStartShopping}
              onCompleteList={(l) => setListToComplete(l)}
              onUpdateItemActualPrice={handleUpdateItemActualPrice}
              onUpdateItemQuantity={handleUpdateItemQuantity}
            />
          ))}
        </div>
      )}

      {/* Modal de Lista (Criar/Editar) */}
      {currentSpace?.id && (
        <MarketListModal
          isOpen={isListModalOpen}
          onClose={() => {
            setIsListModalOpen(false);
            setListToEdit(null);
          }}
          onSave={handleSaveList}
          listToEdit={listToEdit}
          spaceId={currentSpace.id}
        />
      )}

      {/* Modal de Item (Criar/Editar Detalhado) */}
      {currentSpace?.id && targetListForNewItem && (
        <MarketItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false);
            setItemToEdit(null);
            setTargetListForNewItem(null);
          }}
          onSave={handleSaveItem}
          itemToEdit={itemToEdit}
          listId={targetListForNewItem.id}
          spaceId={currentSpace.id}
        />
      )}

      {/* Modal de Confirmação para Finalizar Compra */}
      {listToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1E2220] rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                  Finalizar compra?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  "{listToComplete.name}"
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              A lista será movida para o histórico com os itens e valores registrados.
              <br />
              <strong className="text-neutral-900 dark:text-neutral-100 font-medium">
                Esta ação NÃO gera lançamentos financeiros nem altera seu saldo.
              </strong>
            </p>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 text-xs space-y-1">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Itens Comprados:</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {listToComplete.totals.checkedItems} de {listToComplete.totals.totalItems}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Total Real:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(listToComplete.totals.totalActual)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                id="btn-cancel-complete"
                variant="outline"
                size="sm"
                onClick={() => setListToComplete(null)}
                disabled={isCompleting}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                id="btn-confirm-complete"
                size="sm"
                onClick={handleConfirmComplete}
                disabled={isCompleting}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {isCompleting ? 'Finalizando...' : 'Confirmar e Finalizar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Excluir Lista */}
      {listToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1E2220] rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                  Excluir Lista?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  "{listToDelete.name}"
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Tem certeza que deseja excluir esta lista e todos os seus itens? Esta ação não pode
              ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                id="btn-cancel-delete-list"
                variant="outline"
                size="sm"
                onClick={() => setListToDelete(null)}
                disabled={isDeletingList}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                id="btn-confirm-delete-list"
                size="sm"
                variant="destructive"
                onClick={handleConfirmDeleteList}
                disabled={isDeletingList}
                className="rounded-xl text-xs"
              >
                {isDeletingList ? 'Excluindo...' : 'Excluir Lista'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Excluir Item */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1E2220] rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                  Remover Item?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  "{itemToDelete.name}"
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Deseja remover este produto da lista de compras?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                id="btn-cancel-delete-item"
                variant="outline"
                size="sm"
                onClick={() => setItemToDelete(null)}
                disabled={isDeletingItem}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                id="btn-confirm-delete-item"
                size="sm"
                variant="destructive"
                onClick={handleConfirmDeleteItem}
                disabled={isDeletingItem}
                className="rounded-xl text-xs"
              >
                {isDeletingItem ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
