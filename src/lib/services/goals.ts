import { supabase } from '../supabase';
import {
  Goal,
  GoalContribution,
  GoalWithProgress,
  GoalsSummary,
  CreateGoalInput,
  UpdateGoalInput,
  CreateGoalContributionInput,
} from '../../types';
import { isTableMissingError } from './profile';
import { reservesService } from './reserves';

export const emptyGoalsSummary: GoalsSummary = {
  totalTarget: 0,
  totalAccumulated: 0,
  totalRemaining: 0,
  goalsCount: 0,
  activeCount: 0,
  completedCount: 0,
  pausedCount: 0,
};

export const GOAL_CATEGORIES = [
  'Reserva de emergência',
  'Viagem',
  'Imóvel',
  'Veículo',
  'Educação',
  'Tecnologia',
  'Reforma',
  'Aposentadoria',
  'Outros',
] as const;

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export const goalsService = {
  /**
   * Obtém as metas com o cálculo de progresso derivado exclusivamente do histórico de aportes.
   * Evita consultas N+1 buscando metas e aportes em consultas consolidadas para o espaço.
   */
  async getGoalsWithProgress(
    spaceId: string,
    options?: {
      filterStatus?: 'all' | 'active' | 'completed' | 'paused';
    }
  ): Promise<{
    goals: GoalWithProgress[];
    summary: GoalsSummary;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return {
        goals: [],
        summary: emptyGoalsSummary,
        isTableMissing: false,
        error: 'Conexão Supabase não inicializada.',
      };
    }

    if (!spaceId) {
      return {
        goals: [],
        summary: emptyGoalsSummary,
        isTableMissing: false,
      };
    }

    try {
      // 1. Busca todas as metas do espaço
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });

      if (goalsError) {
        if (isTableMissingError(goalsError)) {
          return {
            goals: [],
            summary: emptyGoalsSummary,
            isTableMissing: true,
          };
        }
        console.warn('Aviso ao buscar goals:', goalsError.message || goalsError);
        return {
          goals: [],
          summary: emptyGoalsSummary,
          isTableMissing: false,
          error: 'Erro ao carregar metas.',
        };
      }

      // 2. Busca todas as contribuições do espaço de forma agregada (Zero N+1)
      const { data: contributionsData, error: contributionsError } = await supabase
        .from('goal_contributions')
        .select('*')
        .eq('space_id', spaceId)
        .order('contribution_date', { ascending: false });

      if (contributionsError) {
        if (isTableMissingError(contributionsError)) {
          return {
            goals: [],
            summary: emptyGoalsSummary,
            isTableMissing: true,
          };
        }
        console.warn('Aviso ao buscar goal_contributions:', contributionsError.message || contributionsError);
        return {
          goals: [],
          summary: emptyGoalsSummary,
          isTableMissing: false,
          error: 'Erro ao carregar histórico de aportes.',
        };
      }

      const rawGoals: Goal[] = (goalsData || []).map((g: any) => ({
        id: g.id,
        space_id: g.space_id,
        created_by: g.created_by,
        name: g.name,
        target_amount: Number(g.target_amount) || 0,
        target_date: g.target_date || null,
        category: g.category || 'Geral',
        status: g.status || 'active',
        notes: g.notes || null,
        created_at: g.created_at,
        updated_at: g.updated_at,
      }));

      const rawContributions: GoalContribution[] = (contributionsData || []).map((c: any) => ({
        id: c.id,
        goal_id: c.goal_id,
        space_id: c.space_id,
        created_by: c.created_by,
        amount: Number(c.amount) || 0,
        contribution_date: c.contribution_date,
        notes: c.notes || null,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      // Agrupa aportes por goal_id
      const contributionsByGoal = new Map<string, GoalContribution[]>();
      for (const contrib of rawContributions) {
        const list = contributionsByGoal.get(contrib.goal_id) || [];
        list.push(contrib);
        contributionsByGoal.set(contrib.goal_id, list);
      }

      // Constrói cada GoalWithProgress derivando estritamente os aportes
      const allGoalsWithProgress: GoalWithProgress[] = rawGoals.map((goal) => {
        const goalContributions = contributionsByGoal.get(goal.id) || [];
        // Ordena aportes por data desc e depois created_at desc
        goalContributions.sort((a, b) => {
          const dateDiff = new Date(b.contribution_date).getTime() - new Date(a.contribution_date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Cálculo de centavos inteiros para evitar flutuações de ponto flutuante
        const accumulatedCents = goalContributions.reduce(
          (sum, c) => sum + Math.round((Number(c.amount) || 0) * 100),
          0
        );
        const accumulatedAmount = accumulatedCents / 100;
        const targetAmount = goal.target_amount || 0;

        const progressPercentage =
          targetAmount > 0
            ? Math.round((accumulatedAmount / targetAmount) * 1000) / 10
            : 0;

        const remainingCents = Math.max(0, Math.round(targetAmount * 100) - accumulatedCents);
        const remainingAmount = remainingCents / 100;

        const isTargetReached = accumulatedAmount >= targetAmount && targetAmount > 0;
        const lastContributionDate = goalContributions.length > 0 ? goalContributions[0].contribution_date : null;

        return {
          ...goal,
          contributions: goalContributions,
          accumulatedAmount,
          progressPercentage,
          remainingAmount,
          contributionsCount: goalContributions.length,
          isTargetReached,
          lastContributionDate,
        };
      });

      // Cálculo do Resumo Global com dados REAIS
      let totalTargetCents = 0;
      let totalAccumulatedCents = 0;
      let activeCount = 0;
      let completedCount = 0;
      let pausedCount = 0;

      for (const goal of allGoalsWithProgress) {
        totalTargetCents += Math.round(goal.target_amount * 100);
        totalAccumulatedCents += Math.round(goal.accumulatedAmount * 100);

        if (goal.status === 'completed' || goal.isTargetReached) {
          completedCount++;
        } else if (goal.status === 'paused') {
          pausedCount++;
        } else {
          activeCount++;
        }
      }

      const totalTarget = totalTargetCents / 100;
      const totalAccumulated = totalAccumulatedCents / 100;
      const totalRemaining = Math.max(0, (totalTargetCents - totalAccumulatedCents) / 100);

      const summary: GoalsSummary = {
        totalTarget,
        totalAccumulated,
        totalRemaining,
        goalsCount: allGoalsWithProgress.length,
        activeCount,
        completedCount,
        pausedCount,
      };

      // Aplica filtro opcional
      const filter = options?.filterStatus || 'all';
      let filteredGoals = allGoalsWithProgress;
      if (filter === 'active') {
        filteredGoals = allGoalsWithProgress.filter((g) => g.status === 'active' && !g.isTargetReached);
      } else if (filter === 'completed') {
        filteredGoals = allGoalsWithProgress.filter((g) => g.status === 'completed' || g.isTargetReached);
      } else if (filter === 'paused') {
        filteredGoals = allGoalsWithProgress.filter((g) => g.status === 'paused');
      }

      return {
        goals: filteredGoals,
        summary,
        isTableMissing: false,
      };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return {
          goals: [],
          summary: emptyGoalsSummary,
          isTableMissing: true,
        };
      }
      console.error('Erro inesperado em getGoalsWithProgress:', err);
      return {
        goals: [],
        summary: emptyGoalsSummary,
        isTableMissing: false,
        error: 'Falha inesperada ao consultar metas.',
      };
    }
  },

  /**
   * Cria uma nova meta no espaço ativo.
   * Não aceita 'valor já acumulado' diretamente; qualquer saldo deve vir de aportes.
   */
  async createGoal(
    input: CreateGoalInput
  ): Promise<{ success: boolean; goal?: Goal; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase não inicializado.' };

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { success: false, error: 'O nome da meta é obrigatório.' };
    }

    const normalizedTarget = roundMoney(input.target_amount);
    if (normalizedTarget <= 0 || isNaN(normalizedTarget)) {
      return { success: false, error: 'O valor-alvo deve ser maior que zero.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const insertPayload: any = {
        space_id: input.space_id,
        created_by: user?.id || null,
        name: trimmedName,
        target_amount: normalizedTarget,
        target_date: input.target_date || null,
        category: input.category?.trim() || 'Geral',
        status: input.status || 'active',
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('goals')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          return { success: false, error: 'Tabela de metas não encontrada no Supabase.' };
        }
        return { success: false, error: error.message || 'Erro ao criar meta.' };
      }

      return { success: true, goal: data as Goal };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao cadastrar meta.' };
    }
  },

  /**
   * Atualiza os dados de uma meta existente.
   * NÃO permite alterar o valor acumulado diretamente.
   */
  async updateGoal(
    id: string,
    spaceId: string,
    input: UpdateGoalInput
  ): Promise<{ success: boolean; goal?: Goal; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase não inicializado.' };

    const updatePayload: any = {};

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) return { success: false, error: 'O nome da meta não pode ser vazio.' };
      updatePayload.name = trimmed;
    }

    if (input.target_amount !== undefined) {
      const normalizedTarget = roundMoney(input.target_amount);
      if (normalizedTarget <= 0 || isNaN(normalizedTarget)) {
        return { success: false, error: 'O valor-alvo deve ser maior que zero.' };
      }
      updatePayload.target_amount = normalizedTarget;
    }

    if (input.target_date !== undefined) {
      updatePayload.target_date = input.target_date || null;
    }

    if (input.category !== undefined) {
      updatePayload.category = input.category.trim() || 'Geral';
    }

    if (input.status !== undefined) {
      updatePayload.status = input.status;
    }

    if (input.notes !== undefined) {
      updatePayload.notes = input.notes ? input.notes.trim() : null;
    }

    try {
      const { data, error } = await supabase
        .from('goals')
        .update(updatePayload)
        .eq('id', id)
        .eq('space_id', spaceId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message || 'Erro ao atualizar meta.' };
      }

      return { success: true, goal: data as Goal };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao salvar alterações da meta.' };
    }
  },

  /**
   * Exclui uma meta. Os aportes são removidos por integridade ON DELETE CASCADE no banco.
   */
  async deleteGoal(id: string, spaceId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase não inicializado.' };

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('space_id', spaceId);

      if (error) {
        return { success: false, error: error.message || 'Erro ao excluir meta.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao remover meta.' };
    }
  },

  /**
   * Registra um aporte financeiro em uma meta.
   * O valor acumulado da meta é derivado pela soma de todos os aportes.
   */
   async addContribution(
    input: CreateGoalContributionInput,
    operationId: string = crypto.randomUUID()
  ): Promise<{ success: boolean; contribution?: GoalContribution; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase não inicializado.' };

    const normalizedAmount = roundMoney(input.amount);
    if (normalizedAmount <= 0 || isNaN(normalizedAmount)) {
      return { success: false, error: 'O valor do aporte deve ser maior que zero.' };
    }

    if (!input.contribution_date) {
      return { success: false, error: 'A data do aporte é obrigatória.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Se origem for reserva, debitar a reserva de forma atômica
      if (input.source_type === 'reserve' && input.source_id) {
        const withdrawRes = await reservesService.withdrawMoney(
          user?.id || '',
          {
            reserve_id: input.source_id,
            space_id: input.space_id,
            amount: normalizedAmount,
            date: input.contribution_date,
            notes: `Aporte na Meta`,
          },
          operationId
        );
        if (withdrawRes.error) {
          return { success: false, error: withdrawRes.error };
        }
      }

      const insertPayload: any = {
        goal_id: input.goal_id,
        space_id: input.space_id,
        created_by: user?.id || null,
        amount: normalizedAmount,
        contribution_date: input.contribution_date,
        source_type: input.source_type || 'free_balance',
        source_id: input.source_id || null,
        source_name: input.source_name || 'Saldo Livre',
        notes: input.notes?.trim() || null,
      };

      let { data, error } = await supabase
        .from('goal_contributions')
        .insert([insertPayload])
        .select()
        .single();

      if (error && error.message && (error.message.includes('column') || error.message.includes('source_type'))) {
        const fallbackPayload = {
          goal_id: input.goal_id,
          space_id: input.space_id,
          created_by: user?.id || null,
          amount: normalizedAmount,
          contribution_date: input.contribution_date,
          notes: [input.notes?.trim(), `Origem: ${input.source_name || 'Saldo Livre'}`].filter(Boolean).join(' - '),
        };
        const res2 = await supabase
          .from('goal_contributions')
          .insert([fallbackPayload])
          .select()
          .single();
        data = res2.data;
        error = res2.error;
      }

      if (error) {
        return { success: false, error: error.message || 'Erro ao registrar aporte.' };
      }

      return { success: true, contribution: data as GoalContribution };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao processar aporte.' };
    }
  },

  /**
   * Remove/estorna um aporte registrado.
   * O acumulado da meta é recalculado automaticamente pela soma dos aportes restantes.
   */
  async deleteContribution(
    contributionId: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase não inicializado.' };

    try {
      const { error } = await supabase
        .from('goal_contributions')
        .delete()
        .eq('id', contributionId)
        .eq('space_id', spaceId);

      if (error) {
        return { success: false, error: error.message || 'Erro ao excluir aporte.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao estornar aporte.' };
    }
  },

  /**
   * Obtém a lista detalhada de aportes de uma meta específica.
   */
  async getGoalContributions(
    goalId: string,
    spaceId: string
  ): Promise<{ contributions: GoalContribution[]; error?: string }> {
    if (!supabase) return { contributions: [], error: 'Supabase não inicializado.' };

    try {
      const { data, error } = await supabase
        .from('goal_contributions')
        .select('*')
        .eq('goal_id', goalId)
        .eq('space_id', spaceId)
        .order('contribution_date', { ascending: false });

      if (error) {
        return { contributions: [], error: error.message || 'Erro ao carregar aportes.' };
      }

      return { contributions: (data || []) as GoalContribution[] };
    } catch (err: any) {
      return { contributions: [], error: err.message || 'Falha ao buscar aportes.' };
    }
  },
};
