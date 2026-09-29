import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { monthlyClosuresService } from '../../lib/services/monthlyClosures';
import { entriesService } from '../../lib/services/entries';
import { fixedExpensesService } from '../../lib/services/fixedExpenses';
import { variableExpensesService } from '../../lib/services/variableExpenses';
import { installmentsService } from '../../lib/services/installments';
import { MonthlyClosure, MonthlyClosureSummary } from '../../types';
import { formatCurrency, getMonthNameBR, getMonthYearLabel } from '../../lib/formatters';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Calendar,
  Lock,
  Unlock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
  Percent,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  History,
  X,
  Download,
} from 'lucide-react';
import { generateFinancialPDFReport } from '../../lib/services/pdfReport';

// Tipos locais para organizar os dados compilados por mês
interface MonthReportData {
  cycle: string; // YYYY-MM
  year: number;
  month: number;
  label: string;
  isClosed: boolean;
  summary: MonthlyClosureSummary;
  closureDetails: MonthlyClosure | null;
  // Detalhes estendidos (caso estejam carregados dinamicamente)
  extended?: {
    incomeReceived: number;
    incomePending: number;
    fixedPaid: number;
    fixedPending: number;
    variablePaid: number;
    variablePending: number;
    installmentsPaid: number;
    installmentsPending: number;
  };
}

type PeriodPreset = 'current_month' | 'last_3_months' | 'last_6_months' | 'current_year' | 'custom';

export function ReportsScreen() {
  const { currentSpace } = useAuth();

  // Filtros de período
  const [preset, setPreset] = useState<PeriodPreset>('last_6_months');
  const [selectedReportYear, setSelectedReportYear] = useState<number>(new Date().getFullYear());
  const [customStartYear, setCustomStartYear] = useState<number>(new Date().getFullYear());
  const [customStartMonth, setCustomStartMonth] = useState<number>(1);
  const [customEndYear, setCustomEndYear] = useState<number>(new Date().getFullYear());
  const [customEndMonth, setCustomEndMonth] = useState<number>(new Date().getMonth() + 1);

  // Estados principais de dados
  const [reportMonths, setReportMonths] = useState<MonthReportData[]>([]);
  const [closuresHistory, setClosuresHistory] = useState<MonthlyClosure[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de dados brutos carregados em lote para exportação CSV e análise de performance
  const [rawEntries, setRawEntries] = useState<any[]>([]);
  const [rawVarExpenses, setRawVarExpenses] = useState<any[]>([]);
  const [rawFixedExpenses, setRawFixedExpenses] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);
  const [rawInstallments, setRawInstallments] = useState<any[]>([]);
  const [rawPurchases, setRawPurchases] = useState<any[]>([]);

  // Estados para Modal de Detalhamento Mensal
  const [selectedDetailMonth, setSelectedDetailMonth] = useState<MonthReportData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [monthEntries, setMonthEntries] = useState<any[]>([]);
  const [monthFixedExpenses, setMonthFixedExpenses] = useState<any[]>([]);
  const [monthVariableExpenses, setMonthVariableExpenses] = useState<any[]>([]);
  const [monthInstallments, setMonthInstallments] = useState<any[]>([]);

  // Estado para Tooltips Interativas nos Gráficos SVG
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [hoveredBreakdownSegment, setHoveredBreakdownSegment] = useState<string | null>(null);

  // Estado para a competência selecionada do Previsto x Realizado
  const [selectedPrevistoCycle, setSelectedPrevistoCycle] = useState<string>('');

  // Geração da lista de competências YYYY-MM do período selecionado
  const cyclesToLoad = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const list: { year: number; month: number; cycle: string }[] = [];

    if (preset === 'current_month') {
      list.push({
        year: currentYear,
        month: currentMonth,
        cycle: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
      });
    } else if (preset === 'last_3_months') {
      for (let i = 2; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        list.push({ year: y, month: m, cycle: `${y}-${String(m).padStart(2, '0')}` });
      }
    } else if (preset === 'last_6_months') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        list.push({ year: y, month: m, cycle: `${y}-${String(m).padStart(2, '0')}` });
      }
    } else if (preset === 'current_year') {
      for (let m = 1; m <= 12; m++) {
        list.push({ year: selectedReportYear, month: m, cycle: `${selectedReportYear}-${String(m).padStart(2, '0')}` });
      }
    } else if (preset === 'custom') {
      const startDate = new Date(customStartYear, customStartMonth - 1, 1);
      const endDate = new Date(customEndYear, customEndMonth - 1, 1);

      // Limita o intervalo personalizado a no máximo 12 meses por segurança e performance
      let temp = new Date(startDate);
      let count = 0;
      while (temp <= endDate && count < 12) {
        const y = temp.getFullYear();
        const m = temp.getMonth() + 1;
        list.push({ year: y, month: m, cycle: `${y}-${String(m).padStart(2, '0')}` });
        temp.setMonth(temp.getMonth() + 1);
        count++;
      }
    }

    return list;
  }, [preset, selectedReportYear, customStartYear, customStartMonth, customEndYear, customEndMonth]);

  // Carrega todos os dados de forma paralela e otimizada (sem N+1 de requisições sequenciais de rede)
  const loadReportsData = useCallback(async () => {
    if (!currentSpace?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      // 1. Busca histórico de fechamentos oficiais uma única vez
      const closuresRes = await monthlyClosuresService.getMonthlyClosuresHistory(currentSpace.id);
      const closures = closuresRes.closures || [];
      setClosuresHistory(closures);

      // 2. Se houver ciclos a carregar, busca todo o período em lote de forma otimizada
      let entriesData: any[] = [];
      let varExpensesData: any[] = [];
      let fixedExpensesData: any[] = [];
      let paymentsData: any[] = [];
      let installmentsData: any[] = [];
      let purchasesData: any[] = [];

      if (cyclesToLoad.length > 0 && supabase) {
        const sortedCycles = [...cyclesToLoad].sort((a, b) => a.cycle.localeCompare(b.cycle));
        const firstCycle = sortedCycles[0].cycle;
        const lastCycle = sortedCycles[sortedCycles.length - 1].cycle;

        const startDate = `${firstCycle}-01`;
        const [lastYear, lastMonth] = lastCycle.split('-').map(Number);
        const lastDay = new Date(lastYear, lastMonth, 0).getDate();
        const endDate = `${lastCycle}-${String(lastDay).padStart(2, '0')}`;

        const [
          entriesRes,
          varRes,
          fixedRes,
          paymentsRes,
          instRes,
          purchasesRes
        ] = await Promise.all([
          supabase.from('entries').select('*').eq('space_id', currentSpace.id).gte('date', startDate).lte('date', endDate),
          supabase.from('variable_expenses').select('*').eq('space_id', currentSpace.id).gte('date', startDate).lte('date', endDate),
          supabase.from('fixed_expenses').select('*').eq('space_id', currentSpace.id),
          supabase.from('fixed_expense_payments').select('*').eq('space_id', currentSpace.id).gte('billing_cycle', firstCycle).lte('billing_cycle', lastCycle),
          supabase.from('installments').select('*').eq('space_id', currentSpace.id).gte('due_date', startDate).lte('due_date', endDate),
          supabase.from('installment_purchases').select('*').eq('space_id', currentSpace.id),
        ]);

        entriesData = entriesRes.data || [];
        varExpensesData = varRes.data || [];
        fixedExpensesData = fixedRes.data || [];
        paymentsData = paymentsRes.data || [];
        installmentsData = instRes.data || [];
        purchasesData = purchasesRes.data || [];
      }

      setRawEntries(entriesData);
      setRawVarExpenses(varExpensesData);
      setRawFixedExpenses(fixedExpensesData);
      setRawPayments(paymentsData);
      setRawInstallments(installmentsData);
      setRawPurchases(purchasesData);

      // 3. Monta o relatório compilado para cada mês do período
      const compiledReports = cyclesToLoad.map((item) => {
        const closedMatch = closures.find((c) => c.billing_cycle === item.cycle);

        if (closedMatch) {
          // Mês Fechado: usa estritamente os valores do snapshot gravado na tabela monthly_closures
          return {
            cycle: item.cycle,
            year: item.year,
            month: item.month,
            label: getMonthYearLabel(item.year, item.month),
            isClosed: true,
            summary: {
              total_income: Number(closedMatch.total_income) || 0,
              total_fixed_expenses: Number(closedMatch.total_fixed_expenses) || 0,
              total_variable_expenses: Number(closedMatch.total_variable_expenses) || 0,
              total_installments: Number(closedMatch.total_installments) || 0,
              total_expenses: Number(closedMatch.total_expenses) || 0,
              final_balance: Number(closedMatch.final_balance) || 0,
            },
            closureDetails: closedMatch,
          } as MonthReportData;
        } else {
          // Mês Aberto: calcula dinamicamente a partir dos dados do lote em memória
          const cyclePrefix = `${item.year}-${String(item.month).padStart(2, '0')}`;

          const monthEntries = entriesData.filter((e: any) => e.date.startsWith(cyclePrefix));
          const totalIncome = monthEntries.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

          const monthVar = varExpensesData.filter((v: any) => v.date.startsWith(cyclePrefix));
          const totalVariable = monthVar.reduce((acc, v) => acc + (Number(v.amount) || 0), 0);

          const monthInst = installmentsData.filter((i: any) => i.due_date.startsWith(cyclePrefix));
          const totalInstallments = monthInst.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

          const targetCycleStr = `${item.year}-${String(item.month).padStart(2, '0')}-01`;
          const applicableFixed = fixedExpensesData.filter((f: any) => {
            const expStartDate = f.start_date ? f.start_date.substring(0, 10) : '1970-01-01';
            if (targetCycleStr < expStartDate) {
              return false;
            }
            if (f.recurrence === 'yearly') {
              return f.due_month === item.month;
            }
            return true;
          });
          const totalFixed = applicableFixed.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);

          const totalExpenses = Number((totalFixed + totalVariable + totalInstallments).toFixed(2));
          const finalBalance = Number((totalIncome - totalExpenses).toFixed(2));

          return {
            cycle: item.cycle,
            year: item.year,
            month: item.month,
            label: getMonthYearLabel(item.year, item.month),
            isClosed: false,
            summary: {
              total_income: Number(totalIncome.toFixed(2)),
              total_fixed_expenses: Number(totalFixed.toFixed(2)),
              total_variable_expenses: Number(totalVariable.toFixed(2)),
              total_installments: Number(totalInstallments.toFixed(2)),
              total_expenses: totalExpenses,
              final_balance: finalBalance,
            },
            closureDetails: null,
          } as MonthReportData;
        }
      });

      setReportMonths(compiledReports);
    } catch (err: any) {
      console.error('Erro ao carregar os relatórios financeiros:', err);
      setError('Ocorreu um erro ao carregar as informações analíticas do período.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, cyclesToLoad]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // Totais agregados de todo o período selecionado
  const aggregates = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalFixed = 0;
    let totalVariable = 0;
    let totalInstallments = 0;

    for (const m of reportMonths) {
      totalIncome += m.summary.total_income;
      totalExpenses += m.summary.total_expenses;
      totalFixed += m.summary.total_fixed_expenses;
      totalVariable += m.summary.total_variable_expenses;
      totalInstallments += m.summary.total_installments;
    }

    const finalBalance = Number((totalIncome - totalExpenses).toFixed(2));
    const commitmentPercent = totalIncome > 0 ? Number(((totalExpenses / totalIncome) * 100).toFixed(1)) : 0;

    return {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalFixed: Number(totalFixed.toFixed(2)),
      totalVariable: Number(totalVariable.toFixed(2)),
      totalInstallments: Number(totalInstallments.toFixed(2)),
      finalBalance,
      commitmentPercent,
    };
  }, [reportMonths]);

  // Sincroniza e inicializa o ciclo selecionado do Previsto x Realizado
  useEffect(() => {
    if (reportMonths.length > 0) {
      if (!selectedPrevistoCycle || !reportMonths.some((m) => m.cycle === selectedPrevistoCycle)) {
        setSelectedPrevistoCycle(reportMonths[reportMonths.length - 1].cycle);
      }
    }
  }, [reportMonths, selectedPrevistoCycle]);

  // Cálculos de Previsto x Realizado por tipo de lançamento
  const previstoRealizadoData = useMemo(() => {
    if (!selectedPrevistoCycle || reportMonths.length === 0) return null;

    const [year, month] = selectedPrevistoCycle.split('-').map(Number);
    const cyclePrefix = `${year}-${String(month).padStart(2, '0')}`;

    // 1. ENTRADAS
    const monthEntries = rawEntries.filter((e: any) => e.date.startsWith(cyclePrefix));
    const entriesPrevisto = monthEntries.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const entriesRealizado = monthEntries
      .filter((e: any) => e.status === 'received')
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    // 2. GASTOS FIXOS
    const applicableFixed = rawFixedExpenses.filter((f: any) => {
      const expStartDate = f.start_date ? f.start_date.substring(0, 10) : '1970-01-01';
      if (selectedPrevistoCycle + '-01' < expStartDate) {
        return false;
      }
      if (f.recurrence === 'yearly') {
        return f.due_month === month;
      }
      return true;
    });
    const fixedPrevisto = applicableFixed.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
    const fixedRealizado = applicableFixed.reduce((acc, f) => {
      const isPaid = rawPayments.some((p: any) => p.fixed_expense_id === f.id && p.billing_cycle === selectedPrevistoCycle);
      return acc + (isPaid ? (Number(f.amount) || 0) : 0);
    }, 0);

    // 3. GASTOS VARIÁVEIS
    const monthVar = rawVarExpenses.filter((v: any) => v.date.startsWith(cyclePrefix));
    const varPrevisto = monthVar.reduce((acc, v) => acc + (Number(v.amount) || 0), 0);
    const varRealizado = monthVar
      .filter((v: any) => v.status === 'paid')
      .reduce((acc, v) => acc + (Number(v.amount) || 0), 0);

    // 4. PARCELADOS
    const monthInst = rawInstallments.filter((i: any) => i.due_date.startsWith(cyclePrefix));
    const instPrevisto = monthInst.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    const instRealizado = monthInst
      .filter((i: any) => i.status === 'paid')
      .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

    // TOTAIS
    const expensesPrevisto = fixedPrevisto + varPrevisto + instPrevisto;
    const expensesRealizado = fixedRealizado + varRealizado + instRealizado;

    const resultPrevisto = entriesPrevisto - expensesPrevisto;
    const resultRealizado = entriesRealizado - expensesRealizado;

    return {
      entries: { previsto: entriesPrevisto, realizado: entriesRealizado },
      fixed: { previsto: fixedPrevisto, realizado: fixedRealizado },
      variable: { previsto: varPrevisto, realizado: varRealizado },
      installments: { previsto: instPrevisto, realizado: instRealizado },
      expenses: { previsto: expensesPrevisto, realizado: expensesRealizado },
      result: { previsto: resultPrevisto, realizado: resultRealizado },
    };
  }, [selectedPrevistoCycle, rawEntries, rawFixedExpenses, rawPayments, rawVarExpenses, rawInstallments, reportMonths]);

  // Carrega lazily os detalhes do lançamento de um mês selecionado ao abrir o modal (Read-Only)
  const loadMonthDetails = async (monthData: MonthReportData) => {
    if (!currentSpace?.id) return;
    setIsDetailLoading(true);
    setSelectedDetailMonth(monthData);
    setIsDetailModalOpen(true);

    try {
      const [entriesRes, fixedRes, variableRes, installmentsRes] = await Promise.all([
        entriesService.getEntriesByMonth(currentSpace.id, monthData.year, monthData.month),
        fixedExpensesService.getFixedExpensesWithStatus(currentSpace.id, monthData.year, monthData.month),
        variableExpensesService.getVariableExpensesByMonth(currentSpace.id, monthData.year, monthData.month),
        installmentsService.getPurchasesWithInstallments(currentSpace.id, {
          year: monthData.year,
          month: monthData.month,
        }),
      ]);

      setMonthEntries(entriesRes.entries || []);
      setMonthFixedExpenses(fixedRes.expenses || []);
      setMonthVariableExpenses(variableRes.expenses || []);

      // Filtra as parcelas do cronograma que vencem neste mês específico
      const cyclePrefix = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
      const relevantInstallments: any[] = [];
      if (installmentsRes.purchases) {
        for (const purchase of installmentsRes.purchases) {
          if (purchase.installments) {
            for (const inst of purchase.installments) {
              if (inst.due_date.startsWith(cyclePrefix)) {
                relevantInstallments.push(inst);
              }
            }
          }
        }
      }
      setMonthInstallments(relevantInstallments);
    } catch (err) {
      console.error('Erro ao buscar detalhes da competência:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Preset quick navigation helper
  const handlePresetChange = (newPreset: PeriodPreset) => {
    setPreset(newPreset);
  };

  // Exportação robusta para CSV com BOM UTF-8 e formato compatível com Excel nacional
  const handleExportCSV = () => {
    if (reportMonths.length === 0) return;

    const rows: string[][] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Para cada ciclo no período selecionado (do mais antigo ao mais recente para ficar na ordem cronológica)
    const sortedCycles = [...cyclesToLoad].sort((a, b) => a.cycle.localeCompare(b.cycle));

    for (const item of sortedCycles) {
      const cyclePrefix = `${item.year}-${String(item.month).padStart(2, '0')}`;
      const compLabel = getMonthYearLabel(item.year, item.month);

      // 1. Receitas (Entradas)
      const monthEntries = rawEntries.filter((e: any) => e.date.startsWith(cyclePrefix));
      for (const ent of monthEntries) {
        rows.push([
          compLabel,
          'Entrada',
          ent.category || 'Outros',
          ent.description,
          String(Number(ent.amount).toFixed(2)).replace('.', ','),
          ent.status === 'received' ? 'Recebido' : 'Pendente'
        ]);
      }

      // 2. Gastos Fixos
      const applicableFixed = rawFixedExpenses.filter((f: any) => {
        const expStartDate = f.start_date ? f.start_date.substring(0, 10) : '1970-01-01';
        if (item.cycle + '-01' < expStartDate) {
          return false;
        }
        if (f.recurrence === 'yearly') {
          return f.due_month === item.month;
        }
        return true;
      });
      for (const f of applicableFixed) {
        const payment = rawPayments.find((p: any) => p.fixed_expense_id === f.id && p.billing_cycle === item.cycle);
        const isPaid = !!payment;

        // Vencimento do mês
        const validDueDay = Math.min(Math.max(1, f.due_day), new Date(item.year, item.month, 0).getDate());
        const dueDateStr = `${item.year}-${String(item.month).padStart(2, '0')}-${String(validDueDay).padStart(2, '0')}`;

        let statusText = 'Pendente';
        if (isPaid) {
          statusText = 'Pago';
        } else if (dueDateStr < todayStr) {
          statusText = 'Atrasado';
        }

        rows.push([
          compLabel,
          'Gasto Fixo',
          f.category || 'Outros',
          f.description,
          String(Number(f.amount).toFixed(2)).replace('.', ','),
          statusText
        ]);
      }

      // 3. Gastos Variáveis
      const monthVar = rawVarExpenses.filter((v: any) => v.date.startsWith(cyclePrefix));
      for (const v of monthVar) {
        rows.push([
          compLabel,
          'Gasto Variável',
          v.category || 'Outros',
          v.description,
          String(Number(v.amount).toFixed(2)).replace('.', ','),
          v.status === 'paid' ? 'Pago' : 'Pendente'
        ]);
      }

      // 4. Parcelados
      const monthInst = rawInstallments.filter((i: any) => i.due_date.startsWith(cyclePrefix));
      for (const inst of monthInst) {
        const purchase = rawPurchases.find((p: any) => p.id === inst.purchase_id);
        const desc = purchase 
          ? `${purchase.description} (${inst.installment_number}/${purchase.installment_count})`
          : `Parcela #${inst.installment_number}`;

        let statusText = 'Pendente';
        if (inst.status === 'paid') {
          statusText = 'Pago';
        } else if (inst.due_date < todayStr) {
          statusText = 'Atrasado';
        }

        rows.push([
          compLabel,
          'Parcelamento',
          purchase?.category || 'Outros',
          desc,
          String(Number(inst.amount).toFixed(2)).replace('.', ','),
          statusText
        ]);
      }
    }

    // Gerar o conteúdo CSV
    const headers = ['Competência', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Situação'];
    const csvContent = [
      headers.map(h => `"${h}"`).join(';'),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\r\n');

    // Download do arquivo com BOM UTF-8 para suporte de acentuação no Excel
    const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Poupagaio_Relatorio_Financeiro_${preset}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Geração de Relatório Financeiro Executivo em PDF com layout profissional
  const handleGeneratePDF = () => {
    if (reportMonths.length === 0) return;

    let periodLabel = '';
    if (preset === 'current_month') {
      periodLabel = reportMonths[0]?.label || 'Mês Atual';
    } else if (preset === 'last_3_months') {
      periodLabel = 'Últimos 3 Meses';
    } else if (preset === 'last_6_months') {
      periodLabel = 'Últimos 6 Meses';
    } else if (preset === 'current_year') {
      periodLabel = `Ano de ${selectedReportYear}`;
    } else {
      periodLabel = `${getMonthNameBR(customStartMonth)}/${customStartYear} até ${getMonthNameBR(customEndMonth)}/${customEndYear}`;
    }

    generateFinancialPDFReport({
      spaceName: currentSpace?.name || 'Meu Espaço',
      periodLabel,
      totalIncome: aggregates.totalIncome,
      totalExpenses: aggregates.totalExpenses,
      finalBalance: aggregates.finalBalance,
      fixedExpenses: aggregates.totalFixed,
      variableExpenses: aggregates.totalVariable,
      installments: aggregates.totalInstallments,
      previstoRealizado: previstoRealizadoData,
      months: reportMonths,
    });
  };

  // Constantes e cálculos de desenho para o Gráfico SVG de Evolução Financeira
  const trendChartMetrics = useMemo(() => {
    if (reportMonths.length === 0) return null;

    // Encontra o valor máximo entre entradas e despesas para escalar o gráfico
    let maxVal = 1000;
    for (const m of reportMonths) {
      const highest = Math.max(m.summary.total_income, m.summary.total_expenses);
      if (highest > maxVal) {
        maxVal = highest;
      }
    }
    // Adiciona margem de respiro de 20% no topo do gráfico para rótulos diretos
    maxVal = Math.ceil(maxVal * 1.2);

    const width = 800;
    const height = 300;
    const paddingLeft = 60;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const stepX = reportMonths.length > 1 ? chartWidth / (reportMonths.length - 1) : chartWidth;

    const points = reportMonths.map((m, idx) => {
      const x = paddingLeft + idx * stepX;
      const yIncome = paddingTop + chartHeight - (m.summary.total_income / maxVal) * chartHeight;
      const yExpense = paddingTop + chartHeight - (m.summary.total_expenses / maxVal) * chartHeight;
      const yBalance = paddingTop + chartHeight - (m.summary.final_balance / maxVal) * chartHeight;

      return { x, yIncome, yExpense, yBalance, data: m };
    });

    return { width, height, paddingLeft, paddingTop, chartWidth, chartHeight, maxVal, points };
  }, [reportMonths]);

  // Composição de Despesas agregadas em formato proporcional para desenho do Donut Chart
  const expenseBreakdownParts = useMemo(() => {
    const { totalFixed, totalVariable, totalInstallments } = aggregates;
    const total = totalFixed + totalVariable + totalInstallments;

    if (total === 0) return [];

    const items = [
      { id: 'fixed', label: 'Gastos Fixos', value: totalFixed, color: '#8B5CF6', hoverColor: '#A78BFA' }, // ROXO
      { id: 'variable', label: 'Gastos Variáveis', value: totalVariable, color: '#E11D48', hoverColor: '#F43F5E' }, // VERMELHO
      { id: 'installments', label: 'Parcelados', value: totalInstallments, color: '#F59E0B', hoverColor: '#FBBF24' }, // LARANJA
    ];

    // Calcula coordenadas para o Donut chart em SVG (raio 70, centro 100,100)
    let cumulativePercent = 0;
    return items.map((item) => {
      const percent = (item.value / total) * 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;

      // Conversão para radianos
      const startAngle = (startPercent / 100) * 360 - 90;
      const endAngle = (cumulativePercent / 100) * 360 - 90;

      const radStart = (startAngle * Math.PI) / 180;
      const radEnd = (endAngle * Math.PI) / 180;

      const x1 = 100 + 70 * Math.cos(radStart);
      const y1 = 100 + 70 * Math.sin(radStart);
      const x2 = 100 + 70 * Math.cos(radEnd);
      const y2 = 100 + 70 * Math.sin(radEnd);

      const largeArcFlag = percent > 50 ? 1 : 0;

      // Desenho do path SVG arc
      const pathData = `M ${x1} ${y1} A 70 70 0 ${largeArcFlag} 1 ${x2} ${y2}`;

      return {
        ...item,
        percent: Number(percent.toFixed(1)),
        pathData,
      };
    });
  }, [aggregates]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="reports-screen-root">
      {/* 1. TOPO & FILTROS DE PERÍODO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1E2220] p-4 rounded-2xl border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xs w-full">
        <div className="space-y-1">
          <h2 className="text-lg font-bold font-display text-[#075C45] dark:text-[#78D9A6] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#16A66A]" />
            Visão Financeira Analítica
          </h2>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            Acompanhe o desempenho, evolução e detalhamento das finanças do seu espaço
          </p>
        </div>

        {/* Seletor de Período Preset & Exportar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 bg-[#F3F4F4] dark:bg-[#151817] p-1 rounded-xl w-full sm:w-auto text-center">
            <button
              type="button"
              onClick={() => handlePresetChange('current_month')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                preset === 'current_month'
                  ? 'bg-white dark:bg-[#1E2220] text-[#075C45] dark:text-[#78D9A6] shadow-2xs'
                  : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F4F4F5]'
              }`}
            >
              Mês Atual
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('last_3_months')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                preset === 'last_3_months'
                  ? 'bg-white dark:bg-[#1E2220] text-[#075C45] dark:text-[#78D9A6] shadow-2xs'
                  : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F4F4F5]'
              }`}
            >
              3 Meses
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('last_6_months')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                preset === 'last_6_months'
                  ? 'bg-white dark:bg-[#1E2220] text-[#075C45] dark:text-[#78D9A6] shadow-2xs'
                  : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F4F4F5]'
              }`}
            >
              6 Meses
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('current_year')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                preset === 'current_year'
                  ? 'bg-white dark:bg-[#1E2220] text-[#075C45] dark:text-[#78D9A6] shadow-2xs'
                  : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F4F4F5]'
              }`}
            >
              Este Ano
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('custom')}
              className={`col-span-2 sm:col-span-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                preset === 'custom'
                  ? 'bg-white dark:bg-[#1E2220] text-[#075C45] dark:text-[#78D9A6] shadow-2xs'
                  : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F4F4F5]'
              }`}
            >
              Personalizado
            </button>
          </div>

          <Button
            onClick={handleGeneratePDF}
            className="bg-[#075C45] hover:bg-[#054131] text-white flex items-center justify-center gap-1.5 px-3 py-1.5 h-9 rounded-xl text-xs font-bold cursor-pointer shadow-2xs dark:bg-[#16A66A] dark:hover:bg-[#128a58] transition-colors w-full sm:w-auto"
          >
            <FileText className="w-4 h-4" />
            Gerar relatório PDF
          </Button>
        </div>
      </div>

      {/* Controles de Ano (exibido quando preset for current_year) */}
      <AnimatePresence>
        {preset === 'current_year' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#EBECEE]/40 dark:bg-[#161817]/40 p-3 rounded-2xl border border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#075C45] dark:text-[#78D9A6]">
                Filtrar por Ano:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReportYear(selectedReportYear - 1)}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B]"
                  aria-label="Ano anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {[selectedReportYear - 1, selectedReportYear, selectedReportYear + 1].map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setSelectedReportYear(year)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedReportYear === year
                          ? 'bg-[#075C45] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                          : 'bg-white/80 dark:bg-[#1E2220] text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724]'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReportYear(selectedReportYear + 1)}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B]"
                  aria-label="Próximo ano"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controles de Intervalo Personalizado (exibido somente quando preset for custom) */}
      <AnimatePresence>
        {preset === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#EBECEE]/40 dark:bg-[#161817]/40 p-4 rounded-2xl border border-[#E2E8E4] dark:border-[#2E3532] grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Data Inicial */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                  Mês Inicial
                </label>
                <div className="flex gap-2">
                  <select
                    value={customStartMonth}
                    onChange={(e) => setCustomStartMonth(Number(e.target.value))}
                    className="flex-1 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] px-3 py-2 text-xs font-semibold"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getMonthNameBR(i + 1)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={customStartYear}
                    onChange={(e) => setCustomStartYear(Number(e.target.value))}
                    className="w-24 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] px-3 py-2 text-xs font-semibold"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const yr = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Data Final */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                  Mês Final (Até 12 meses do inicial)
                </label>
                <div className="flex gap-2">
                  <select
                    value={customEndMonth}
                    onChange={(e) => setCustomEndMonth(Number(e.target.value))}
                    className="flex-1 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] px-3 py-2 text-xs font-semibold"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getMonthNameBR(i + 1)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={customEndYear}
                    onChange={(e) => setCustomEndYear(Number(e.target.value))}
                    className="w-24 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] px-3 py-2 text-xs font-semibold"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const yr = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. LOADING STATE / SKELETONS */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="reports-loading-skeleton">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-[#E2E8E4] dark:border-[#2E3532]">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
          <div className="col-span-full grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-[280px] w-full rounded-2xl" />
            </div>
            <Skeleton className="h-[280px] w-full rounded-2xl" />
          </div>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-sm text-rose-800 dark:text-rose-400">Falha ao Carregar</h3>
          <p className="text-xs text-rose-600 dark:text-rose-300 max-w-md mx-auto">{error}</p>
          <Button
            onClick={loadReportsData}
            variant="outline"
            className="mt-2 border-rose-300 hover:bg-rose-100 dark:border-rose-900"
          >
            Tentar Novamente
          </Button>
        </div>
      ) : reportMonths.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#1E2220] border border-[#E2E8E4] dark:border-[#2E3532] rounded-2xl space-y-3">
          <Info className="w-10 h-10 text-[#16A66A] mx-auto opacity-70" />
          <h3 className="font-bold text-sm text-[#202724] dark:text-[#F4F4F5]">Nenhuma competência selecionada</h3>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B] max-w-sm mx-auto">
            Não existem lançamentos ou fechamentos no período selecionado. Modifique os filtros de competência para carregar informações.
          </p>
        </div>
      ) : (
        <div className="space-y-6" id="reports-dashboard-content">
          {/* 3. QUATRO KPI CARDS PRINCIPAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card Receitas (Entradas) */}
            <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs overflow-hidden">
              <CardContent className="p-4 relative">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                      Receitas do Período
                    </span>
                    <h3 className="text-xl lg:text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(aggregates.totalIncome)}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F3F4F4] dark:border-[#282E2B] flex items-center justify-between text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                  <span>Total estimado em {reportMonths.length} meses</span>
                </div>
              </CardContent>
            </Card>

            {/* Card Despesas */}
            <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs overflow-hidden">
              <CardContent className="p-4 relative">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                      Despesas do Período
                    </span>
                    <h3 className="text-xl lg:text-2xl font-bold font-display text-rose-500 dark:text-rose-400">
                      {formatCurrency(aggregates.totalExpenses)}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-500 dark:text-rose-400">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F3F4F4] dark:border-[#282E2B] flex items-center justify-between text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D6A84B]" />
                    Fixos: {formatCurrency(aggregates.totalFixed)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
                    Var.: {formatCurrency(aggregates.totalVariable)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                    Parc.: {formatCurrency(aggregates.totalInstallments)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card Resultado do Período */}
            <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs overflow-hidden">
              <CardContent className="p-4 relative">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                      Saldo Acumulado
                    </span>
                    <h3 className={`text-xl lg:text-2xl font-bold font-display ${
                      aggregates.finalBalance >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400'
                    }`}>
                      {formatCurrency(aggregates.finalBalance)}
                    </h3>
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    aggregates.finalBalance >= 0
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-50 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}>
                    {aggregates.finalBalance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F3F4F4] dark:border-[#282E2B] flex items-center justify-between text-[10px]">
                  <span className="text-[#5E6963] dark:text-[#95A39B]">Status consolidado:</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                    aggregates.finalBalance >= 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}>
                    {aggregates.finalBalance >= 0 ? 'Superávit' : 'Déficit'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card Comprometimento da Renda */}
            <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs overflow-hidden">
              <CardContent className="p-4 relative space-y-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                      Média de Comprometimento
                    </span>
                    <h3 className="text-xl lg:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                      {aggregates.totalIncome > 0 ? `${aggregates.commitmentPercent.toFixed(1)}%` : '—'}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#16A66A]/10 flex items-center justify-center text-[#16A66A]">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>

                {/* Progress bar do Comprometimento */}
                <div className="space-y-1 pt-1">
                  <div className="w-full bg-[#F3F4F4] dark:bg-[#282E2B] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-[#075C45] dark:bg-[#78D9A6]"
                      style={{ width: `${aggregates.totalIncome > 0 ? Math.min(100, aggregates.commitmentPercent) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-[#5E6963] dark:text-[#95A39B]">
                    <span>Fórmula: Despesas / Entradas * 100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. SEÇÃO DE GRÁFICOS (Evolução + Composição) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico 1: Evolução Financeira Mensal (SVG) */}
            <Card className="lg:col-span-2 border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs">
              <CardContent className="pt-6 pb-4 px-4 sm:pt-7 sm:pb-5 sm:px-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left pb-1">
                  <div className="flex flex-col items-center sm:items-start">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#075C45] dark:text-[#78D9A6]">
                      Evolução Mensal (Entradas vs Despesas)
                    </h4>
                    <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                      Evolução das receitas, despesas e saldo no período
                    </p>
                  </div>
                  {/* Legenda do Gráfico */}
                  <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#16A66A]" />
                      Receitas
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                      Despesas
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-blue-500 inline-block" />
                      Saldo
                    </span>
                  </div>
                </div>

                {/* SVG Drawing of the Trend Chart */}
                {trendChartMetrics && (
                  <div className="relative w-full min-h-[220px] sm:min-h-[260px] pt-2">
                    <div className="w-full">
                      <svg
                        viewBox={`0 0 ${trendChartMetrics.width} ${trendChartMetrics.height}`}
                        className="w-full h-auto max-h-[300px] overflow-visible select-none"
                      >
                        {/* Linhas de Grade de Fundo (Y-axis gridlines) */}
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const yVal = trendChartMetrics.paddingTop + (trendChartMetrics.chartHeight / 4) * idx;
                          const gridVal = trendChartMetrics.maxVal - (trendChartMetrics.maxVal / 4) * idx;
                          return (
                            <g key={idx} className="opacity-40 dark:opacity-20">
                              <line
                                x1={trendChartMetrics.paddingLeft}
                                y1={yVal}
                                x2={trendChartMetrics.width - 30}
                                y2={yVal}
                                stroke="#A3B2A9"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                              />
                              <text
                                x={trendChartMetrics.paddingLeft - 10}
                                y={yVal + 3}
                                textAnchor="end"
                                className="fill-[#5E6963] dark:fill-[#95A39B] text-[9px] font-bold"
                              >
                                {formatCurrency(gridVal).replace(',00', '').replace('R$', '')}
                              </text>
                            </g>
                          );
                        })}

                        {/* Barras e Linhas de Dados */}
                        {trendChartMetrics.points.map((p, idx) => {
                          const barWidth = 14;
                          const xOffsetIncome = p.x - barWidth - 2;
                          const xOffsetExpense = p.x + 2;

                          // Altura de barras correspondentes
                          const incomeBarHeight = trendChartMetrics.paddingTop + trendChartMetrics.chartHeight - p.yIncome;
                          const expenseBarHeight = trendChartMetrics.paddingTop + trendChartMetrics.chartHeight - p.yExpense;

                          const isHovered = hoveredTrendIndex === idx;

                          return (
                            <g
                              key={idx}
                              onMouseEnter={() => setHoveredTrendIndex(idx)}
                              onMouseLeave={() => setHoveredTrendIndex(null)}
                              className="cursor-pointer"
                            >
                              {/* Barra de Receitas (Verde) */}
                              <rect
                                x={xOffsetIncome}
                                y={p.yIncome}
                                width={barWidth}
                                height={Math.max(2, incomeBarHeight)}
                                fill={isHovered ? '#10B981' : '#16A66A'}
                                rx="3"
                                opacity={isHovered || hoveredTrendIndex === null ? 1 : 0.4}
                                className="transition-all duration-150"
                              />

                              {/* Valor Direto acima da Barra de Receitas */}
                              {p.data.income > 0 && (
                                <text
                                  x={xOffsetIncome + barWidth / 2}
                                  y={p.yIncome - 4}
                                  textAnchor="middle"
                                  className="text-[8px] font-extrabold fill-[#075C45] dark:fill-[#78D9A6] select-none pointer-events-none"
                                >
                                  {p.data.income >= 1000 ? `${(p.data.income / 1000).toFixed(1)}k` : `${p.data.income}`}
                                </text>
                              )}

                              {/* Barra de Despesas (Rose) */}
                              <rect
                                x={xOffsetExpense}
                                y={p.yExpense}
                                width={barWidth}
                                height={Math.max(2, expenseBarHeight)}
                                fill={isHovered ? '#F43F5E' : '#E11D48'}
                                rx="3"
                                opacity={isHovered || hoveredTrendIndex === null ? 1 : 0.4}
                                className="transition-all duration-150"
                              />

                              {/* Valor Direto acima da Barra de Despesas */}
                              {p.data.expenses > 0 && (
                                <text
                                  x={xOffsetExpense + barWidth / 2}
                                  y={p.yExpense - 4}
                                  textAnchor="middle"
                                  className="text-[8px] font-extrabold fill-[#E11D48] dark:fill-[#FB7185] select-none pointer-events-none"
                                >
                                  {p.data.expenses >= 1000 ? `${(p.data.expenses / 1000).toFixed(1)}k` : `${p.data.expenses}`}
                                </text>
                              )}

                              {/* Área/Interação Vertical de Fundo */}
                              <rect
                                x={p.x - 30}
                                y={trendChartMetrics.paddingTop}
                                width="60"
                                height={trendChartMetrics.chartHeight}
                                fill="transparent"
                              />

                              {/* Eixo X labels (Month / Year) */}
                              <text
                                x={p.x}
                                y={trendChartMetrics.height - 15}
                                textAnchor="middle"
                                className={`text-[10px] font-bold ${
                                  isHovered
                                    ? 'fill-[#075C45] dark:fill-[#78D9A6]'
                                    : 'fill-[#5E6963] dark:fill-[#95A39B]'
                                }`}
                              >
                                {p.data.cycle.split('-').reverse().join('/')}
                              </text>

                              {/* Indicador de Status (Cadeado para Fechado, Círculo para Aberto) */}
                              {p.data.isClosed ? (
                                <g transform={`translate(${p.x - 5}, ${trendChartMetrics.height - 10})`}>
                                  <path
                                    d="M2.5 1.5a2 2 0 0 1 4 0V3h-4V1.5ZM1.5 3A1.5 1.5 0 0 0 0 4.5v3A1.5 1.5 0 0 0 1.5 9h6A1.5 1.5 0 0 0 9 7.5v-3A1.5 1.5 0 0 0 7.5 3h-6Z"
                                    className="fill-[#16A66A] opacity-70"
                                    transform="scale(0.8)"
                                  />
                                </g>
                              ) : (
                                <circle
                                  cx={p.x}
                                  cy={trendChartMetrics.height - 6}
                                  r="2"
                                  className="fill-amber-500 opacity-75"
                                />
                              )}
                            </g>
                          );
                        })}

                        {/* Linha de Conexão do Saldo (Trend Line) */}
                        <path
                          d={trendChartMetrics.points
                            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yBalance}`)
                            .join(' ')}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-90 pointer-events-none"
                        />

                        {/* Pontos sobre a linha de saldo com rótulo direto */}
                        {trendChartMetrics.points.map((p, idx) => {
                          const isHovered = hoveredTrendIndex === idx;
                          return (
                            <g key={`dot-group-${idx}`} className="pointer-events-none">
                              <circle
                                cx={p.x}
                                cy={p.yBalance}
                                r={isHovered ? 6 : 4}
                                fill="#3B82F6"
                                stroke={p.data.isClosed ? '#E2E8E4' : '#F7F4EA'}
                                strokeWidth="2"
                                className="transition-all duration-150"
                              />
                              <text
                                x={p.x}
                                y={p.yBalance - 7}
                                textAnchor="middle"
                                className="text-[8px] font-black fill-[#2563EB] dark:fill-[#60A5FA] select-none"
                              >
                                {Math.abs(p.data.balance) >= 1000 ? `${(p.data.balance / 1000).toFixed(1)}k` : `${p.data.balance}`}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Tooltip Card flutuante baseada em interações */}
                    <AnimatePresence>
                      {hoveredTrendIndex !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute bottom-16 bg-white dark:bg-[#151817] border border-[#E2E8E4] dark:border-[#2E3532] p-3 rounded-xl shadow-xl z-30 space-y-1 text-left min-w-[180px]"
                          style={{
                            left: `${Math.min(
                              80,
                              Math.max(
                                10,
                                ((trendChartMetrics.points[hoveredTrendIndex].x - trendChartMetrics.paddingLeft) /
                                  trendChartMetrics.chartWidth) *
                                  100
                              )
                            )}%`,
                          }}
                        >
                          <div className="flex items-center justify-between border-b border-[#F3F4F4] dark:border-[#282E2B] pb-1">
                            <span className="text-xs font-bold text-[#202724] dark:text-[#F4F4F5]">
                              {reportMonths[hoveredTrendIndex].label}
                            </span>
                            <span className="flex items-center">
                              {reportMonths[hoveredTrendIndex].isClosed ? (
                                <Lock className="w-2.5 h-2.5 text-emerald-500" />
                              ) : (
                                <Unlock className="w-2.5 h-2.5 text-amber-500" />
                              )}
                            </span>
                          </div>
                          <div className="text-[11px] space-y-1 pt-1">
                            <div className="flex justify-between items-center text-[#5E6963] dark:text-[#95A39B]">
                              <span>Receitas:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(reportMonths[hoveredTrendIndex].summary.total_income)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[#5E6963] dark:text-[#95A39B]">
                              <span>Despesas:</span>
                              <span className="font-bold text-rose-500 dark:text-rose-400">
                                {formatCurrency(reportMonths[hoveredTrendIndex].summary.total_expenses)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-t border-[#F3F4F4] dark:border-[#282E2B] pt-1">
                              <span className="font-semibold">Resultado:</span>
                              <span
                                className={`font-bold ${
                                  reportMonths[hoveredTrendIndex].summary.final_balance >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-500 dark:text-rose-400'
                                }`}
                              >
                                {formatCurrency(reportMonths[hoveredTrendIndex].summary.final_balance)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-[#5E6963] dark:text-[#95A39B]">
                              <span>Comprometimento:</span>
                              <span className="font-bold">
                                {reportMonths[hoveredTrendIndex].summary.total_income > 0
                                  ? `${((reportMonths[hoveredTrendIndex].summary.total_expenses /
                                      reportMonths[hoveredTrendIndex].summary.total_income) *
                                      100).toFixed(1)}%`
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico 2: Composição de Despesas (SVG Donut) */}
            <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs">
              <CardContent className="pt-6 pb-4 px-4 sm:pt-7 sm:pb-5 sm:px-5 space-y-4 text-center">
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left pb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#075C45] dark:text-[#78D9A6]">
                    Composição de Despesas
                  </h4>
                  <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                    Divisão das despesas totais do período por tipo
                  </p>
                </div>

                {aggregates.totalExpenses === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-[#5E6963] dark:text-[#95A39B] text-xs">
                    <Info className="w-8 h-8 opacity-40 mb-2" />
                    <span>Nenhuma despesa registrada</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-4">
                    {/* Desenho do Donut Chart */}
                    <div className="relative w-44 h-44">
                      <svg viewBox="0 0 200 200" className="w-full h-full rotate-270 transform">
                        {/* Círculo Cinza Base */}
                        <circle cx="100" cy="100" r="70" fill="transparent" stroke="#E2E8E4" strokeWidth="18" className="dark:stroke-[#2E3532]" />

                        {/* Segmentos de Cores */}
                        {expenseBreakdownParts.map((seg) => {
                          const isHovered = hoveredBreakdownSegment === seg.id;
                          return (
                            <path
                              key={seg.id}
                              d={seg.pathData}
                              fill="transparent"
                              stroke={isHovered ? seg.hoverColor : seg.color}
                              strokeWidth={isHovered ? 24 : 18}
                              strokeLinecap="round"
                              onMouseEnter={() => setHoveredBreakdownSegment(seg.id)}
                              onMouseLeave={() => setHoveredBreakdownSegment(null)}
                              className="transition-all duration-150 cursor-pointer"
                            />
                          );
                        })}
                      </svg>
                      {/* Centro do Donut */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                          Total Despesas
                        </span>
                        <span className="text-sm font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                          {formatCurrency(aggregates.totalExpenses).replace(',00', '')}
                        </span>
                      </div>
                    </div>

                    {/* Legendas & Valores em Cards Limpos */}
                    <div className="w-full space-y-2 text-left text-xs pt-1">
                      {expenseBreakdownParts.map((seg) => {
                        const isHovered = hoveredBreakdownSegment === seg.id;
                        return (
                          <div
                            key={seg.id}
                            onMouseEnter={() => setHoveredBreakdownSegment(seg.id)}
                            onMouseLeave={() => setHoveredBreakdownSegment(null)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] transition-colors ${
                              isHovered ? 'bg-[#F3F4F4] dark:bg-[#151817]' : 'bg-white dark:bg-[#1E2220]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                              <span className="font-semibold text-xs text-[#202724] dark:text-[#F4F4F5] truncate">{seg.label}</span>
                            </div>
                            <div className="text-right flex items-center gap-2 shrink-0">
                              <span className="font-bold text-[#202724] dark:text-[#F4F4F5] whitespace-nowrap">{formatCurrency(seg.value)}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F3F4F4] dark:bg-[#202623] text-[#5E6963] dark:text-[#95A39B] whitespace-nowrap">
                                {seg.percent}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SEÇÃO COMPACTA: PREVISTO X REALIZADO — ETAPA 3.10 */}
          {previstoRealizadoData && (
            <Card className="mt-10 border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs">
              <CardContent className="pt-6 pb-4 px-4 sm:pt-7 sm:pb-5 sm:px-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#F3F4F4] dark:border-[#282E2B] pb-3 text-center sm:text-left">
                  <div className="flex flex-col items-center sm:items-start">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#075C45] dark:text-[#78D9A6] flex items-center justify-center sm:justify-start gap-1.5">
                      <TrendingUp className="w-4 h-4 text-[#16A66A]" />
                      Análise Previsto x Realizado
                    </h4>
                    <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                      Acompanhe o planejado frente à efetivação de receitas e pagamentos da competência selecionada
                    </p>
                  </div>

                  {/* Seletor de Mês específico */}
                  <div className="flex items-center justify-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                      Competência:
                    </span>
                    <select
                      value={selectedPrevistoCycle}
                      onChange={(e) => setSelectedPrevistoCycle(e.target.value)}
                      className="rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] px-3 py-1.5 text-xs font-bold shadow-2xs cursor-pointer focus:outline-none"
                    >
                      {reportMonths.map((m) => (
                        <option key={m.cycle} value={m.cycle}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  {/* Mobile Cards (telas pequenas) */}
                  <div className="block md:hidden space-y-3">
                    {[
                      {
                        title: 'Entradas (Receitas)',
                        color: 'bg-emerald-500',
                        textColor: 'text-emerald-700 dark:text-emerald-400',
                        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
                        previsto: previstoRealizadoData.entries.previsto,
                        realizado: previstoRealizadoData.entries.realizado,
                        diff: previstoRealizadoData.entries.realizado - previstoRealizadoData.entries.previsto,
                        isHighlight: false,
                        progress: previstoRealizadoData.entries.previsto > 0
                          ? (previstoRealizadoData.entries.realizado / previstoRealizadoData.entries.previsto) * 100
                          : 0,
                        barColor: 'bg-emerald-500',
                      },
                      {
                        title: 'Gastos Fixos',
                        color: 'bg-[#D6A84B]',
                        textColor: 'text-[#B4882F] dark:text-[#F2C052]',
                        badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
                        previsto: previstoRealizadoData.fixed.previsto,
                        realizado: previstoRealizadoData.fixed.realizado,
                        diff: previstoRealizadoData.fixed.previsto - previstoRealizadoData.fixed.realizado,
                        isHighlight: false,
                        progress: previstoRealizadoData.fixed.previsto > 0
                          ? (previstoRealizadoData.fixed.realizado / previstoRealizadoData.fixed.previsto) * 100
                          : 0,
                        barColor: 'bg-[#D6A84B]',
                      },
                      {
                        title: 'Gastos Variáveis',
                        color: 'bg-rose-500',
                        textColor: 'text-rose-600 dark:text-rose-400',
                        badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
                        previsto: previstoRealizadoData.variable.previsto,
                        realizado: previstoRealizadoData.variable.realizado,
                        diff: previstoRealizadoData.variable.previsto - previstoRealizadoData.variable.realizado,
                        isHighlight: false,
                        progress: previstoRealizadoData.variable.previsto > 0
                          ? (previstoRealizadoData.variable.realizado / previstoRealizadoData.variable.previsto) * 100
                          : 0,
                        barColor: 'bg-rose-500',
                      },
                      {
                        title: 'Parcelados',
                        color: 'bg-indigo-500',
                        textColor: 'text-indigo-600 dark:text-indigo-400',
                        badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
                        previsto: previstoRealizadoData.installments.previsto,
                        realizado: previstoRealizadoData.installments.realizado,
                        diff: previstoRealizadoData.installments.previsto - previstoRealizadoData.installments.realizado,
                        isHighlight: false,
                        progress: previstoRealizadoData.installments.previsto > 0
                          ? (previstoRealizadoData.installments.realizado / previstoRealizadoData.installments.previsto) * 100
                          : 0,
                        barColor: 'bg-indigo-500',
                      },
                      {
                        title: 'Total de Despesas',
                        color: 'bg-red-600',
                        textColor: 'text-red-700 dark:text-red-400',
                        badgeBg: 'bg-red-50 dark:bg-red-950/40',
                        previsto: previstoRealizadoData.expenses.previsto,
                        realizado: previstoRealizadoData.expenses.realizado,
                        diff: previstoRealizadoData.expenses.previsto - previstoRealizadoData.expenses.realizado,
                        isHighlight: true,
                        progress: previstoRealizadoData.expenses.previsto > 0
                          ? (previstoRealizadoData.expenses.realizado / previstoRealizadoData.expenses.previsto) * 100
                          : 0,
                        barColor: 'bg-rose-600',
                      },
                      {
                        title: 'Resultado Líquido',
                        color: previstoRealizadoData.result.realizado >= 0 ? 'bg-emerald-600' : 'bg-rose-600',
                        textColor: previstoRealizadoData.result.realizado >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600',
                        badgeBg: previstoRealizadoData.result.realizado >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40',
                        previsto: previstoRealizadoData.result.previsto,
                        realizado: previstoRealizadoData.result.realizado,
                        diff: previstoRealizadoData.result.realizado - previstoRealizadoData.result.previsto,
                        isHighlight: true,
                        progress: previstoRealizadoData.result.previsto !== 0
                          ? (previstoRealizadoData.result.realizado / previstoRealizadoData.result.previsto) * 100
                          : 0,
                        barColor: previstoRealizadoData.result.realizado >= 0 ? 'bg-emerald-600' : 'bg-rose-600',
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          item.isHighlight
                            ? 'bg-[#F2F7F4] dark:bg-[#151C18] border-[#075C45]/20 dark:border-[#78D9A6]/20'
                            : 'bg-white dark:bg-[#1E2220] border-[#E2E8E4] dark:border-[#2E3532]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F3F4F4] dark:border-[#282E2B]">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.color}`} />
                            <span className="font-bold text-xs text-[#202724] dark:text-[#F4F4F5] uppercase tracking-wide">
                              {item.title}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.badgeBg} ${item.textColor}`}>
                            {item.previsto > 0 || (item.title === 'Resultado Líquido' && item.previsto !== 0) ? `${item.progress.toFixed(0)}%` : '—'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2.5 text-left">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B] block">
                              Previsto
                            </span>
                            <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B] whitespace-nowrap block mt-0.5">
                              {formatCurrency(item.previsto)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B] block">
                              Realizado
                            </span>
                            <span className={`text-xs font-bold whitespace-nowrap block mt-0.5 ${item.textColor}`}>
                              {formatCurrency(item.realizado)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B] block">
                              Diferença
                            </span>
                            <span
                              className={`text-xs font-bold whitespace-nowrap block mt-0.5 ${
                                item.diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                              }`}
                            >
                              {formatCurrency(item.diff)}
                            </span>
                          </div>
                        </div>

                        {/* Barra de Progresso visual */}
                        {item.previsto > 0 && (
                          <div className="mt-2.5 pt-1">
                            <div className="w-full bg-[#F3F4F4] dark:bg-[#282E2B] h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${item.barColor} transition-all duration-300`}
                                style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Tabela de Valores (Desktop) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#F3F4F4] dark:border-[#282E2B] text-[#5E6963] dark:text-[#95A39B] text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-2 pb-2.5">Categoria</th>
                          <th className="py-2 pb-2.5 text-right">Previsto</th>
                          <th className="py-2 pb-2.5 text-right">Realizado</th>
                          <th className="py-2 pb-2.5 text-right">Diferença</th>
                          <th className="py-2 pb-2.5 text-center">Progresso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F4] dark:divide-[#282E2B] font-medium">
                        {/* 1. Entradas */}
                        <tr>
                          <td className="py-2.5 font-bold flex items-center gap-1.5 text-[#202724] dark:text-[#F4F4F5]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            Entradas (Receitas)
                          </td>
                          <td className="py-2.5 text-right text-[#5E6963] dark:text-[#95A39B]">
                            {formatCurrency(previstoRealizadoData.entries.previsto)}
                          </td>
                          <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                            {formatCurrency(previstoRealizadoData.entries.realizado)}
                          </td>
                          <td className={`py-2.5 text-right ${
                            previstoRealizadoData.entries.realizado - previstoRealizadoData.entries.previsto >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500'
                          }`}>
                            {formatCurrency(previstoRealizadoData.entries.realizado - previstoRealizadoData.entries.previsto)}
                          </td>
                          <td className="py-2.5 text-center font-bold">
                            {previstoRealizadoData.entries.previsto > 0
                              ? `${((previstoRealizadoData.entries.realizado / previstoRealizadoData.entries.previsto) * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                        </tr>

                        {/* 2. Gastos Fixos */}
                        <tr>
                          <td className="py-2.5 font-bold flex items-center gap-1.5 text-[#202724] dark:text-[#F4F4F5]">
                            <span className="w-2 h-2 rounded-full bg-[#D6A84B] shrink-0" />
                            Gastos Fixos
                          </td>
                          <td className="py-2.5 text-right text-[#5E6963] dark:text-[#95A39B]">
                            {formatCurrency(previstoRealizadoData.fixed.previsto)}
                          </td>
                          <td className="py-2.5 text-right text-rose-500 dark:text-rose-400 font-bold">
                            {formatCurrency(previstoRealizadoData.fixed.realizado)}
                          </td>
                          <td className={`py-2.5 text-right ${
                            previstoRealizadoData.fixed.previsto - previstoRealizadoData.fixed.realizado >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500'
                          }`}>
                            {formatCurrency(previstoRealizadoData.fixed.previsto - previstoRealizadoData.fixed.realizado)}
                          </td>
                          <td className="py-2.5 text-center font-bold">
                            {previstoRealizadoData.fixed.previsto > 0
                              ? `${((previstoRealizadoData.fixed.realizado / previstoRealizadoData.fixed.previsto) * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                        </tr>

                        {/* 3. Gastos Variáveis */}
                        <tr>
                          <td className="py-2.5 font-bold flex items-center gap-1.5 text-[#202724] dark:text-[#F4F4F5]">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            Gastos Variáveis
                          </td>
                          <td className="py-2.5 text-right text-[#5E6963] dark:text-[#95A39B]">
                            {formatCurrency(previstoRealizadoData.variable.previsto)}
                          </td>
                          <td className="py-2.5 text-right text-rose-500 dark:text-rose-400 font-bold">
                            {formatCurrency(previstoRealizadoData.variable.realizado)}
                          </td>
                          <td className={`py-2.5 text-right ${
                            previstoRealizadoData.variable.previsto - previstoRealizadoData.variable.realizado >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500'
                          }`}>
                            {formatCurrency(previstoRealizadoData.variable.previsto - previstoRealizadoData.variable.realizado)}
                          </td>
                          <td className="py-2.5 text-center font-bold">
                            {previstoRealizadoData.variable.previsto > 0
                              ? `${((previstoRealizadoData.variable.realizado / previstoRealizadoData.variable.previsto) * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                        </tr>

                        {/* 4. Parcelados */}
                        <tr>
                          <td className="py-2.5 font-bold flex items-center gap-1.5 text-[#202724] dark:text-[#F4F4F5]">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            Parcelados
                          </td>
                          <td className="py-2.5 text-right text-[#5E6963] dark:text-[#95A39B]">
                            {formatCurrency(previstoRealizadoData.installments.previsto)}
                          </td>
                          <td className="py-2.5 text-right text-rose-500 dark:text-rose-400 font-bold">
                            {formatCurrency(previstoRealizadoData.installments.realizado)}
                          </td>
                          <td className={`py-2.5 text-right ${
                            previstoRealizadoData.installments.previsto - previstoRealizadoData.installments.realizado >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500'
                          }`}>
                            {formatCurrency(previstoRealizadoData.installments.previsto - previstoRealizadoData.installments.realizado)}
                          </td>
                          <td className="py-2.5 text-center font-bold">
                            {previstoRealizadoData.installments.previsto > 0
                              ? `${((previstoRealizadoData.installments.realizado / previstoRealizadoData.installments.previsto) * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                        </tr>

                        {/* Total Despesas */}
                        <tr className="border-t border-[#F3F4F4] dark:border-[#282E2B] font-bold">
                          <td className="py-3 text-[#202724] dark:text-[#F4F4F5]">Total Geral Despesas</td>
                          <td className="py-3 text-right text-[#5E6963] dark:text-[#95A39B]">
                            {formatCurrency(previstoRealizadoData.expenses.previsto)}
                          </td>
                          <td className="py-3 text-right text-rose-500 dark:text-rose-400 font-bold">
                            {formatCurrency(previstoRealizadoData.expenses.realizado)}
                          </td>
                          <td className={`py-3 text-right ${
                            previstoRealizadoData.expenses.previsto - previstoRealizadoData.expenses.realizado >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500'
                          }`}>
                            {formatCurrency(previstoRealizadoData.expenses.previsto - previstoRealizadoData.expenses.realizado)}
                          </td>
                          <td className="py-3 text-center font-bold">
                            {previstoRealizadoData.expenses.previsto > 0
                              ? `${((previstoRealizadoData.expenses.realizado / previstoRealizadoData.expenses.previsto) * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                        </tr>

                        {/* Resultado Final */}
                        <tr className="bg-[#16A66A]/5 dark:bg-[#16A66A]/10 font-bold border-t border-[#E2E8E4]/60">
                          <td className="py-3 px-2 text-[#075C45] dark:text-[#78D9A6]">Resultado Líquido</td>
                          <td className={`py-3 text-right pr-2 ${previstoRealizadoData.result.previsto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {formatCurrency(previstoRealizadoData.result.previsto)}
                          </td>
                          <td className={`py-3 text-right pr-2 ${previstoRealizadoData.result.realizado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {formatCurrency(previstoRealizadoData.result.realizado)}
                          </td>
                          <td className={`py-3 text-right pr-2 ${
                            previstoRealizadoData.result.realizado - previstoRealizadoData.result.previsto >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500'
                          }`}>
                            {formatCurrency(previstoRealizadoData.result.realizado - previstoRealizadoData.result.previsto)}
                          </td>
                          <td className="py-3 text-center font-bold">
                            {previstoRealizadoData.result.previsto !== 0
                              ? `${((previstoRealizadoData.result.realizado / previstoRealizadoData.result.previsto) * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Visualização de Barras / Progressos de Realização */}
                  <div className="space-y-4 flex flex-col justify-center">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] mb-1">
                        Legenda do Cockpit
                      </span>
                      <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
                        • <strong>Previsto:</strong> Todo o valor de lançamentos inseridos ou previstos para a competência.<br />
                        • <strong>Realizado:</strong> Soma dos valores efetivamente pagos (status <em>pago</em>) ou receitas recebidas (status <em>recebido</em>).
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      {/* Progresso de Entradas */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-[#202724] dark:text-[#F4F4F5]">Realização de Receitas</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {previstoRealizadoData.entries.previsto > 0
                              ? `${((previstoRealizadoData.entries.realizado / previstoRealizadoData.entries.previsto) * 100).toFixed(1)}%`
                              : '0.0%'}
                          </span>
                        </div>
                        <div className="w-full bg-[#F3F4F4] dark:bg-[#282E2B] h-2.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{
                              width: `${
                                previstoRealizadoData.entries.previsto > 0
                                  ? Math.min(100, (previstoRealizadoData.entries.realizado / previstoRealizadoData.entries.previsto) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Progresso de Despesas */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-[#202724] dark:text-[#F4F4F5]">Quitação de Despesas</span>
                          <span className="text-rose-500">
                            {previstoRealizadoData.expenses.previsto > 0
                              ? `${((previstoRealizadoData.expenses.realizado / previstoRealizadoData.expenses.previsto) * 100).toFixed(1)}%`
                              : '0.0%'}
                          </span>
                        </div>
                        <div className="w-full bg-[#F3F4F4] dark:bg-[#282E2B] h-2.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-500 transition-all duration-500"
                            style={{
                              width: `${
                                previstoRealizadoData.expenses.previsto > 0
                                  ? Math.min(100, (previstoRealizadoData.expenses.realizado / previstoRealizadoData.expenses.previsto) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 5. TABELA COMPARATIVA DE COMPETÊNCIAS */}
          <Card className="mt-10 border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-2xs">
            <CardContent className="pt-6 pb-4 px-4 sm:pt-7 sm:pb-5 sm:px-5 space-y-4">
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left pb-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#075C45] dark:text-[#78D9A6]">
                  Comparativo de Competências do Período
                </h4>
                <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                  Consolidado mês a mês das receitas, despesas, balanço final e nível de comprometimento
                </p>
              </div>

              {/* Mobile: Cards de Competência */}
              <div className="block md:hidden space-y-3">
                {reportMonths.map((m) => {
                  const commitment = m.summary.total_income > 0 ? (m.summary.total_expenses / m.summary.total_income) * 100 : 0;
                  return (
                    <div
                      key={m.cycle}
                      className="p-3.5 rounded-2xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#F3F4F4] dark:border-[#282E2B] pb-2">
                        <span className="font-bold text-xs uppercase tracking-wide text-[#202724] dark:text-[#F4F4F5]">
                          {m.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.isClosed
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {m.isClosed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          {m.isClosed ? 'Fechado' : 'Aberto'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B] block">
                            Entradas
                          </span>
                          <span className="font-bold text-[#16A66A] whitespace-nowrap block mt-0.5">
                            {formatCurrency(m.summary.total_income)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B] block">
                            Despesas
                          </span>
                          <span className="font-bold text-[#E11D48] whitespace-nowrap block mt-0.5">
                            {formatCurrency(m.summary.total_expenses)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B] block">
                            Saldo
                          </span>
                          <span className={`font-bold whitespace-nowrap block mt-0.5 ${
                            m.summary.final_balance >= 0 ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            {formatCurrency(m.summary.final_balance)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B] block">
                            Comprometimento
                          </span>
                          <span className="font-bold text-[#202724] dark:text-[#F4F4F5] whitespace-nowrap block mt-0.5">
                            {m.summary.total_income > 0 ? `${commitment.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadMonthDetails(m)}
                          className="w-full h-8.5 rounded-xl border-[#E2E8E4] dark:border-[#2E3532] text-[#075C45] dark:text-[#78D9A6] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver detalhes da competência
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabela de Competências (Desktop) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8E4] dark:border-[#2E3532] text-[#5E6963] dark:text-[#95A39B] text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3">Competência</th>
                      <th className="py-3 px-3 text-center">Situação</th>
                      <th className="py-3 px-3 text-right">Entradas (R$)</th>
                      <th className="py-3 px-3 text-right">Despesas (R$)</th>
                      <th className="py-3 px-3 text-right">Resultado (R$)</th>
                      <th className="py-3 px-3 text-center">Comprometimento</th>
                      <th className="py-3 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8E4]/50 dark:divide-[#2E3532]/50">
                    {reportMonths.map((m) => {
                      const commitment = m.summary.total_income > 0 ? (m.summary.total_expenses / m.summary.total_income) * 100 : 0;
                      return (
                        <tr
                          key={m.cycle}
                          className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors group"
                        >
                          <td className="py-3 px-3 font-bold text-[#202724] dark:text-[#F4F4F5]">
                            {m.label}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              m.isClosed
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}>
                              {m.isClosed ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Fechado
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  Aberto
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-[#16A66A]">
                            {formatCurrency(m.summary.total_income)}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-[#E11D48]">
                            {formatCurrency(m.summary.total_expenses)}
                          </td>
                          <td className={`py-3 px-3 text-right font-bold ${
                            m.summary.final_balance >= 0 ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            {formatCurrency(m.summary.final_balance)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-[#202724] dark:text-[#F4F4F5]">
                              {m.summary.total_income > 0 ? `${commitment.toFixed(1)}%` : '—'}
                              {m.summary.total_income > 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#075C45] dark:bg-[#78D9A6]" />
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => loadMonthDetails(m)}
                              className="h-8 rounded-lg hover:bg-[#16A66A]/10 text-[#075C45] dark:text-[#78D9A6]"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Detalhes
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 6. HISTÓRICO DE FECHAMENTO */}
          <Card className="mt-10 border-[#E2E8E4] dark:border-[#2E3532] bg-[#F7F9F7] dark:bg-[#131514] overflow-hidden">
            <CardContent className="pt-6 pb-4 px-4 sm:pt-7 sm:pb-5 sm:px-5">
              <div className="flex items-center justify-center sm:justify-start gap-2 pb-3 border-b border-[#E2E8E4] dark:border-[#2E3532] mb-3 text-center sm:text-left">
                <History className="w-4 h-4 text-[#16A66A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#202724] dark:text-[#F4F4F5]">
                  Histórico de Fechamento
                </span>
              </div>

              {closuresHistory.length === 0 ? (
                <div className="py-6 text-center text-[#5E6963] dark:text-[#95A39B] text-xs">
                  Ainda não foram registrados fechamentos oficiais para este espaço.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {closuresHistory.slice(0, 5).map((cl) => (
                    <div
                      key={cl.id}
                      className="bg-white dark:bg-[#1E2220] border border-[#E2E8E4] dark:border-[#2E3532] p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-shadow hover:shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#075C45] dark:text-[#78D9A6]">
                            {getMonthYearLabel(
                              parseInt(cl.billing_cycle.split('-')[0]),
                              parseInt(cl.billing_cycle.split('-')[1])
                            )}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 inline-flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Fechamento Oficial
                          </span>
                        </div>
                        <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                          Encerrado em: {new Date(cl.closed_at).toLocaleDateString('pt-BR')} por {cl.closed_by_name || 'Sistema'}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E2E8E4]/60 dark:border-[#2E3532]/60">
                        <div>
                          <p className="text-[9px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">Receitas</p>
                          <p className="font-bold text-[#16A66A] whitespace-nowrap text-xs">{formatCurrency(cl.total_income)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">Despesas</p>
                          <p className="font-bold text-[#E11D48] whitespace-nowrap text-xs">{formatCurrency(cl.total_expenses)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">Saldo Final</p>
                          <p className={`font-bold whitespace-nowrap text-xs ${cl.final_balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {formatCurrency(cl.final_balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7. MODAL DETALHADO MENSAL (READ-ONLY) */}
      <AnimatePresence>
        {isDetailModalOpen && selectedDetailMonth && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#1E2220] border border-[#E2E8E4] dark:border-[#2E3532] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-[#202724] dark:text-[#F4F4F5]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8E4] dark:border-[#2E3532]">
                <div>
                  <h3 className="text-sm font-bold font-display text-[#075C45] dark:text-[#78D9A6] flex items-center gap-2">
                    {selectedDetailMonth.isClosed ? <Lock className="w-4 h-4 text-emerald-500" /> : <Unlock className="w-4 h-4 text-amber-500" />}
                    Detalhamento de {selectedDetailMonth.label}
                  </h3>
                  <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                    {selectedDetailMonth.isClosed
                      ? 'Exibição exclusiva de snapshot oficial fechado'
                      : 'Exibição calculada ao vivo (competência em aberto)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[#F3F4F4] dark:hover:bg-[#282E2B] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {isDetailLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Mini sumário interno */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#F7F9F7] dark:bg-[#131514] p-4 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532]">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">Entradas</p>
                        <p className="font-bold text-emerald-600 text-sm">
                          {formatCurrency(selectedDetailMonth.summary.total_income)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">Despesas</p>
                        <p className="font-bold text-rose-500 text-sm">
                          {formatCurrency(selectedDetailMonth.summary.total_expenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">Resultado</p>
                        <p className={`font-bold text-sm ${selectedDetailMonth.summary.final_balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {formatCurrency(selectedDetailMonth.summary.final_balance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-[#5E6963] dark:text-[#95A39B]">Comprometimento</p>
                        <p className="font-bold text-sm text-[#202724] dark:text-[#F4F4F5]">
                          {selectedDetailMonth.summary.total_income > 0
                            ? `${((selectedDetailMonth.summary.total_expenses / selectedDetailMonth.summary.total_income) * 100).toFixed(1)}%`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Lançamentos Divididos por Categorias */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Bloco 1: Entradas */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#E2E8E4] dark:border-[#2E3532]">
                          <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-xs">Entradas e Receitas ({monthEntries.length})</span>
                        </div>
                        {monthEntries.length === 0 ? (
                          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] italic">Nenhuma receita lançada.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {monthEntries.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center bg-white dark:bg-[#1E2220] border border-[#E2E8E4]/50 dark:border-[#2E3532]/50 p-2 rounded-lg"
                              >
                                <div>
                                  <p className="font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]">{item.description}</p>
                                  <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                                    {new Date(item.date).toLocaleDateString('pt-BR')} • {item.category || 'Outros'}
                                  </p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <span className="font-bold text-[#16A66A]">{formatCurrency(item.amount)}</span>
                                  {item.status === 'received' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bloco 2: Gastos Fixos */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#E2E8E4] dark:border-[#2E3532]">
                          <FileText className="w-4 h-4 text-[#D6A84B]" />
                          <span className="font-bold text-xs">Gastos Fixos ({monthFixedExpenses.length})</span>
                        </div>
                        {monthFixedExpenses.length === 0 ? (
                          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] italic">Nenhum gasto fixo lançado.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {monthFixedExpenses.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center bg-white dark:bg-[#1E2220] border border-[#E2E8E4]/50 dark:border-[#2E3532]/50 p-2 rounded-lg"
                              >
                                <div>
                                  <p className="font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]">{item.description}</p>
                                  <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                                    Dia {item.due_day} • {item.category || 'Outros'}
                                  </p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <span className="font-bold text-rose-500">{formatCurrency(item.amount)}</span>
                                  {item.isPaid ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bloco 3: Gastos Variáveis */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#E2E8E4] dark:border-[#2E3532]">
                          <CreditCard className="w-4 h-4 text-rose-500" />
                          <span className="font-bold text-xs">Gastos Variáveis ({monthVariableExpenses.length})</span>
                        </div>
                        {monthVariableExpenses.length === 0 ? (
                          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] italic">Nenhum gasto variável lançado.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {monthVariableExpenses.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center bg-white dark:bg-[#1E2220] border border-[#E2E8E4]/50 dark:border-[#2E3532]/50 p-2 rounded-lg"
                              >
                                <div>
                                  <p className="font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]">{item.description}</p>
                                  <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                                    {new Date(item.date).toLocaleDateString('pt-BR')} • {item.category || 'Outros'}
                                  </p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <span className="font-bold text-rose-500">{formatCurrency(item.amount)}</span>
                                  {item.status === 'paid' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bloco 4: Parcelas */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#E2E8E4] dark:border-[#2E3532]">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          <span className="font-bold text-xs">Parcelas do Mês ({monthInstallments.length})</span>
                        </div>
                        {monthInstallments.length === 0 ? (
                          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] italic">Nenhuma compra parcelada em andamento neste mês.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {monthInstallments.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center bg-white dark:bg-[#1E2220] border border-[#E2E8E4]/50 dark:border-[#2E3532]/50 p-2 rounded-lg"
                              >
                                <div>
                                  <p className="font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]">{item.purchaseDescription}</p>
                                  <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                                    Parcela {item.installment_number}/{item.purchaseTotalCount} • Vence: {new Date(item.due_date).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <span className="font-bold text-rose-500">{formatCurrency(item.amount)}</span>
                                  {item.status === 'paid' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-[#E2E8E4] dark:border-[#2E3532] bg-[#F7F9F7] dark:bg-[#131514] flex justify-end">
                <Button onClick={() => setIsDetailModalOpen(false)} className="bg-[#075C45] hover:bg-[#054131] text-white">
                  Fechar Detalhamento
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
