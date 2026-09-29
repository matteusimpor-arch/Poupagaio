import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { monthlyClosuresService, emptyClosureSummary } from '../../lib/services/monthlyClosures';
import { spaceService } from '../../lib/services/space';
import { MonthlyClosure, MonthlyClosureSummary } from '../../types';
import { formatCurrency, formatDateBR } from '../../lib/formatters';
import { SupabaseSchemaNotice } from '../layout/SupabaseSchemaNotice';
import { CloseMonthModal } from './CloseMonthModal';
import { ClosureDetailModal } from './ClosureDetailModal';
import { ReopenMonthModal } from './ReopenMonthModal';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  AlertCircle,
  Info,
} from 'lucide-react';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function ClosingScreen() {
  const { currentSpace, user } = useAuth();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  const [closure, setClosure] = useState<MonthlyClosure | null>(null);
  const [summary, setSummary] = useState<MonthlyClosureSummary>(emptyClosureSummary);
  const [history, setHistory] = useState<MonthlyClosure[]>([]);

  const [userRole, setUserRole] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isTableMissing, setIsTableMissing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados dos Modais de Resumo Histórico e Reabertura
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [detailClosure, setDetailClosure] = useState<MonthlyClosure | null>(null);
  const [detailLabel, setDetailLabel] = useState<string>('');

  const [isReopenModalOpen, setIsReopenModalOpen] = useState<boolean>(false);
  const [reopenClosure, setReopenClosure] = useState<MonthlyClosure | null>(null);
  const [isReopening, setIsReopening] = useState<boolean>(false);

  const billingCycle = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const billingCycleLabel = `${MONTH_NAMES_PT[selectedMonth - 1]} de ${selectedYear}`;

  // Auditoria de Role do usuário para permissões na interface
  useEffect(() => {
    async function fetchUserRole() {
      if (!currentSpace?.id || !user?.id) return;
      if (currentSpace.owner_id === user.id) {
        setUserRole('owner');
        return;
      }
      const members = await spaceService.getSpaceMembers(currentSpace.id);
      const myMember = members.find((m) => m.user_id === user.id);
      setUserRole(myMember?.role || 'member');
    }
    fetchUserRole();
  }, [currentSpace?.id, currentSpace?.owner_id, user?.id]);

  const canReopen =
    currentSpace?.owner_id === user?.id || userRole === 'owner' || userRole === 'admin';

  const loadData = useCallback(async () => {
    if (!currentSpace?.id) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Verifica se a competência atual já foi fechada
      const [closureRes, historyRes] = await Promise.all([
        monthlyClosuresService.getClosureByCycle(currentSpace.id, billingCycle),
        monthlyClosuresService.getMonthlyClosuresHistory(currentSpace.id),
      ]);

      if (closureRes.isTableMissing || historyRes.isTableMissing) {
        setIsTableMissing(true);
        setIsLoading(false);
        return;
      }

      setIsTableMissing(false);
      setClosure(closureRes.closure);
      setHistory(historyRes.closures);

      if (closureRes.closure) {
        // Mês fechado: utiliza exclusivamente o snapshot armazenado
        const c = closureRes.closure;
        setSummary({
          total_income: Number(c.total_income) || 0,
          total_fixed_expenses: Number(c.total_fixed_expenses) || 0,
          total_variable_expenses: Number(c.total_variable_expenses) || 0,
          total_installments: Number(c.total_installments) || 0,
          total_expenses: Number(c.total_expenses) || 0,
          final_balance: Number(c.final_balance) || 0,
        });
      } else {
        // Mês aberto: calcula os totais ao vivo
        const liveSummary = await monthlyClosuresService.calculateMonthSummary(
          currentSpace.id,
          selectedYear,
          selectedMonth
        );
        setSummary(liveSummary);
      }
    } catch {
      setErrorMessage('Erro ao carregar dados do fechamento do mês.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, billingCycle, selectedYear, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navegação de mês/ano
  const handlePrevMonth = () => {
    setSuccessMessage(null);
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSuccessMessage(null);
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Processo de fechamento
  const handleConfirmClose = async () => {
    if (!currentSpace?.id) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await monthlyClosuresService.closeMonth({
      space_id: currentSpace.id,
      billing_cycle: billingCycle,
    });

    setIsSubmitting(false);

    if (res.success && res.closure) {
      setIsConfirmModalOpen(false);
      setClosure(res.closure);
      setSuccessMessage(`Mês de ${billingCycleLabel} encerrado com sucesso!`);
      await loadData();
    } else {
      if (res.isTableMissing) setIsTableMissing(true);
      setErrorMessage(res.error || 'Não foi possível realizar o fechamento do mês.');
    }
  };

  // Handler para abrir o detalhe do resumo histórico
  const handleOpenDetail = (c: MonthlyClosure) => {
    const [hYear, hMonth] = c.billing_cycle.split('-').map(Number);
    const label = `${MONTH_NAMES_PT[hMonth - 1]} de ${hYear}`;
    setDetailClosure(c);
    setDetailLabel(label);
    setIsDetailModalOpen(true);
  };

  // Handler para abrir confirmação de reabertura
  const handleOpenReopenConfirm = (c: MonthlyClosure) => {
    setReopenClosure(c);
    setIsReopenModalOpen(true);
  };

  // Executar a reabertura via DELETE no Supabase
  const handleConfirmReopen = async () => {
    if (!reopenClosure || !currentSpace?.id) return;
    setIsReopening(true);
    setErrorMessage(null);

    const res = await monthlyClosuresService.reopenMonth(reopenClosure.id, currentSpace.id);
    setIsReopening(false);

    if (res.success) {
      const [rYear, rMonth] = reopenClosure.billing_cycle.split('-').map(Number);
      const rLabel = `${MONTH_NAMES_PT[rMonth - 1]} de ${rYear}`;

      setIsReopenModalOpen(false);
      setIsDetailModalOpen(false);
      setReopenClosure(null);
      setDetailClosure(null);
      setSuccessMessage(`Competência ${rLabel} reaberta com sucesso. Os lançamentos foram mantidos.`);
      await loadData();
    } else {
      setErrorMessage(res.error || 'Não foi possível reabrir a competência.');
    }
  };

  // Formatação de data/hora do fechamento
  const formatClosedAt = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${formatDateBR(isoString)} às ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;
    } catch {
      return formatDateBR(isoString);
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6 pb-4 animate-in fade-in duration-300">
      {/* 1. Cabeçalho de Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#E2E8E4] dark:border-[#2E3532]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-600/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
              Fechamento do Mês
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
            Encerre competências e registre snapshots históricos com total precisão.
          </p>
        </div>

        {/* Mês/Ano Selector */}
        <div className="flex items-center justify-between sm:justify-end gap-2 bg-white dark:bg-[#232725] p-1.5 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] shadow-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrevMonth}
            className="h-8 w-8 p-0 rounded-lg text-[#5E6963] dark:text-[#95A39B] hover:bg-[#F3F4F4] dark:hover:bg-[#2E3532]"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="text-xs sm:text-sm font-bold font-display text-[#202724] dark:text-[#F4F4F5] px-2 min-w-[140px] text-center">
            {billingCycleLabel}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            className="h-8 w-8 p-0 rounded-lg text-[#5E6963] dark:text-[#95A39B] hover:bg-[#F3F4F4] dark:hover:bg-[#2E3532]"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Alerta de Tabela Faltante */}
      {isTableMissing && (
        <SupabaseSchemaNotice
          tableName="monthly_closures"
          migrationFile="supabase/migrations/20260918_create_monthly_closures.sql"
        />
      )}

      {/* Mensagens de Sucesso e Erro */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Status do Mês & Card Principal */}
      <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] shadow-xs">
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Header do Card com Status do Mês */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8E4] dark:border-[#2E3532]">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                Situação da Competência
              </span>
              <div className="flex items-center gap-2">
                {closure ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30">
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    🔒 Mês fechado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30">
                    <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    🟢 Mês aberto
                  </span>
                )}
              </div>
            </div>

            {/* Metadados de fechamento se estiver fechado */}
            {closure && (
              <div className="text-left sm:text-right space-y-0.5 text-xs text-[#5E6963] dark:text-[#95A39B]">
                <p className="flex items-center sm:justify-end gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Fechado em: <strong>{formatClosedAt(closure.closed_at)}</strong></span>
                </p>
              </div>
            )}
          </div>

          {/* Skeletons de Carregamento */}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {/* Resumo Consolidado Principal (Entradas, Saídas, Saldo) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {/* Entradas */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F9FAF9] dark:bg-[#1D211F] border border-[#E2E8E4] dark:border-[#2E3532] space-y-1">
                  <div className="flex items-center justify-between text-[#5E6963] dark:text-[#95A39B]">
                    <span className="text-xs font-bold uppercase tracking-wider">Entradas</span>
                    <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-lg sm:text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(summary.total_income)}
                  </p>
                </div>

                {/* Saídas */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F9FAF9] dark:bg-[#1D211F] border border-[#E2E8E4] dark:border-[#2E3532] space-y-1">
                  <div className="flex items-center justify-between text-[#5E6963] dark:text-[#95A39B]">
                    <span className="text-xs font-bold uppercase tracking-wider">Saídas</span>
                    <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <p className="text-lg sm:text-2xl font-bold font-display text-rose-600 dark:text-rose-400">
                    {formatCurrency(summary.total_expenses)}
                  </p>
                </div>

                {/* Saldo Final */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F9FAF9] dark:bg-[#1D211F] border border-[#E2E8E4] dark:border-[#2E3532] space-y-1">
                  <div className="flex items-center justify-between text-[#5E6963] dark:text-[#95A39B]">
                    <span className="text-xs font-bold uppercase tracking-wider">Saldo Final</span>
                    <Lock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <p
                    className={`text-lg sm:text-2xl font-bold font-display ${
                      summary.final_balance >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(summary.final_balance)}
                  </p>
                </div>
              </div>

              {/* Detalhamento das Despesas */}
              <div className="space-y-2.5 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                  Detalhamento de Saídas
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Gastos Fixos */}
                  <div className="p-3 rounded-xl bg-white dark:bg-[#181B1A] border border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[#5E6963] dark:text-[#95A39B]">
                      <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Gastos Fixos</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                      {formatCurrency(summary.total_fixed_expenses)}
                    </span>
                  </div>

                  {/* Gastos Variáveis */}
                  <div className="p-3 rounded-xl bg-white dark:bg-[#181B1A] border border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[#5E6963] dark:text-[#95A39B]">
                      <CreditCard className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Gastos Variáveis</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                      {formatCurrency(summary.total_variable_expenses)}
                    </span>
                  </div>

                  {/* Parcelamentos */}
                  <div className="p-3 rounded-xl bg-white dark:bg-[#181B1A] border border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[#5E6963] dark:text-[#95A39B]">
                      <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Parcelamentos</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                      {formatCurrency(summary.total_installments)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ação de Fechamento ou Ações do Mês Fechado */}
              <div className="pt-4 border-t border-[#E2E8E4] dark:border-[#2E3532] flex flex-col sm:flex-row items-center justify-between gap-3">
                {closure ? (
                  <div className="w-full p-3.5 rounded-xl bg-[#F9FAF9] dark:bg-[#181B1A] border border-[#E2E8E4] dark:border-[#2E3532] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs text-[#5E6963] dark:text-[#95A39B]">
                      <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <span>
                        Esta competência foi encerrada e seu resultado está salvo no histórico.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(closure)}
                        className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ver Resumo</span>
                      </Button>
                      {canReopen && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReopenConfirm(closure)}
                          className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Reabrir Mês</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                      Revise os totais calculados acima e confirme para registrar o resultado desta competência.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setIsConfirmModalOpen(true)}
                      className="w-full sm:w-auto bg-[#075C45] hover:bg-[#054433] text-white font-bold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Lock className="w-4 h-4" />
                      <span>FECHAR MÊS</span>
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. Histórico de Fechamentos */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#075C45] dark:text-[#78D9A6]" />
          <h2 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
            Histórico de Fechamentos
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : history.length === 0 ? (
          <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] p-6 text-center text-xs text-[#5E6963] dark:text-[#95A39B]">
            Nenhum mês foi fechado até o momento.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map((item) => {
              const [hYear, hMonth] = item.billing_cycle.split('-').map(Number);
              const label = `${MONTH_NAMES_PT[hMonth - 1]}/${hYear}`;
              const isCurrentSelected = item.billing_cycle === billingCycle;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                    isCurrentSelected
                      ? 'bg-[#075C45]/5 dark:bg-[#16A66A]/10 border-[#075C45]/40 dark:border-[#78D9A6]/40'
                      : 'bg-white dark:bg-[#232725] border-[#E2E8E4] dark:border-[#2E3532] hover:border-[#16A66A]/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                      {label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Fechado
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                    <span className="text-[#5E6963] dark:text-[#95A39B]">Saldo Final:</span>
                    <span
                      className={`font-bold font-display ${
                        item.final_balance >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(Number(item.final_balance) || 0)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetail(item)}
                      className="flex-1 text-xs h-8 cursor-pointer font-semibold"
                    >
                      Resumo
                    </Button>
                    {canReopen && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReopenConfirm(item)}
                        className="text-xs h-8 cursor-pointer border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5"
                        title="Reabrir este mês"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Fechamento */}
      <CloseMonthModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmClose}
        summary={summary}
        billingCycleLabel={billingCycleLabel}
        isSubmitting={isSubmitting}
      />

      {/* Modal de Detalhe / Resumo do Snapshot Histórico */}
      <ClosureDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        closure={detailClosure}
        billingCycleLabel={detailLabel}
        canReopen={canReopen}
        onOpenReopenConfirm={() => {
          if (detailClosure) handleOpenReopenConfirm(detailClosure);
        }}
      />

      {/* Modal de Confirmação para Reabrir Mês */}
      <ReopenMonthModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        onConfirm={handleConfirmReopen}
        billingCycleLabel={
          reopenClosure
            ? `${MONTH_NAMES_PT[Number(reopenClosure.billing_cycle.split('-')[1]) - 1]} de ${
                reopenClosure.billing_cycle.split('-')[0]
              }`
            : ''
        }
        isSubmitting={isReopening}
      />
    </div>
  );
}
