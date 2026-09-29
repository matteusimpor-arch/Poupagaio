import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  FixedExpenseWithStatus,
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  FixedExpensesSummary,
} from '../../types';
import { fixedExpensesService } from '../../lib/services/fixedExpenses';
import { MonthPicker } from '../entries/MonthPicker';
import { FixedExpenseModal } from './FixedExpenseModal';
import { FixedExpenseDeleteModal } from './FixedExpenseDeleteModal';
import { PaymentOriginConfirmModal } from '../reserves/PaymentOriginConfirmModal';
import { reservesService } from '../../lib/services/reserves';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { SUPABASE_EXPENSES_MIGRATION_SQL } from '../../lib/expenses-sql';
import { formatCurrency, getMonthYearLabel } from '../../lib/formatters';
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  Database,
  Copy,
  Check,
  RefreshCw,
  Repeat,
  Calendar,
  Tag,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface FixedExpensesScreenProps {
  selectedYear?: number;
  selectedMonth?: number;
  onMonthChange?: (year: number, month: number) => void;
}

export function FixedExpensesScreen({
  selectedYear: initialYear,
  selectedMonth: initialMonth,
  onMonthChange,
}: FixedExpensesScreenProps = {}) {
  const { currentSpace, user } = useAuth();

  // Competência selecionada (mês / ano)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(initialYear || now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || (now.getMonth() + 1));

  useEffect(() => {
    if (initialYear && initialMonth) {
      setSelectedYear(initialYear);
      setSelectedMonth(initialMonth);
    }
  }, [initialYear, initialMonth]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    onMonthChange?.(year, month);
  };

  // Estados de dados
  const [expenses, setExpenses] = useState<FixedExpenseWithStatus[]>([]);
  const [summary, setSummary] = useState<FixedExpensesSummary>({
    totalMonth: 0,
    totalPaid: 0,
    totalPending: 0,
    totalUpcoming: 0,
    totalOverdue: 0,
    count: 0,
    paidCount: 0,
    upcomingCount: 0,
    overdueCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Estados de modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpenseWithStatus | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<FixedExpenseWithStatus | null>(null);
  const [payingExpense, setPayingExpense] = useState<FixedExpenseWithStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Cópia do SQL
  const [sqlCopied, setSqlCopied] = useState(false);
  const [checkingTable, setCheckingTable] = useState(false);

  // Carregar gastos fixos da competência
  const loadExpenses = useCallback(async () => {
    if (!currentSpace) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await fixedExpensesService.getFixedExpensesWithStatus(
      currentSpace.id,
      selectedYear,
      selectedMonth
    );

    setIsTableMissing(result.isTableMissing);
    if (result.isTableMissing) {
      setExpenses([]);
      setSummary({
        totalMonth: 0,
        totalPaid: 0,
        totalPending: 0,
        totalUpcoming: 0,
        totalOverdue: 0,
        count: 0,
        paidCount: 0,
        upcomingCount: 0,
        overdueCount: 0,
      });
    } else if (result.error) {
      setErrorMessage(result.error);
    } else {
      setExpenses(result.expenses);
      setSummary(result.summary);
    }

    setIsLoading(false);
  }, [currentSpace, selectedYear, selectedMonth]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Copiar SQL
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_EXPENSES_MIGRATION_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 3500);
    } catch {
      setErrorMessage('Não foi possível copiar automaticamente o SQL.');
    }
  };

  const handleCheckTable = async () => {
    setCheckingTable(true);
    await loadExpenses();
    setCheckingTable(false);
  };

  // Salvar gasto fixo (criar ou editar)
  const handleSaveExpense = async (
    data: CreateFixedExpenseInput | UpdateFixedExpenseInput
  ): Promise<boolean> => {
    if (!currentSpace || !user) return false;

    if (editingExpense) {
      const res = await fixedExpensesService.updateFixedExpense(editingExpense.id, data);
      if (res.error) {
        setErrorMessage(res.error);
        return false;
      }
      setFeedbackMessage(`Gasto fixo "${res.expense?.description}" atualizado com sucesso!`);
    } else {
      const res = await fixedExpensesService.createFixedExpense(
        user.id,
        data as CreateFixedExpenseInput
      );
      if (res.isTableMissing) {
        setIsTableMissing(true);
        return false;
      }
      if (res.error) {
        setErrorMessage(res.error);
        return false;
      }
      setFeedbackMessage(`Gasto fixo "${res.expense?.description}" cadastrado com sucesso!`);
    }

    await loadExpenses();
    return true;
  };

  // Alternar pagamento do gasto fixo para esta competência
  const handleTogglePayment = async (exp: FixedExpenseWithStatus) => {
    if (!currentSpace) return;

    if (exp.isPaid) {
      setActionLoadingId(exp.id);
      try {
        if (user?.id) {
          await reservesService.refundExpensePayment('fixed', exp.id, currentSpace.id, user.id);
        }
        const res = await fixedExpensesService.unmarkPaid(exp.id, selectedYear, selectedMonth);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          setFeedbackMessage(`Pagamento de "${exp.description}" desmarcado.`);
          await loadExpenses();
        }
      } finally {
        setActionLoadingId(null);
      }
    } else {
      setPayingExpense(exp);
    }
  };

  // Excluir gasto fixo
  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);

    const res = await fixedExpensesService.deleteFixedExpense(expenseToDelete.id);
    setIsDeleting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setFeedbackMessage(`Gasto fixo "${expenseToDelete.description}" excluído.`);
      setExpenseToDelete(null);
      await loadExpenses();
    }
  };

  return (
    <div id="fixed-expenses-screen" className="space-y-6 pb-4">
      {/* 1. CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[#075C45] dark:text-[#78D9A6]">
              Gastos Fixos
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              Recorrentes
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
            Organize as despesas que fazem parte da sua rotina.
          </p>
        </div>

        {/* Controles do Cabeçalho: MonthPicker e Botão Novo */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <MonthPicker
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => handleMonthChange(y, m)}
          />

          <Button
            type="button"
            id="new-fixed-expense-btn"
            variant="primary"
            size="md"
            onClick={() => {
              setEditingExpense(null);
              setIsModalOpen(true);
            }}
            className="gap-2 shadow-sm font-bold shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo gasto fixo</span>
          </Button>
        </div>
      </div>

      {/* 2. FEEDBACK DO MASCOTE / SUCESSO */}
      {feedbackMessage && (
        <div
          role="status"
          className="p-3 sm:p-4 rounded-2xl bg-[#16A66A]/10 border border-[#16A66A]/30 dark:bg-[#16A66A]/15 text-[#075C45] dark:text-[#78D9A6] flex items-center gap-3 animate-in fade-in duration-200"
        >
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 border border-[#16A66A]/30 bg-white dark:bg-[#18211D] p-0.5">
            <img
              src={POUPAGAIO_MASCOT_URL}
              alt="Poupagaio"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-xs sm:text-sm font-medium">{feedbackMessage}</p>
        </div>
      )}

      {/* 3. AVISO DE TABELA PENDENTE (SE A MIGRATION AINDA NÃO FOI RODADA) */}
      {isTableMissing && (
        <div
          id="fixed-expenses-table-notice"
          className="p-5 sm:p-6 rounded-3xl bg-[#D6A84B]/10 dark:bg-[#D6A84B]/15 border border-[#D6A84B]/30 text-[#202724] dark:text-[#F7F4EA] space-y-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D6A84B]/20 text-[#8A6318] dark:text-[#F2D58A] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold font-display text-[#8A6318] dark:text-[#F2D58A]">
                Tabelas de Gastos no Supabase necessárias
              </h3>
              <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
                Para gerenciar gastos fixos e variáveis com segurança por competência, aplique a migration SQL no seu projeto Supabase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={handleCopySql}
              className="gap-2 cursor-pointer"
            >
              {sqlCopied ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
              <span>{sqlCopied ? 'SQL Copiado para a Área de Transferência!' : 'Copiar SQL de Migração'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckTable}
              isLoading={checkingTable}
              disabled={checkingTable}
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verificar Novamente</span>
            </Button>
          </div>
        </div>
      )}

      {/* 4. MENSAGEM DE ERRO */}
      {errorMessage && !isTableMissing && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 5. CARDS DE RESUMO DO MÊS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Total do mês */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Total do mês
            </span>
            <span className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <Repeat className="w-4 h-4" />
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[#202724] dark:text-[#F7F4EA]">
              {formatCurrency(summary.totalMonth)}
            </div>
          )}
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            {summary.count} {summary.count === 1 ? 'gasto fixo cadastrado' : 'gastos fixos cadastrados'}
          </p>
        </div>

        {/* Card 2: Pago */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Pago
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.totalPaid)}
            </div>
          )}
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            {summary.paidCount} de {summary.count} quitados em {getMonthYearLabel(selectedMonth, selectedYear)}
          </p>
        </div>

        {/* Card 3: A pagar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              A pagar
            </span>
            <span className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-amber-600 dark:text-amber-400">
              {formatCurrency(summary.totalPending)}
            </div>
          )}
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            {summary.overdueCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                {summary.overdueCount} {summary.overdueCount === 1 ? 'atrasado' : 'atrasados'} • {summary.upcomingCount} a vencer
              </span>
            ) : (
              `${summary.upcomingCount} a vencer neste mês`
            )}
          </p>
        </div>
      </div>

      {/* 6. LISTA DE GASTOS FIXOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
            Despesas fixas do mês
          </h2>
          <span className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            {expenses.length} {expenses.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : expenses.length === 0 ? (
          /* ESTADO VAZIO COM MASCOTE OFICIAL */
          <div
            id="empty-fixed-expenses"
            className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs space-y-4"
          >
            <div className="w-24 h-24 mx-auto rounded-3xl overflow-hidden border-2 border-[#16A66A]/30 bg-[#F7F4EA] dark:bg-[#101614] p-2 shadow-xs">
              <img
                src={POUPAGAIO_MASCOT_URL}
                alt="Poupagaio Mascote"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
                Você ainda não possui gastos fixos cadastrados.
              </h3>
              <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
                Cadastre suas despesas recorrentes como aluguel, internet, condomínio e assinaturas para organizar o mês automaticamente.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                setEditingExpense(null);
                setIsModalOpen(true);
              }}
              className="gap-2 font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar primeiro gasto fixo</span>
            </Button>
          </div>
        ) : (
          /* LISTAGEM DE CARDS */
          <div className="space-y-2.5">
            {expenses.map((exp) => {
              const isActionLoading = actionLoadingId === exp.id;

              return (
                <div
                  key={exp.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] hover:border-[#16A66A]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group"
                >
                  {/* Informações da Despesa */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    {/* Botão circular de marcar como pago / desmarcar */}
                    <button
                      type="button"
                      onClick={() => handleTogglePayment(exp)}
                      disabled={isActionLoading}
                      title={exp.isPaid ? 'Clique para desmarcar pagamento' : 'Clique para marcar como pago'}
                      className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                        exp.isPaid
                          ? 'bg-emerald-500 text-white shadow-xs hover:bg-emerald-600'
                          : exp.computedStatus === 'overdue'
                          ? 'bg-rose-50 text-rose-600 border border-rose-300 dark:bg-rose-950/30 dark:border-rose-900/50 hover:bg-rose-100'
                          : 'bg-[#F7F4EA] text-[#5E6963] border border-[#E8E4D5] dark:bg-[#121915] dark:border-[#24312B] hover:border-emerald-500 hover:text-emerald-600'
                      }`}
                    >
                      {exp.isPaid ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Check className="w-4 h-4 opacity-50 hover:opacity-100" />
                      )}
                    </button>

                    {/* Textos */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-[#202724] dark:text-[#F7F4EA] truncate">
                          {exp.description}
                        </span>

                        {/* Tag de Recorrência */}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F7F4EA] dark:bg-[#121915] border border-[#E8E4D5] dark:border-[#24312B] text-[#5E6963] dark:text-[#95A39B]">
                          {exp.recurrence === 'yearly' ? 'Anual' : 'Mensal'}
                        </span>

                        {/* Status Badge */}
                        {exp.computedStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Pago
                          </span>
                        ) : exp.computedStatus === 'overdue' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            Atrasado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Clock className="w-3 h-3" />
                            Próximo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#5E6963] dark:text-[#95A39B] flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {exp.category}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Vence todo dia {exp.due_day}
                        </span>
                        {exp.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]" title={exp.notes}>
                              {exp.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Valor e Ações */}
                  <div className="flex items-center justify-between sm:justify-end gap-3.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8E4D5] dark:border-[#24312B]">
                    <div className="text-right">
                      <div
                        className={`text-base sm:text-lg font-extrabold font-display ${
                          exp.isPaid
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : exp.computedStatus === 'overdue'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-[#202724] dark:text-[#F7F4EA]'
                        }`}
                      >
                        {formatCurrency(exp.amount)}
                      </div>
                      <div className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                        {exp.isPaid ? 'Liquidado' : 'A pagar'}
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Alternar Pagamento */}
                      <Button
                        type="button"
                        variant={exp.isPaid ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => handleTogglePayment(exp)}
                        isLoading={isActionLoading}
                        disabled={isActionLoading}
                        className="text-xs h-8 px-2.5 rounded-xl cursor-pointer"
                      >
                        {exp.isPaid ? 'Desmarcar' : 'Marcar pago'}
                      </Button>

                      {/* Editar */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpense(exp);
                          setIsModalOpen(true);
                        }}
                        title="Editar gasto fixo"
                        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] hover:text-[#075C45] dark:hover:text-[#78D9A6] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Excluir */}
                      <button
                        type="button"
                        onClick={() => setExpenseToDelete(exp)}
                        title="Excluir gasto fixo"
                        className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-[#5E6963] dark:text-[#95A39B] hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <FixedExpenseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        editingExpense={editingExpense}
        spaceId={currentSpace?.id || ''}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* MODAL DE EXCLUSÃO */}
      <FixedExpenseDeleteModal
        isOpen={Boolean(expenseToDelete)}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={handleConfirmDelete}
        expense={expenseToDelete}
        isDeleting={isDeleting}
      />

      {/* MODAL DE CONFIRMAÇÃO DE ORIGEM DO PAGAMENTO */}
      {payingExpense && currentSpace && user && (
        <PaymentOriginConfirmModal
          isOpen={Boolean(payingExpense)}
          onClose={() => setPayingExpense(null)}
          spaceId={currentSpace.id}
          userId={user.id}
          item={{
            id: payingExpense.id,
            sourceType: 'fixed',
            sourceId: payingExpense.id,
            title: payingExpense.description,
            amount: payingExpense.amount,
            dueDate: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(payingExpense.due_day).padStart(2, '0')}`,
            category: payingExpense.category,
          }}
          onSuccess={async () => {
            setPayingExpense(null);
            setFeedbackMessage(`Gasto "${payingExpense.description}" marcado como pago!`);
            await loadExpenses();
          }}
        />
      )}
    </div>
  );
}
