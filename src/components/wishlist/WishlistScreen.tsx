import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  WishlistItem,
  WishlistSummary,
  WishlistStatus,
  WishlistPriority,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
} from '../../types';
import { wishlistService, emptyWishlistSummary } from '../../lib/services/wishlist';
import { formatCurrency } from '../../lib/formatters';
import { WishlistCard } from './WishlistCard';
import { WishlistModal } from './WishlistModal';
import { DeleteWishlistConfirmModal } from './DeleteWishlistConfirmModal';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { WISHLIST_MIGRATION_SQL } from '../../lib/wishlist-sql';
import {
  Gift,
  Plus,
  Coins,
  AlertTriangle,
  AlertCircle,
  Database,
  Copy,
  Check,
  Filter,
} from 'lucide-react';

export function WishlistScreen() {
  const { currentSpace } = useAuth();

  // Filtros
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'purchased' | 'archived'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Dados
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [summary, setSummary] = useState<WishlistSummary>(emptyWishlistSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [userFriendlyError, setUserFriendlyError] = useState<string | null>(null);

  // Modais
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<WishlistItem | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WishlistItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copiar SQL caso tabela não exista
  const [copiedSql, setCopiedSql] = useState(false);

  // Carregar dados da lista de desejos
  const loadWishlistData = useCallback(async () => {
    if (!currentSpace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setUserFriendlyError(null);

    try {
      const res = await wishlistService.getWishlistItems(currentSpace.id, {
        filterStatus: statusFilter,
        filterPriority: priorityFilter,
      });

      if (res.isTableMissing) {
        setIsTableMissing(true);
        setItems([]);
        setSummary(emptyWishlistSummary);
      } else if (res.error) {
        setUserFriendlyError(res.error);
      } else {
        setIsTableMissing(false);
        setItems(res.items);
        setSummary(res.summary);
      }
    } catch {
      setUserFriendlyError('Não foi possível carregar a lista de desejos no momento.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, statusFilter, priorityFilter]);

  useEffect(() => {
    loadWishlistData();
  }, [loadWishlistData]);

  // Salvar Desejo (Criar ou Atualizar)
  const handleSaveWishlistItem = async (
    input: CreateWishlistItemInput | UpdateWishlistItemInput
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentSpace?.id) return { success: false, error: 'Espaço não selecionado.' };

    if (itemToEdit) {
      const res = await wishlistService.updateWishlistItem(itemToEdit.id, currentSpace.id, input);
      if (res.item) {
        await loadWishlistData();
        return { success: true };
      }
      return { success: false, error: res.error };
    } else {
      const res = await wishlistService.createWishlistItem(input as CreateWishlistItemInput);
      if (res.item) {
        await loadWishlistData();
        return { success: true };
      }
      return { success: false, error: res.error };
    }
  };

  // Alteração rápida de status (Marcar como comprado, arquivar, reativar)
  const handleUpdateStatus = async (item: WishlistItem, newStatus: WishlistStatus) => {
    if (!currentSpace?.id) return;
    try {
      const res = await wishlistService.updateWishlistStatus(item.id, currentSpace.id, newStatus);
      if (res.success) {
        await loadWishlistData();
      } else if (res.error) {
        setUserFriendlyError(res.error);
      }
    } catch {
      setUserFriendlyError('Falha ao atualizar o status do desejo.');
    }
  };

  // Excluir Desejo
  const handleConfirmDelete = async () => {
    if (!itemToDelete || !currentSpace?.id) return;

    setIsDeleting(true);
    try {
      const res = await wishlistService.deleteWishlistItem(itemToDelete.id, currentSpace.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
        await loadWishlistData();
      } else {
        setUserFriendlyError(res.error || 'Erro ao excluir desejo.');
      }
    } catch {
      setUserFriendlyError('Falha ao excluir o desejo.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copiar SQL de migration
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(WISHLIST_MIGRATION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      {/* 1. Header com Título e Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E2E8E4] dark:border-[#2E3532]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5] tracking-tight">
              Lista de desejos
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
            Guarde aqui o que você quer conquistar depois.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setItemToEdit(null);
              setIsWishlistModalOpen(true);
            }}
            className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-3.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Novo desejo</span>
          </Button>
        </div>
      </div>

      {/* 2. Aviso de Tabela Não Criada no Supabase (se aplicável) */}
      {isTableMissing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-4 h-4" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 font-display">
                Tabela da Lista de Desejos aguardando criação no Supabase
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                O arquivo de migração <code className="px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/60 font-mono text-[11px]">20260918_create_wishlist.sql</code> foi preparado. Execute o script no SQL Editor do seu Supabase para ativar este módulo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopySql}
              className="gap-1.5 text-xs cursor-pointer border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'SQL copiado!' : 'Copiar SQL de migração'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadWishlistData}
              className="text-xs cursor-pointer"
            >
              Recarregar após executar
            </Button>
          </div>
        </div>
      )}

      {/* Erro amigável */}
      {userFriendlyError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{userFriendlyError}</span>
        </div>
      )}

      {/* 3. Cards de Resumo Compacto com Dados Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Desejos Ativos */}
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B]">
                Desejos ativos
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#F3F4F4] dark:bg-[#232725] text-[#5E6963] dark:text-[#95A39B] flex items-center justify-center">
                <Gift className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
              {isLoading ? <Skeleton className="h-7 w-16" /> : summary.activeCount}
            </div>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              {summary.totalCount} {summary.totalCount === 1 ? 'item no total' : 'itens no total'}
            </p>
          </CardContent>
        </Card>

        {/* Valor Estimado (Apenas itens ativos) */}
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B]">
                Valor estimado
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#F3F4F4] dark:bg-[#232725] text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Coins className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5] truncate">
              {isLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                formatCurrency(summary.totalEstimatedAmount)
              )}
            </div>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              Considera apenas desejos ativos
            </p>
          </CardContent>
        </Card>

        {/* Alta Prioridade */}
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B]">
                Alta prioridade
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
              {isLoading ? <Skeleton className="h-7 w-16" /> : summary.highPriorityCount}
            </div>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              Desejos prioritários em aberto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Filtros Limpos e Compactos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        {/* Filtro por Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-[#202724] text-white dark:bg-[#F4F4F5] dark:text-[#181B1A]'
                : 'bg-white dark:bg-[#1E2220] text-[#5E6963] dark:text-[#95A39B] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#E2E8E4] dark:border-[#2E3532]'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'active'
                ? 'bg-[#202724] text-white dark:bg-[#F4F4F5] dark:text-[#181B1A]'
                : 'bg-white dark:bg-[#1E2220] text-[#5E6963] dark:text-[#95A39B] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#E2E8E4] dark:border-[#2E3532]'
            }`}
          >
            Ativos ({summary.activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('purchased')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'purchased'
                ? 'bg-[#202724] text-white dark:bg-[#F4F4F5] dark:text-[#181B1A]'
                : 'bg-white dark:bg-[#1E2220] text-[#5E6963] dark:text-[#95A39B] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#E2E8E4] dark:border-[#2E3532]'
            }`}
          >
            Comprados ({summary.purchasedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('archived')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'archived'
                ? 'bg-[#202724] text-white dark:bg-[#F4F4F5] dark:text-[#181B1A]'
                : 'bg-white dark:bg-[#1E2220] text-[#5E6963] dark:text-[#95A39B] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[#E2E8E4] dark:border-[#2E3532]'
            }`}
          >
            Arquivados ({summary.archivedCount})
          </button>
        </div>

        {/* Filtro por Prioridade */}
        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Prioridade:
          </span>
          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as 'all' | 'low' | 'medium' | 'high')
            }
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] text-[#181B1A] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
          >
            <option value="all">Todas</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
      </div>

      {/* 5. Lista de Desejos / Estado Vazio */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220]">
          <CardContent className="p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Gift className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="font-bold text-base text-[#181B1A] dark:text-white">
                Sua lista de desejos está vazia.
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Quando algo entrar nos seus planos, guarde aqui.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setItemToEdit(null);
                setIsWishlistModalOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-4 mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar primeiro desejo</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onEdit={(it) => {
                setItemToEdit(it);
                setIsWishlistModalOpen(true);
              }}
              onUpdateStatus={handleUpdateStatus}
              onDelete={(it) => {
                setItemToDelete(it);
                setIsDeleteModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Modal de Criação / Edição de Desejo */}
      {currentSpace?.id && (
        <WishlistModal
          isOpen={isWishlistModalOpen}
          onClose={() => {
            setIsWishlistModalOpen(false);
            setItemToEdit(null);
          }}
          onSave={handleSaveWishlistItem}
          itemToEdit={itemToEdit}
          spaceId={currentSpace.id}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      <DeleteWishlistConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        item={itemToDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
