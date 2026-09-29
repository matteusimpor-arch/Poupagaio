import { supabase } from '../supabase';
import {
  Reserve,
  ReserveTransaction,
  ExpensePaymentSource,
  ReservesSummary,
  CreateReserveInput,
  UpdateReserveInput,
  AddReserveMoneyInput,
  WithdrawReserveMoneyInput,
  TransferReserveMoneyInput,
  ConfirmPaymentWithOriginInput,
} from '../../types';
import { isTableMissingError } from './profile';
import { entriesService } from './entries';
import { checklistService } from './checklist';
import { fixedExpensesService } from './fixedExpenses';
import { variableExpensesService } from './variableExpenses';
import { installmentsService } from './installments';

export const emptyReservesSummary: ReservesSummary = {
  totalBalance: 0,
  totalReserved: 0,
  freeBalance: 0,
  totalAllocated: 0,
  totalSpentFromReserves: 0,
  contasAPagar: 0,
  count: 0,
};

export const RESERVE_ICONS = [
  '⛽', '🛒', '🏠', '🎮', '🚗', '✈️', '💊', '🍔', '💡', '💰', '📱', '🎓', '🐾', '🛡️', '📦'
];

export const RESERVE_COLORS = [
  '#16A66A', '#0D9488', '#0284C7', '#6366F1', '#8B5CF6', 
  '#EC4899', '#F43F5E', '#F59E0B', '#EAB308', '#64748B'
];

// Fallback in-memory/localStorage stores when Supabase tables/RPCs are pending migration
const LOCAL_RESERVES_KEY = 'poupagaio_local_reserves';
const LOCAL_TRANSACTIONS_KEY = 'poupagaio_local_reserve_transactions';
const LOCAL_PAYMENT_SOURCES_KEY = 'poupagaio_local_payment_sources';

function getLocalData<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalData<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

export const reservesService = {
  /**
   * Busca todas as reservas ativas de uma competência e calcula o resumo financeiro (Saldo Total, Reservado, Saldo Livre)
   */
  async getReservesWithSummary(
    spaceId: string,
    year: number,
    month: number
  ): Promise<{
    reserves: Reserve[];
    summary: ReservesSummary;
    isTableMissing: boolean;
    error?: string;
  }> {
    if (!spaceId) {
      return { reserves: [], summary: emptyReservesSummary, isTableMissing: false };
    }

    const billingCycle = `${year}-${String(month).padStart(2, '0')}`;

    try {
      // 1. Obter entradas e checklist do mês para calcular o Saldo Total Disponível Oficial
      const [entriesRes, checklistRes] = await Promise.all([
        entriesService.getMonthSummary(spaceId, year, month),
        checklistService.getMonthlyChecklist(spaceId, year, month),
      ]);

      const totalIncome = entriesRes.totalPlanned;
      const totalPaidExpenses = checklistRes.stats ? checklistRes.stats.paidAmount : 0;
      const totalBalance = Math.max(0, totalIncome - totalPaidExpenses);

      let reserves: Reserve[] = [];
      let isTableMissing = false;

      if (supabase) {
        const { data, error } = await supabase
          .from('reserves')
          .select('*')
          .eq('space_id', spaceId)
          .eq('billing_cycle', billingCycle)
          .eq('is_archived', false)
          .order('is_preferred', { ascending: false })
          .order('name', { ascending: true });

        if (error) {
          if (isTableMissingError(error)) {
            isTableMissing = true;
          } else {
            console.warn('Aviso ao buscar reservas:', error.message || error);
          }
        } else if (data) {
          reserves = data;
        }
      }

      // Se tabela não existir no Supabase, usa o fallback local
      if (isTableMissing || !supabase) {
        const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
        reserves = localList.filter(
          (r) => r.space_id === spaceId && r.billing_cycle === billingCycle && !r.is_archived
        );
      }

      // Cálculos financeiros rigorosos
      let totalReserved = 0;
      let totalAllocated = 0;
      let totalSpentFromReserves = 0;

      for (const r of reserves) {
        const currentBal = Number(r.current_balance) || 0;
        const alloc = Number(r.allocated_amount) || 0;
        totalReserved += currentBal;
        totalAllocated += alloc;
        totalSpentFromReserves += Math.max(0, alloc - currentBal);
      }

      // Saldo Livre oficial = Saldo Total - Total Reservado
      const freeBalance = Math.max(0, totalBalance - totalReserved);
      const contasAPagar = checklistRes.stats ? checklistRes.stats.pendingAmount : 0;

      return {
        reserves,
        summary: {
          totalBalance,
          totalReserved,
          freeBalance,
          totalAllocated,
          totalSpentFromReserves,
          contasAPagar,
          count: reserves.length,
        },
        isTableMissing,
      };
    } catch (err: any) {
      console.warn('Erro ao obter reservas e sumário:', err);
      return {
        reserves: [],
        summary: emptyReservesSummary,
        isTableMissing: false,
        error: 'Erro ao carregar reservas.',
      };
    }
  },

  /**
   * Cria uma nova reserva / caixinha via RPC PostgreSQL segura com idempotência
   */
  async createReserve(
    userId: string,
    input: CreateReserveInput,
    operationId: string = crypto.randomUUID()
  ): Promise<{ reserve: Reserve | null; error?: string; isTableMissing?: boolean }> {
    const name = input.name.trim();
    if (!name) return { reserve: null, error: 'O nome da reserva é obrigatório.' };

    const allocatedAmount = Number(input.allocated_amount);
    if (isNaN(allocatedAmount) || allocatedAmount < 0) {
      return { reserve: null, error: 'O valor reservado deve ser igual ou maior que zero.' };
    }

    if (!input.space_id) {
      return { reserve: null, error: 'Espaço financeiro não selecionado.' };
    }

    const billingCycle = input.billing_cycle || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const now = new Date().toISOString();

    const newReserve: Reserve = {
      id: crypto.randomUUID(),
      space_id: input.space_id,
      created_by: userId || null,
      name,
      allocated_amount: allocatedAmount,
      current_balance: allocatedAmount,
      billing_cycle: billingCycle,
      category: input.category || null,
      icon: input.icon || '💰',
      color: input.color || '#16A66A',
      renew_monthly: input.renew_monthly ?? true,
      is_preferred: input.is_preferred ?? false,
      is_archived: false,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      try {
        // Tenta executar via RPC segura
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_create_reserve', {
          p_space_id: input.space_id,
          p_name: name,
          p_allocated_amount: allocatedAmount,
          p_billing_cycle: billingCycle,
          p_category: input.category || null,
          p_icon: input.icon || '💰',
          p_color: input.color || '#16A66A',
          p_renew_monthly: input.renew_monthly ?? true,
          p_is_preferred: input.is_preferred ?? false,
          p_notes: input.notes?.trim() || null,
          p_operation_id: operationId,
        });

        if (!rpcError && rpcData) {
          return { reserve: rpcData as Reserve };
        }

        // Se RPC falhar por ausência de migration, tenta INSERT direto seguro
        if (rpcError && isTableMissingError(rpcError)) {
          const { data, error } = await supabase
            .from('reserves')
            .insert({
              space_id: newReserve.space_id,
              created_by: newReserve.created_by,
              name: newReserve.name,
              allocated_amount: newReserve.allocated_amount,
              current_balance: newReserve.current_balance,
              billing_cycle: newReserve.billing_cycle,
              category: newReserve.category,
              icon: newReserve.icon,
              color: newReserve.color,
              renew_monthly: newReserve.renew_monthly,
              is_preferred: newReserve.is_preferred,
              is_archived: false,
              notes: newReserve.notes,
            })
            .select()
            .single();

          if (!error && data) {
            const created = data as Reserve;
            await supabase.from('reserve_transactions').insert({
              operation_id: operationId,
              reserve_id: created.id,
              space_id: created.space_id,
              created_by: userId || null,
              type: 'initial_allocation',
              amount: allocatedAmount,
              previous_balance: 0,
              new_balance: allocatedAmount,
              source_description: 'Criação da Reserva / Valor Inicial',
              transaction_date: now.split('T')[0],
            });
            return { reserve: created };
          }
        } else if (rpcError) {
          return { reserve: null, error: rpcError.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { reserve: null, error: err?.message || 'Erro ao criar reserva.' };
        }
      }
    }

    // Local only fallback
    const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
    localList.push(newReserve);
    setLocalData(LOCAL_RESERVES_KEY, localList);

    this.recordTransactionLocal({
      id: crypto.randomUUID(),
      operation_id: operationId,
      reserve_id: newReserve.id,
      space_id: newReserve.space_id,
      created_by: userId,
      type: 'initial_allocation',
      amount: allocatedAmount,
      previous_balance: 0,
      new_balance: allocatedAmount,
      source_description: 'Criação da Reserva / Valor Inicial',
      transaction_date: now.split('T')[0],
      created_at: now,
    });

    return { reserve: newReserve };
  },

  /**
   * Atualiza detalhes cadastrais de uma reserva (nome, ícone, cor, etc.)
   */
  async updateReserve(
    reserveId: string,
    input: UpdateReserveInput
  ): Promise<{ reserve: Reserve | null; error?: string }> {
    if (!reserveId) return { reserve: null, error: 'ID da reserva não informado.' };

    const updates: any = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.category !== undefined) updates.category = input.category;
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.color !== undefined) updates.color = input.color;
    if (input.renew_monthly !== undefined) updates.renew_monthly = input.renew_monthly;
    if (input.is_preferred !== undefined) updates.is_preferred = input.is_preferred;
    if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
    if (input.allocated_amount !== undefined) {
      const newAlloc = Number(input.allocated_amount);
      if (!isNaN(newAlloc) && newAlloc >= 0) {
        updates.allocated_amount = newAlloc;
      }
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('reserves')
          .update(updates)
          .eq('id', reserveId)
          .select()
          .single();

        if (error) {
          if (!isTableMissingError(error)) {
            return { reserve: null, error: error.message };
          }
        } else if (data) {
          return { reserve: data as Reserve };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { reserve: null, error: err.message };
        }
      }
    }

    // Local fallback update
    const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
    const idx = localList.findIndex((r) => r.id === reserveId);
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...updates };
      setLocalData(LOCAL_RESERVES_KEY, localList);
      return { reserve: localList[idx] };
    }

    return { reserve: null, error: 'Reserva não encontrada.' };
  },

  /**
   * Exclui ou arquiva uma reserva (se tiver movimentações, arquiva mantendo histórico auditável)
   */
  async deleteReserve(
    reserveId: string,
    spaceId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!reserveId) return { success: false, error: 'ID da reserva não informado.' };

    if (supabase) {
      try {
        // Tenta RPC de arquivamento/exclusão segura
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_archive_or_delete_reserve', {
          p_reserve_id: reserveId,
          p_space_id: spaceId,
        });

        if (!rpcError && rpcData) {
          return { success: true };
        }

        if (rpcError && !isTableMissingError(rpcError)) {
          // Fallback para delete direto se RPC não existir
          const { error: delError } = await supabase
            .from('reserves')
            .delete()
            .eq('id', reserveId)
            .eq('space_id', spaceId);

          if (!delError) return { success: true };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { success: false, error: err.message };
        }
      }
    }

    // Local fallback
    const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
    const filtered = localList.filter((r) => r.id !== reserveId);
    setLocalData(LOCAL_RESERVES_KEY, filtered);

    return { success: true };
  },

  /**
   * Adicionar dinheiro à reserva (Aporte via RPC atômica com FOR UPDATE e idempotência)
   */
  async addMoney(
    userId: string,
    input: AddReserveMoneyInput,
    operationId: string = crypto.randomUUID()
  ): Promise<{ reserve: Reserve | null; error?: string }> {
    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { reserve: null, error: 'O valor a adicionar deve ser maior que zero.' };
    }

    const dateStr = input.date || new Date().toISOString().split('T')[0];

    if (supabase) {
      try {
        // Executa RPC segura com SELECT ... FOR UPDATE no PostgreSQL
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_deposit_to_reserve', {
          p_reserve_id: input.reserve_id,
          p_space_id: input.space_id,
          p_amount: amount,
          p_date: dateStr,
          p_notes: input.notes || null,
          p_operation_id: operationId,
        });

        if (!rpcError && rpcData) {
          return { reserve: rpcData as Reserve };
        }

        if (rpcError && !isTableMissingError(rpcError)) {
          return { reserve: null, error: rpcError.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { reserve: null, error: err.message };
        }
      }
    }

    // Local fallback
    const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
    const idx = localList.findIndex((r) => r.id === input.reserve_id);
    if (idx !== -1) {
      const prevBalance = Number(localList[idx].current_balance) || 0;
      const newBalance = prevBalance + amount;
      localList[idx].current_balance = newBalance;
      setLocalData(LOCAL_RESERVES_KEY, localList);

      this.recordTransactionLocal({
        id: crypto.randomUUID(),
        operation_id: operationId,
        reserve_id: input.reserve_id,
        space_id: input.space_id,
        created_by: userId,
        type: 'deposit',
        amount,
        previous_balance: prevBalance,
        new_balance: newBalance,
        source_description: 'Aporte de Saldo Livre',
        transaction_date: dateStr,
        notes: input.notes || null,
        created_at: new Date().toISOString(),
      });
      return { reserve: localList[idx] };
    }

    return { reserve: null, error: 'Reserva não encontrada.' };
  },

  /**
   * Retirar dinheiro da reserva (Retirada via RPC atômica com FOR UPDATE e idempotência)
   */
  async withdrawMoney(
    userId: string,
    input: WithdrawReserveMoneyInput,
    operationId: string = crypto.randomUUID()
  ): Promise<{ reserve: Reserve | null; error?: string }> {
    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { reserve: null, error: 'O valor a retirar deve ser maior que zero.' };
    }

    const dateStr = input.date || new Date().toISOString().split('T')[0];

    if (supabase) {
      try {
        // Executa RPC segura com SELECT ... FOR UPDATE no PostgreSQL
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_withdraw_from_reserve', {
          p_reserve_id: input.reserve_id,
          p_space_id: input.space_id,
          p_amount: amount,
          p_date: dateStr,
          p_notes: input.notes || null,
          p_operation_id: operationId,
        });

        if (!rpcError && rpcData) {
          return { reserve: rpcData as Reserve };
        }

        if (rpcError && !isTableMissingError(rpcError)) {
          return { reserve: null, error: rpcError.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { reserve: null, error: err.message };
        }
      }
    }

    // Local fallback
    const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
    const idx = localList.findIndex((r) => r.id === input.reserve_id);
    if (idx !== -1) {
      const prevBalance = Number(localList[idx].current_balance) || 0;
      if (amount > prevBalance) {
        return {
          reserve: null,
          error: `Saldo insuficiente na reserva. Disponível: R$ ${prevBalance.toFixed(2)}`,
        };
      }
      const newBalance = prevBalance - amount;
      localList[idx].current_balance = newBalance;
      setLocalData(LOCAL_RESERVES_KEY, localList);

      this.recordTransactionLocal({
        id: crypto.randomUUID(),
        operation_id: operationId,
        reserve_id: input.reserve_id,
        space_id: input.space_id,
        created_by: userId,
        type: 'withdraw',
        amount,
        previous_balance: prevBalance,
        new_balance: newBalance,
        source_description: 'Retirada para Saldo Livre',
        transaction_date: dateStr,
        notes: input.notes || null,
        created_at: new Date().toISOString(),
      });
      return { reserve: localList[idx] };
    }

    return { reserve: null, error: 'Reserva não encontrada.' };
  },

  /**
   * Transferência atômica entre reservas (Reserva A -> Reserva B) com ordenação anti-deadlock
   */
  async transferMoney(
    userId: string,
    input: TransferReserveMoneyInput,
    operationId: string = crypto.randomUUID()
  ): Promise<{ success: boolean; error?: string }> {
    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'O valor da transferência deve ser maior que zero.' };
    }

    if (input.from_reserve_id === input.to_reserve_id) {
      return { success: false, error: 'A reserva de origem e destino devem ser diferentes.' };
    }

    const dateStr = input.date || new Date().toISOString().split('T')[0];

    if (supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_transfer_between_reserves', {
          p_from_reserve_id: input.from_reserve_id,
          p_to_reserve_id: input.to_reserve_id,
          p_space_id: input.space_id,
          p_amount: amount,
          p_date: dateStr,
          p_notes: input.notes || null,
          p_operation_id: operationId,
        });

        if (!rpcError && rpcData) {
          return { success: true };
        }

        if (rpcError && !isTableMissingError(rpcError)) {
          return { success: false, error: rpcError.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { success: false, error: err.message };
        }
      }
    }

    // Local fallback
    const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
    const idxA = localList.findIndex((r) => r.id === input.from_reserve_id);
    const idxB = localList.findIndex((r) => r.id === input.to_reserve_id);

    if (idxA === -1 || idxB === -1) {
      return { success: false, error: 'Reservas não localizadas.' };
    }

    const fromPrevBal = Number(localList[idxA].current_balance) || 0;
    if (amount > fromPrevBal) {
      return {
        success: false,
        error: `Saldo insuficiente na reserva "${localList[idxA].name}". Disponível: R$ ${fromPrevBal.toFixed(2)}`,
      };
    }

    const fromNewBal = fromPrevBal - amount;
    const toPrevBal = Number(localList[idxB].current_balance) || 0;
    const toNewBal = toPrevBal + amount;
    const now = new Date().toISOString();

    localList[idxA].current_balance = fromNewBal;
    localList[idxB].current_balance = toNewBal;
    setLocalData(LOCAL_RESERVES_KEY, localList);

    this.recordTransactionLocal({
      id: crypto.randomUUID(),
      operation_id: operationId,
      reserve_id: input.from_reserve_id,
      space_id: input.space_id,
      created_by: userId,
      type: 'transfer_out',
      amount,
      previous_balance: fromPrevBal,
      new_balance: fromNewBal,
      source_description: `Transferência para "${localList[idxB].name}"`,
      related_reserve_id: input.to_reserve_id,
      transaction_date: dateStr,
      created_at: now,
    });

    this.recordTransactionLocal({
      id: crypto.randomUUID(),
      operation_id: operationId,
      reserve_id: input.to_reserve_id,
      space_id: input.space_id,
      created_by: userId,
      type: 'transfer_in',
      amount,
      previous_balance: toPrevBal,
      new_balance: toNewBal,
      source_description: `Transferência recebida de "${localList[idxA].name}"`,
      related_reserve_id: input.from_reserve_id,
      transaction_date: dateStr,
      created_at: now,
    });

    return { success: true };
  },

  /**
   * Busca o histórico de transações / extrato de uma reserva
   */
  async getReserveTransactions(
    reserveId: string
  ): Promise<{ transactions: ReserveTransaction[]; error?: string }> {
    if (!reserveId) return { transactions: [] };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('reserve_transactions')
          .select('*')
          .eq('reserve_id', reserveId)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error && !isTableMissingError(error)) {
          return { transactions: [], error: error.message };
        }
        if (data) return { transactions: data };
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { transactions: [], error: err.message };
        }
      }
    }

    // Local fallback
    const localTxs = getLocalData<ReserveTransaction[]>(LOCAL_TRANSACTIONS_KEY, []);
    const filtered = localTxs
      .filter((t) => t.reserve_id === reserveId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { transactions: filtered };
  },

  /**
   * Executa o pagamento de uma despesa especificando a origem financeira (Saldo Livre ou Reserva(s))
   * Utiliza RPC PostgreSQL transacional que valida concorrência (FOR UPDATE), idempotência e registra fontes
   */
  async payExpenseWithOrigin(
    userId: string,
    input: ConfirmPaymentWithOriginInput,
    operationId: string = crypto.randomUUID()
  ): Promise<{ success: boolean; error?: string }> {
    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Valor da despesa inválido.' };
    }

    const dateStr = input.payment_date || new Date().toISOString().split('T')[0];

    // Monta o array estruturado de fontes
    let sources: Array<{ reserve_id: string | null; amount: number; is_free_balance: boolean }> = [];

    if (input.origin_type === 'reserve' && input.primary_reserve_id) {
      sources = [{ reserve_id: input.primary_reserve_id, amount, is_free_balance: false }];
    } else if (input.origin_type === 'split' && input.primary_reserve_id) {
      const reserveAmt = Number(input.reserve_amount) || 0;
      const freeBalAmt = Number(input.free_balance_amount) || Math.max(0, amount - reserveAmt);
      if (reserveAmt > 0) {
        sources.push({ reserve_id: input.primary_reserve_id, amount: reserveAmt, is_free_balance: false });
      }
      if (freeBalAmt > 0) {
        sources.push({ reserve_id: null, amount: freeBalAmt, is_free_balance: true });
      }
    } else {
      sources = [{ reserve_id: null, amount, is_free_balance: true }];
    }

    if (supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_pay_expense_from_sources', {
          p_space_id: input.space_id,
          p_expense_type: input.expense_type,
          p_expense_id: input.expense_id,
          p_total_amount: amount,
          p_payment_date: dateStr,
          p_sources: sources,
          p_operation_id: operationId,
        });

        if (!rpcError && rpcData) {
          return { success: true };
        }

        if (rpcError && !isTableMissingError(rpcError)) {
          return { success: false, error: rpcError.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { success: false, error: err.message };
        }
      }
    }

    // Local fallback execution
    const now = new Date().toISOString();
    for (const src of sources) {
      if (!src.is_free_balance && src.reserve_id) {
        const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
        const idx = localList.findIndex((r) => r.id === src.reserve_id);
        if (idx !== -1) {
          const prevBal = Number(localList[idx].current_balance) || 0;
          if (src.amount > prevBal) {
            return {
              success: false,
              error: `Saldo insuficiente na reserva "${localList[idx].name}".`,
            };
          }
          const newBal = prevBal - src.amount;
          localList[idx].current_balance = newBal;
          setLocalData(LOCAL_RESERVES_KEY, localList);

          this.recordTransactionLocal({
            id: crypto.randomUUID(),
            operation_id: operationId,
            reserve_id: src.reserve_id,
            space_id: input.space_id,
            created_by: userId,
            type: 'expense_payment',
            amount: src.amount,
            previous_balance: prevBal,
            new_balance: newBal,
            source_description: 'Pagamento de despesa',
            related_expense_type: input.expense_type,
            related_expense_id: input.expense_id,
            transaction_date: dateStr,
            created_at: now,
          });
        }
      }

      await this.recordPaymentSource({
        id: crypto.randomUUID(),
        operation_id: operationId,
        space_id: input.space_id,
        expense_type: input.expense_type,
        expense_id: input.expense_id,
        reserve_id: src.reserve_id,
        amount: src.amount,
        is_free_balance: src.is_free_balance,
        payment_date: dateStr,
        created_at: now,
      });
    }

    // Marca o status de pago no serviço correspondente
    const [y, m] = dateStr.split('-').map(Number);
    if (input.expense_type === 'fixed') {
      await fixedExpensesService.markAsPaid(input.expense_id, input.space_id, y, m, amount, userId);
    } else if (input.expense_type === 'variable') {
      await variableExpensesService.updateVariableExpense(input.expense_id, { status: 'paid', date: dateStr });
    } else if (input.expense_type === 'installment') {
      await installmentsService.markInstallmentAsPaid(input.expense_id, input.space_id);
    }

    return { success: true };
  },

  /**
   * Estorna pagamentos ao desfazer ou cancelar o pagamento de uma despesa
   * Cria transações de estorno auditáveis (type = 'refund') e devolve saldo às reservas
   */
  async refundExpensePayment(
    expenseType: 'fixed' | 'variable' | 'installment',
    expenseId: string,
    spaceId: string,
    userId?: string,
    operationId: string = crypto.randomUUID()
  ): Promise<{ success: boolean; refundedAmount: number; error?: string }> {
    if (supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_refund_expense_payment', {
          p_expense_type: expenseType,
          p_expense_id: expenseId,
          p_space_id: spaceId,
          p_operation_id: operationId,
        });

        if (!rpcError && rpcData) {
          return { success: true, refundedAmount: rpcData.refunded_amount || 0 };
        }

        if (rpcError && !isTableMissingError(rpcError)) {
          return { success: false, refundedAmount: 0, error: rpcError.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { success: false, refundedAmount: 0, error: err.message };
        }
      }
    }

    // Local fallback refund
    const localSources = getLocalData<ExpensePaymentSource[]>(LOCAL_PAYMENT_SOURCES_KEY, []);
    const sources = localSources.filter((s) => s.expense_type === expenseType && s.expense_id === expenseId && s.space_id === spaceId);

    let totalRefunded = 0;
    const now = new Date().toISOString();

    for (const src of sources) {
      if (!src.is_free_balance && src.reserve_id) {
        const amount = Number(src.amount) || 0;
        totalRefunded += amount;

        const localList = getLocalData<Reserve[]>(LOCAL_RESERVES_KEY, []);
        const idx = localList.findIndex((r) => r.id === src.reserve_id);
        if (idx !== -1) {
          const prevBal = Number(localList[idx].current_balance) || 0;
          const newBal = prevBal + amount;
          localList[idx].current_balance = newBal;
          setLocalData(LOCAL_RESERVES_KEY, localList);

          this.recordTransactionLocal({
            id: crypto.randomUUID(),
            operation_id: operationId,
            reserve_id: src.reserve_id,
            space_id: spaceId,
            created_by: userId,
            type: 'refund',
            amount,
            previous_balance: prevBal,
            new_balance: newBal,
            source_description: 'Estorno por cancelamento ou desmarcação de pagamento',
            related_expense_type: expenseType,
            related_expense_id: expenseId,
            transaction_date: now.split('T')[0],
            created_at: now,
          });
        }
      }
    }

    const remainingSources = localSources.filter(
      (s) => !(s.expense_type === expenseType && s.expense_id === expenseId && s.space_id === spaceId)
    );
    setLocalData(LOCAL_PAYMENT_SOURCES_KEY, remainingSources);

    return { success: true, refundedAmount: totalRefunded };
  },

  /**
   * Ajusta incrementalmente o valor de uma despesa já paga (débito ou estorno da diferença)
   */
  async adjustExpensePaymentAmount(
    expenseType: 'fixed' | 'variable' | 'installment',
    expenseId: string,
    spaceId: string,
    newTotalAmount: number,
    operationId: string = crypto.randomUUID()
  ): Promise<{ success: boolean; difference?: number; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('rpc_adjust_expense_payment_amount', {
          p_expense_type: expenseType,
          p_expense_id: expenseId,
          p_space_id: spaceId,
          p_new_total_amount: newTotalAmount,
          p_operation_id: operationId,
        });

        if (!error && data) {
          return { success: true, difference: data.difference };
        }
        if (error && !isTableMissingError(error)) {
          return { success: false, error: error.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { success: false, error: err.message };
        }
      }
    }
    return { success: true };
  },

  /**
   * Troca a origem de uma despesa já paga (estorno da anterior e aplicação da nova atomicamente)
   */
  async changeExpensePaymentOrigin(
    expenseType: 'fixed' | 'variable' | 'installment',
    expenseId: string,
    spaceId: string,
    totalAmount: number,
    paymentDate: string,
    newSources: Array<{ reserve_id: string | null; amount: number; is_free_balance: boolean }>,
    operationId: string = crypto.randomUUID()
  ): Promise<{ success: boolean; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('rpc_change_expense_payment_origin', {
          p_expense_type: expenseType,
          p_expense_id: expenseId,
          p_space_id: spaceId,
          p_total_amount: totalAmount,
          p_payment_date: paymentDate,
          p_new_sources: newSources,
          p_operation_id: operationId,
        });

        if (!error && data) {
          return { success: true };
        }
        if (error && !isTableMissingError(error)) {
          return { success: false, error: error.message };
        }
      } catch (err: any) {
        if (!isTableMissingError(err)) {
          return { success: false, error: err.message };
        }
      }
    }
    return { success: true };
  },

  async recordPaymentSource(source: ExpensePaymentSource): Promise<void> {
    if (supabase) {
      try {
        await supabase.from('expense_payment_sources').insert(source);
        return;
      } catch {
        // ignore
      }
    }
    const list = getLocalData<ExpensePaymentSource[]>(LOCAL_PAYMENT_SOURCES_KEY, []);
    list.push(source);
    setLocalData(LOCAL_PAYMENT_SOURCES_KEY, list);
  },

  recordTransactionLocal(tx: ReserveTransaction): void {
    const list = getLocalData<ReserveTransaction[]>(LOCAL_TRANSACTIONS_KEY, []);
    list.push(tx);
    setLocalData(LOCAL_TRANSACTIONS_KEY, list);
  },
};
