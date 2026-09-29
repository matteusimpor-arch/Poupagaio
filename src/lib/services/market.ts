import { supabase } from '../supabase';
import {
  ShoppingList,
  ShoppingListItem,
  ShoppingListStatus,
  ShoppingListWithItems,
  ShoppingListTotals,
  CreateShoppingListInput,
  UpdateShoppingListInput,
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
} from '../../types';
import { isTableMissingError } from './profile';

export const MARKET_UNITS = [
  'un',
  'kg',
  'g',
  'L',
  'ml',
  'pacote',
  'caixa',
  'lata',
  'garrafa',
  'dúzia',
] as const;

export const MARKET_CATEGORIES = [
  'Geral',
  'Hortifruti',
  'Açougue & Peixaria',
  'Padaria & Confeitaria',
  'Laticínios & Frios',
  'Mercearia & Despensa',
  'Bebidas',
  'Limpeza',
  'Higiene & Beleza',
  'Congelados',
  'Pet Shop',
  'Outros',
] as const;

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calcula os totais de uma lista de compras utilizando aritmética em centavos inteiros
 * para evitar qualquer imprecisão com ponto flutuante.
 */
export function calculateListTotals(items: ShoppingListItem[]): ShoppingListTotals {
  let totalEstimatedCents = 0;
  let totalActualCents = 0;
  let checkedItems = 0;

  for (const it of items) {
    if (it.is_checked) {
      checkedItems++;
    }
    const qty = Number(it.quantity) || 0;
    if (qty > 0) {
      if (it.estimated_unit_price !== null && it.estimated_unit_price !== undefined) {
        const estUnitCents = Math.round(Number(it.estimated_unit_price) * 100);
        totalEstimatedCents += Math.round(qty * estUnitCents);
      }
      if (it.actual_unit_price !== null && it.actual_unit_price !== undefined) {
        const actUnitCents = Math.round(Number(it.actual_unit_price) * 100);
        totalActualCents += Math.round(qty * actUnitCents);
      }
    }
  }

  return {
    totalEstimated: totalEstimatedCents / 100,
    totalActual: totalActualCents / 100,
    totalItems: items.length,
    checkedItems,
  };
}

export const marketService = {
  /**
   * Obtém todas as listas de compras e seus itens em um espaço.
   * Utiliza exatamente 2 queries consolidadas (listas + itens) com agrupamento em memória,
   * garantindo ausência total de N+1 queries.
   */
  async getShoppingLists(
    spaceId: string,
    options?: {
      filterStatus?: 'all' | ShoppingListStatus;
    }
  ): Promise<{
    lists: ShoppingListWithItems[];
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return {
        lists: [],
        isTableMissing: false,
        error: 'Conexão Supabase não inicializada.',
      };
    }

    if (!spaceId) {
      return {
        lists: [],
        isTableMissing: false,
      };
    }

    try {
      // Query 1: Busca listas do espaço ordenadas por data de compra / criação
      let listsQuery = supabase
        .from('shopping_lists')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });

      if (options?.filterStatus && options.filterStatus !== 'all') {
        listsQuery = listsQuery.eq('status', options.filterStatus);
      }

      const { data: listsData, error: listsError } = await listsQuery;

      if (listsError) {
        if (isTableMissingError(listsError)) {
          return { lists: [], isTableMissing: true };
        }
        console.error('Erro ao carregar listas de compras:', listsError);
        return {
          lists: [],
          isTableMissing: false,
          error: listsError.message || 'Erro ao carregar listas de compras.',
        };
      }

      const rawLists: ShoppingList[] = (listsData || []).map((l) => ({
        id: l.id,
        space_id: l.space_id,
        created_by: l.created_by,
        name: l.name,
        shopping_date: l.shopping_date || null,
        budget_amount:
          l.budget_amount !== null && l.budget_amount !== undefined
            ? Number(l.budget_amount)
            : null,
        status: (l.status as ShoppingListStatus) || 'active',
        notes: l.notes || null,
        completed_at: l.completed_at || null,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }));

      if (rawLists.length === 0) {
        return { lists: [], isTableMissing: false };
      }

      // Query 2: Busca todos os itens das listas do espaço em uma única query
      const { data: itemsData, error: itemsError } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true });

      if (itemsError) {
        if (isTableMissingError(itemsError)) {
          return { lists: [], isTableMissing: true };
        }
        console.error('Erro ao carregar itens de mercado:', itemsError);
        return {
          lists: [],
          isTableMissing: false,
          error: itemsError.message || 'Erro ao carregar itens da lista de compras.',
        };
      }

      // Agrupamento em memória dos itens por lista (O(N) limpo, sem N+1)
      const itemsByListId = new Map<string, ShoppingListItem[]>();
      for (const raw of itemsData || []) {
        const item: ShoppingListItem = {
          id: raw.id,
          shopping_list_id: raw.shopping_list_id,
          space_id: raw.space_id,
          created_by: raw.created_by,
          name: raw.name,
          quantity: Number(raw.quantity) || 1,
          unit: raw.unit || 'un',
          estimated_unit_price:
            raw.estimated_unit_price !== null && raw.estimated_unit_price !== undefined
              ? Number(raw.estimated_unit_price)
              : null,
          actual_unit_price:
            raw.actual_unit_price !== null && raw.actual_unit_price !== undefined
              ? Number(raw.actual_unit_price)
              : null,
          is_checked: Boolean(raw.is_checked),
          category: raw.category || 'Geral',
          notes: raw.notes || null,
          created_at: raw.created_at,
          updated_at: raw.updated_at,
        };

        const existing = itemsByListId.get(item.shopping_list_id) || [];
        existing.push(item);
        itemsByListId.set(item.shopping_list_id, existing);
      }

      const listsWithItems: ShoppingListWithItems[] = rawLists.map((list) => {
        const listItems = itemsByListId.get(list.id) || [];
        return {
          ...list,
          items: listItems,
          totals: calculateListTotals(listItems),
        };
      });

      return {
        lists: listsWithItems,
        isTableMissing: false,
      };
    } catch (err: any) {
      console.error('Falha inesperada no serviço de mercado:', err);
      return {
        lists: [],
        isTableMissing: false,
        error: err.message || 'Erro inesperado ao consultar módulo Mercado.',
      };
    }
  },

  /**
   * Cria uma nova lista de compras no espaço.
   * Garante autoria com created_by = auth.uid().
   */
  async createShoppingList(input: CreateShoppingListInput): Promise<{
    list?: ShoppingListWithItems;
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
      return { isTableMissing: false, error: 'O nome da lista é obrigatório.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        return { isTableMissing: false, error: 'Sessão expirada. Faça login novamente.' };
      }

      const payload = {
        space_id: input.space_id,
        created_by: user.id,
        name: trimmedName,
        shopping_date: input.shopping_date ? input.shopping_date.trim() : null,
        budget_amount:
          input.budget_amount !== undefined && input.budget_amount !== null
            ? Number(input.budget_amount)
            : null,
        status: 'active',
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('shopping_lists')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) return { isTableMissing: true };
        return { isTableMissing: false, error: error.message };
      }

      const createdList: ShoppingListWithItems = {
        id: data.id,
        space_id: data.space_id,
        created_by: data.created_by,
        name: data.name,
        shopping_date: data.shopping_date || null,
        budget_amount:
          data.budget_amount !== null && data.budget_amount !== undefined
            ? Number(data.budget_amount)
            : null,
        status: data.status,
        notes: data.notes || null,
        completed_at: data.completed_at || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: [],
        totals: {
          totalEstimated: 0,
          totalActual: 0,
          totalItems: 0,
          checkedItems: 0,
        },
      };

      return { list: createdList, isTableMissing: false };
    } catch (err: any) {
      return { isTableMissing: false, error: err.message || 'Erro ao criar lista.' };
    }
  },

  /**
   * Atualiza dados de uma lista de compras existente com restrição estrita por space_id.
   */
  async updateShoppingList(
    id: string,
    spaceId: string,
    input: UpdateShoppingListInput
  ): Promise<{
    list?: ShoppingList;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }
    if (!id || !spaceId) {
      return { isTableMissing: false, error: 'Identificador ou espaço ausente.' };
    }

    try {
      const payload: Record<string, any> = {};
      if (input.name !== undefined) {
        const trimmed = input.name.trim();
        if (!trimmed) return { isTableMissing: false, error: 'O nome da lista não pode ser vazio.' };
        payload.name = trimmed;
      }
      if (input.shopping_date !== undefined) {
        payload.shopping_date = input.shopping_date ? input.shopping_date.trim() : null;
      }
      if (input.budget_amount !== undefined) {
        payload.budget_amount =
          input.budget_amount !== null && !isNaN(Number(input.budget_amount))
            ? Number(input.budget_amount)
            : null;
      }
      if (input.notes !== undefined) {
        payload.notes = input.notes ? input.notes.trim() : null;
      }
      if (input.status !== undefined) {
        payload.status = input.status;
      }
      if (input.completed_at !== undefined) {
        payload.completed_at = input.completed_at;
      }

      const { data, error } = await supabase
        .from('shopping_lists')
        .update(payload)
        .eq('id', id)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) return { isTableMissing: true };
        return { isTableMissing: false, error: error.message };
      }

      return { list: data, isTableMissing: false };
    } catch (err: any) {
      return { isTableMissing: false, error: err.message || 'Erro ao atualizar lista.' };
    }
  },

  /**
   * Inicia a compra (muda status para 'shopping').
   * Não apaga itens nem zera preços estimados nem altera valores financeiros.
   */
  async startShoppingList(
    id: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string; isTableMissing: boolean }> {
    return this.updateShoppingList(id, spaceId, {
      status: 'shopping',
    }).then((res) => ({
      success: !res.error && !res.isTableMissing,
      error: res.error,
      isTableMissing: res.isTableMissing,
    }));
  },

  /**
   * Finaliza uma compra.
   * Altera o status para 'completed' e registra completed_at.
   * NÃO cria movimentações financeiras, despesas nem altera saldo.
   */
  async completeShoppingList(
    id: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string; isTableMissing: boolean }> {
    return this.updateShoppingList(id, spaceId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).then((res) => ({
      success: !res.error && !res.isTableMissing,
      error: res.error,
      isTableMissing: res.isTableMissing,
    }));
  },

  /**
   * Reabre uma compra finalizada/arquivada para o estado ativo.
   */
  async reopenShoppingList(
    id: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string; isTableMissing: boolean }> {
    return this.updateShoppingList(id, spaceId, {
      status: 'active',
      completed_at: null,
    }).then((res) => ({
      success: !res.error && !res.isTableMissing,
      error: res.error,
      isTableMissing: res.isTableMissing,
    }));
  },

  /**
   * Arquiva uma lista de compras.
   */
  async archiveShoppingList(
    id: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string; isTableMissing: boolean }> {
    return this.updateShoppingList(id, spaceId, {
      status: 'archived',
    }).then((res) => ({
      success: !res.error && !res.isTableMissing,
      error: res.error,
      isTableMissing: res.isTableMissing,
    }));
  },

  /**
   * Exclui uma lista de compras e seus itens (ON DELETE CASCADE pelo banco e filtro de spaceId).
   */
  async deleteShoppingList(
    id: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string; isTableMissing: boolean }> {
    if (!supabase) {
      return { success: false, isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }
    if (!id || !spaceId) {
      return { success: false, isTableMissing: false, error: 'Identificadores ausentes.' };
    }

    try {
      const { error } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', id)
        .eq('space_id', spaceId);

      if (error) {
        if (isTableMissingError(error)) return { success: false, isTableMissing: true };
        return { success: false, isTableMissing: false, error: error.message };
      }

      return { success: true, isTableMissing: false };
    } catch (err: any) {
      return { success: false, isTableMissing: false, error: err.message || 'Erro ao excluir lista.' };
    }
  },

  /**
   * Adiciona um item a uma lista de compras com integridade estrita (shopping_list_id + space_id).
   */
  async createShoppingListItem(input: CreateShoppingListItemInput): Promise<{
    item?: ShoppingListItem;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }
    if (!input.space_id || !input.shopping_list_id) {
      return { isTableMissing: false, error: 'Identificador da lista ou espaço ausente.' };
    }
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return { isTableMissing: false, error: 'O nome do produto é obrigatório.' };
    }
    const qty = Number(input.quantity);
    if (isNaN(qty) || qty <= 0) {
      return { isTableMissing: false, error: 'A quantidade deve ser maior que zero.' };
    }

    const estimatedPrice =
      input.estimated_unit_price !== undefined &&
      input.estimated_unit_price !== null &&
      !isNaN(Number(input.estimated_unit_price))
        ? roundMoney(Math.max(0, Number(input.estimated_unit_price)))
        : null;

    const actualPrice =
      input.actual_unit_price !== undefined &&
      input.actual_unit_price !== null &&
      !isNaN(Number(input.actual_unit_price))
        ? roundMoney(Math.max(0, Number(input.actual_unit_price)))
        : null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        return { isTableMissing: false, error: 'Sessão expirada. Faça login novamente.' };
      }

      const payload = {
        shopping_list_id: input.shopping_list_id,
        space_id: input.space_id,
        created_by: user.id,
        name: trimmedName,
        quantity: qty,
        unit: input.unit?.trim() || 'un',
        estimated_unit_price: estimatedPrice,
        actual_unit_price: actualPrice,
        is_checked: Boolean(input.is_checked),
        category: input.category?.trim() || 'Geral',
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('shopping_list_items')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) return { isTableMissing: true };
        return { isTableMissing: false, error: error.message };
      }

      const createdItem: ShoppingListItem = {
        id: data.id,
        shopping_list_id: data.shopping_list_id,
        space_id: data.space_id,
        created_by: data.created_by,
        name: data.name,
        quantity: Number(data.quantity) || 1,
        unit: data.unit || 'un',
        estimated_unit_price:
          data.estimated_unit_price !== null && data.estimated_unit_price !== undefined
            ? Number(data.estimated_unit_price)
            : null,
        actual_unit_price:
          data.actual_unit_price !== null && data.actual_unit_price !== undefined
            ? Number(data.actual_unit_price)
            : null,
        is_checked: Boolean(data.is_checked),
        category: data.category || 'Geral',
        notes: data.notes || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      return { item: createdItem, isTableMissing: false };
    } catch (err: any) {
      return { isTableMissing: false, error: err.message || 'Erro ao adicionar item.' };
    }
  },

  /**
   * Atualiza um item com restrição estrita de id, shopping_list_id e space_id.
   */
  async updateShoppingListItem(
    id: string,
    listId: string,
    spaceId: string,
    input: UpdateShoppingListItemInput
  ): Promise<{
    item?: ShoppingListItem;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }
    if (!id || !listId || !spaceId) {
      return { isTableMissing: false, error: 'Identificadores ausentes.' };
    }

    try {
      const payload: Record<string, any> = {};
      if (input.name !== undefined) {
        const trimmed = input.name.trim();
        if (!trimmed) return { isTableMissing: false, error: 'O nome do produto não pode ser vazio.' };
        payload.name = trimmed;
      }
      if (input.quantity !== undefined) {
        const qty = Number(input.quantity);
        if (isNaN(qty) || qty <= 0) return { isTableMissing: false, error: 'Quantidade inválida.' };
        payload.quantity = qty;
      }
      if (input.unit !== undefined) {
        payload.unit = input.unit ? input.unit.trim() : 'un';
      }
      if (input.estimated_unit_price !== undefined) {
        payload.estimated_unit_price =
          input.estimated_unit_price !== null && !isNaN(Number(input.estimated_unit_price))
            ? roundMoney(Math.max(0, Number(input.estimated_unit_price)))
            : null;
      }
      if (input.actual_unit_price !== undefined) {
        payload.actual_unit_price =
          input.actual_unit_price !== null && !isNaN(Number(input.actual_unit_price))
            ? roundMoney(Math.max(0, Number(input.actual_unit_price)))
            : null;
      }
      if (input.is_checked !== undefined) {
        payload.is_checked = Boolean(input.is_checked);
      }
      if (input.category !== undefined) {
        payload.category = input.category ? input.category.trim() : 'Geral';
      }
      if (input.notes !== undefined) {
        payload.notes = input.notes ? input.notes.trim() : null;
      }

      const { data, error } = await supabase
        .from('shopping_list_items')
        .update(payload)
        .eq('id', id)
        .eq('shopping_list_id', listId)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) return { isTableMissing: true };
        return { isTableMissing: false, error: error.message };
      }

      const updatedItem: ShoppingListItem = {
        id: data.id,
        shopping_list_id: data.shopping_list_id,
        space_id: data.space_id,
        created_by: data.created_by,
        name: data.name,
        quantity: Number(data.quantity) || 1,
        unit: data.unit || 'un',
        estimated_unit_price:
          data.estimated_unit_price !== null && data.estimated_unit_price !== undefined
            ? Number(data.estimated_unit_price)
            : null,
        actual_unit_price:
          data.actual_unit_price !== null && data.actual_unit_price !== undefined
            ? Number(data.actual_unit_price)
            : null,
        is_checked: Boolean(data.is_checked),
        category: data.category || 'Geral',
        notes: data.notes || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      return { item: updatedItem, isTableMissing: false };
    } catch (err: any) {
      return { isTableMissing: false, error: err.message || 'Erro ao atualizar item.' };
    }
  },

  /**
   * Alterna rapidamente o estado de comprado de um item (ideal para mobile).
   */
  async toggleItemChecked(
    id: string,
    listId: string,
    spaceId: string,
    isChecked: boolean
  ): Promise<{ success: boolean; error?: string; isTableMissing: boolean }> {
    return this.updateShoppingListItem(id, listId, spaceId, {
      is_checked: isChecked,
    }).then((res) => ({
      success: !res.error && !res.isTableMissing,
      error: res.error,
      isTableMissing: res.isTableMissing,
    }));
  },

  /**
   * Exclui um item da lista de compras.
   */
  async deleteShoppingListItem(
    id: string,
    listId: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string; isTableMissing: boolean }> {
    if (!supabase) {
      return { success: false, isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }
    if (!id || !listId || !spaceId) {
      return { success: false, isTableMissing: false, error: 'Identificadores ausentes.' };
    }

    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('id', id)
        .eq('shopping_list_id', listId)
        .eq('space_id', spaceId);

      if (error) {
        if (isTableMissingError(error)) return { success: false, isTableMissing: true };
        return { success: false, isTableMissing: false, error: error.message };
      }

      return { success: true, isTableMissing: false };
    } catch (err: any) {
      return { success: false, isTableMissing: false, error: err.message || 'Erro ao excluir item.' };
    }
  },
};
