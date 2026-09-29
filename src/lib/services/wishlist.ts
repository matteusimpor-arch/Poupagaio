import { supabase } from '../supabase';
import {
  WishlistItem,
  WishlistSummary,
  WishlistStatus,
  WishlistPriority,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
} from '../../types';
import { isTableMissingError } from './profile';

export const emptyWishlistSummary: WishlistSummary = {
  activeCount: 0,
  totalEstimatedAmount: 0,
  highPriorityCount: 0,
  purchasedCount: 0,
  archivedCount: 0,
  totalCount: 0,
};

export const WISHLIST_CATEGORIES = [
  'Geral',
  'Tecnologia',
  'Eletrônicos',
  'Casa & Móveis',
  'Viagem',
  'Educação',
  'Vestuário',
  'Lazer & Hobbies',
  'Veículo',
  'Saúde & Bem-estar',
] as const;

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export const wishlistService = {
  /**
   * Obtém os itens da lista de desejos de um espaço e calcula o resumo consolidado em memória.
   * Executa exatamente 1 query para carregar os dados do espaço, sem qualquer consulta N+1.
   */
  async getWishlistItems(
    spaceId: string,
    options?: {
      filterStatus?: 'all' | 'active' | 'purchased' | 'archived';
      filterPriority?: 'all' | 'low' | 'medium' | 'high';
    }
  ): Promise<{
    items: WishlistItem[];
    summary: WishlistSummary;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return {
        items: [],
        summary: emptyWishlistSummary,
        isTableMissing: false,
        error: 'Conexão Supabase não inicializada.',
      };
    }

    if (!spaceId) {
      return {
        items: [],
        summary: emptyWishlistSummary,
        isTableMissing: false,
      };
    }

    try {
      // 1. Busca todos os itens do espaço em ordem cronológica decrescente
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          return {
            items: [],
            summary: emptyWishlistSummary,
            isTableMissing: true,
          };
        }
        console.error('Erro ao carregar itens da lista de desejos:', error);
        return {
          items: [],
          summary: emptyWishlistSummary,
          isTableMissing: false,
          error: error.message || 'Erro ao carregar lista de desejos.',
        };
      }

      const allItems: WishlistItem[] = (data || []).map((raw) => ({
        id: raw.id,
        space_id: raw.space_id,
        created_by: raw.created_by,
        name: raw.name,
        estimated_amount: Number(raw.estimated_amount) || 0,
        category: raw.category || 'Geral',
        priority: (raw.priority as WishlistPriority) || 'medium',
        desired_date: raw.desired_date || null,
        status: (raw.status as WishlistStatus) || 'active',
        notes: raw.notes || null,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
      }));

      // 2. Calcula resumo em centavos inteiros considerando apenas itens ativos para o montante financeiro
      let activeCents = 0;
      let activeCount = 0;
      let highPriorityCount = 0;
      let purchasedCount = 0;
      let archivedCount = 0;

      for (const item of allItems) {
        if (item.status === 'active') {
          activeCount++;
          activeCents += Math.round(item.estimated_amount * 100);
          if (item.priority === 'high') {
            highPriorityCount++;
          }
        } else if (item.status === 'purchased') {
          purchasedCount++;
        } else if (item.status === 'archived') {
          archivedCount++;
        }
      }

      const summary: WishlistSummary = {
        activeCount,
        totalEstimatedAmount: activeCents / 100,
        highPriorityCount,
        purchasedCount,
        archivedCount,
        totalCount: allItems.length,
      };

      // 3. Aplicação de filtros em memória para renderização
      let filteredItems = allItems;

      if (options?.filterStatus && options.filterStatus !== 'all') {
        filteredItems = filteredItems.filter((i) => i.status === options.filterStatus);
      }

      if (options?.filterPriority && options.filterPriority !== 'all') {
        filteredItems = filteredItems.filter((i) => i.priority === options.filterPriority);
      }

      return {
        items: filteredItems,
        summary,
        isTableMissing: false,
      };
    } catch (err: any) {
      console.error('Falha inesperada no serviço de lista de desejos:', err);
      return {
        items: [],
        summary: emptyWishlistSummary,
        isTableMissing: false,
        error: err.message || 'Erro inesperado ao consultar lista de desejos.',
      };
    }
  },

  /**
   * Cria um novo item na lista de desejos.
   * Injeta space_id e garante created_by = auth.uid().
   */
  async createWishlistItem(input: CreateWishlistItemInput): Promise<{
    item?: WishlistItem;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }

    if (!input.space_id) {
      return { isTableMissing: false, error: 'Identificador do espaço ausente.' };
    }

    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return { isTableMissing: false, error: 'O nome do desejo é obrigatório.' };
    }

    const estimatedAmount = Number(input.estimated_amount);
    if (isNaN(estimatedAmount) || estimatedAmount <= 0) {
      return { isTableMissing: false, error: 'O valor estimado deve ser maior que zero.' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        return { isTableMissing: false, error: 'Sessão do usuário expirada. Faça login novamente.' };
      }

      const payload = {
        space_id: input.space_id,
        created_by: user.id,
        name: trimmedName,
        estimated_amount: roundMoney(estimatedAmount),
        category: input.category?.trim() || 'Geral',
        priority: input.priority || 'medium',
        desired_date: input.desired_date ? input.desired_date.trim() : null,
        status: input.status || 'active',
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('wishlist_items')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          return { isTableMissing: true };
        }
        return { isTableMissing: false, error: error.message };
      }

      return {
        item: {
          ...data,
          estimated_amount: Number(data.estimated_amount) || 0,
        },
        isTableMissing: false,
      };
    } catch (err: any) {
      return { isTableMissing: false, error: err.message || 'Erro ao criar desejo.' };
    }
  },

  /**
   * Atualiza os dados de um item existente.
   * Não altera created_by e protege com space_id no filtro.
   */
  async updateWishlistItem(
    id: string,
    spaceId: string,
    input: UpdateWishlistItemInput
  ): Promise<{
    item?: WishlistItem;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }

    if (!id || !spaceId) {
      return { isTableMissing: false, error: 'Parâmetros de identificação inválidos.' };
    }

    const updatePayload: Record<string, any> = {};

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) {
        return { isTableMissing: false, error: 'O nome do desejo não pode ficar vazio.' };
      }
      updatePayload.name = trimmed;
    }

    if (input.estimated_amount !== undefined) {
      const num = Number(input.estimated_amount);
      if (isNaN(num) || num <= 0) {
        return { isTableMissing: false, error: 'O valor estimado deve ser maior que zero.' };
      }
      updatePayload.estimated_amount = roundMoney(num);
    }

    if (input.category !== undefined) {
      updatePayload.category = input.category.trim() || 'Geral';
    }

    if (input.priority !== undefined) {
      updatePayload.priority = input.priority;
    }

    if (input.desired_date !== undefined) {
      updatePayload.desired_date = input.desired_date ? input.desired_date.trim() : null;
    }

    if (input.status !== undefined) {
      updatePayload.status = input.status;
    }

    if (input.notes !== undefined) {
      updatePayload.notes = input.notes ? input.notes.trim() : null;
    }

    try {
      const { data, error } = await supabase
        .from('wishlist_items')
        .update(updatePayload)
        .eq('id', id)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          return { isTableMissing: true };
        }
        return { isTableMissing: false, error: error.message };
      }

      return {
        item: {
          ...data,
          estimated_amount: Number(data.estimated_amount) || 0,
        },
        isTableMissing: false,
      };
    } catch (err: any) {
      return { isTableMissing: false, error: err.message || 'Erro ao atualizar desejo.' };
    }
  },

  /**
   * Altera diretamente o status de um item (active | purchased | archived).
   * Não efetua lançamentos financeiros, movimentações de conta ou parcelamentos.
   */
  async updateWishlistStatus(
    id: string,
    spaceId: string,
    status: WishlistStatus
  ): Promise<{
    success: boolean;
    isTableMissing: boolean;
    error?: string;
  }> {
    return this.updateWishlistItem(id, spaceId, { status }).then((res) => ({
      success: !!res.item,
      isTableMissing: res.isTableMissing,
      error: res.error,
    }));
  },

  /**
   * Exclui um item da lista de desejos de forma definitiva.
   * Não afeta nenhum lançamento financeiro existente.
   */
  async deleteWishlistItem(
    id: string,
    spaceId: string
  ): Promise<{
    success: boolean;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { success: false, isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }

    if (!id || !spaceId) {
      return { success: false, isTableMissing: false, error: 'Parâmetros de identificação inválidos.' };
    }

    try {
      const { error } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('id', id)
        .eq('space_id', spaceId);

      if (error) {
        if (isTableMissingError(error)) {
          return { success: false, isTableMissing: true };
        }
        return { success: false, isTableMissing: false, error: error.message };
      }

      return { success: true, isTableMissing: false };
    } catch (err: any) {
      return { success: false, isTableMissing: false, error: err.message || 'Erro ao excluir desejo.' };
    }
  },
};
