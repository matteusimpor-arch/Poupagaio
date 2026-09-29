import { supabase } from '../supabase';
import {
  FixedExpense,
  FixedExpensePayment,
  FixedExpenseWithStatus,
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  FixedExpensesSummary,
  FixedExpenseComputedStatus,
} from '../../types';
import { isTableMissingError } from './profile';

const emptySummary: FixedExpensesSummary = {
  totalMonth: 0,
  totalPaid: 0,
  totalPending: 0,
  totalUpcoming: 0,
  totalOverdue: 0,
  count: 0,
  paidCount: 0,
  upcomingCount: 0,
  overdueCount: 0,
};

export const fixedExpensesService = {
  /**
   * Obtém a lista de gastos fixos com status calculado para a competência (mês/ano)
   */
  async getFixedExpensesWithStatus(
    spaceId: string,
    year: number,
    month: number
  ): Promise<{
    expenses: FixedExpenseWithStatus[];
    summary: FixedExpensesSummary;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return { expenses: [], summary: emptySummary, isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    }

    if (!spaceId) {
      return { expenses: [], summary: emptySummary, isTableMissing: false };
    }

    const billingCycle = `${year}-${String(month).padStart(2, '0')}`;

    try {
      // 1. Busca todos os gastos fixos do espaço
      const { data: expensesData, error: expensesError } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('space_id', spaceId)
        .order('due_day', { ascending: true })
        .order('description', { ascending: true });

      if (expensesError) {
        if (isTableMissingError(expensesError)) {
          return { expenses: [], summary: emptySummary, isTableMissing: true };
        }
        console.warn('Aviso ao buscar fixed_expenses:', expensesError.message || expensesError);
        return { expenses: [], summary: emptySummary, isTableMissing: false, error: 'Erro ao carregar os gastos fixos.' };
      }

      const rawExpenses: FixedExpense[] = expensesData || [];

      // 2. Busca pagamentos registrados para esta competência
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('fixed_expense_payments')
        .select('*')
        .eq('space_id', spaceId)
        .eq('billing_cycle', billingCycle);

      if (paymentsError && !isTableMissingError(paymentsError)) {
        console.warn('Aviso ao buscar pagamentos de gastos fixos:', paymentsError);
      }

      const paymentsMap = new Map<string, FixedExpensePayment>();
      if (paymentsData) {
        for (const p of paymentsData as FixedExpensePayment[]) {
          paymentsMap.set(p.fixed_expense_id, p);
        }
      }

      // 3. Data de hoje para cálculo de atrasado vs próximo
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const maxDaysInMonth = new Date(year, month, 0).getDate();
      const targetCycleStr = `${year}-${String(month).padStart(2, '0')}-01`;

      // Filtra gastos que competem para este mês respeitando a vigência inicial (start_date):
      // 1. A competência consultada deve ser maior ou igual a start_date (YYYY-MM-01).
      // 2. Se mensal, incide em todos os meses a partir de start_date.
      // 3. Se anual, incide a partir de start_date SOMENTE no mês correspondente a due_month.
      const applicableExpenses = rawExpenses.filter((exp) => {
        const expStartDate = exp.start_date ? exp.start_date.substring(0, 10) : '1970-01-01';
        if (targetCycleStr < expStartDate) {
          return false;
        }
        if (exp.recurrence === 'yearly') {
          return exp.due_month === month;
        }
        return true;
      });

      let totalMonth = 0;
      let totalPaid = 0;
      let totalPending = 0;
      let totalUpcoming = 0;
      let totalOverdue = 0;
      let paidCount = 0;
      let upcomingCount = 0;
      let overdueCount = 0;

      const expensesWithStatus: FixedExpenseWithStatus[] = applicableExpenses.map((exp) => {
        const amount = Number(exp.amount) || 0;
        totalMonth += amount;

        // Calcula a data de vencimento específica para o mês
        const validDueDay = Math.min(Math.max(1, exp.due_day), maxDaysInMonth);
        const dueDateThisMonth = `${year}-${String(month).padStart(2, '0')}-${String(validDueDay).padStart(2, '0')}`;

        const payment = paymentsMap.get(exp.id) || null;
        const isPaid = !!payment;

        let computedStatus: FixedExpenseComputedStatus;
        if (isPaid) {
          computedStatus = 'paid';
          totalPaid += amount;
          paidCount++;
        } else {
          if (dueDateThisMonth < todayStr) {
            computedStatus = 'overdue';
            totalOverdue += amount;
            overdueCount++;
          } else {
            computedStatus = 'upcoming';
            totalUpcoming += amount;
            upcomingCount++;
          }
          totalPending += amount;
        }

        return {
          ...exp,
          computedStatus,
          isPaid,
          payment,
          dueDateThisMonth,
        };
      });

      return {
        expenses: expensesWithStatus,
        summary: {
          totalMonth,
          totalPaid,
          totalPending,
          totalUpcoming,
          totalOverdue,
          count: applicableExpenses.length,
          paidCount,
          upcomingCount,
          overdueCount,
        },
        isTableMissing: false,
      };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { expenses: [], summary: emptySummary, isTableMissing: true };
      }
      console.warn('getFixedExpensesWithStatus exception:', err?.message || err);
      return { expenses: [], summary: emptySummary, isTableMissing: false, error: 'Erro de conexão ao carregar os gastos fixos.' };
    }
  },

  /**
   * Resumo rápido do mês para uso pelo Dashboard
   */
  async getMonthSummary(
    spaceId: string,
    year: number,
    month: number
  ): Promise<FixedExpensesSummary> {
    const res = await this.getFixedExpensesWithStatus(spaceId, year, month);
    return res.summary;
  },

  /**
   * Cadastra um novo gasto fixo recorrente
   */
  async createFixedExpense(
    userId: string,
    input: CreateFixedExpenseInput
  ): Promise<{ expense: FixedExpense | null; error?: string; isTableMissing?: boolean }> {
    if (!supabase) {
      return { expense: null, error: 'Conexão Supabase não inicializada.' };
    }

    const desc = input.description.trim();
    if (!desc) return { expense: null, error: 'A descrição do gasto fixo é obrigatória.' };

    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { expense: null, error: 'O valor deve ser maior que zero.' };
    }

    const dueDay = Number(input.due_day);
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      return { expense: null, error: 'O dia de vencimento deve estar entre 1 e 31.' };
    }

    if (!input.space_id) {
      return { expense: null, error: 'Espaço financeiro não selecionado.' };
    }

    try {
      const now = new Date().toISOString();
      const isYearly = (input.recurrence || 'monthly') === 'yearly';
      let dueMonth: number | null = null;
      if (isYearly) {
        dueMonth = Number(input.due_month);
        if (isNaN(dueMonth) || dueMonth < 1 || dueMonth > 12) {
          return { expense: null, error: 'Para despesas anuais, informe o mês de vencimento (1 a 12).' };
        }
      }

      // Normaliza a competência inicial (start_date) para o 1º dia do mês (YYYY-MM-01)
      let startDate = input.start_date?.trim();
      if (startDate) {
        startDate = startDate.substring(0, 7) + '-01';
      } else {
        const nowObj = new Date();
        startDate = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-01`;
      }

      const payload = {
        space_id: input.space_id,
        created_by: userId || null,
        description: desc,
        amount: Math.round(amount * 100) / 100,
        due_day: dueDay,
        due_month: isYearly ? dueMonth : null,
        category: input.category?.trim() || 'Outros',
        recurrence: input.recurrence || 'monthly',
        start_date: startDate,
        notes: input.notes?.trim() || null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('fixed_expenses')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          return { expense: null, isTableMissing: true, error: 'A tabela de gastos fixos ainda não foi criada no Supabase.' };
        }
        console.warn('Aviso ao cadastrar gasto fixo:', error.message || error);
        return { expense: null, error: 'Não foi possível cadastrar o gasto fixo. Tente novamente.' };
      }

      return { expense: data as FixedExpense };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { expense: null, isTableMissing: true, error: 'A tabela de gastos fixos ainda não foi criada no Supabase.' };
      }
      return { expense: null, error: 'Não foi possível salvar este gasto. Tente novamente.' };
    }
  },

  /**
   * Atualiza os dados de um gasto fixo existente
   */
  async updateFixedExpense(
    id: string,
    input: UpdateFixedExpenseInput
  ): Promise<{ expense: FixedExpense | null; error?: string }> {
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

    if (input.due_day !== undefined) {
      const dueDay = Number(input.due_day);
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) return { expense: null, error: 'O dia de vencimento deve estar entre 1 e 31.' };
      payload.due_day = dueDay;
    }

    if (input.category !== undefined) payload.category = input.category.trim() || 'Outros';
    if (input.recurrence !== undefined) {
      payload.recurrence = input.recurrence;
      if (input.recurrence === 'monthly') {
        payload.due_month = null;
      } else if (input.recurrence === 'yearly') {
        if (input.due_month !== undefined) {
          const m = Number(input.due_month);
          if (isNaN(m) || m < 1 || m > 12) {
            return { expense: null, error: 'Para despesas anuais, informe o mês de vencimento (1 a 12).' };
          }
          payload.due_month = m;
        }
      }
    } else if (input.due_month !== undefined) {
      payload.due_month = input.due_month;
    }
    if (input.start_date !== undefined && input.start_date !== null) {
      const sd = input.start_date.trim();
      if (sd) {
        payload.start_date = sd.substring(0, 7) + '-01';
      }
    }
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;

    try {
      const { data, error } = await supabase
        .from('fixed_expenses')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.warn('Aviso ao atualizar gasto fixo:', error.message || error);
        return { expense: null, error: 'Não foi possível salvar as alterações do gasto fixo.' };
      }

      return { expense: data as FixedExpense };
    } catch (err: any) {
      return { expense: null, error: 'Erro ao atualizar gasto fixo. Tente novamente.' };
    }
  },

  /**
   * Exclui um gasto fixo
   */
  async deleteFixedExpense(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    try {
      const { error } = await supabase
        .from('fixed_expenses')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Aviso ao excluir gasto fixo:', error.message || error);
        return { success: false, error: 'Não foi possível excluir o gasto fixo.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Erro ao excluir gasto fixo. Tente novamente.' };
    }
  },

  /**
   * Registra pagamento do gasto fixo na competência especificada
   */
  async markAsPaid(
    fixedExpenseId: string,
    spaceId: string,
    year: number,
    month: number,
    amount: number,
    userId?: string
  ): Promise<{ payment: FixedExpensePayment | null; error?: string }> {
    if (!supabase) return { payment: null, error: 'Conexão Supabase não inicializada.' };

    const billingCycle = `${year}-${String(month).padStart(2, '0')}`;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const payload = {
        fixed_expense_id: fixedExpenseId,
        space_id: spaceId,
        billing_cycle: billingCycle,
        amount_paid: amount,
        paid_at: todayStr,
        created_by: userId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('fixed_expense_payments')
        .upsert(payload, { onConflict: 'fixed_expense_id,billing_cycle' })
        .select('*')
        .single();

      if (error) {
        console.warn('Aviso ao registrar pagamento de gasto fixo:', error.message || error);
        return { payment: null, error: 'Não foi possível registrar o pagamento.' };
      }

      return { payment: data as FixedExpensePayment };
    } catch (err: any) {
      return { payment: null, error: 'Erro ao registrar pagamento. Tente novamente.' };
    }
  },

  /**
   * Desmarca pagamento do gasto fixo na competência (remove o registro de pagamento)
   */
  async unmarkPaid(
    fixedExpenseId: string,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    const billingCycle = `${year}-${String(month).padStart(2, '0')}`;

    try {
      const { error } = await supabase
        .from('fixed_expense_payments')
        .delete()
        .eq('fixed_expense_id', fixedExpenseId)
        .eq('billing_cycle', billingCycle);

      if (error) {
        console.warn('Aviso ao desmarcar pagamento:', error.message || error);
        return { success: false, error: 'Não foi possível desmarcar o pagamento.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Erro ao desmarcar pagamento. Tente novamente.' };
    }
  },
};
