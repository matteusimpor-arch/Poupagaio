import { fixedExpensesService } from './fixedExpenses';
import { variableExpensesService } from './variableExpenses';
import { installmentsService } from './installments';

export type ChecklistSourceType = 'fixed' | 'variable' | 'installment';
export type VisualStatus = 'paid' | 'overdue' | 'today' | 'upcoming' | 'pending';
export type AlertSeverity = 'critical' | 'alert' | 'warning';

export interface NormalizedChecklistExpense {
  id: string; // unique item id, e.g. "fixed_abc"
  sourceType: ChecklistSourceType;
  sourceId: string; // database record ID
  title: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  category: string;
  status: 'pending' | 'paid';
  visualStatus: VisualStatus;
  installmentNumber?: number;
  totalInstallments?: number;
  purchaseId?: string;
}

export interface FinancialAlert {
  id: string;
  itemId: string;
  title: string;
  amount: number;
  dueDate: string;
  severity: AlertSeverity; // critical = overdue/today, alert = tomorrow, warning = next 2-3 days
  badgeText: string;
  sourceType: ChecklistSourceType;
  category: string;
}

export interface MonthlyChecklistResult {
  items: NormalizedChecklistExpense[];
  alerts: FinancialAlert[];
  stats: {
    totalItems: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    todayCount: number;
    upcomingCount: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    progressPercentage: number;
  };
  isTableMissing: boolean;
  error?: string;
}

/**
 * Utilitário para formatar datas YYYY-MM-DD
 */
function getTodayFormatted(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const resY = dt.getFullYear();
  const resM = String(dt.getMonth() + 1).padStart(2, '0');
  const resD = String(dt.getDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

export const checklistService = {
  /**
   * Consolida todos os compromissos (Fixos, Variáveis e Parcelados) da competência
   */
  async getMonthlyChecklist(
    spaceId: string,
    year: number,
    month: number
  ): Promise<MonthlyChecklistResult> {
    if (!spaceId) {
      return {
        items: [],
        alerts: [],
        stats: {
          totalItems: 0,
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
          todayCount: 0,
          upcomingCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          progressPercentage: 0,
        },
        isTableMissing: false,
      };
    }

    const todayStr = getTodayFormatted();
    const tomorrowStr = addDays(todayStr, 1);
    const dayPlus3Str = addDays(todayStr, 3);

    try {
      // Busca simultânea dos 3 módulos
      const [fixedRes, variableRes, installmentsRes] = await Promise.all([
        fixedExpensesService.getFixedExpensesWithStatus(spaceId, year, month),
        variableExpensesService.getVariableExpensesByMonth(spaceId, year, month),
        installmentsService.getPurchasesWithInstallments(spaceId, { year, month }),
      ]);

      const items: NormalizedChecklistExpense[] = [];
      const isTableMissing = fixedRes.isTableMissing || variableRes.isTableMissing || installmentsRes.isTableMissing;

      // 1. Processa Gastos Fixos
      for (const fe of fixedRes.expenses) {
        const isPaid = fe.isPaid;
        const dueDate = fe.dueDateThisMonth;

        let visualStatus: VisualStatus = 'pending';
        if (isPaid) {
          visualStatus = 'paid';
        } else if (dueDate < todayStr) {
          visualStatus = 'overdue';
        } else if (dueDate === todayStr) {
          visualStatus = 'today';
        } else if (dueDate > todayStr && dueDate <= dayPlus3Str) {
          visualStatus = 'upcoming';
        } else {
          visualStatus = 'pending';
        }

        items.push({
          id: `fixed_${fe.id}`,
          sourceType: 'fixed',
          sourceId: fe.id,
          title: fe.description,
          amount: Number(fe.amount) || 0,
          dueDate,
          category: fe.category || 'Fixo',
          status: isPaid ? 'paid' : 'pending',
          visualStatus,
        });
      }

      // 2. Processa Gastos Variáveis
      for (const ve of variableRes.expenses) {
        const isPaid = ve.status === 'paid';
        const dueDate = ve.date;

        let visualStatus: VisualStatus = 'pending';
        if (isPaid) {
          visualStatus = 'paid';
        } else if (dueDate < todayStr) {
          visualStatus = 'overdue';
        } else if (dueDate === todayStr) {
          visualStatus = 'today';
        } else if (dueDate > todayStr && dueDate <= dayPlus3Str) {
          visualStatus = 'upcoming';
        } else {
          visualStatus = 'pending';
        }

        items.push({
          id: `var_${ve.id}`,
          sourceType: 'variable',
          sourceId: ve.id,
          title: ve.description,
          amount: Number(ve.amount) || 0,
          dueDate,
          category: ve.category || 'Variável',
          status: isPaid ? 'paid' : 'pending',
          visualStatus,
        });
      }

      // 3. Processa Parcelados
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      for (const purchase of installmentsRes.purchases) {
        for (const inst of purchase.installments) {
          if (inst.due_date.startsWith(monthPrefix)) {
            const isPaid = inst.status === 'paid';
            const dueDate = inst.due_date;

            let visualStatus: VisualStatus = 'pending';
            if (isPaid) {
              visualStatus = 'paid';
            } else if (dueDate < todayStr) {
              visualStatus = 'overdue';
            } else if (dueDate === todayStr) {
              visualStatus = 'today';
            } else if (dueDate > todayStr && dueDate <= dayPlus3Str) {
              visualStatus = 'upcoming';
            } else {
              visualStatus = 'pending';
            }

            items.push({
              id: `inst_${inst.id}`,
              sourceType: 'installment',
              sourceId: inst.id,
              title: `${purchase.description}`,
              amount: Number(inst.amount) || 0,
              dueDate,
              category: purchase.category || 'Parcelado',
              status: isPaid ? 'paid' : 'pending',
              visualStatus,
              installmentNumber: inst.installment_number,
              totalInstallments: purchase.installment_count,
              purchaseId: purchase.id,
            });
          }
        }
      }

      // Ordenação prioritária:
      // 1. overdue (Atrasados)
      // 2. today (Vencem Hoje)
      // 3. upcoming (Próximos)
      // 4. pending (Pendentes)
      // 5. paid (Pagos)
      // Secundário: Data de vencimento crescente e depois Título
      const statusPriority: Record<VisualStatus, number> = {
        overdue: 1,
        today: 2,
        upcoming: 3,
        pending: 4,
        paid: 5,
      };

      items.sort((a, b) => {
        const prioA = statusPriority[a.visualStatus];
        const priob = statusPriority[b.visualStatus];
        if (prioA !== priob) return prioA - priob;
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.title.localeCompare(b.title);
      });

      // Geração determinística dos alertas automáticos
      const alerts: FinancialAlert[] = [];
      for (const item of items) {
        if (item.status === 'paid') continue; // Pagos não geram alertas

        if (item.visualStatus === 'overdue') {
          alerts.push({
            id: `alert_${item.id}`,
            itemId: item.id,
            title: item.title,
            amount: item.amount,
            dueDate: item.dueDate,
            severity: 'critical',
            badgeText: 'Atrasado',
            sourceType: item.sourceType,
            category: item.category,
          });
        } else if (item.visualStatus === 'today') {
          alerts.push({
            id: `alert_${item.id}`,
            itemId: item.id,
            title: item.title,
            amount: item.amount,
            dueDate: item.dueDate,
            severity: 'critical',
            badgeText: 'Vence Hoje',
            sourceType: item.sourceType,
            category: item.category,
          });
        } else if (item.visualStatus === 'upcoming') {
          const isTomorrow = item.dueDate === tomorrowStr;
          alerts.push({
            id: `alert_${item.id}`,
            itemId: item.id,
            title: item.title,
            amount: item.amount,
            dueDate: item.dueDate,
            severity: isTomorrow ? 'alert' : 'warning',
            badgeText: isTomorrow ? 'Vence Amanhã' : 'Vence em breve',
            sourceType: item.sourceType,
            category: item.category,
          });
        }
      }

      // Ordena alertas por severidade (critical -> alert -> warning) e depois por data
      const alertSeverityPrio: Record<AlertSeverity, number> = {
        critical: 1,
        alert: 2,
        warning: 3,
      };
      alerts.sort((a, b) => {
        const pA = alertSeverityPrio[a.severity];
        const pB = alertSeverityPrio[b.severity];
        if (pA !== pB) return pA - pB;
        return a.dueDate.localeCompare(b.dueDate);
      });

      // Cálculos estatísticos
      let paidCount = 0;
      let pendingCount = 0;
      let overdueCount = 0;
      let todayCount = 0;
      let upcomingCount = 0;
      let totalAmount = 0;
      let paidAmount = 0;
      let pendingAmount = 0;

      for (const item of items) {
        totalAmount += item.amount;
        if (item.status === 'paid') {
          paidCount++;
          paidAmount += item.amount;
        } else {
          pendingCount++;
          pendingAmount += item.amount;
          if (item.visualStatus === 'overdue') overdueCount++;
          if (item.visualStatus === 'today') todayCount++;
          if (item.visualStatus === 'upcoming') upcomingCount++;
        }
      }

      const totalItems = items.length;
      const progressPercentage = totalItems > 0 ? Math.round((paidCount / totalItems) * 100) : 0;

      return {
        items,
        alerts,
        stats: {
          totalItems,
          paidCount,
          pendingCount,
          overdueCount,
          todayCount,
          upcomingCount,
          totalAmount,
          paidAmount,
          pendingAmount,
          progressPercentage,
        },
        isTableMissing,
      };
    } catch (err: any) {
      console.warn('Exceção ao gerar checklist do mês:', err);
      return {
        items: [],
        alerts: [],
        stats: {
          totalItems: 0,
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
          todayCount: 0,
          upcomingCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          progressPercentage: 0,
        },
        isTableMissing: false,
        error: 'Erro ao consolidar o checklist do mês.',
      };
    }
  },

  /**
   * Alterna o estado de pagamento de um item do checklist
   */
  async toggleItemPaymentStatus(
    item: NormalizedChecklistExpense,
    spaceId: string,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> {
    if (item.sourceType === 'fixed') {
      if (item.status === 'paid') {
        return await fixedExpensesService.unmarkPaid(item.sourceId, year, month);
      } else {
        const res = await fixedExpensesService.markAsPaid(item.sourceId, spaceId, year, month, item.amount);
        return { success: !!res.payment, error: res.error };
      }
    } else if (item.sourceType === 'variable') {
      const nextStatus = item.status === 'paid' ? 'pending' : 'paid';
      const res = await variableExpensesService.updateVariableExpense(item.sourceId, { status: nextStatus });
      return { success: !!res.expense, error: res.error };
    } else if (item.sourceType === 'installment') {
      if (item.status === 'paid') {
        return await installmentsService.unmarkInstallmentPayment(item.sourceId, spaceId);
      } else {
        return await installmentsService.markInstallmentAsPaid(item.sourceId, spaceId);
      }
    }

    return { success: false, error: 'Tipo de compromisso desconhecido.' };
  },
};
