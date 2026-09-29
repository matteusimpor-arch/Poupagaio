export type SpaceType = 'personal' | 'couple' | 'family' | 'business';

export type SpaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: SpaceRole;
  created_at: string;
  profile?: Profile;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
}

export type ActiveTab = 
  | 'home' 
  | 'movements'
  | 'planning'
  | 'reserves'
  | 'entries' 
  | 'fixed_expenses' 
  | 'variable_expenses' 
  | 'installments' 
  | 'market' 
  | 'goals' 
  | 'wishlist' 
  | 'closing' 
  | 'reports'
  | 'calendar'
  | 'support'
  | 'profile';

export type EntryStatus = 'pending' | 'received';

export interface Entry {
  id: string;
  space_id: string;
  created_by?: string | null;
  user_id?: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  status: EntryStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEntryInput {
  space_id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category?: string;
  status?: EntryStatus;
  notes?: string | null;
}

export interface UpdateEntryInput {
  description?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  category?: string;
  status?: EntryStatus;
  notes?: string | null;
}

export interface EntriesSummary {
  totalPlanned: number; // Total previsto
  totalReceived: number; // Total recebido
  totalPending: number;  // A receber
  count: number;
}

// ==========================================
// GASTOS FIXOS (FIXED EXPENSES) — ETAPA 3.3
// ==========================================
export type ExpenseRecurrence = 'monthly' | 'yearly';
export type FixedExpenseComputedStatus = 'paid' | 'upcoming' | 'overdue';

export interface FixedExpense {
  id: string;
  space_id: string;
  created_by?: string | null;
  description: string;
  amount: number;
  due_day: number; // 1 - 31
  due_month?: number | null; // 1 - 12 (obrigatório para yearly, null para monthly)
  category: string;
  recurrence: ExpenseRecurrence;
  start_date: string; // YYYY-MM-01 (competência inicial do gasto)
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedExpensePayment {
  id: string;
  fixed_expense_id: string;
  space_id: string;
  billing_cycle: string; // YYYY-MM
  paid_at: string; // YYYY-MM-DD
  amount_paid: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedExpenseWithStatus extends FixedExpense {
  computedStatus: FixedExpenseComputedStatus;
  isPaid: boolean;
  payment?: FixedExpensePayment | null;
  dueDateThisMonth: string; // YYYY-MM-DD
}

export interface CreateFixedExpenseInput {
  space_id: string;
  description: string;
  amount: number;
  due_day: number;
  due_month?: number | null;
  category?: string;
  recurrence?: ExpenseRecurrence;
  start_date?: string; // YYYY-MM-01
  notes?: string | null;
}

export interface UpdateFixedExpenseInput {
  description?: string;
  amount?: number;
  due_day?: number;
  due_month?: number | null;
  category?: string;
  recurrence?: ExpenseRecurrence;
  start_date?: string; // YYYY-MM-01
  notes?: string | null;
}

export interface FixedExpensesSummary {
  totalMonth: number;   // Total previsto no mês
  totalPaid: number;    // Pago
  totalPending: number; // A pagar (atrasados + próximos)
  totalUpcoming: number; // Apenas próximos
  totalOverdue: number;  // Apenas atrasados
  count: number;
  paidCount: number;
  upcomingCount: number;
  overdueCount: number;
}

// ==========================================
// GASTOS VARIÁVEIS (VARIABLE EXPENSES) — ETAPA 3.3
// ==========================================
export type VariableExpenseStatus = 'pending' | 'paid';

export interface VariableExpense {
  id: string;
  space_id: string;
  created_by?: string | null;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  status: VariableExpenseStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVariableExpenseInput {
  space_id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category?: string;
  status?: VariableExpenseStatus;
  notes?: string | null;
}

export interface UpdateVariableExpenseInput {
  description?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  category?: string;
  status?: VariableExpenseStatus;
  notes?: string | null;
}

export interface VariableExpensesSummary {
  totalMonth: number;   // Total de variáveis do mês
  totalPaid: number;    // Pago
  totalPending: number; // Pendente
  count: number;
  paidCount: number;
  pendingCount: number;
}

// ==========================================
// PARCELADOS (INSTALLMENTS) — ETAPA 3.4
// ==========================================
export type InstallmentStatus = 'pending' | 'paid';
export type InstallmentComputedStatus = 'paid' | 'upcoming' | 'overdue';

export interface InstallmentPurchase {
  id: string;
  space_id: string;
  created_by?: string | null;
  description: string;
  total_amount: number;
  installment_count: number;
  first_due_date: string; // YYYY-MM-DD
  category: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Installment {
  id: string;
  purchase_id: string;
  space_id: string;
  installment_number: number;
  amount: number;
  due_date: string; // YYYY-MM-DD
  status: InstallmentStatus;
  paid_at?: string | null; // YYYY-MM-DD
  paid_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstallmentWithStatus extends Installment {
  computedStatus: InstallmentComputedStatus;
  purchaseDescription?: string;
  purchaseCategory?: string;
  purchaseTotalCount?: number;
}

export interface InstallmentPurchaseWithInstallments extends InstallmentPurchase {
  installments: InstallmentWithStatus[];
  paidCount: number;
  totalPaidAmount: number;
  progressPercentage: number;
  isFullyPaid: boolean;
  nextDueDate?: string | null;
}

export interface CreateInstallmentPurchaseInput {
  space_id: string;
  description: string;
  total_amount: number;
  installment_count: number;
  first_due_date: string; // YYYY-MM-DD
  category?: string;
  notes?: string | null;
}

export interface UpdateInstallmentPurchaseInput {
  description?: string;
  category?: string;
  notes?: string | null;
  total_amount?: number;
  installment_count?: number;
  first_due_date?: string;
}

export interface InstallmentsMonthSummary {
  totalMonth: number;   // Total de parcelas com vencimento neste mês
  totalPaid: number;    // Parcelas do mês já pagas
  totalPending: number; // Parcelas do mês a pagar (próximas + atrasadas)
  totalUpcoming: number; // Parcelas do mês que ainda vão vencer
  totalOverdue: number;  // Parcelas do mês atrasadas
  count: number;
  paidCount: number;
  upcomingCount: number;
  overdueCount: number;
}

export interface InstallmentsGlobalSummary {
  totalOverall: number;
  totalPaidOverall: number;
  totalRemainingOverall: number;
  activePurchasesCount: number;
  completedPurchasesCount: number;
}

// ==========================================
// METAS (GOALS) — ETAPA 3.5.1
// ==========================================
export type GoalStatus = 'active' | 'completed' | 'paused';

export interface Goal {
  id: string;
  space_id: string;
  created_by?: string | null;
  name: string;
  target_amount: number;
  target_date?: string | null; // YYYY-MM-DD
  category: string;
  status: GoalStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  space_id: string;
  created_by?: string | null;
  amount: number;
  contribution_date: string; // YYYY-MM-DD
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalWithProgress extends Goal {
  contributions: GoalContribution[];
  accumulatedAmount: number;
  progressPercentage: number;
  remainingAmount: number;
  contributionsCount: number;
  isTargetReached: boolean;
  lastContributionDate?: string | null;
}

export interface GoalsSummary {
  totalTarget: number;        // Total das metas (target_amount)
  totalAccumulated: number;   // Total acumulado em aportes
  totalRemaining: number;     // Falta alcançar: max(totalTarget - totalAccumulated, 0)
  goalsCount: number;
  activeCount: number;
  completedCount: number;
  pausedCount: number;
}

export interface CreateGoalInput {
  space_id: string;
  name: string;
  target_amount: number;
  target_date?: string | null;
  category?: string;
  status?: GoalStatus;
  notes?: string | null;
}

export interface UpdateGoalInput {
  name?: string;
  target_amount?: number;
  target_date?: string | null;
  category?: string;
  status?: GoalStatus;
  notes?: string | null;
}

export interface CreateGoalContributionInput {
  goal_id: string;
  space_id: string;
  amount: number;
  contribution_date: string; // YYYY-MM-DD
  notes?: string | null;
}

// ==========================================
// LISTA DE DESEJOS (WISHLIST) — ETAPA 3.5.2
// ==========================================
export type WishlistStatus = 'active' | 'purchased' | 'archived';

export type WishlistPriority = 'low' | 'medium' | 'high';

export interface WishlistItem {
  id: string;
  space_id: string;
  created_by: string;
  name: string;
  estimated_amount: number;
  category: string;
  priority: WishlistPriority;
  desired_date?: string | null; // YYYY-MM-DD
  status: WishlistStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistSummary {
  activeCount: number;         // Desejos ativos
  totalEstimatedAmount: number; // Valor estimado total dos itens ativos
  highPriorityCount: number;   // Quantidade de desejos ativos com prioridade alta
  purchasedCount: number;      // Comprados
  archivedCount: number;       // Arquivados
  totalCount: number;          // Total geral
}

export interface CreateWishlistItemInput {
  space_id: string;
  name: string;
  estimated_amount: number;
  category?: string;
  priority?: WishlistPriority;
  desired_date?: string | null;
  status?: WishlistStatus;
  notes?: string | null;
}

export interface UpdateWishlistItemInput {
  name?: string;
  estimated_amount?: number;
  category?: string;
  priority?: WishlistPriority;
  desired_date?: string | null;
  status?: WishlistStatus;
  notes?: string | null;
}

// ==========================================
// MERCADO (SHOPPING LISTS) — ETAPA 3.6
// ==========================================
export type ShoppingListStatus = 'active' | 'shopping' | 'completed' | 'archived';

export interface ShoppingList {
  id: string;
  space_id: string;
  created_by: string | null;
  name: string;
  shopping_date?: string | null; // YYYY-MM-DD
  budget_amount?: number | null;
  status: ShoppingListStatus;
  notes?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  space_id: string;
  created_by: string | null;
  name: string;
  quantity: number;
  unit?: string | null;
  estimated_unit_price?: number | null;
  actual_unit_price?: number | null;
  is_checked: boolean;
  category?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListTotals {
  totalEstimated: number;
  totalActual: number;
  totalItems: number;
  checkedItems: number;
}

export interface ShoppingListWithItems extends ShoppingList {
  items: ShoppingListItem[];
  totals: ShoppingListTotals;
}

export interface CreateShoppingListInput {
  space_id: string;
  name: string;
  shopping_date?: string | null;
  budget_amount?: number | null;
  notes?: string | null;
}

export interface UpdateShoppingListInput {
  name?: string;
  shopping_date?: string | null;
  budget_amount?: number | null;
  notes?: string | null;
  status?: ShoppingListStatus;
  completed_at?: string | null;
}

export interface CreateShoppingListItemInput {
  shopping_list_id: string;
  space_id: string;
  name: string;
  quantity: number;
  unit?: string | null;
  estimated_unit_price?: number | null;
  actual_unit_price?: number | null;
  is_checked?: boolean;
  category?: string | null;
  notes?: string | null;
}

export interface UpdateShoppingListItemInput {
  name?: string;
  quantity?: number;
  unit?: string | null;
  estimated_unit_price?: number | null;
  actual_unit_price?: number | null;
  is_checked?: boolean;
  category?: string | null;
  notes?: string | null;
}

// ==========================================
// FECHAMENTO DO MÊS (MONTHLY CLOSURES) — ETAPA 3.5
// ==========================================
export interface MonthlyClosure {
  id: string;
  space_id: string;
  billing_cycle: string; // YYYY-MM
  total_income: number;
  total_fixed_expenses: number;
  total_variable_expenses: number;
  total_installments: number;
  total_expenses: number;
  final_balance: number;
  closed_at: string;
  closed_by?: string | null;
  closed_by_name?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MonthlyClosureSummary {
  total_income: number;
  total_fixed_expenses: number;
  total_variable_expenses: number;
  total_installments: number;
  total_expenses: number;
  final_balance: number;
}

export interface CloseMonthInput {
  space_id: string;
  billing_cycle: string; // YYYY-MM
  total_income?: number;
  total_fixed_expenses?: number;
  total_variable_expenses?: number;
  total_installments?: number;
}

// ==========================================
// RESERVAS FINANCEIRAS ("CAIXINHAS")
// ==========================================
export type ReserveTransactionType = 
  | 'initial_allocation' 
  | 'deposit' 
  | 'withdraw' 
  | 'expense_payment' 
  | 'transfer_in' 
  | 'transfer_out' 
  | 'refund';

export interface Reserve {
  id: string;
  space_id: string;
  created_by?: string | null;
  name: string;
  allocated_amount: number; // Valor reservado inicial/planejado
  current_balance: number;   // Saldo disponível atual na caixinha
  billing_cycle: string;     // YYYY-MM
  category?: string | null;  // Categoria vinculada (ex: Combustível, Mercado)
  icon?: string | null;      // Emoji ou chave de ícone (ex: ⛽, 🛒, 🏠, 🎮, 🚗, 💰)
  color?: string | null;     // Cor de destaque visual
  renew_monthly: boolean;    // Se renova automaticamente na nova competência
  is_preferred: boolean;     // Se é a reserva preferencial da categoria
  is_archived?: boolean;     // Soft delete / arquivamento para manter integridade histórica
  archived_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReserveTransaction {
  id: string;
  reserve_id: string;
  space_id: string;
  operation_id?: string;     // Identificador idempotente de operação
  created_by?: string | null;
  type: ReserveTransactionType;
  amount: number;
  previous_balance: number;
  new_balance: number;
  source_description: string;
  related_expense_type?: 'fixed' | 'variable' | 'installment' | null;
  related_expense_id?: string | null;
  related_reserve_id?: string | null;
  transaction_date: string; // YYYY-MM-DD
  notes?: string | null;
  created_at: string;
}

export interface ExpensePaymentSource {
  id: string;
  space_id: string;
  operation_id?: string;     // Identificador idempotente de operação
  expense_type: 'fixed' | 'variable' | 'installment';
  expense_id: string;
  payment_id?: string | null;
  reserve_id?: string | null; // null quando pago com Saldo Livre
  amount: number;
  is_free_balance: boolean;
  payment_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface ReservesSummary {
  totalBalance: number;              // Saldo Total do usuário (Entradas - Despesas Pagas)
  totalReserved: number;             // Total acumulado disponível nas reservas
  freeBalance: number;               // Saldo Livre = Saldo Total - Total Reservado
  totalAllocated: number;            // Total inicialmente alocado nas reservas da competência
  totalSpentFromReserves: number;    // Total gasto a partir das reservas
  contasAPagar: number;              // Contas a pagar pendentes
  count: number;
}

export interface CreateReserveInput {
  space_id: string;
  name: string;
  allocated_amount: number;
  billing_cycle: string; // YYYY-MM
  category?: string | null;
  icon?: string | null;
  color?: string | null;
  renew_monthly?: boolean;
  is_preferred?: boolean;
  notes?: string | null;
}

export interface UpdateReserveInput {
  name?: string;
  allocated_amount?: number;
  category?: string | null;
  icon?: string | null;
  color?: string | null;
  renew_monthly?: boolean;
  is_preferred?: boolean;
  notes?: string | null;
}

export interface AddReserveMoneyInput {
  reserve_id: string;
  space_id: string;
  amount: number;
  date?: string; // YYYY-MM-DD
  notes?: string | null;
}

export interface WithdrawReserveMoneyInput {
  reserve_id: string;
  space_id: string;
  amount: number;
  date?: string; // YYYY-MM-DD
  notes?: string | null;
}

export interface TransferReserveMoneyInput {
  from_reserve_id: string;
  to_reserve_id: string;
  space_id: string;
  amount: number;
  date?: string; // YYYY-MM-DD
  notes?: string | null;
}

export type PaymentOriginType = 'free_balance' | 'reserve' | 'split';

export interface ConfirmPaymentWithOriginInput {
  space_id: string;
  expense_type: 'fixed' | 'variable' | 'installment';
  expense_id: string;
  amount: number;
  payment_date: string; // YYYY-MM-DD
  origin_type: PaymentOriginType;
  primary_reserve_id?: string | null;
  reserve_amount?: number;
  free_balance_amount?: number;
  notes?: string | null;
}




