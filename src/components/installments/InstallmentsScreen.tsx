import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  InstallmentPurchaseWithInstallments,
  InstallmentsMonthSummary,
  InstallmentsGlobalSummary,
  CreateInstallmentPurchaseInput,
  UpdateInstallmentPurchaseInput,
} from '../../types';
import {
  installmentsService,
  emptyMonthSummary,
  emptyGlobalSummary,
} from '../../lib/services/installments';
import { formatCurrency } from '../../lib/formatters';
import { InstallmentCard } from './InstallmentCard';
import { InstallmentPurchaseModal } from './InstallmentPurchaseModal';
import { PaymentOriginConfirmModal } from '../reserves/PaymentOriginConfirmModal';
import { reservesService } from '../../lib/services/reserves';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import {
  Calendar,
  Plus,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

const MONTH_NAMES = [
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

interface InstallmentsScreenProps {
  selectedYear?: number;
  selectedMonth?: number;
  onMonthChange?: (year: number, month: number) => void;
}

export function InstallmentsScreen({
  selectedYear: initialYear,
  selectedMonth: initialMonth,
  onMonthChange,
}: InstallmentsScreenProps = {}) {
  const { user, currentSpace } = useAuth();

  // Competência selecionada (Mês / Ano)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(initialYear || now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth || (now.getMonth() + 1));

  useEffect(() => {
    if (initialYear && initialMonth) {
      setSelectedYear(initialYear);
      setSelectedMonth(initialMonth);
    }
  }, [initialYear, initialMonth]);

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    onMonthChange?.(newYear, newMonth);
  };

  // Filtro de listagem: Todas / Em andamento / Finalizadas
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Dados
  const [purchases, setPurchases] = useState<InstallmentPurchaseWithInstallments[]>([]);
  const [monthSummary, setMonthSummary] = useState<InstallmentsMonthSummary>(emptyMonthSummary);
  const [globalSummary, setGlobalSummary] = useState<InstallmentsGlobalSummary>(emptyGlobalSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [userFriendlyError, setUserFriendlyError] = useState<string | null>(null);

  // Modais
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseToEdit, setPurchaseToEdit] = useState<InstallmentPurchaseWithInstallments | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<InstallmentPurchaseWithInstallments | null>(null);
  const [payingInstallment, setPayingInstallment] = useState<{
    installmentId: string;
    purchase: InstallmentPurchaseWithInstallments;
    amount: number;
    dueDate: string;
    number: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carregar dados de parcelados
  const loadInstallmentsData = useCallback(async () => {
    if (!currentSpace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setUserFriendlyError(null);

    try {
      const res = await installmentsService.getPurchasesWithInstallments(currentSpace.id, {
        year: selectedYear,
        month: selectedMonth,
        filterStatus: statusFilter,
      });

      if (res.error) {
        setUserFriendlyError(res.error);
      } else {
        setPurchases(res.purchases);
        setMonthSummary(res.monthSummary);
        setGlobalSummary(res.globalSummary);
      }
    } catch {
      setUserFriendlyError('Não foi possível carregar as compras parceladas no momento.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, selectedYear, selectedMonth, statusFilter]);

  useEffect(() => {
    loadInstallmentsData();
  }, [loadInstallmentsData]);

  // Navegação de mês
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      handleMonthChange(selectedYear - 1, 12);
    } else {
      handleMonthChange(selectedYear, selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      handleMonthChange(selectedYear + 1, 1);
    } else {
      handleMonthChange(selectedYear, selectedMonth + 1);
    }
  };

  // Salvar compra (criar ou atualizar)
  const handleSavePurchase = async (
    input: CreateInstallmentPurchaseInput | UpdateInstallmentPurchaseInput
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentSpace?.id) return { success: false, error: 'Espaço não selecionado.' };

    if (purchaseToEdit) {
      const res = await installmentsService.updatePurchase(purchaseToEdit.id, currentSpace.id, input);
      if (res.success) {
        await loadInstallmentsData();
        setIsPurchaseModalOpen(false);
        setPurchaseToEdit(null);
      }
      return res;
    } else {
      const res = await installmentsService.createPurchase(input as CreateInstallmentPurchaseInput);
      if (res.purchase) {
        await loadInstallmentsData();
        setIsPurchaseModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.error || 'Erro ao criar compra parcelada.' };
    }
  };

  // Excluir compra confirmada
  const handleConfirmDelete = async () => {
    if (!purchaseToDelete || !currentSpace?.id || isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await installmentsService.deletePurchase(purchaseToDelete.id, currentSpace.id);
      if (res.success) {
        await loadInstallmentsData();
        setPurchaseToDelete(null);
      } else {
        setUserFriendlyError(res.error || 'Não foi possível excluir a compra parcelada.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Marcar parcela como paga
  const handleMarkInstallmentPaid = async (installmentId: string) => {
    if (!currentSpace?.id) return;
    for (const p of purchases) {
      const found = p.installments?.find((i) => i.id === installmentId);
      if (found) {
        setPayingInstallment({
          installmentId,
          purchase: p,
          amount: found.amount,
          dueDate: found.due_date,
          number: found.installment_number,
        });
        return;
      }
    }
  };

  // Desfazer pagamento de parcela
  const handleUnmarkInstallmentPaid = async (installmentId: string) => {
    if (!currentSpace?.id) return;
    try {
      if (user?.id) {
        await reservesService.refundExpensePayment('installment', installmentId, currentSpace.id, user.id);
      }
      const res = await installmentsService.unmarkInstallmentPayment(installmentId, currentSpace.id);
      if (res.success) {
        await loadInstallmentsData();
      } else {
        setUserFriendlyError(res.error || 'Não foi possível desfazer o pagamento.');
      }
    } catch {
      setUserFriendlyError('Não foi possível desfazer o pagamento.');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3.5 sm:space-y-6 pb-4 animate-in fade-in duration-300">
      {/* ==================================================
          1. CABEÇALHO DO MÓDULO PARCELADOS
          ================================================== */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-xs">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#075C45]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F7F4EA] tracking-tight truncate">
              Parcelados
            </h1>
            <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B] truncate sm:whitespace-normal">
              Acompanhe suas compras e compromissos parcelados.
            </p>
          </div>
        </div>

        {/* Botão Nova Compra */}
        <Button
          type="button"
          onClick={() => {
            setPurchaseToEdit(null);
            setIsPurchaseModalOpen(true);
          }}
          className="w-full sm:w-auto rounded-xl sm:rounded-2xl bg-[#075C45] hover:bg-[#075C45]/90 dark:bg-[#16A66A] dark:hover:bg-[#16A66A]/90 text-white font-bold gap-2 px-4 py-2.5 shadow-xs cursor-pointer justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Nova compra parcelada</span>
        </Button>
      </header>

      {/* Alerta amigável de erro se houver */}
      {userFriendlyError && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate sm:whitespace-normal">{userFriendlyError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUserFriendlyError(null)}
            className="text-xs font-bold underline hover:opacity-80 cursor-pointer shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ==================================================
          2. SELETOR DE COMPETÊNCIA (MÊS / ANO) E FILTROS
          ================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B]">
        {/* Navegação do Mês: centralizado e balanceado em telas pequenas */}
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            aria-label="Mês anterior"
            className="rounded-xl h-9 w-9 p-0 border-[#E2E8E4] dark:border-[#24312B] cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl bg-[#F7F4EA] dark:bg-[#101614] border border-[#E2E8E4] dark:border-[#24312B] text-center sm:min-w-[170px]">
            <span className="text-sm font-bold font-display text-[#202724] dark:text-[#F7F4EA] truncate block">
              {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            aria-label="Próximo mês"
            className="rounded-xl h-9 w-9 p-0 border-[#E2E8E4] dark:border-[#24312B] cursor-pointer shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Filtros de Visualização de Compras: grid simétrico no mobile, flex no desktop */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1 sm:gap-1.5 bg-[#F7F4EA] dark:bg-[#101614] p-1 rounded-xl border border-[#E2E8E4] dark:border-[#24312B] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`w-full sm:w-auto text-center py-1.5 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer truncate ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-[#18211D] text-[#075C45] dark:text-[#78D9A6] shadow-xs'
                : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F7F4EA]'
            }`}
          >
            Todas ({globalSummary.activePurchasesCount + globalSummary.completedPurchasesCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`w-full sm:w-auto text-center py-1.5 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer truncate ${
              statusFilter === 'active'
                ? 'bg-white dark:bg-[#18211D] text-[#075C45] dark:text-[#78D9A6] shadow-xs'
                : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F7F4EA]'
            }`}
          >
            Em andamento ({globalSummary.activePurchasesCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`w-full sm:w-auto text-center py-1.5 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer truncate ${
              statusFilter === 'completed'
                ? 'bg-white dark:bg-[#18211D] text-[#075C45] dark:text-[#78D9A6] shadow-xs'
                : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F7F4EA]'
            }`}
          >
            Quitadas ({globalSummary.completedPurchasesCount})
          </button>
        </div>
      </div>

      {/* ==================================================
          3. CARDS SUPERIORES: TOTAL PARCELADO | PAGO | A PAGAR
          ================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-5">
        {/* Card 1: TOTAL PARCELADO (Comprometimento da Competência) */}
        <Card className="rounded-2xl border-[#E2E8E4] dark:border-[#24312B] bg-white dark:bg-[#18211D] shadow-xs">
          <CardContent className="p-3.5 pt-3.5 pb-3 sm:p-5 sm:pt-5 space-y-1 sm:space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              <span className="truncate">Total Parcelado no Mês</span>
              <Calendar className="w-4 h-4 text-[#075C45] dark:text-[#78D9A6] shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[#202724] dark:text-[#F7F4EA] truncate leading-tight">
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(monthSummary.totalMonth)}
            </div>
            <p className="text-[11px] leading-tight text-[#5E6963] dark:text-[#95A39B] truncate">
              {monthSummary.count} {monthSummary.count === 1 ? 'parcela com vencimento' : 'parcelas com vencimento'} em{' '}
              {MONTH_NAMES[selectedMonth - 1]}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: PAGO (Parcelas pagas na competência) */}
        <Card className="rounded-2xl border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs">
          <CardContent className="p-3.5 pt-3.5 pb-3 sm:p-5 sm:pt-5 space-y-1 sm:space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              <span className="truncate">Pago</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-600 dark:text-emerald-400 truncate leading-tight">
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(monthSummary.totalPaid)}
            </div>
            <p className="text-[11px] leading-tight text-emerald-700/80 dark:text-emerald-400/80 truncate">
              {monthSummary.paidCount} de {monthSummary.count} pagas neste mês
            </p>
          </CardContent>
        </Card>

        {/* Card 3: A PAGAR (Parcelas pendentes/atrasadas na competência) */}
        <Card className="rounded-2xl border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs">
          <CardContent className="p-3.5 pt-3.5 pb-3 sm:p-5 sm:pt-5 space-y-1 sm:space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <span className="truncate">A Pagar</span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-amber-700 dark:text-amber-300 truncate leading-tight">
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(monthSummary.totalPending)}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-tight text-amber-700/80 dark:text-amber-400/80">
              <span className="truncate">Próximas: {formatCurrency(monthSummary.totalUpcoming)}</span>
              {monthSummary.totalOverdue > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold truncate">
                  • {formatCurrency(monthSummary.totalOverdue)} atrasadas
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Global Compacto das Obrigações Totais */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F7F4EA]/70 dark:bg-[#121915] border border-[#E2E8E4] dark:border-[#24312B] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#5E6963] dark:text-[#95A39B] min-w-0">
          <Layers className="w-4 h-4 text-[#075C45] dark:text-[#78D9A6] shrink-0" />
          <span className="truncate sm:whitespace-normal">
            Saldo total de compromissos parcelados:{' '}
            <strong className="text-[#202724] dark:text-[#F7F4EA]">
              {formatCurrency(globalSummary.totalRemainingOverall)}
            </strong>{' '}
            a quitar
          </span>
        </div>
        <div className="text-[#5E6963] dark:text-[#95A39B] sm:text-right shrink-0">
          Histórico geral: {formatCurrency(globalSummary.totalPaidOverall)} pagos de{' '}
          {formatCurrency(globalSummary.totalOverall)} contratados
        </div>
      </div>

      {/* ==================================================
          4. LISTAGEM DAS COMPRAS PARCELADAS
          ================================================== */}
      <div className="space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
            Suas Compras Parceladas
          </h2>
          <span className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            {purchases.length} {purchases.length === 1 ? 'compra registrada' : 'compras registradas'}
          </span>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-2xl sm:rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-2xl sm:rounded-3xl" />
          </div>
        )}

        {/* Estado Vazio com Mascote Oficial do Poupagaio */}
        {!isLoading && purchases.length === 0 && (
          <div className="p-6 sm:p-12 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] text-center flex flex-col items-center justify-center space-y-3.5 sm:space-y-4 shadow-xs">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-[#16A66A]/30 bg-[#F7F4EA] dark:bg-[#101614] p-2 shadow-sm">
              <img
                src={POUPAGAIO_MASCOT_URL}
                alt="Poupagaio"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-xl sm:rounded-2xl"
              />
            </div>
            <div className="max-w-md space-y-1 sm:space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
                Tudo tranquilo por aqui
              </h3>
              <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
                Sem parcelas por enquanto. Quando precisar, o Poupagaio ajuda você a acompanhar cada uma.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setPurchaseToEdit(null);
                setIsPurchaseModalOpen(true);
              }}
              className="w-full sm:w-auto rounded-xl sm:rounded-2xl bg-[#075C45] hover:bg-[#075C45]/90 dark:bg-[#16A66A] dark:hover:bg-[#16A66A]/90 text-white font-bold gap-2 px-5 py-2.5 cursor-pointer mt-1 sm:mt-2 justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar primeira compra</span>
            </Button>
          </div>
        )}

        {/* Cards das Compras */}
        {!isLoading && purchases.length > 0 && (
          <div className="space-y-3.5 sm:space-y-4">
            {purchases.map((purchase) => (
              <InstallmentCard
                key={purchase.id}
                purchase={purchase}
                onEdit={(item) => {
                  setPurchaseToEdit(item);
                  setIsPurchaseModalOpen(true);
                }}
                onDelete={(item) => setPurchaseToDelete(item)}
                onMarkPaid={handleMarkInstallmentPaid}
                onUnmarkPaid={handleUnmarkInstallmentPaid}
              />
            ))}
          </div>
        )}
      </div>

      {/* ==================================================
          5. MODAL DE CADASTRO / EDIÇÃO DE COMPRA PARCELADA
          ================================================== */}
      {isPurchaseModalOpen && currentSpace?.id && (
        <InstallmentPurchaseModal
          isOpen={isPurchaseModalOpen}
          onClose={() => {
            setIsPurchaseModalOpen(false);
            setPurchaseToEdit(null);
          }}
          spaceId={currentSpace.id}
          purchaseToEdit={purchaseToEdit}
          onSave={handleSavePurchase}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      )}

      {/* ==================================================
          6. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
          ================================================== */}
      {purchaseToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
                Excluir Compra Parcelada?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
              Excluir esta compra também removerá suas parcelas e o histórico de pagamentos relacionado.
              Deseja continuar?
            </p>
            <div className="p-3 rounded-xl bg-[#F7F4EA] dark:bg-[#101614] border border-[#E8E4D5] dark:border-[#24312B] text-xs">
              <strong>{purchaseToDelete.description}</strong> — {purchaseToDelete.installment_count} parcelas
              de {formatCurrency(purchaseToDelete.total_amount / purchaseToDelete.installment_count)} (Total:{' '}
              {formatCurrency(purchaseToDelete.total_amount)})
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPurchaseToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, excluir compra'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIRMAÇÃO DE ORIGEM DO PAGAMENTO DA PARCELA */}
      {payingInstallment && currentSpace && user && (
        <PaymentOriginConfirmModal
          isOpen={Boolean(payingInstallment)}
          onClose={() => setPayingInstallment(null)}
          spaceId={currentSpace.id}
          userId={user.id}
          item={{
            id: payingInstallment.installmentId,
            sourceType: 'installment',
            sourceId: payingInstallment.installmentId,
            title: `${payingInstallment.purchase.description} (${payingInstallment.number}/${payingInstallment.purchase.installment_count})`,
            amount: payingInstallment.amount,
            dueDate: payingInstallment.dueDate,
            category: payingInstallment.purchase.category,
          }}
          onSuccess={async () => {
            setPayingInstallment(null);
            await loadInstallmentsData();
          }}
        />
      )}
    </div>
  );
}
