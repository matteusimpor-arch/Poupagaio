import { supabase } from '../supabase';
import {
  VariableExpense,
  VariableExpenseStatus,
  CreateVariableExpenseInput,
  UpdateVariableExpenseInput,
  VariableExpensesSummary,
} from '../../types';
import { isTableMissingError } from './profile';

const emptySummary: VariableExpensesSummary = {
  totalMonth: 0,
  totalPaid: 0,
  totalPending: 0,
  count: 0,
  paidCount: 0,
  pendingCount: 0,
};

export const variableExpensesService = {
  /**
   * Busca os gastos variáveis para o mês e ano especificados
   */
  async getVariableExpensesByMonth(
    spaceId: string,
    year: number,
    month: number
  ): Promise<{
    expenses: VariableExpense[];
    summary: VariableExpensesSummary;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { expenses: [], summary: emptySummary, isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }

    if (!spaceId) {
      return { expenses: [], summary: emptySummary, isTableMissing: false };
    }

    // Calcula range de datas do mês
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const { data, error } = await supabase
        .from('variable_expenses')
        .select('*')
        .eq('space_id', spaceId)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          return { expenses: [], summary: emptySummary, isTableMissing: true };
        }
        console.warn('Aviso ao buscar variable_expenses:', error.message || error);
        return { expenses: [], summary: emptySummary, isTableMissing: false, error: 'Erro ao carregar os gastos variáveis.' };
      }

      const expenses: VariableExpense[] = data || [];

      let totalMonth = 0;
      let totalPaid = 0;
      let totalPending = 0;
      let paidCount = 0;
      let pendingCount = 0;

      for (const item of expenses) {
        const amt = Number(item.amount) || 0;
        totalMonth += amt;
        if (item.status === 'paid') {
          totalPaid += amt;
          paidCount++;
        } else {
          totalPending += amt;
          pendingCount++;
        }
      }

      return {
        expenses,
        summary: {
          totalMonth,
          totalPaid,
          totalPending,
          count: expenses.length,
          paidCount,
          pendingCount,
        },
        isTableMissing: false,
      };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { expenses: [], summary: emptySummary, isTableMissing: true };
      }
      console.warn('getVariableExpensesByMonth exception:', err?.message || err);
      return { expenses: [], summary: emptySummary, isTableMissing: false, error: 'Erro de conexão ao carregar gastos variáveis.' };
    }
  },

  /**
   * Resumo rápido do mês para uso pelo Dashboard
   */
  async getMonthSummary(
    spaceId: string,
    year: number,
    month: number
  ): Promise<VariableExpensesSummary> {
    const res = await this.getVariableExpensesByMonth(spaceId, year, month);
    return res.summary;
  },

  /**
   * Cadastra um novo gasto variável
   */
  async createVariableExpense(
    userId: string,
    input: CreateVariableExpenseInput
  ): Promise<{ expense: VariableExpense | null; error?: string; isTableMissing?: boolean }> {
    if (!supabase) {
      return { expense: null, error: 'Conexão Supabase não inicializada.' };
    }

    const desc = input.description.trim();
    if (!desc) return { expense: null, error: 'A descrição do gasto é obrigatória.' };

    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { expense: null, error: 'O valor deve ser maior que zero.' };
    }

    if (!input.date) {
      return { expense: null, error: 'A data do gasto é obrigatória.' };
    }

    if (!input.space_id) {
      return { expense: null, error: 'Espaço financeiro não selecionado.' };
    }

    try {
      const now = new Date().toISOString();
      const payload = {
        space_id: input.space_id,
        created_by: userId || null,
        description: desc,
        amount: Math.round(amount * 100) / 100,
        date: input.date,
        category: input.category?.trim() || 'Outros',
        status: input.status || 'pending',
        notes: input.notes?.trim() || null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('variable_expenses')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          return { expense: null, isTableMissing: true, error: 'A tabela de gastos variáveis ainda não foi criada no Supabase.' };
        }
        console.warn('Aviso ao cadastrar gasto variável:', error.message || error);
        return { expense: null, error: 'Não foi possível cadastrar o gasto variável. Tente novamente.' };
      }

      return { expense: data as VariableExpense };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { expense: null, isTableMissing: true, error: 'A tabela de gastos variáveis ainda não foi criada no Supabase.' };
      }
      return { expense: null, error: 'Não foi possível salvar este gasto. Tente novamente.' };
    }
  },

  /**
   * Atualiza um gasto variável existente
   */
  async updateVariableExpense(
    id: string,
    input: UpdateVariableExpenseInput
  ): Promise<{ expense: VariableExpense | null; error?: string }> {
    if (!supabase) {
      return { expense: null, error: 'Conexão Supabase não inicializada.' };
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.description !== undefined) {
      const desc = input.description.trim();
      if (!desc) return { expense: null, error: 'A descrição é obrigatória.' };
      payload.description = desc;
    }

    if (input.amount !== undefined) {
      const amount = Number(input.amount);
      if (isNaN(amount) || amount <= 0) return { expense: null, error: 'O valor deve ser maior que zero.' };
      payload.amount = Math.round(amount * 100) / 100;
    }

    if (input.date !== undefined) {
      if (!input.date) return { expense: null, error: 'A data é obrigatória.' };
      payload.date = input.date;
    }

    if (input.category !== undefined) payload.category = input.category.trim() || 'Outros';
    if (input.status !== undefined) payload.status = input.status;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;

    try {
      const { data, error } = await supabase
        .from('variable_expenses')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.warn('Aviso ao atualizar gasto variável:', error.message || error);
        return { expense: null, error: 'Não foi possível salvar as alterações.' };
      }

      return { expense: data as VariableExpense };
    } catch (err: any) {
      return { expense: null, error: 'Erro ao atualizar gasto variável. Tente novamente.' };
    }
  },

  /**
   * Alterna o status (pago / pendente) do gasto variável
   */
  async toggleStatus(
    id: string,
    currentStatus: VariableExpenseStatus
  ): Promise<{ expense: VariableExpense | null; error?: string }> {
    const newStatus: VariableExpenseStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    return this.updateVariableExpense(id, { status: newStatus });
  },

  /**
   * Exclui um gasto variável
   */
  async deleteVariableExpense(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    try {
      const { error } = await supabase
        .from('variable_expenses')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Aviso ao excluir gasto variável:', error.message || error);
        return { success: false, error: 'Não foi possível excluir o gasto variável.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Erro ao excluir gasto variável. Tente novamente.' };
    }
  },
};
