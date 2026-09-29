import { supabase } from '../supabase';
import { Entry, EntryStatus, CreateEntryInput, UpdateEntryInput, EntriesSummary } from '../../types';
import { isTableMissingError } from './profile';
import { getMonthDateRange } from '../formatters';

export interface GetEntriesResult {
  entries: Entry[];
  summary: EntriesSummary;
  isTableMissing: boolean;
  error?: string;
}

export const entriesService = {
  /**
   * Verifica se a tabela 'entries' já foi criada no Supabase
   */
  async checkTableExists(): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('entries').select('id').limit(1);
      if (error && isTableMissingError(error)) {
        return false;
      }
      return !error || error.code === 'PGRST116';
    } catch {
      return false;
    }
  },

  /**
   * Busca todas as entradas de um espaço para o mês e ano selecionados
   */
  async getEntriesByMonth(
    spaceId: string,
    year: number,
    month: number
  ): Promise<GetEntriesResult> {
    const emptySummary: EntriesSummary = {
      totalPlanned: 0,
      totalReceived: 0,
      totalPending: 0,
      count: 0,
    };

    if (!supabase) {
      return { entries: [], summary: emptySummary, isTableMissing: false, error: 'Supabase não inicializado.' };
    }

    if (!spaceId) {
      return { entries: [], summary: emptySummary, isTableMissing: false };
    }

    try {
      // Processa baixas automáticas pendentes no servidor para este espaço se a RPC estiver disponível
      await this.processSpaceAutoReceive(spaceId).catch(() => {});

      const { startDate, endDate } = getMonthDateRange(year, month);

      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('space_id', spaceId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          return { entries: [], summary: emptySummary, isTableMissing: true };
        }
        console.warn('Erro ao consultar entradas no Supabase:', error.message || error);
        return {
          entries: [],
          summary: emptySummary,
          isTableMissing: false,
          error: 'Não foi possível carregar as entradas. Tente novamente.',
        };
      }

      const entries = (data as Entry[]) || [];

      // Cálculo dos totais
      let totalPlanned = 0;
      let totalReceived = 0;
      let totalPending = 0;

      for (const entry of entries) {
        const amount = Number(entry.amount) || 0;
        totalPlanned += amount;
        if (entry.status === 'received') {
          totalReceived += amount;
        } else {
          totalPending += amount;
        }
      }

      return {
        entries,
        summary: {
          totalPlanned,
          totalReceived,
          totalPending,
          count: entries.length,
        },
        isTableMissing: false,
      };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { entries: [], summary: emptySummary, isTableMissing: true };
      }
      console.error('getEntriesByMonth exception:', err?.message || err);
      return {
        entries: [],
        summary: emptySummary,
        isTableMissing: false,
        error: 'Erro de conexão ao carregar as entradas.',
      };
    }
  },

  /**
   * Cadastra uma nova entrada no Supabase
   */
  async createEntry(
    userId: string,
    input: CreateEntryInput
  ): Promise<{ entry: Entry | null; error?: string; isTableMissing?: boolean }> {
    if (!supabase) {
      return { entry: null, error: 'Conexão com o banco não inicializada.' };
    }

    // Validações
    const desc = input.description.trim();
    if (!desc) {
      return { entry: null, error: 'A descrição da entrada é obrigatória.' };
    }

    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { entry: null, error: 'O valor da entrada deve ser maior que zero.' };
    }

    if (!input.date) {
      return { entry: null, error: 'A data da entrada é obrigatória.' };
    }

    if (!input.space_id) {
      return { entry: null, error: 'Espaço não identificado para a entrada.' };
    }

    try {
      const now = new Date().toISOString();
      const payload: Record<string, any> = {
        space_id: input.space_id,
        created_by: userId || null,
        description: desc,
        amount: Math.round(amount * 100) / 100, // duas casas decimais
        date: input.date,
        category: input.category?.trim() || 'Outros',
        status: input.status || 'pending',
        notes: input.notes?.trim() || null,
        auto_receive: Boolean(input.auto_receive),
        created_at: now,
        updated_at: now,
      };

      let { data, error } = await supabase
        .from('entries')
        .insert(payload)
        .select('*')
        .single();

      if (error && (error.code === '42703' || error.message?.includes('auto_receive'))) {
        console.warn('Aviso: coluna auto_receive pendente de migração no Supabase. Inserindo sem este campo.');
        delete payload.auto_receive;
        const retry = await supabase.from('entries').insert(payload).select('*').single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (isTableMissingError(error)) {
          return { entry: null, isTableMissing: true, error: 'A tabela de entradas ainda não foi criada no Supabase.' };
        }
        console.error('Erro ao inserir entrada:', error.message || error);
        return { entry: null, error: 'Não foi possível adicionar a entrada. Tente novamente.' };
      }

      return { entry: data as Entry };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { entry: null, isTableMissing: true, error: 'A tabela de entradas ainda não foi criada no Supabase.' };
      }
      console.error('createEntry exception:', err?.message || err);
      return { entry: null, error: 'Não foi possível adicionar a entrada. Tente novamente.' };
    }
  },

  /**
   * Atualiza os dados de uma entrada existente
   */
  async updateEntry(
    entryId: string,
    input: UpdateEntryInput
  ): Promise<{ entry: Entry | null; error?: string }> {
    if (!supabase) {
      return { entry: null, error: 'Conexão com o banco não inicializada.' };
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.description !== undefined) {
      const desc = input.description.trim();
      if (!desc) return { entry: null, error: 'A descrição da entrada é obrigatória.' };
      updatePayload.description = desc;
    }

    if (input.amount !== undefined) {
      const amount = Number(input.amount);
      if (isNaN(amount) || amount <= 0) {
        return { entry: null, error: 'O valor da entrada deve ser maior que zero.' };
      }
      updatePayload.amount = Math.round(amount * 100) / 100;
    }

    if (input.date !== undefined) {
      if (!input.date) return { entry: null, error: 'A data é obrigatória.' };
      updatePayload.date = input.date;
    }

    if (input.category !== undefined) {
      updatePayload.category = input.category.trim() || 'Outros';
    }

    if (input.status !== undefined) {
      updatePayload.status = input.status;
    }

    if (input.notes !== undefined) {
      updatePayload.notes = input.notes?.trim() || null;
    }

    if (input.auto_receive !== undefined) {
      updatePayload.auto_receive = Boolean(input.auto_receive);
    }

    try {
      let { data, error } = await supabase
        .from('entries')
        .update(updatePayload)
        .eq('id', entryId)
        .select('*')
        .single();

      if (error && (error.code === '42703' || error.message?.includes('auto_receive'))) {
        console.warn('Aviso: coluna auto_receive pendente de migração no Supabase. Atualizando sem este campo.');
        delete updatePayload.auto_receive;
        const retry = await supabase
          .from('entries')
          .update(updatePayload)
          .eq('id', entryId)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.warn('Erro ao atualizar entrada:', error.message || error);
        return { entry: null, error: 'Não foi possível salvar as alterações. Tente novamente.' };
      }

      return { entry: data as Entry };
    } catch (err: any) {
      console.warn('updateEntry exception:', err?.message || err);
      return { entry: null, error: 'Não foi possível salvar as alterações. Tente novamente.' };
    }
  },

  /**
   * Alterna o status da entrada entre 'pending' e 'received'
   * Se disableAutoReceive for true, desativa o auto_receive para não reprocessar entradas vencidas
   */
  async toggleStatus(
    entryId: string,
    currentStatus: EntryStatus,
    disableAutoReceive: boolean = false
  ): Promise<{ entry: Entry | null; error?: string }> {
    const nextStatus: EntryStatus = currentStatus === 'received' ? 'pending' : 'received';
    const payload: UpdateEntryInput = { status: nextStatus };
    if (nextStatus === 'pending' && disableAutoReceive) {
      payload.auto_receive = false;
    }
    return this.updateEntry(entryId, payload);
  },

  /**
   * Executa a RPC server-side autoritativa para dar baixa automática nas entradas do espaço cuja data chegou
   */
  async processSpaceAutoReceive(spaceId: string): Promise<number> {
    if (!supabase || !spaceId) return 0;
    try {
      const { data, error } = await supabase.rpc('fn_process_space_auto_receive_entries', {
        p_space_id: spaceId,
      });
      if (error) {
        // Silencioso se RPC ainda não foi instalada no Supabase
        return 0;
      }
      return Number(data) || 0;
    } catch {
      return 0;
    }
  },

  /**
   * Exclui uma entrada do Supabase
   */
  async deleteEntry(entryId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Conexão com o banco não inicializada.' };
    }

    try {
      const { error } = await supabase.from('entries').delete().eq('id', entryId);

      if (error) {
        console.warn('Erro ao excluir entrada:', error.message || error);
        return { success: false, error: 'Não foi possível excluir a entrada. Tente novamente.' };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('deleteEntry exception:', err?.message || err);
      return { success: false, error: 'Não foi possível excluir a entrada. Tente novamente.' };
    }
  },

  /**
   * Busca resumo rápido para exibição no Dashboard
   */
  async getMonthSummary(
    spaceId: string,
    year: number,
    month: number
  ): Promise<EntriesSummary> {
    const res = await this.getEntriesByMonth(spaceId, year, month);
    return res.summary;
  },
};
