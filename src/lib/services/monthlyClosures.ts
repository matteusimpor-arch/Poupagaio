import { supabase } from '../supabase';
import {
  MonthlyClosure,
  MonthlyClosureSummary,
  CloseMonthInput,
} from '../../types';
import { isTableMissingError } from './profile';
import { entriesService } from './entries';
import { fixedExpensesService } from './fixedExpenses';
import { variableExpensesService } from './variableExpenses';
import { installmentsService } from './installments';

export const emptyClosureSummary: MonthlyClosureSummary = {
  total_income: 0,
  total_fixed_expenses: 0,
  total_variable_expenses: 0,
  total_installments: 0,
  total_expenses: 0,
  final_balance: 0,
};

export const monthlyClosuresService = {
  /**
   * Verifica se a tabela 'monthly_closures' já foi criada no Supabase
   */
  async checkTableExists(): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('monthly_closures').select('id').limit(1);
      if (error && isTableMissingError(error)) {
        return false;
      }
      return !error || error.code === 'PGRST116';
    } catch {
      return false;
    }
  },

  /**
   * Busca o registro de fechamento de uma competência específica (YYYY-MM)
   */
  async getClosureByCycle(
    spaceId: string,
    billingCycle: string
  ): Promise<{
    closure: MonthlyClosure | null;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { closure: null, isTableMissing: false, error: 'Supabase não inicializado.' };
    }

    if (!spaceId || !billingCycle) {
      return { closure: null, isTableMissing: false };
    }

    try {
      const { data, error } = await supabase
        .from('monthly_closures')
        .select('*')
        .eq('space_id', spaceId)
        .eq('billing_cycle', billingCycle)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          return { closure: null, isTableMissing: true };
        }
        console.warn('Erro ao verificar fechamento do mês:', error.message || error);
        return { closure: null, isTableMissing: false, error: 'Erro ao consultar o fechamento.' };
      }

      return { closure: (data as MonthlyClosure) || null, isTableMissing: false };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { closure: null, isTableMissing: true };
      }
      return { closure: null, isTableMissing: false, error: 'Falha inesperada ao consultar fechamento.' };
    }
  },

  /**
   * Obtém o histórico de todos os fechamentos efetuados no espaço (ordenado do mais recente)
   */
  async getMonthlyClosuresHistory(
    spaceId: string
  ): Promise<{
    closures: MonthlyClosure[];
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { closures: [], isTableMissing: false, error: 'Supabase não inicializado.' };
    }

    if (!spaceId) {
      return { closures: [], isTableMissing: false };
    }

    try {
      const { data, error } = await supabase
        .from('monthly_closures')
        .select('*')
        .eq('space_id', spaceId)
        .order('billing_cycle', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          return { closures: [], isTableMissing: true };
        }
        console.warn('Erro ao consultar histórico de fechamentos:', error.message || error);
        return { closures: [], isTableMissing: false, error: 'Erro ao carregar o histórico de fechamentos.' };
      }

      return { closures: (data as MonthlyClosure[]) || [], isTableMissing: false };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { closures: [], isTableMissing: true };
      }
      return { closures: [], isTableMissing: false, error: 'Falha inesperada ao carregar histórico.' };
    }
  },

  /**
   * Calcula ao vivo o resumo da competência reutilizando os serviços existentes
   * sem duplicar regras de cálculo
   */
  async calculateMonthSummary(
    spaceId: string,
    year: number,
    month: number
  ): Promise<MonthlyClosureSummary> {
    if (!spaceId) return emptyClosureSummary;

    try {
      const [entriesRes, fixedRes, variableRes, installmentsRes] = await Promise.allSettled([
        entriesService.getMonthSummary(spaceId, year, month),
        fixedExpensesService.getMonthSummary(spaceId, year, month),
        variableExpensesService.getMonthSummary(spaceId, year, month),
        installmentsService.getMonthSummary(spaceId, year, month),
      ]);

      const totalIncome = entriesRes.status === 'fulfilled' ? entriesRes.value.totalPlanned : 0;
      const totalFixed = fixedRes.status === 'fulfilled' ? fixedRes.value.totalMonth : 0;
      const totalVariable = variableRes.status === 'fulfilled' ? variableRes.value.totalMonth : 0;
      const totalInstallments = installmentsRes.status === 'fulfilled' ? installmentsRes.value.totalMonth : 0;

      const totalExpenses = Number((totalFixed + totalVariable + totalInstallments).toFixed(2));
      const finalBalance = Number((totalIncome - totalExpenses).toFixed(2));

      return {
        total_income: Number(totalIncome.toFixed(2)),
        total_fixed_expenses: Number(totalFixed.toFixed(2)),
        total_variable_expenses: Number(totalVariable.toFixed(2)),
        total_installments: Number(totalInstallments.toFixed(2)),
        total_expenses: totalExpenses,
        final_balance: finalBalance,
      };
    } catch {
      return emptyClosureSummary;
    }
  },

  /**
   * Efetua o fechamento do mês de forma atômica utilizando a RPC autoritativa fn_close_month.
   * Não envia valores financeiros do cliente; a RPC calcula tudo diretamente do banco.
   */
  async closeMonth(
    input: CloseMonthInput
  ): Promise<{
    success: boolean;
    closure?: MonthlyClosure;
    error?: string;
    isTableMissing?: boolean;
  }> {
    if (!supabase) {
      return { success: false, error: 'Supabase não inicializado.' };
    }

    if (!input.space_id || !input.billing_cycle) {
      return { success: false, error: 'Identificador do espaço e competência são obrigatórios.' };
    }

    // Validação de formato YYYY-MM
    if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(input.billing_cycle)) {
      return { success: false, error: 'Competência inválida. Use o formato YYYY-MM.' };
    }

    try {
      // 1. Executa exclusivamente via RPC fn_close_month (Server-Authoritative)
      const { data: rpcData, error: rpcError } = await supabase.rpc('fn_close_month', {
        p_space_id: input.space_id,
        p_billing_cycle: input.billing_cycle,
      });

      if (!rpcError && rpcData) {
        return { success: true, closure: rpcData as MonthlyClosure };
      }

      if (rpcError) {
        if (isTableMissingError(rpcError)) {
          return { success: false, isTableMissing: true, error: 'Tabela ou RPC de fechamento não foi instalada no Supabase.' };
        }
        if (rpcError.message?.includes('já se encontra fechada') || rpcError.code === '23505') {
          return { success: false, error: 'Esta competência já foi encerrada para este espaço.' };
        }
        return { success: false, error: rpcError.message || 'Falha na execução do fechamento no servidor.' };
      }

      return { success: false, error: 'Erro desconhecido ao fechar competência.' };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { success: false, isTableMissing: true, error: 'Tabela de fechamentos não encontrada.' };
      }
      return { success: false, error: err?.message || 'Falha ao processar o fechamento do mês.' };
    }
  },

  /**
   * Reabre o mês excluindo exclusivamente o snapshot de fechamento correspondente em monthly_closures.
   * Não altera nem exclui nenhuma entrada ou despesa financeira.
   */
  async reopenMonth(
    closureId: string,
    spaceId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { success: false, error: 'Supabase não inicializado.' };
    }

    if (!closureId || !spaceId) {
      return { success: false, error: 'Identificador do fechamento e do espaço são obrigatórios.' };
    }

    try {
      const { error } = await supabase
        .from('monthly_closures')
        .delete()
        .eq('id', closureId)
        .eq('space_id', spaceId);

      if (error) {
        console.warn('Erro ao reabrir mês (excluir fechamento):', error.message || error);
        return { success: false, error: error.message || 'Erro ao reabrir competência no banco.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao reabrir a competência.' };
    }
  },
};
