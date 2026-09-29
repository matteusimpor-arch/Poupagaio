import { supabase } from '../supabase';
import {
  InstallmentPurchase,
  Installment,
  InstallmentWithStatus,
  InstallmentPurchaseWithInstallments,
  CreateInstallmentPurchaseInput,
  UpdateInstallmentPurchaseInput,
  InstallmentsMonthSummary,
  InstallmentsGlobalSummary,
} from '../../types';
import { isTableMissingError } from './profile';

export const emptyMonthSummary: InstallmentsMonthSummary = {
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

export const emptyGlobalSummary: InstallmentsGlobalSummary = {
  totalOverall: 0,
  totalPaidOverall: 0,
  totalRemainingOverall: 0,
  activePurchasesCount: 0,
  completedPurchasesCount: 0,
};

export const INSTALLMENT_CATEGORIES = [
  'Eletrônicos',
  'Casa',
  'Veículo',
  'Educação',
  'Saúde',
  'Viagem',
  'Compras',
  'Serviços',
  'Outros',
] as const;

/**
 * Utilitário puro para gerar o cronograma de parcelas com cálculo exato de centavos
 * e ajuste da diferença na última parcela.
 * Trata o último dia do mês para não estourar em meses com menos dias (ex: 31/01 -> 28/02).
 */
export function calculateInstallmentsSchedule(
  totalAmount: number,
  count: number,
  firstDueDateStr: string
): { installment_number: number; amount: number; due_date: string }[] {
  if (count < 2 || count > 120) {
    throw new Error('A quantidade de parcelas deve estar entre 2 e 120.');
  }
  if (totalAmount <= 0) {
    throw new Error('O valor total deve ser maior que zero.');
  }

  // Conversão segura em centavos inteiros
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  // Decomposição segura da data YYYY-MM-DD
  const [firstYear, firstMonth, firstDay] = firstDueDateStr.split('-').map(Number);
  if (!firstYear || !firstMonth || !firstDay) {
    throw new Error('Data de primeiro vencimento inválida.');
  }

  const schedule: { installment_number: number; amount: number; due_date: string }[] = [];

  for (let i = 0; i < count; i++) {
    const installmentNumber = i + 1;
    // O resíduo de centavos é somado na última parcela
    const installmentCents = i === count - 1 ? baseCents + remainderCents : baseCents;
    const amount = Number((installmentCents / 100).toFixed(2));

    // Cálculo do ano e mês de vencimento preservando o dia base
    const monthIndex = firstMonth - 1 + i;
    const targetYear = firstYear + Math.floor(monthIndex / 12);
    const targetMonth = (monthIndex % 12) + 1; // 1 a 12

    // Último dia válido daquele mês específico
    const maxDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const actualDay = Math.min(firstDay, maxDaysInMonth);

    const dueDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;

    schedule.push({
      installment_number: installmentNumber,
      amount,
      due_date: dueDate,
    });
  }

  return schedule;
}

export const installmentsService = {
  /**
   * Obtém compras parceladas com suas respectivas parcelas para o espaço.
   */
  async getPurchasesWithInstallments(
    spaceId: string,
    options?: {
      year?: number;
      month?: number;
      filterStatus?: 'all' | 'active' | 'completed';
    }
  ): Promise<{
    purchases: InstallmentPurchaseWithInstallments[];
    monthSummary: InstallmentsMonthSummary;
    globalSummary: InstallmentsGlobalSummary;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!supabase) {
      return {
        purchases: [],
        monthSummary: emptyMonthSummary,
        globalSummary: emptyGlobalSummary,
        isTableMissing: false,
        error: 'Conexão Supabase não inicializada.',
      };
    }

    if (!spaceId) {
      return {
        purchases: [],
        monthSummary: emptyMonthSummary,
        globalSummary: emptyGlobalSummary,
        isTableMissing: false,
      };
    }

    try {
      // 1. Busca todas as compras parceladas do espaço
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('installment_purchases')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });

      if (purchasesError) {
        if (isTableMissingError(purchasesError)) {
          return {
            purchases: [],
            monthSummary: emptyMonthSummary,
            globalSummary: emptyGlobalSummary,
            isTableMissing: true,
          };
        }
        console.warn('Aviso ao buscar installment_purchases:', purchasesError.message || purchasesError);
        return {
          purchases: [],
          monthSummary: emptyMonthSummary,
          globalSummary: emptyGlobalSummary,
          isTableMissing: false,
          error: 'Erro ao carregar compras parceladas.',
        };
      }

      // 2. Busca todas as parcelas do espaço
      const { data: installmentsData, error: installmentsError } = await supabase
        .from('installments')
        .select('*')
        .eq('space_id', spaceId)
        .order('installment_number', { ascending: true });

      if (installmentsError && !isTableMissingError(installmentsError)) {
        console.warn('Aviso ao buscar parcelas:', installmentsError.message || installmentsError);
      }

      const rawPurchases: InstallmentPurchase[] = purchasesData || [];
      const rawInstallments: Installment[] = installmentsData || [];

      // Mapeamento de parcelas por compra
      const installmentsByPurchase = new Map<string, Installment[]>();
      for (const inst of rawInstallments) {
        const list = installmentsByPurchase.get(inst.purchase_id) || [];
        list.push(inst);
        installmentsByPurchase.set(inst.purchase_id, list);
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;

      // Montagem das compras com parcelas e cálculo de status
      const processedPurchases: InstallmentPurchaseWithInstallments[] = rawPurchases.map((purchase) => {
        const purchaseInstallments = (installmentsByPurchase.get(purchase.id) || []).sort(
          (a, b) => a.installment_number - b.installment_number
        );

        let paidCount = 0;
        let totalPaidAmount = 0;
        let nextDueDate: string | null = null;

        const installmentsWithStatus: InstallmentWithStatus[] = purchaseInstallments.map((inst) => {
          let computedStatus: 'paid' | 'upcoming' | 'overdue' = 'upcoming';
          if (inst.status === 'paid') {
            computedStatus = 'paid';
            paidCount += 1;
            totalPaidAmount += Number(inst.amount);
          } else if (inst.due_date < todayStr) {
            computedStatus = 'overdue';
            if (!nextDueDate) nextDueDate = inst.due_date;
          } else {
            computedStatus = 'upcoming';
            if (!nextDueDate) nextDueDate = inst.due_date;
          }

          return {
            ...inst,
            computedStatus,
            purchaseDescription: purchase.description,
            purchaseCategory: purchase.category,
            purchaseTotalCount: purchase.installment_count,
          };
        });

        const progressPercentage =
          purchase.installment_count > 0 ? Math.round((paidCount / purchase.installment_count) * 100) : 0;
        const isFullyPaid = paidCount >= purchase.installment_count && purchase.installment_count > 0;

        return {
          ...purchase,
          installments: installmentsWithStatus,
          paidCount,
          totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
          progressPercentage,
          isFullyPaid,
          nextDueDate,
        };
      });

      // Cálculo do Resumo Global
      let totalOverall = 0;
      let totalPaidOverall = 0;
      let activePurchasesCount = 0;
      let completedPurchasesCount = 0;

      for (const p of processedPurchases) {
        totalOverall += Number(p.total_amount);
        totalPaidOverall += p.totalPaidAmount;
        if (p.isFullyPaid) {
          completedPurchasesCount += 1;
        } else {
          activePurchasesCount += 1;
        }
      }

      const globalSummary: InstallmentsGlobalSummary = {
        totalOverall: Number(totalOverall.toFixed(2)),
        totalPaidOverall: Number(totalPaidOverall.toFixed(2)),
        totalRemainingOverall: Number(Math.max(0, totalOverall - totalPaidOverall).toFixed(2)),
        activePurchasesCount,
        completedPurchasesCount,
      };

      // Cálculo do Resumo da Competência (mês/ano fornecidos ou atual)
      const selectedYear = options?.year ?? now.getFullYear();
      const selectedMonth = options?.month ?? now.getMonth() + 1;
      const cyclePrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

      let monthTotal = 0;
      let monthPaid = 0;
      let monthPending = 0;
      let monthUpcoming = 0;
      let monthOverdue = 0;
      let monthCount = 0;
      let monthPaidCount = 0;
      let monthUpcomingCount = 0;
      let monthOverdueCount = 0;

      for (const inst of rawInstallments) {
        if (inst.due_date.startsWith(cyclePrefix)) {
          const val = Number(inst.amount);
          monthTotal += val;
          monthCount += 1;

          if (inst.status === 'paid') {
            monthPaid += val;
            monthPaidCount += 1;
          } else {
            monthPending += val;
            if (inst.due_date < todayStr) {
              monthOverdue += val;
              monthOverdueCount += 1;
            } else {
              monthUpcoming += val;
              monthUpcomingCount += 1;
            }
          }
        }
      }

      const monthSummary: InstallmentsMonthSummary = {
        totalMonth: Number(monthTotal.toFixed(2)),
        totalPaid: Number(monthPaid.toFixed(2)),
        totalPending: Number(monthPending.toFixed(2)),
        totalUpcoming: Number(monthUpcoming.toFixed(2)),
        totalOverdue: Number(monthOverdue.toFixed(2)),
        count: monthCount,
        paidCount: monthPaidCount,
        upcomingCount: monthUpcomingCount,
        overdueCount: monthOverdueCount,
      };

      // Filtragem opcional de lista
      let filteredPurchases = processedPurchases;
      if (options?.filterStatus === 'active') {
        filteredPurchases = processedPurchases.filter((p) => !p.isFullyPaid);
      } else if (options?.filterStatus === 'completed') {
        filteredPurchases = processedPurchases.filter((p) => p.isFullyPaid);
      }

      return {
        purchases: filteredPurchases,
        monthSummary,
        globalSummary,
        isTableMissing: false,
      };
    } catch (err: any) {
      console.warn('Erro ao processar parcelados:', err);
      return {
        purchases: [],
        monthSummary: emptyMonthSummary,
        globalSummary: emptyGlobalSummary,
        isTableMissing: false,
        error: 'Não foi possível carregar as compras parceladas.',
      };
    }
  },

  /**
   * Resumo de parcelas para a competência mensal (usado pelo Dashboard e Parcelados)
   */
  async getMonthSummary(spaceId: string, year: number, month: number): Promise<InstallmentsMonthSummary> {
    if (!supabase || !spaceId) return emptyMonthSummary;

    const cyclePrefix = `${year}-${String(month).padStart(2, '0')}`;
    const startStr = `${cyclePrefix}-01`;
    // Cálculo seguro do último dia real do mês (evita datas inválidas como 2026-09-31 no Postgres)
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${cyclePrefix}-${String(lastDay).padStart(2, '0')}`;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    try {
      const { data, error } = await supabase
        .from('installments')
        .select('*')
        .eq('space_id', spaceId)
        .gte('due_date', startStr)
        .lte('due_date', endStr);

      if (error) {
        if (!isTableMissingError(error)) {
          console.warn('Aviso ao buscar resumo mensal de parcelas:', error.message || error);
        }
        return emptyMonthSummary;
      }

      const list: Installment[] = data || [];
      let totalMonth = 0;
      let totalPaid = 0;
      let totalPending = 0;
      let totalUpcoming = 0;
      let totalOverdue = 0;
      let paidCount = 0;
      let upcomingCount = 0;
      let overdueCount = 0;

      for (const inst of list) {
        const val = Number(inst.amount);
        totalMonth += val;

        if (inst.status === 'paid') {
          totalPaid += val;
          paidCount += 1;
        } else {
          totalPending += val;
          if (inst.due_date < todayStr) {
            totalOverdue += val;
            overdueCount += 1;
          } else {
            totalUpcoming += val;
            upcomingCount += 1;
          }
        }
      }

      return {
        totalMonth: Number(totalMonth.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalPending: Number(totalPending.toFixed(2)),
        totalUpcoming: Number(totalUpcoming.toFixed(2)),
        totalOverdue: Number(totalOverdue.toFixed(2)),
        count: list.length,
        paidCount,
        upcomingCount,
        overdueCount,
      };
    } catch (err) {
      console.warn('Exceção ao calcular getMonthSummary de parcelados:', err);
      return emptyMonthSummary;
    }
  },

  /**
   * Cria uma compra parcelada e gera atomicamente todas as suas parcelas
   * EXCLUSIVAMENTE via RPC transacional do PostgreSQL (create_installment_purchase).
   * Sem fallback client-side para garantir atomicidade estrita e integridade transacional.
   */
  async createPurchase(
    input: CreateInstallmentPurchaseInput
  ): Promise<{ purchase?: InstallmentPurchase; error?: string; isTableMissing?: boolean }> {
    if (!supabase) {
      return { error: 'Conexão Supabase não inicializada.' };
    }

    // Validações de domínio
    if (!input.description?.trim()) {
      return { error: 'Informe a descrição da compra.' };
    }
    const normalizedAmount = Math.round(input.total_amount * 100) / 100;
    if (!normalizedAmount || normalizedAmount <= 0) {
      return { error: 'O valor total deve ser maior que zero.' };
    }
    if (!input.installment_count || input.installment_count < 2 || input.installment_count > 120) {
      return { error: 'A quantidade de parcelas deve ser entre 2 e 120.' };
    }
    if (!input.first_due_date) {
      return { error: 'Informe a data do primeiro vencimento.' };
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_installment_purchase', {
        p_space_id: input.space_id,
        p_description: input.description.trim(),
        p_total_amount: normalizedAmount,
        p_installment_count: input.installment_count,
        p_first_due_date: input.first_due_date,
        p_category: input.category || 'Outros',
        p_notes: input.notes?.trim() || null,
      });

      if (rpcError) {
        // Registra o erro técnico somente no console
        console.error('Falha técnica na RPC create_installment_purchase:', rpcError);

        if (isTableMissingError(rpcError) || rpcError.code === '42883') {
          return {
            isTableMissing: true,
            error: 'As funções ou tabelas de parcelados ainda não foram criadas no banco de dados.',
          };
        }

        return {
          error: 'Não foi possível cadastrar a compra parcelada. Nenhuma parcela foi gerada.',
        };
      }

      if (rpcData) {
        return { purchase: rpcData as InstallmentPurchase };
      }

      return { error: 'Não foi possível cadastrar a compra parcelada.' };
    } catch (e: any) {
      console.error('Erro de conexão ao chamar create_installment_purchase:', e);
      return { error: 'Ocorreu um erro ao salvar a compra parcelada.' };
    }
  },

  /**
   * Atualiza uma compra parcelada de maneira segura.
   * Se houver parcelas já pagas, bloqueia alteração de valor, parcelas e primeiro vencimento.
   */
  async updatePurchase(
    purchaseId: string,
    spaceId: string,
    input: UpdateInstallmentPurchaseInput
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    try {
      // 1. Verifica se a compra tem parcelas pagas
      const { data: paidInstallments, error: paidError } = await supabase
        .from('installments')
        .select('id, status')
        .eq('purchase_id', purchaseId)
        .eq('status', 'paid');

      if (paidError && !isTableMissingError(paidError)) {
        console.warn('Erro ao checar parcelas pagas:', paidError);
      }

      const hasPaidInstallments = (paidInstallments && paidInstallments.length > 0);

      // 2. Se houver parcelas pagas, impede mudança de valor/parcelas/vencimento
      const isTryingToChangeSchedule =
        (input.total_amount !== undefined) ||
        (input.installment_count !== undefined) ||
        (input.first_due_date !== undefined);

      if (hasPaidInstallments && isTryingToChangeSchedule) {
        return {
          success: false,
          error:
            'Esta compra já possui parcelas pagas. Por segurança financeira, você só pode alterar a descrição, categoria e observações.',
        };
      }

      // 3. Se não tem parcelas pagas e está alterando o cronograma, regenera as parcelas
      if (!hasPaidInstallments && isTryingToChangeSchedule) {
        if (!input.total_amount || !input.installment_count || !input.first_due_date) {
          return {
            success: false,
            error: 'Para alterar o cronograma, forneça valor total, número de parcelas e primeiro vencimento.',
          };
        }

        const newSchedule = calculateInstallmentsSchedule(
          input.total_amount,
          input.installment_count,
          input.first_due_date
        );

        // Atualiza a compra
        const { error: updatePurchaseError } = await supabase
          .from('installment_purchases')
          .update({
            description: input.description?.trim(),
            category: input.category,
            notes: input.notes?.trim() || null,
            total_amount: input.total_amount,
            installment_count: input.installment_count,
            first_due_date: input.first_due_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', purchaseId)
          .eq('space_id', spaceId);

        if (updatePurchaseError) {
          return { success: false, error: 'Erro ao atualizar dados da compra.' };
        }

        // Remove parcelas pendentes antigas
        await supabase.from('installments').delete().eq('purchase_id', purchaseId);

        // Insere as novas parcelas
        const newInstallments = newSchedule.map((item) => ({
          purchase_id: purchaseId,
          space_id: spaceId,
          installment_number: item.installment_number,
          amount: item.amount,
          due_date: item.due_date,
          status: 'pending',
          notes: null,
        }));

        const { error: insertError } = await supabase.from('installments').insert(newInstallments);
        if (insertError) {
          return { success: false, error: 'Erro ao regenerar parcelas da compra.' };
        }

        return { success: true };
      }

      // 4. Edição padrão (somente metadados: descrição, categoria, observações)
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (input.description !== undefined) updatePayload.description = input.description.trim();
      if (input.category !== undefined) updatePayload.category = input.category;
      if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null;

      const { error: updateError } = await supabase
        .from('installment_purchases')
        .update(updatePayload)
        .eq('id', purchaseId)
        .eq('space_id', spaceId);

      if (updateError) {
        return { success: false, error: 'Erro ao atualizar dados da compra.' };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Exceção ao atualizar compra parcelada:', err);
      return { success: false, error: 'Erro inesperado ao atualizar compra.' };
    }
  },

  /**
   * Exclui uma compra parcelada e suas parcelas vinculadas em cascata.
   */
  async deletePurchase(purchaseId: string, spaceId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    try {
      // Deleta primeiro as parcelas para segurança caso cascade não esteja configurado
      await supabase.from('installments').delete().eq('purchase_id', purchaseId).eq('space_id', spaceId);

      const { error } = await supabase
        .from('installment_purchases')
        .delete()
        .eq('id', purchaseId)
        .eq('space_id', spaceId);

      if (error) {
        console.warn('Erro ao excluir installment_purchase:', error);
        return { success: false, error: 'Não foi possível excluir a compra parcelada.' };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Exceção ao excluir compra:', err);
      return { success: false, error: 'Erro ao excluir compra.' };
    }
  },

  /**
   * Exclui uma única parcela vinculada.
   */
  async deleteSingleInstallment(installmentId: string, spaceId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };
    try {
      const { error } = await supabase
        .from('installments')
        .delete()
        .eq('id', installmentId)
        .eq('space_id', spaceId);

      if (error) {
        console.warn('Erro ao excluir parcela individual:', error);
        return { success: false, error: 'Não foi possível excluir a parcela.' };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Exceção ao excluir parcela individual:', err);
      return { success: false, error: 'Erro ao excluir parcela.' };
    }
  },

  /**
   * Marca uma parcela como paga.
   */
  async markInstallmentAsPaid(
    installmentId: string,
    spaceId: string,
    paidAt?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    try {
      const { error } = await supabase
        .from('installments')
        .update({
          status: 'paid',
          paid_at: paidAt || todayStr,
          paid_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', installmentId)
        .eq('space_id', spaceId);

      if (error) {
        console.warn('Erro ao marcar parcela como paga:', error);
        return { success: false, error: 'Não foi possível registrar o pagamento da parcela.' };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Exceção ao pagar parcela:', err);
      return { success: false, error: 'Erro ao registrar pagamento.' };
    }
  },

  /**
   * Desfaz o pagamento de uma parcela (volta para pending).
   */
  async unmarkInstallmentPayment(
    installmentId: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    try {
      const { error } = await supabase
        .from('installments')
        .update({
          status: 'pending',
          paid_at: null,
          paid_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', installmentId)
        .eq('space_id', spaceId);

      if (error) {
        console.warn('Erro ao desfazer pagamento de parcela:', error);
        return { success: false, error: 'Não foi possível desfazer o pagamento da parcela.' };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Exceção ao desfazer pagamento:', err);
      return { success: false, error: 'Erro ao desfazer pagamento.' };
    }
  },
};
