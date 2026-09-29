import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { entriesService } from '../../lib/services/entries';
import { checklistService, NormalizedChecklistExpense, MonthlyChecklistResult } from '../../lib/services/checklist';
import { calendarNotesService, CalendarNote } from '../../lib/services/calendarNotes';
import { goalsService } from '../../lib/services/goals';
import { installmentsService } from '../../lib/services/installments';
import { marketService, calculateListTotals } from '../../lib/services/market';
import { formatCurrency } from '../../lib/formatters';
import {
  ActiveTab,
  EntriesSummary,
  GoalWithProgress,
  InstallmentPurchaseWithInstallments,
  ShoppingListItem,
  ShoppingListWithItems,
  ShoppingListTotals,
} from '../../types';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Target,
  ShoppingBag,
  BarChart3,
  Sparkles,
  PieChart as PieIcon,
  TrendingUp,
  Plus,
  FileText,
} from 'lucide-react';

import { FixedExpenseModal } from '../fixed-expenses/FixedExpenseModal';
import { VariableExpenseModal } from '../variable-expenses/VariableExpenseModal';
import { InstallmentPurchaseModal } from '../installments/InstallmentPurchaseModal';
import { GoalModal } from '../goals/GoalModal';
import { EntryModal } from '../entries/EntryModal';
import { DashboardReservesSection } from './DashboardReservesSection';
import { PaymentOriginConfirmModal } from '../reserves/PaymentOriginConfirmModal';
import { fixedExpensesService } from '../../lib/services/fixedExpenses';
import { variableExpensesService } from '../../lib/services/variableExpenses';
import { reservesService, emptyReservesSummary } from '../../lib/services/reserves';
import {
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  CreateVariableExpenseInput,
  UpdateVariableExpenseInput,
  CreateInstallmentPurchaseInput,
  UpdateInstallmentPurchaseInput,
  CreateGoalInput,
  UpdateGoalInput,
  ReservesSummary,
  CreateEntryInput,
  UpdateEntryInput,
} from '../../types';

interface DashboardHomeProps {
  onSelectTab: (tab: ActiveTab) => void;
  selectedYear?: number;
  selectedMonth?: number;
  onMonthChange?: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT_NAMES = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'
];

const DONUT_COLORS = {
  fixed: '#8B5CF6',       // ROXO
  variable: '#E11D48',    // VERMELHO
  installments: '#F59E0B', // LARANJA
};

export function DashboardHome({
  onSelectTab,
  selectedYear: initialYear,
  selectedMonth: initialMonth,
  onMonthChange,
}: DashboardHomeProps) {
  const { profile, user, currentSpace } = useAuth();
  const { theme } = useTheme();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(initialYear || now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialMonth || (now.getMonth() + 1));

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (initialYear && initialMonth) {
      setCurrentYear(initialYear);
      setCurrentMonth(initialMonth);
    }
  }, [initialYear, initialMonth]);

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
    onMonthChange?.(newYear, newMonth);
  };

  // Core Operational Data States
  const [checklistResult, setChecklistResult] = useState<MonthlyChecklistResult | null>(null);
  const [entriesSummary, setEntriesSummary] = useState<EntriesSummary>({
    totalPlanned: 0,
    totalReceived: 0,
    totalPending: 0,
    count: 0,
  });
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [activeGoals, setActiveGoals] = useState<GoalWithProgress[]>([]);
  const [activeInstallments, setActiveInstallments] = useState<InstallmentPurchaseWithInstallments[]>([]);
  const [activeMarketList, setActiveMarketList] = useState<ShoppingListWithItems | null>(null);
  const [activeMarketTotals, setActiveMarketTotals] = useState<ShoppingListTotals | null>(null);
  const [reservesSummary, setReservesSummary] = useState<ReservesSummary>(emptyReservesSummary);
  
  // Interactive Modal & View States
  const [confirmPaymentItem, setConfirmPaymentItem] = useState<NormalizedChecklistExpense | null>(null);
  const [showAllChecklistMobile, setShowAllChecklistMobile] = useState<boolean>(false);
  const [isQuickAddMenuOpen, setIsQuickAddMenuOpen] = useState<boolean>(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState<boolean>(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [quickAddModalType, setQuickAddModalType] = useState<
    'fixed_expenses' | 'variable_expenses' | 'installments' | null
  >(null);

  // Historical evolution chart state
  const [evolutionData, setEvolutionData] = useState<Array<{
    monthLabel: string;
    Entradas: number;
    Despesas: number;
    Saldo: number;
  }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [checklistFilter, setChecklistFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedMiniDay, setSelectedMiniDay] = useState<number>(now.getDate());

  // Load All Dashboard Data
  const loadDashboardData = async () => {
    if (!currentSpace?.id) return;
    setIsLoading(true);
    setActionError(null);

    try {
      const [
        checklistRes,
        entriesRes,
        notesRes,
        goalsRes,
        installmentsRes,
        marketListsRes,
        reservesRes,
      ] = await Promise.all([
        checklistService.getMonthlyChecklist(currentSpace.id, currentYear, currentMonth),
        entriesService.getMonthSummary(currentSpace.id, currentYear, currentMonth),
        calendarNotesService.getNotesByMonth(currentSpace.id, currentYear, currentMonth),
        goalsService.getGoalsWithProgress(currentSpace.id, { filterStatus: 'active' }),
        installmentsService.getPurchasesWithInstallments(currentSpace.id, { filterStatus: 'active' }),
        marketService.getShoppingLists(currentSpace.id, { filterStatus: 'active' }),
        reservesService.getReservesWithSummary(currentSpace.id, currentYear, currentMonth),
      ]);

      setChecklistResult(checklistRes);
      setEntriesSummary(entriesRes);
      setCalendarNotes(notesRes.notes || []);
      setActiveGoals((goalsRes.goals || []).slice(0, 3));
      setActiveInstallments((installmentsRes.purchases || []).slice(0, 3));
      setReservesSummary(reservesRes.summary);
      
      // Store primary active market list and compute arithmetic totals
      const activeList = marketListsRes.lists?.[0] || null;
      setActiveMarketList(activeList);
      if (activeList && activeList.items) {
        setActiveMarketTotals(calculateListTotals(activeList.items));
      } else {
        setActiveMarketTotals(null);
      }

      // Build 6-month financial evolution data
      const monthOffsets = [-3, -2, -1, 0, 1, 2];
      const evolution = await Promise.all(
        monthOffsets.map(async (offset) => {
          const d = new Date(currentYear, currentMonth - 1 + offset, 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const [ent, chk] = await Promise.all([
            entriesService.getMonthSummary(currentSpace.id, y, m),
            checklistService.getMonthlyChecklist(currentSpace.id, y, m),
          ]);
          const inc = ent.totalPlanned;
          const exp = chk.stats.totalAmount;
          return {
            monthLabel: `${MONTH_SHORT_NAMES[m - 1]}/${String(y).slice(-2)}`,
            Entradas: inc,
            Despesas: exp,
            Saldo: inc - exp,
          };
        })
      );
      setEvolutionData(evolution);

    } catch (err) {
      console.warn('Erro ao carregar dados do painel:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentSpace?.id, currentYear, currentMonth]);

  const handleSaveFixedExpense = async (data: CreateFixedExpenseInput | UpdateFixedExpenseInput): Promise<boolean> => {
    if (!user) return false;
    const targetSpaceId = ('space_id' in data && data.space_id) ? data.space_id : (currentSpace?.id || user.id);
    const res = await fixedExpensesService.createFixedExpense(user.id, {
      ...data,
      space_id: targetSpaceId,
    } as CreateFixedExpenseInput);
    if (res.error) throw new Error(res.error);
    setQuickAddModalType(null);
    loadDashboardData();
    return true;
  };

  const handleSaveVariableExpense = async (data: CreateVariableExpenseInput | UpdateVariableExpenseInput): Promise<boolean> => {
    if (!user) return false;
    const targetSpaceId = ('space_id' in data && data.space_id) ? data.space_id : (currentSpace?.id || user.id);
    const res = await variableExpensesService.createVariableExpense(user.id, {
      ...data,
      space_id: targetSpaceId,
    } as CreateVariableExpenseInput);
    if (res.error) throw new Error(res.error);
    setQuickAddModalType(null);
    loadDashboardData();
    return true;
  };

  const handleSaveInstallment = async (input: CreateInstallmentPurchaseInput | UpdateInstallmentPurchaseInput): Promise<{ success: boolean; error?: string }> => {
    const targetSpaceId = ('space_id' in input && input.space_id) ? input.space_id : (currentSpace?.id || user?.id);
    if (!user || !targetSpaceId) return { success: false, error: 'Espaço indisponível' };
    const res = await installmentsService.createPurchase({
      ...input,
      space_id: targetSpaceId,
    } as CreateInstallmentPurchaseInput);
    if (!res.error) {
      setQuickAddModalType(null);
      loadDashboardData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleSaveGoal = async (input: CreateGoalInput | UpdateGoalInput): Promise<{ success: boolean; error?: string }> => {
    if (!user || !currentSpace?.id) return { success: false, error: 'Espaço indisponível' };
    const res = await goalsService.createGoal({
      ...input,
      space_id: currentSpace.id,
    } as CreateGoalInput);
    if (res.success) {
      setIsGoalModalOpen(false);
      loadDashboardData();
      return { success: true };
    }
    return { success: false, error: res.error || 'Erro ao criar meta' };
  };

  const handleSaveEntry = async (data: CreateEntryInput | UpdateEntryInput): Promise<boolean> => {
    if (!user || !currentSpace?.id) return false;
    const res = await entriesService.createEntry(user.id, data as CreateEntryInput);
    if (res.error) throw new Error(res.error);
    setIsEntryModalOpen(false);
    loadDashboardData();
    return true;
  };

  // Navigate months
  const handlePrevMonth = () => {
    setSelectedMiniDay(1);
    if (currentMonth === 1) {
      handleMonthChange(currentYear - 1, 12);
    } else {
      handleMonthChange(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedMiniDay(1);
    if (currentMonth === 12) {
      handleMonthChange(currentYear + 1, 1);
    } else {
      handleMonthChange(currentYear, currentMonth + 1);
    }
  };

  // Toggle item payment status using existing category services
  const handleToggleItemStatus = async (item: NormalizedChecklistExpense) => {
    if (!currentSpace?.id) return;
    if (item.status === 'paid' && user?.id) {
      await reservesService.refundExpensePayment(
        item.sourceType as any,
        item.sourceId,
        currentSpace.id,
        user.id
      );
    }
    const res = await checklistService.toggleItemPaymentStatus(item, currentSpace.id, currentYear, currentMonth);
    if (res.success) {
      await loadDashboardData();
    } else if (res.error) {
      setActionError(res.error);
    }
  };

  // Financial calculations
  const totalReceitas = entriesSummary.totalPlanned;
  const totalDespesas = checklistResult ? checklistResult.stats.totalAmount : 0;
  const saldoConsolidado = totalReceitas - totalDespesas;

  const totalPago = checklistResult ? checklistResult.stats.paidAmount : 0;
  const totalPendente = checklistResult ? checklistResult.stats.pendingAmount : 0;

  const overdueItems = checklistResult ? checklistResult.items.filter(i => i.visualStatus === 'overdue' && i.status === 'pending') : [];
  const todayItems = checklistResult ? checklistResult.items.filter(i => i.visualStatus === 'today' && i.status === 'pending') : [];
  const upcomingItems = checklistResult ? checklistResult.items.filter(i => i.visualStatus === 'upcoming' && i.status === 'pending') : [];

  const totalAtrasado = overdueItems.reduce((acc, i) => acc + i.amount, 0) + todayItems.reduce((acc, i) => acc + i.amount, 0);
  const totalProximo = upcomingItems.reduce((acc, i) => acc + i.amount, 0);

  // User details
  const fullName = profile?.full_name || user?.full_name || user?.email?.split('@')[0] || '';
  const firstName = fullName.trim().split(' ')[0] || 'Usuário';

  // Category breakdown for Donut Chart using correct sourceType
  let fixedSum = 0;
  let variableSum = 0;
  let installmentSum = 0;

  if (checklistResult?.items) {
    checklistResult.items.forEach((item) => {
      if (item.sourceType === 'fixed') fixedSum += item.amount;
      else if (item.sourceType === 'variable') variableSum += item.amount;
      else if (item.sourceType === 'installment') installmentSum += item.amount;
    });
  }

  const donutData = [
    { name: 'Gastos Fixos', value: fixedSum, color: DONUT_COLORS.fixed },
    { name: 'Gastos Variáveis', value: variableSum, color: DONUT_COLORS.variable },
    { name: 'Parcelados', value: installmentSum, color: DONUT_COLORS.installments },
  ].filter(d => d.value > 0);

  // Filter checklist items
  const filteredChecklistItems = checklistResult
    ? checklistResult.items.filter((item) => {
        if (checklistFilter === 'pending') return item.status === 'pending';
        if (checklistFilter === 'paid') return item.status === 'paid';
        return true;
      })
    : [];

  // Helper calculations for mini calendar
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  const itemsByDate: Record<string, NormalizedChecklistExpense[]> = {};
  if (checklistResult) {
    checklistResult.items.forEach((item) => {
      if (!itemsByDate[item.dueDate]) itemsByDate[item.dueDate] = [];
      itemsByDate[item.dueDate].push(item);
    });
  }

  const selectedMiniDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedMiniDay).padStart(2, '0')}`;
  const miniSelectedDayItems = itemsByDate[selectedMiniDateStr] || [];

  return (
    <div className="w-full max-w-[1480px] mx-auto space-y-6 sm:space-y-8 pb-28 sm:pb-16 px-3 sm:px-6 animate-in fade-in duration-300">
      
      {/* Action error banner */}
      {actionError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PAYMENT ORIGIN CONFIRMATION MODAL (SALDO LIVRE VS RESERVAS) */}
      {confirmPaymentItem && currentSpace && user && (
        <PaymentOriginConfirmModal
          isOpen={!!confirmPaymentItem}
          onClose={() => setConfirmPaymentItem(null)}
          spaceId={currentSpace.id}
          userId={user.id}
          item={confirmPaymentItem}
          onSuccess={async () => {
            setConfirmPaymentItem(null);
            await loadDashboardData();
          }}
        />
      )}

      {/* ==================================================
          A. MOBILE LAYOUT ONLY (< 768px) - REORGANIZED OPERATIONAL FLOW
          ================================================== */}
      <div className="block md:hidden space-y-4">
        {/* 1. Competência Compacta no Mobile */}
        <div className="flex items-center justify-between gap-2 bg-white/80 dark:bg-[#1C211E]/80 backdrop-blur-md border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-2.5 px-3.5 shadow-2xs">
          <span className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
            Competência
          </span>
          <div className="flex items-center gap-1 bg-[#EAF3EE] dark:bg-[#181B1A] p-1 rounded-xl border border-[#CDE0D5] dark:border-[#2B322F]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold min-w-[90px] text-center font-display text-[#02402E] dark:text-[#78D9A6]">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Resumo Financeiro COMPACTO (Dinheiro Disponível, Reservas, Saldo Livre, Compromissos) */}
        <div className="bg-[#02402E] text-white rounded-2xl p-3 shadow-2xs space-y-1.5 border border-[#02402E]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1D9BD]">
              DINHEIRO DISPONÍVEL
            </span>
            <span className="text-sm font-extrabold font-display">
              {formatCurrency(reservesSummary.totalBalance)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 pt-1 border-t border-white/10 text-[10px]">
            <span className="text-[#C0E3D3]">Livre: <strong className="text-white font-bold">{formatCurrency(reservesSummary.freeBalance)}</strong></span>
            <span className="text-[#C0E3D3]/50">•</span>
            <span className="text-[#C0E3D3]">Reservado: <strong className="text-[#F2D58A] font-bold">{formatCurrency(reservesSummary.totalReserved)}</strong></span>
          </div>

          <div className="pt-1 border-t border-white/10 space-y-0.5 text-[10px]">
            <div className="flex justify-between items-center text-[#C0E3D3]">
              <span>Contas a pagar</span>
              <span className="font-bold text-rose-300">{formatCurrency(reservesSummary.contasAPagar)}</span>
            </div>
            <div className="flex justify-between items-center text-[#C0E3D3]">
              <span>Após compromissos</span>
              <span className="font-bold text-[#78D9A6]">{formatCurrency(Math.max(0, reservesSummary.totalBalance - reservesSummary.contasAPagar))}</span>
            </div>
          </div>
        </div>

        {/* Entradas e Despesas Mobile */}
        <div className="grid grid-cols-2 gap-2">
          {/* Entradas */}
          <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-3 shadow-2xs space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display truncate">
                ENTRADAS
              </span>
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(true)}
                title="Adicionar Entrada"
                className="w-5 h-5 rounded-md bg-[#E6F6EF] hover:bg-[#d0ecdf] dark:bg-[#16A66A]/20 dark:hover:bg-[#16A66A]/30 flex items-center justify-center text-[#16A66A] shrink-0 cursor-pointer active:scale-90 transition-transform"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
            <div className="text-sm sm:text-base font-extrabold tracking-tight text-[#02402E] dark:text-[#78D9A6] font-display truncate">
              {formatCurrency(totalReceitas)}
            </div>
          </div>

          {/* Despesas */}
          <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-3 shadow-2xs space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display truncate">
                DESPESAS
              </span>
              <div className="w-5 h-5 rounded-md bg-[#FEE2E2] dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <ArrowDownRight className="w-3 h-3" />
              </div>
            </div>
            <div className="text-sm sm:text-base font-extrabold tracking-tight text-rose-600 dark:text-rose-400 font-display truncate">
              {formatCurrency(totalDespesas)}
            </div>
          </div>
        </div>

        {/* 3. CONTAS PREVISTAS PARA PAGAR (Prioritário no mobile) */}
        <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold font-display text-[#02402E] dark:text-[#78D9A6] flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-[#16A66A]" />
              Contas Previstas
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQuickAddMenuOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold hover:bg-[#16A66A] dark:hover:bg-[#5ECB93] transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Nova Conta</span>
              </button>

              {/* Filtros simples e compactos */}
              <div className="flex items-center gap-0.5 bg-[#EAF3EE] dark:bg-[#181B1A] p-0.5 rounded-xl border border-[#CDE0D5] dark:border-[#2B322F]">
                <button
                  type="button"
                  onClick={() => setChecklistFilter('pending')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    checklistFilter === 'pending'
                      ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                      : 'text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  Pendentes
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistFilter('paid')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    checklistFilter === 'paid'
                      ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                      : 'text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  Pagas
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    checklistFilter === 'all'
                      ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                      : 'text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  Todas
                </button>
              </div>
            </div>
          </div>

          {/* Cards individuais de contas */}
          <div className="space-y-2">
            {filteredChecklistItems.length === 0 ? (
              <div className="py-4 text-center space-y-1">
                <CheckCircle2 className="w-5 h-5 text-[#16A66A] mx-auto opacity-75" />
                <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Nenhuma conta nesta categoria.
                </p>
              </div>
            ) : (
              (showAllChecklistMobile ? filteredChecklistItems : filteredChecklistItems.slice(0, 4)).map((item) => {
                const isPaid = item.status === 'paid';
                const typeLabel =
                  item.sourceType === 'fixed'
                    ? 'Gasto Fixo'
                    : item.sourceType === 'variable'
                    ? 'Gasto Variável'
                    : item.sourceType === 'installment'
                    ? `Parcela ${item.installmentNumber}/${item.totalInstallments}`
                    : 'Conta';

                let statusBadgeBg = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
                let statusText = 'Vence hoje';

                if (isPaid) {
                  statusBadgeBg = 'bg-[#E6F6EF] text-[#16A66A] dark:bg-[#16A66A]/20 dark:text-[#78D9A6]';
                  statusText = 'Paga ✓';
                } else if (item.visualStatus === 'overdue') {
                  statusBadgeBg = 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400';
                  statusText = 'Atrasada';
                } else if (item.visualStatus === 'today') {
                  statusBadgeBg = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
                  statusText = 'Vence hoje';
                } else {
                  statusBadgeBg = 'bg-[#E2ECE6] text-[#5E6963] dark:bg-[#28322C] dark:text-[#95A39B]';
                  statusText = `${item.dueDate.split('-').reverse().slice(0, 2).join('/')}`;
                }

                return (
                  <div
                    key={`m-chk-${item.id}`}
                    className="p-3 rounded-xl border border-[#E2ECE6] dark:border-[#28322C] bg-[#F9FBF9] dark:bg-[#222825] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={`text-xs font-bold truncate ${isPaid ? 'line-through text-[#8A9690] dark:text-[#6A7870]' : 'text-[#202724] dark:text-[#F4F4F5]'}`}>
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                          <span className={`font-bold ${
                            item.sourceType === 'fixed'
                              ? 'text-purple-600 dark:text-purple-400'
                              : item.sourceType === 'installment'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}>{typeLabel}</span>
                          <span>•</span>
                          <span>{item.category}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs sm:text-sm font-extrabold font-display ${isPaid ? 'text-[#8A9690]' : 'text-[#02402E] dark:text-[#78D9A6]'}`}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E2ECE6]/80 dark:border-[#28322C]/80">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${statusBadgeBg}`}>
                        {statusText}
                      </span>

                      <button
                        type="button"
                        onClick={() => isPaid ? handleToggleItemStatus(item) : setConfirmPaymentItem(item)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                          isPaid
                            ? 'bg-[#E2ECE6] dark:bg-[#28322C] text-[#16A66A] dark:text-[#78D9A6]'
                            : 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] shadow-2xs'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{isPaid ? 'Pago ✓' : 'Marcar como pago'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {filteredChecklistItems.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllChecklistMobile(!showAllChecklistMobile)}
                className="w-full pt-1.5 text-center text-xs font-bold text-[#16A66A] hover:underline cursor-pointer"
              >
                {showAllChecklistMobile
                  ? 'Mostrar apenas 4 contas'
                  : `Ver todas as ${filteredChecklistItems.length} contas →`}
              </button>
            )}
          </div>
        </div>

        {/* 4. MERCADO */}
        <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-display text-[#02402E] dark:text-[#78D9A6] flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-[#16A66A]" />
              Mercado
            </h2>
          </div>

          {!activeMarketList ? (
            <div className="py-3 text-center space-y-2">
              <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Nenhuma lista ativa
              </p>
              <button
                type="button"
                onClick={() => onSelectTab('market')}
                className="px-3.5 py-1.5 rounded-xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold cursor-pointer hover:bg-[#16A66A] transition-all inline-flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Criar Lista</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] truncate font-display">
                  {activeMarketList.name}
                </h3>
                <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B] font-semibold">
                  {activeMarketTotals?.checkedItems || 0} de {activeMarketTotals?.totalItems || 0} itens
                </span>
              </div>

              {/* Progress bar */}
              {activeMarketTotals && activeMarketTotals.totalItems > 0 && (
                <div className="w-full h-1.5 rounded-full bg-[#E2ECE6] dark:bg-[#28322C] overflow-hidden">
                  <div
                    className="h-full bg-[#16A66A] rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((activeMarketTotals.checkedItems / activeMarketTotals.totalItems) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}

              <div className="flex justify-between items-center text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                {activeMarketList.budget_amount ? (
                  <span>Orçamento: <strong className="text-[#02402E] dark:text-[#78D9A6]">{formatCurrency(activeMarketList.budget_amount)}</strong></span>
                ) : <span />}

                {activeMarketTotals?.totalActual ? (
                  <span>Gasto atual: <strong className="text-[#16A66A]">{formatCurrency(activeMarketTotals.totalActual)}</strong></span>
                ) : activeMarketTotals?.totalEstimated ? (
                  <span>Estimado: <strong className="text-[#02402E] dark:text-[#78D9A6]">{formatCurrency(activeMarketTotals.totalEstimated)}</strong></span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onSelectTab('market')}
                className="w-full py-2 rounded-xl bg-[#02402E] text-white hover:bg-[#16A66A] dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Continuar compras →</span>
              </button>
            </div>
          )}
        </div>

        {/* 5. Situação do Mês (Card Compacto) */}
        <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              Situação do Mês
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
            <div className="p-2 rounded-xl bg-[#E6F6EF] dark:bg-[#16A66A]/15 text-center">
              <span className="text-[#5E6963] dark:text-[#95A39B] block text-[9px]">Quitado</span>
              <strong className="text-[#16A66A] text-xs">{formatCurrency(totalPago)}</strong>
            </div>

            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-center">
              <span className="text-[#5E6963] dark:text-[#95A39B] block text-[9px]">Próximos</span>
              <strong className="text-amber-600 dark:text-amber-400 text-xs">{formatCurrency(totalProximo)}</strong>
            </div>

            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-center">
              <span className="text-[#5E6963] dark:text-[#95A39B] block text-[9px]">Atrasados</span>
              <strong className="text-rose-600 dark:text-rose-400 text-xs">{formatCurrency(totalAtrasado)}</strong>
            </div>
          </div>
        </div>

        {/* 6. MINHAS RESERVAS (Abaixo da Situação do Mês) */}
        {currentSpace && (
          <DashboardReservesSection
            spaceId={currentSpace.id}
            selectedYear={currentYear}
            selectedMonth={currentMonth}
            onSelectTab={onSelectTab}
          />
        )}

        {/* 6. Análises e Gráficos */}
        <div className="space-y-3 pt-1">
          <h2 className="text-base font-bold font-display text-[#02402E] dark:text-[#78D9A6] flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-[#16A66A]" />
            Análise Financeira
          </h2>

          {/* Gráfico 1: Composição das Despesas */}
          <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
              Composição das Despesas
            </h3>

            {donutData.length === 0 ? (
              <p className="text-xs text-center text-[#5E6963] py-4">Sem dados no mês.</p>
            ) : (
              <div className="space-y-3">
                <div className="h-36 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={54}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`m-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1 text-[11px]">
                  {donutData.map((d) => (
                    <div key={`m-d-${d.name}`} className="flex justify-between items-center p-1.5 rounded-lg bg-[#F4F8F5] dark:bg-[#222825]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <strong>{formatCurrency(d.value)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico 2: Evolução Financeira */}
          <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
              Evolução Mensal
            </h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolutionData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                  <Bar dataKey="Entradas" fill="#16A66A" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#E11D48" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="Saldo" stroke="#F2B807" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 7. Calendário & Metas */}
        <div className="space-y-3 pt-1">
          {/* Metas */}
          <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] font-display flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#16A66A]" />
                Metas
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(true)}
                  className="text-xs font-bold text-[#16A66A] hover:text-[#02402E] dark:hover:text-[#78D9A6] cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova meta</span>
                </button>
                <span className="text-[#D2DDD6] dark:text-[#28322C]">|</span>
                <button type="button" onClick={() => onSelectTab('goals')} className="text-xs text-[#5E6963] dark:text-[#95A39B] hover:text-[#16A66A] font-semibold cursor-pointer">
                  Ver todas →
                </button>
              </div>
            </div>

            {activeGoals.length === 0 ? (
              <div className="py-3 text-center space-y-2">
                <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Nenhuma meta ativa
                </p>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold cursor-pointer hover:bg-[#16A66A] transition-all inline-flex items-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Criar Meta</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeGoals.map((goal) => {
                  const percent = Math.min(Math.round(goal.progressPercentage ?? goal.progress_percentage ?? 0), 100);
                  const accumulated = goal.accumulatedAmount ?? (goal as any).accumulated_amount ?? 0;
                  const target = goal.target_amount ?? (goal as any).targetAmount ?? 0;
                  const title = goal.name || (goal as any).title || 'Meta';
                  return (
                    <div key={`m-goal-${goal.id}`} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="truncate text-[#202724] dark:text-[#F4F4F5] max-w-[140px]">{title}</span>
                        <div className="text-right shrink-0 flex items-center gap-1.5">
                          <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                            {formatCurrency(accumulated)} / <strong className="text-[#02402E] dark:text-[#78D9A6]">{formatCurrency(target)}</strong>
                          </span>
                          <span className="text-[#16A66A] font-bold">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#E2ECE6] dark:bg-[#28322C] overflow-hidden">
                        <div className="h-full bg-[#16A66A] rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================
          B. DESKTOP LAYOUT ONLY (>= 768px)
          ================================================== */}
      <div className="hidden md:block space-y-6 sm:space-y-8">
      {/* ==================================================
          SEÇÃO 1: CABEÇALHO & 4 CARDS DE RESUMO FINANCEIRO
          ================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#5E6963] dark:text-[#95A39B] font-display flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-[#16A66A]" />
            Resumo Financeiro
          </h1>

          <div className="flex items-center gap-1.5 bg-[#EAF3EE] dark:bg-[#181B1A] p-1 rounded-xl border border-[#CDE0D5] dark:border-[#2B322F] shadow-2xs scale-90 origin-right">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold min-w-[110px] text-center font-display text-[#02402E] dark:text-[#78D9A6]">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>


        {/* 2. Painel Principal Refinado (Horizontal e Compacto) */}
        <div className="bg-white/40 dark:bg-[#1C211E]/40 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-5 px-8 shadow-2xs">
          <div className="flex items-center justify-between">
            {/* Dinheiro Disponível */}
            <div className="flex-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#5E6963] dark:text-[#95A39B] block mb-0.5">Dinheiro Disponível</span>
              <div className="text-2xl font-extrabold text-[#02402E] dark:text-[#78D9A6] font-display tracking-tight">
                {formatCurrency(reservesSummary.totalBalance)}
              </div>
            </div>
          
            <div className="h-8 w-px bg-[#D2DDD6] dark:bg-[#28322C] mx-8 opacity-40" />

            {/* Livre */}
            <div className="flex-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#5E6963] dark:text-[#95A39B] block mb-0.5">Livre</span>
              <div className="text-lg font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                {formatCurrency(reservesSummary.freeBalance)}
              </div>
            </div>

            <div className="h-8 w-px bg-[#D2DDD6] dark:bg-[#28322C] mx-8 opacity-40" />

            {/* Reservado */}
            <div className="flex-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#5E6963] dark:text-[#95A39B] block mb-0.5">Reservado</span>
              <div className="text-lg font-bold text-[#F2B807] font-display">
                {formatCurrency(reservesSummary.totalReserved)}
              </div>
            </div>

            <div className="h-8 w-px bg-[#D2DDD6] dark:bg-[#28322C] mx-8 opacity-40" />

            {/* Após compromissos */}
            <div className="flex-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#5E6963] dark:text-[#95A39B] block mb-0.5">Após compromissos</span>
              <div className="text-lg font-bold text-[#16A66A] font-display">
                {formatCurrency(Math.max(0, reservesSummary.totalBalance - reservesSummary.contasAPagar))}
              </div>
            </div>
          </div>
        </div>


        {/* 3. Faixa de Indicadores Secundários (Ajustada para proximidade) */}
        <div className="grid grid-cols-3 gap-8 px-4 pt-2 pb-1 border-b border-[#D2DDD6]/30 dark:border-[#28322C]/30">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#5E6963] dark:text-[#95A39B]">Entradas</span>
              <button 
                onClick={() => setIsEntryModalOpen(true)}
                className="p-1 rounded-md bg-[#E6F6EF] text-[#16A66A] hover:bg-[#16A66A] hover:text-white transition-all cursor-pointer scale-75"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#16A66A] font-display">{formatCurrency(totalReceitas)}</span>
              <span className="text-[9px] font-bold text-[#5E6963] dark:text-[#95A39B]">
                {entriesSummary.count} receitas
              </span>
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#5E6963] dark:text-[#95A39B]">Despesas</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-display">{formatCurrency(totalDespesas)}</span>
              <span className="text-[9px] font-bold text-[#5E6963] dark:text-[#95A39B]">
                {checklistResult?.stats.totalCount || 0} lançamentos
              </span>
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#5E6963] dark:text-[#95A39B]">A Pagar</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-amber-600 font-display">{formatCurrency(totalPendente)}</span>
              <span className="text-[9px] font-bold text-[#5E6963] dark:text-[#95A39B]">
                {checklistResult?.stats.pendingCount || 0} pendentes
              </span>
            </div>
          </div>
        </div>


      </section>

      {/* ==================================================
          SEÇÃO 2: CONTAS PREVISTAS (CHECKLIST COMPACTO)
          ================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D2DDD6] dark:border-[#28322C]">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold font-display text-[#02402E] dark:text-[#78D9A6] flex items-center gap-2.5">
              <CalendarCheck className="w-6 h-6 text-[#16A66A]" />
              Contas Previstas
            </h2>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#EAF3EE] dark:bg-[#181B1A] rounded-full border border-[#CDE0D5] dark:border-[#2B322F] shadow-2xs">
              <span className="text-[11px] font-bold text-[#02402E] dark:text-[#78D9A6]">
                {checklistResult?.stats.pendingCount || 0} pendentes
              </span>
              <span className="text-[#D2DDD6] dark:text-[#28322C]">•</span>
              <span className="text-[11px] font-extrabold text-[#16A66A]">
                {formatCurrency(totalPendente)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsQuickAddMenuOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] text-sm font-bold hover:bg-[#16A66A] dark:hover:bg-[#5ECB93] transition-all cursor-pointer flex items-center gap-2 shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nova Conta</span>
            </button>

            <div className="flex items-center gap-1 bg-[#EAF3EE] dark:bg-[#181B1A] p-1 rounded-xl border border-[#CDE0D5] dark:border-[#2B322F] shadow-2xs">
              <button
                type="button"
                onClick={() => setChecklistFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  checklistFilter === 'pending'
                    ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614] shadow-sm'
                    : 'text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setChecklistFilter('paid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  checklistFilter === 'paid'
                    ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614] shadow-sm'
                    : 'text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Pagas
              </button>
              <button
                type="button"
                onClick={() => setChecklistFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  checklistFilter === 'all'
                    ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614] shadow-sm'
                    : 'text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Todas
              </button>
            </div>
          </div>
        </div>


        {/* List items */}
        <div className="bg-white/90 dark:bg-[#1C211E]/90 backdrop-blur-md border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-4 sm:p-5 shadow-2xs divide-y divide-[#E2ECE6] dark:divide-[#28322C]">
          {filteredChecklistItems.length === 0 ? (
            <div className="py-5 text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-[#16A66A] mx-auto opacity-75" />
              <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Nenhuma conta nesta categoria.
              </p>
              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                Suas despesas fixas, variáveis e parceladas para {MONTH_NAMES[currentMonth - 1]} aparecerão aqui.
              </p>
            </div>
          ) : (
            (showAllChecklistMobile ? filteredChecklistItems : filteredChecklistItems.slice(0, 5)).map((item) => {
              const isPaid = item.status === 'paid';
              
              const typeLabel =
                item.sourceType === 'fixed'
                  ? 'Gasto Fixo'
                  : item.sourceType === 'variable'
                  ? 'Gasto Variável'
                  : item.sourceType === 'installment'
                  ? `Parcelado ${item.installmentNumber && item.totalInstallments ? `(${item.installmentNumber}/${item.totalInstallments})` : ''}`
                  : 'Conta';

              // Visual Status badge
              let statusBadgeBg = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
              let statusText = 'Vence hoje';
              
              if (isPaid) {
                statusBadgeBg = 'bg-[#E6F6EF] text-[#16A66A] dark:bg-[#16A66A]/20 dark:text-[#78D9A6]';
                statusText = 'Paga ✓';
              } else if (item.visualStatus === 'overdue') {
                statusBadgeBg = 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400';
                statusText = 'Atrasada';
              } else if (item.visualStatus === 'today') {
                statusBadgeBg = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
                statusText = 'Vence hoje';
              } else if (item.visualStatus === 'upcoming') {
                statusBadgeBg = 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
                statusText = `Vence ${item.dueDate.split('-').reverse().join('/')}`;
              } else {
                statusBadgeBg = 'bg-[#E2ECE6] text-[#5E6963] dark:bg-[#28322C] dark:text-[#95A39B]';
                statusText = `Vence ${item.dueDate.split('-').reverse().join('/')}`;
              }

              return (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-[#F6FAF7] dark:hover:bg-[#222825] px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs sm:text-sm font-bold truncate ${isPaid ? 'line-through text-[#8A9690] dark:text-[#6A7870]' : 'text-[#202724] dark:text-[#F4F4F5]'}`}>
                          {item.title}
                        </span>
                        
                        {/* Type badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${
                          item.sourceType === 'fixed'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                            : item.sourceType === 'installment'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {typeLabel}
                        </span>

                        {/* Visual Status badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${statusBadgeBg}`}>
                          {statusText}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                        <span>Categoria: <strong className="text-[#202724] dark:text-[#E2ECE6]">{item.category}</strong></span>
                        <span>•</span>
                        <span>Vencimento: {item.dueDate.split('-').reverse().join('/')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-0 border-[#E2ECE6] dark:border-[#28322C] shrink-0">
                    <span className={`text-sm sm:text-base font-extrabold font-display ${isPaid ? 'text-[#8A9690] dark:text-[#6A7870]' : 'text-[#02402E] dark:text-[#78D9A6]'}`}>
                      {formatCurrency(item.amount)}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (isPaid) {
                          handleToggleItemStatus(item);
                        } else {
                          setConfirmPaymentItem(item);
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5 shrink-0 ${
                        isPaid
                          ? 'bg-[#E2ECE6] dark:bg-[#28322C] text-[#16A66A] dark:text-[#78D9A6] hover:bg-rose-100 hover:text-rose-700'
                          : 'bg-[#02402E] text-white hover:bg-[#16A66A] dark:bg-[#78D9A6] dark:text-[#101614] shadow-2xs'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{isPaid ? 'Pago ✓' : 'Marcar como pago'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {filteredChecklistItems.length > 5 && (
            <div className="pt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowAllChecklistMobile(!showAllChecklistMobile)}
                className="text-xs font-bold text-[#16A66A] hover:underline cursor-pointer"
              >
                {showAllChecklistMobile
                  ? 'Mostrar apenas as próximas 5 contas'
                  : `Ver todas as ${filteredChecklistItems.length} contas (${checklistResult?.stats.pendingCount || 0} pendentes)`}
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('closing')}
                className="text-xs text-[#5E6963] dark:text-[#95A39B] hover:text-[#02402E] dark:hover:text-[#78D9A6] font-semibold cursor-pointer"
              >
                Abrir Fechamento do Mês →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================
          SEÇÃO 3: MERCADO E MINHAS RESERVAS
          ================================================== */}
      <section className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-display text-[#02402E] dark:text-[#78D9A6] flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#16A66A]" />
              Mercado
            </h2>
            <button
              type="button"
              onClick={() => onSelectTab('market')}
              className="text-xs text-[#16A66A] hover:underline font-bold cursor-pointer"
            >
              Ir para Mercado →
            </button>
          </div>

          <div className="bg-white/90 dark:bg-[#1C211E]/90 backdrop-blur-md border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-5 shadow-2xs space-y-4">
            {!activeMarketList ? (
              <div className="py-4 text-center space-y-2">
                <ShoppingBag className="w-7 h-7 text-[#16A66A] mx-auto opacity-60" />
                <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Nenhuma lista de mercado ativa no momento.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectTab('market')}
                  className="px-4 py-2 rounded-xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold cursor-pointer hover:bg-[#16A66A] transition-all inline-flex items-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Criar Lista de Mercado</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[#02402E] dark:text-[#78D9A6] truncate font-display">
                      {activeMarketList.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E8F2EC] dark:bg-[#25322A] text-[#02402E] dark:text-[#78D9A6] font-bold shrink-0">
                      Lista Atual
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5E6963] dark:text-[#95A39B]">
                    <span>
                      <strong>{activeMarketTotals?.totalItems || 0}</strong> itens • <strong>{activeMarketTotals?.checkedItems || 0}</strong> comprados
                    </span>
                    
                    {activeMarketList.budget_amount ? (
                      <span>Orçamento: <strong className="text-[#02402E] dark:text-[#78D9A6]">{formatCurrency(activeMarketList.budget_amount)}</strong></span>
                    ) : null}

                    {activeMarketTotals?.totalActual ? (
                      <span>Gasto: <strong className="text-[#16A66A]">{formatCurrency(activeMarketTotals.totalActual)}</strong></span>
                    ) : activeMarketTotals?.totalEstimated ? (
                      <span>Estimado: <strong className="text-[#02402E] dark:text-[#78D9A6]">{formatCurrency(activeMarketTotals.totalEstimated)}</strong></span>
                    ) : null}
                  </div>

                  {/* Progress bar */}
                  {activeMarketTotals && activeMarketTotals.totalItems > 0 && (
                    <div className="w-full max-w-md space-y-1 pt-1">
                      <div className="w-full h-2 rounded-full bg-[#E2ECE6] dark:bg-[#28322C] overflow-hidden">
                        <div
                          className="h-full bg-[#16A66A] rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((activeMarketTotals.checkedItems / activeMarketTotals.totalItems) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 pt-1 md:pt-0">
                  <button
                    type="button"
                    onClick={() => onSelectTab('market')}
                    className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-[#02402E] text-white hover:bg-[#16A66A] dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Continuar compras →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {currentSpace && (
          <DashboardReservesSection
            spaceId={currentSpace.id}
            selectedYear={currentYear}
            selectedMonth={currentMonth}
            onSelectTab={onSelectTab}
          />
        )}
      </section>

      {/* ==================================================
          SEÇÃO 4: ANÁLISE E EVOLUÇÃO FINANCEIRA (CHARTS)
          ================================================== */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold font-display text-[#02402E] dark:text-[#78D9A6] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#16A66A]" />
            Análise e Evolução Financeira
          </h2>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            Gráficos de composição de despesas e evolução mensal das suas contas.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
          {/* Chart 1: Composição das Despesas (Donut) */}
          <div className="lg:col-span-5 bg-white/90 dark:bg-[#1C211E]/90 backdrop-blur-md border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
              <div>
                <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Composição das Despesas
                </h3>
                <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                  Distribuição por categoria neste mês
                </p>
              </div>
              <PieIcon className="w-4 h-4 text-[#16A66A]" />
            </div>

            {donutData.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#5E6963] dark:text-[#95A39B]">
                Nenhuma despesa cadastrada para exibir o gráfico.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 items-center gap-4 my-2 min-w-0">
                <div className="w-full min-w-0 h-44 relative flex items-center justify-center">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(val: number) => formatCurrency(val)}
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? '#1C211E' : '#FFFFFF',
                            borderColor: theme === 'dark' ? '#28322C' : '#D2DDD6',
                            borderRadius: '12px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  
                  {/* Donut Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">
                      Total
                    </span>
                    <span className="text-xs font-extrabold text-[#02402E] dark:text-[#78D9A6]">
                      {formatCurrency(totalDespesas)}
                    </span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="space-y-2 text-xs">
                  {donutData.map((d) => {
                    const percentage = totalDespesas > 0 ? ((d.value / totalDespesas) * 100).toFixed(1) : '0';
                    return (
                      <div key={d.name} className="flex items-center justify-between p-2 rounded-xl bg-[#F4F8F5] dark:bg-[#222825] border border-[#E2ECE6] dark:border-[#2C3630]">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="font-semibold text-[#202724] dark:text-[#F4F4F5]">{d.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[#02402E] dark:text-[#78D9A6]">{formatCurrency(d.value)}</span>
                          <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B] ml-1.5">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Chart 2: Evolução Financeira (Composed Chart) */}
          <div className="lg:col-span-7 bg-white/90 dark:bg-[#1C211E]/90 backdrop-blur-md border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
              <div>
                <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Evolução Financeira
                </h3>
                <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                  Entradas vs Despesas e Tendência de Saldo
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('reports')}
                className="text-xs text-[#16A66A] hover:underline font-bold cursor-pointer flex items-center gap-1"
              >
                <span>Ver evolução completa →</span>
              </button>
            </div>

            <div className="w-full min-w-0 h-56 pt-2">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <ComposedChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#28322C' : '#E2ECE6'} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: theme === 'dark' ? '#95A39B' : '#5E6963' }} />
                    <YAxis tick={{ fontSize: 10, fill: theme === 'dark' ? '#95A39B' : '#5E6963' }} tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                    <RechartsTooltip
                      formatter={(val: number) => formatCurrency(val)}
                      contentStyle={{
                        backgroundColor: theme === 'dark' ? '#1C211E' : '#FFFFFF',
                        borderColor: theme === 'dark' ? '#28322C' : '#D2DDD6',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="Entradas" fill="#16A66A" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Despesas" fill="#E11D48" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line type="monotone" dataKey="Saldo" stroke="#F2B807" strokeWidth={3} dot={{ r: 4, fill: '#F2B807' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend Footer */}
            <div className="flex items-center justify-center gap-6 pt-2 border-t border-[#E2ECE6] dark:border-[#28322C] text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#16A66A]" />
                <span className="text-[#5E6963] dark:text-[#95A39B]">Entradas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#E11D48]" />
                <span className="text-[#5E6963] dark:text-[#95A39B]">Despesas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#F2B807]" />
                <span className="text-[#5E6963] dark:text-[#95A39B]">Saldo Líquido</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          SEÇÃO 5: ORGANIZAÇÃO E DESTAQUES (METAS & CALENDÁRIO)
          ================================================== */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold font-display text-[#02402E] dark:text-[#78D9A6] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#16A66A]" />
            Organização e Destaques
          </h2>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            Seu calendário de vencimentos e metas de economia em um único lugar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Metas de Economia */}
          <div className="bg-white/90 dark:bg-[#1C211E]/90 backdrop-blur-md border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#16A66A]" />
                <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Metas de Economia
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('goals')}
                className="text-xs text-[#16A66A] hover:underline font-bold cursor-pointer"
              >
                Gerenciar →
              </button>
            </div>

            {activeGoals.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">Nenhuma meta ativa cadastrada.</p>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold cursor-pointer hover:bg-[#16A66A] transition-all inline-flex items-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Criar Meta</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeGoals.map((goal) => {
                  const percent = Math.min(Math.round(goal.progressPercentage ?? goal.progress_percentage ?? 0), 100);
                  const accumulated = goal.accumulatedAmount ?? (goal as any).accumulated_amount ?? 0;
                  const target = goal.target_amount ?? (goal as any).targetAmount ?? 0;
                  const title = goal.name || (goal as any).title || 'Meta';
                  return (
                    <div key={goal.id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-[#202724] dark:text-[#F4F4F5] truncate">{title}</span>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                            {formatCurrency(accumulated)} / <strong className="text-[#02402E] dark:text-[#78D9A6]">{formatCurrency(target)}</strong>
                          </span>
                          <span className="text-[#16A66A] font-bold">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E2ECE6] dark:bg-[#28322C] overflow-hidden">
                        <div className="h-full bg-[#16A66A] rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 2: Calendário */}
          <div className="bg-white/90 dark:bg-[#1C211E]/90 backdrop-blur-md border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#16A66A]" />
                <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Calendário ({MONTH_SHORT_NAMES[currentMonth - 1]})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('calendar')}
                className="text-xs text-[#16A66A] hover:underline font-bold cursor-pointer"
              >
                Abrir →
              </button>
            </div>

            {/* Mini Grid representation */}
            <div className="space-y-2">
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#5E6963] dark:text-[#95A39B]">
                <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold">
                {Array.from({ length: Math.min(daysInMonth, 14) }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const hasItems = itemsByDate[dateKey] && itemsByDate[dateKey].length > 0;
                  const isSelected = selectedMiniDay === dayNum;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => setSelectedMiniDay(dayNum)}
                      className={`h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#02402E] text-white font-bold'
                          : hasItems
                          ? 'bg-[#E6F6EF] text-[#02402E] font-bold border border-[#16A66A]/40'
                          : 'bg-[#F4F8F5] dark:bg-[#222825] text-[#202724] dark:text-[#F4F4F5]'
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F4F8F5] dark:bg-[#222825] border border-[#E2ECE6] dark:border-[#28322C] text-xs">
              <span className="font-bold text-[#02402E] dark:text-[#78D9A6]">Dia {selectedMiniDay}: </span>
              <span className="text-[#5E6963] dark:text-[#95A39B]">
                {miniSelectedDayItems.length} vencimento(s) cadastrado(s)
              </span>
            </div>
          </div>

        </div>
      </section>
      </div>

      {/* MENU MODAL PARA ADICIONAR NOVA CONTA (DESKTOP E MOBILE) */}
      {isQuickAddMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsQuickAddMenuOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1C211E] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 border-t sm:border border-[#D2DDD6] dark:border-[#28322C] shadow-2xl space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E2ECE6] dark:border-[#28322C] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#02402E] dark:text-[#78D9A6] font-display flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-[#16A66A]" />
                  Adicionar Nova Conta
                </h3>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                  Selecione o tipo de conta para {MONTH_NAMES[currentMonth - 1]}/{currentYear}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddMenuOpen(false)}
                className="p-1.5 rounded-full text-[#5E6963] hover:text-[#02402E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 py-1">
              <button
                type="button"
                onClick={() => {
                  setIsQuickAddMenuOpen(false);
                  setQuickAddModalType('fixed_expenses');
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#F4F7F5] dark:bg-[#222825] hover:bg-[#E8F2EC] dark:hover:bg-[#28322C] border border-transparent hover:border-[#8B5CF6]/40 text-left transition-all cursor-pointer group shadow-2xs hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      Gasto Fixo
                    </p>
                    <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                      Recorrente mensal (Ex: Luz, Água, Aluguel, Internet, Academia)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#5E6963] group-hover:text-purple-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsQuickAddMenuOpen(false);
                  setQuickAddModalType('variable_expenses');
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#F4F7F5] dark:bg-[#222825] hover:bg-[#E8F2EC] dark:hover:bg-[#28322C] border border-transparent hover:border-[#E11D48]/40 text-left transition-all cursor-pointer group shadow-2xs hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      Gasto Variável
                    </p>
                    <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                      Eventual ou imprevisto (Ex: Restaurante, Farmácia, Combustível, Mercado)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#5E6963] group-hover:text-rose-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsQuickAddMenuOpen(false);
                  setQuickAddModalType('installments');
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#F4F7F5] dark:bg-[#222825] hover:bg-[#E8F2EC] dark:hover:bg-[#28322C] border border-transparent hover:border-[#F59E0B]/40 text-left transition-all cursor-pointer group shadow-2xs hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      Parcelamento
                    </p>
                    <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                      Compra parcelada no cartão (Ex: 10x sem juros, parcelas futuras)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#5E6963] group-hover:text-amber-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS REUTILIZADOS COM CONTEXTO DA COMPETÊNCIA ATUAL */}
      {(currentSpace?.id || user?.id) && (
        <>
          <FixedExpenseModal
            isOpen={quickAddModalType === 'fixed_expenses'}
            onClose={() => setQuickAddModalType(null)}
            onSave={handleSaveFixedExpense}
            spaceId={currentSpace?.id || user?.id || ''}
            selectedYear={currentYear}
            selectedMonth={currentMonth}
          />

          <VariableExpenseModal
            isOpen={quickAddModalType === 'variable_expenses'}
            onClose={() => setQuickAddModalType(null)}
            onSave={handleSaveVariableExpense}
            spaceId={currentSpace?.id || user?.id || ''}
            selectedYear={currentYear}
            selectedMonth={currentMonth}
          />

          <InstallmentPurchaseModal
            isOpen={quickAddModalType === 'installments'}
            onClose={() => setQuickAddModalType(null)}
            onSave={handleSaveInstallment}
            spaceId={currentSpace?.id || user?.id || ''}
            selectedYear={currentYear}
            selectedMonth={currentMonth}
          />

          <GoalModal
            isOpen={isGoalModalOpen}
            onClose={() => setIsGoalModalOpen(false)}
            onSave={handleSaveGoal}
            spaceId={currentSpace?.id || user?.id || ''}
          />

          <EntryModal
            isOpen={isEntryModalOpen}
            onClose={() => setIsEntryModalOpen(false)}
            onSave={handleSaveEntry}
            spaceId={currentSpace?.id || user?.id || ''}
            selectedYear={currentYear}
            selectedMonth={currentMonth}
          />
        </>
      )}
    </div>
  );
}
