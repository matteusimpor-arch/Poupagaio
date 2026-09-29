import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { reservesService } from '../../lib/services/reserves';
import { variableExpensesService } from '../../lib/services/variableExpenses';
import { fixedExpensesService } from '../../lib/services/fixedExpenses';
import { entriesService } from '../../lib/services/entries';
import { installmentsService } from '../../lib/services/installments';
import { lastTransactionService, LastTransactionData, QuickEntryType } from '../../lib/services/lastTransaction';
import { Reserve, ReservesSummary } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import {
  X,
  Check,
  Calendar,
  Wallet,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Layers,
  ArrowUpRight,
  TrendingDown,
  FileText,
  AlertCircle,
  Plus,
  PiggyBank,
} from 'lucide-react';

interface QuickEntryWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialType?: QuickEntryType;
  initialData?: Partial<LastTransactionData> | null;
  selectedYear?: number;
  selectedMonth?: number;
}

const QUICK_SUGGESTIONS: Record<QuickEntryType, string[]> = {
  variable_expense: ['Almoço', 'Supermercado', 'Gasolina', 'Farmácia', 'Uber / Transporte', 'Lanche', 'Padaria'],
  fixed_expense: ['Aluguel', 'Condomínio', 'Energia Elétrica', 'Água', 'Internet', 'Streaming', 'Academia'],
  entry: ['Salário', 'Freelance', 'Rendimento', 'Venda', 'Reembolso', 'PIX Recebido'],
  installment: ['Celular', 'Notebook', 'Passagem Aérea', 'Eletrodoméstico', 'Roupas', 'Móveis'],
};

const CATEGORY_SUGGESTIONS: Record<QuickEntryType, string[]> = {
  variable_expense: ['Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Supermercado', 'Outros'],
  fixed_expense: ['Moradia', 'Utilidades', 'Serviços', 'Educação', 'Assinaturas', 'Outros'],
  entry: ['Salário', 'Rendimentos', 'Extra / Freela', 'Outros'],
  installment: ['Eletrônicos', 'Viagem', 'Casa & Móveis', 'Vestuário', 'Outros'],
};

export function QuickEntryWizardModal({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'variable_expense',
  initialData,
  selectedYear,
  selectedMonth,
}: QuickEntryWizardModalProps) {
  const { user, currentSpace } = useAuth();

  const now = new Date();
  const activeYear = selectedYear || now.getFullYear();
  const activeMonth = selectedMonth || (now.getMonth() + 1);

  const [type, setType] = useState<QuickEntryType>(initialType);
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [dateOption, setDateOption] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState(() => now.toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState<boolean>(true);
  
  // Payment Origin States
  const [originType, setOriginType] = useState<'free_balance' | 'reserve' | 'split'>('free_balance');
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null);
  const [reserveAmountInput, setReserveAmountInput] = useState<string>('');
  
  // More Options Collapsible
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [category, setCategory] = useState('Alimentação');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [notes, setNotes] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [billingCycle, setBillingCycle] = useState<string>(
    `${activeYear}-${String(activeMonth).padStart(2, '0')}`
  );

  // Reserves Data
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [reservesSummary, setReservesSummary] = useState<ReservesSummary | null>(null);
  const [isLoadingReserves, setIsLoadingReserves] = useState(false);

  // Submitting and Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper date strings
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const getActiveDate = () => {
    if (dateOption === 'today') return todayStr;
    if (dateOption === 'yesterday') return yesterdayStr;
    return customDate || todayStr;
  };

  // Load reserves for space
  useEffect(() => {
    if (!isOpen || !currentSpace?.id) return;
    const loadReserves = async () => {
      setIsLoadingReserves(true);
      try {
        const res = await reservesService.getReservesWithSummary(
          currentSpace.id,
          activeYear,
          activeMonth
        );
        setReserves(res.reserves || []);
        setReservesSummary(res.summary);
      } catch (err) {
        console.warn('Erro ao carregar reservas:', err);
      } finally {
        setIsLoadingReserves(false);
      }
    };
    loadReserves();
  }, [isOpen, currentSpace?.id, activeYear, activeMonth]);

  // Handle initialization and Pre-fill for "Repetir Último Lançamento"
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setType(initialData.type || initialType);
      setDescription(initialData.description || '');
      setAmountInput(initialData.amount ? String(initialData.amount) : '');
      setCategory(initialData.category || (CATEGORY_SUGGESTIONS[initialData.type || initialType][0] || 'Geral'));
      setPaymentMethod(initialData.paymentMethod || 'PIX');
      setNotes(initialData.notes || '');
      setIsPaid(true);

      if (initialData.reserveId) {
        setOriginType('reserve');
        setSelectedReserveId(initialData.reserveId);
      } else {
        setOriginType('free_balance');
        setSelectedReserveId(null);
      }
    } else {
      setType(initialType);
      setDescription('');
      setAmountInput('');
      setDateOption('today');
      setCustomDate(todayStr);
      setIsPaid(true);
      setOriginType('free_balance');
      setSelectedReserveId(null);
      setReserveAmountInput('');
      setCategory(CATEGORY_SUGGESTIONS[initialType][0] || 'Geral');
      setPaymentMethod('PIX');
      setNotes('');
      setInstallmentsCount(3);
      setShowMoreOptions(false);
    }
    setErrorMessage(null);
  }, [isOpen, initialType, initialData]);

  // Change default category when type changes
  const handleTypeChange = (newType: QuickEntryType) => {
    setType(newType);
    setCategory(CATEGORY_SUGGESTIONS[newType][0] || 'Geral');
    setErrorMessage(null);
  };

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amountInput.replace(',', '.')) || 0;
  const selectedReserve = reserves.find((r) => r.id === selectedReserveId);

  // Quick Amount additions
  const addQuickAmount = (val: number) => {
    const next = parsedAmount + val;
    setAmountInput(next % 1 === 0 ? String(next) : next.toFixed(2).replace('.', ','));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user?.id || !currentSpace?.id) {
      setErrorMessage('Usuário ou Espaço não identificado.');
      return;
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setErrorMessage('Informe a descrição do lançamento.');
      return;
    }

    if (parsedAmount <= 0 || isNaN(parsedAmount)) {
      setErrorMessage('Informe um valor maior que zero.');
      return;
    }

    const date = getActiveDate();
    const [dYear, dMonth] = date.split('-').map(Number);
    const resolvedCycle = `${dYear}-${String(dMonth).padStart(2, '0')}`;

    setIsSubmitting(true);

    try {
      if (type === 'entry') {
        const entryRes = await entriesService.createEntry(user.id, {
          space_id: currentSpace.id,
          description: trimmedDesc,
          amount: parsedAmount,
          date: date,
          status: isPaid ? 'received' : 'pending',
          category: category || 'Outros',
          notes: notes.trim() || undefined,
        });

        if (entryRes.error) {
          throw new Error(entryRes.error);
        }
      } else if (type === 'variable_expense') {
        const expRes = await variableExpensesService.createVariableExpense(user.id, {
          space_id: currentSpace.id,
          description: trimmedDesc,
          amount: parsedAmount,
          date: date,
          status: isPaid ? 'paid' : 'pending',
          category: category || 'Outros',
          notes: notes.trim() || undefined,
        });

        if (expRes.error || !expRes.expense?.id) {
          throw new Error(expRes.error || 'Erro ao criar despesa variável');
        }

        // If marked as paid, invoke origin registration
        if (isPaid) {
          const originRes = await reservesService.payExpenseWithOrigin(user.id, {
            space_id: currentSpace.id,
            expense_type: 'variable',
            expense_id: expRes.expense.id,
            amount: parsedAmount,
            payment_date: date,
            origin_type: originType,
            primary_reserve_id: originType !== 'free_balance' ? selectedReserveId : null,
            reserve_amount: originType === 'split' ? parseFloat(reserveAmountInput.replace(',', '.')) || 0 : undefined,
          });

          if (!originRes.success && originRes.error) {
            console.warn('Aviso de origem de pagamento:', originRes.error);
          }
        }
      } else if (type === 'fixed_expense') {
        const [yStr, mStr, dStr] = date.split('-');
        const fixRes = await fixedExpensesService.createFixedExpense(user.id, {
          space_id: currentSpace.id,
          description: trimmedDesc,
          amount: parsedAmount,
          due_day: parseInt(dStr, 10) || 1,
          category: category || 'Moradia',
          notes: notes.trim() || undefined,
        });

        if (fixRes.error || !fixRes.expense?.id) {
          throw new Error(fixRes.error || 'Erro ao criar despesa fixa');
        }

        if (isPaid) {
          await fixedExpensesService.markAsPaid(
            fixRes.expense.id,
            currentSpace.id,
            parseInt(yStr, 10),
            parseInt(mStr, 10),
            parsedAmount,
            user.id
          );

          await reservesService.payExpenseWithOrigin(user.id, {
            space_id: currentSpace.id,
            expense_type: 'fixed',
            expense_id: fixRes.expense.id,
            amount: parsedAmount,
            payment_date: date,
            origin_type: originType,
            primary_reserve_id: originType !== 'free_balance' ? selectedReserveId : null,
            reserve_amount: originType === 'split' ? parseFloat(reserveAmountInput.replace(',', '.')) || 0 : undefined,
          });
        }
      } else if (type === 'installment') {
        const instRes = await installmentsService.createPurchase({
          space_id: currentSpace.id,
          description: trimmedDesc,
          total_amount: parsedAmount,
          installment_count: Math.max(2, installmentsCount),
          category: category || 'Outros',
          first_due_date: date,
          notes: notes.trim() || undefined,
        });

        if (instRes.error) {
          throw new Error(instRes.error);
        }
      }

      // Save for "Repetir Último Lançamento"
      lastTransactionService.saveLastTransaction(currentSpace.id, {
        type,
        description: trimmedDesc,
        amount: parsedAmount,
        category,
        paymentMethod,
        reserveId: originType === 'reserve' ? selectedReserveId : null,
        reserveName: selectedReserve?.name,
        isFreeBalance: originType === 'free_balance',
        notes: notes.trim() || undefined,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao salvar lançamento rápido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-[#181C1A] border-t sm:border border-[#D2DDD6] dark:border-[#28322C] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2ECE6] dark:border-[#28322C] shrink-0 bg-[#F4F8F5] dark:bg-[#151917]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#02402E] dark:bg-[#78D9A6] text-white dark:text-[#101614] flex items-center justify-center font-bold text-xs shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black font-display text-[#02402E] dark:text-[#78D9A6] leading-none">
                Lançamento Rápido
              </h3>
              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] mt-0.5 font-medium">
                Poupagaio Assistente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#5E6963] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TYPE SELECTOR TABS */}
        <div className="px-5 pt-3 pb-1 shrink-0">
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#E8F0EB] dark:bg-[#202723] rounded-2xl">
            {[
              { id: 'variable_expense' as QuickEntryType, label: 'Variável', icon: TrendingDown, color: 'text-rose-600' },
              { id: 'fixed_expense' as QuickEntryType, label: 'Fixo', icon: FileText, color: 'text-purple-600' },
              { id: 'entry' as QuickEntryType, label: 'Entrada', icon: ArrowUpRight, color: 'text-[#16A66A]' },
              { id: 'installment' as QuickEntryType, label: 'Parcelado', icon: CreditCard, color: 'text-amber-600' },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    isActive
                      ? 'bg-white dark:bg-[#181C1A] text-[#02402E] dark:text-[#78D9A6] shadow-2xs'
                      : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#02402E]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? t.color : ''}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SCROLLABLE STEP BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* ERROR NOTICE */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ETAPA 1: DESCRIÇÃO */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display flex items-center justify-between">
              <span>Etapa 1: {type === 'entry' ? 'O que você recebeu?' : 'O que você pagou?'}</span>
              <span className="text-[10px] text-[#16A66A] font-semibold lowercase">obrigatório</span>
            </label>
            <input
              type="text"
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'entry' ? 'Ex: Salário, Freela...' : 'Ex: Almoço, Gasolina, Aluguel...'}
              className="w-full px-4 py-3 rounded-2xl border border-[#D2DDD6] dark:border-[#28322C] bg-[#F9FBF9] dark:bg-[#1E2420] text-sm font-semibold text-[#02402E] dark:text-[#F4F4F5] focus:ring-2 focus:ring-[#16A66A] focus:outline-none transition-all"
            />
            {/* Quick description chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {QUICK_SUGGESTIONS[type]?.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setDescription(sug)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer ${
                    description === sug
                      ? 'bg-[#16A66A] text-white border-[#16A66A]'
                      : 'bg-white dark:bg-[#202723] text-[#5E6963] dark:text-[#95A39B] border-[#D2DDD6] dark:border-[#28322C] hover:border-[#16A66A]'
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* ETAPA 2: VALOR */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display flex items-center justify-between">
              <span>Etapa 2: Quanto?</span>
              <span className="text-[10px] text-[#16A66A] font-semibold lowercase">R$</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[#5E6963] dark:text-[#95A39B]">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[#D2DDD6] dark:border-[#28322C] bg-[#F9FBF9] dark:bg-[#1E2420] text-lg font-extrabold text-[#02402E] dark:text-[#78D9A6] focus:ring-2 focus:ring-[#16A66A] focus:outline-none transition-all"
              />
            </div>

            {/* Fast Add Increments */}
            <div className="flex items-center gap-1.5 pt-1">
              {[10, 20, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => addQuickAmount(v)}
                  className="flex-1 py-1 rounded-lg bg-[#E8F2EC] dark:bg-[#202A24] hover:bg-[#16A66A]/20 text-[11px] font-bold text-[#16A66A] dark:text-[#78D9A6] transition-colors cursor-pointer"
                >
                  +{v}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmountInput('')}
                className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] font-bold text-[#5E6963] dark:text-[#95A39B] hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* ETAPA 3: DATA */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display">
              Etapa 3: Quando?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDateOption('today')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                  dateOption === 'today'
                    ? 'border-[#16A66A] bg-[#E6F6EF] dark:bg-[#16A66A]/20 text-[#02402E] dark:text-[#78D9A6] shadow-2xs'
                    : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1E2420] text-[#5E6963] dark:text-[#95A39B]'
                }`}
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() => setDateOption('yesterday')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                  dateOption === 'yesterday'
                    ? 'border-[#16A66A] bg-[#E6F6EF] dark:bg-[#16A66A]/20 text-[#02402E] dark:text-[#78D9A6] shadow-2xs'
                    : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1E2420] text-[#5E6963] dark:text-[#95A39B]'
                }`}
              >
                Ontem
              </button>

              <button
                type="button"
                onClick={() => setDateOption('custom')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  dateOption === 'custom'
                    ? 'border-[#16A66A] bg-[#E6F6EF] dark:bg-[#16A66A]/20 text-[#02402E] dark:text-[#78D9A6] shadow-2xs'
                    : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1E2420] text-[#5E6963] dark:text-[#95A39B]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Outro dia</span>
              </button>
            </div>

            {dateOption === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full mt-2 px-4 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1E2420] text-xs font-semibold text-[#02402E] dark:text-[#F4F4F5] focus:ring-2 focus:ring-[#16A66A] focus:outline-none"
              />
            )}
          </div>

          {/* ETAPA 4: SITUAÇÃO (Já paguei / Pagar depois) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display">
              Etapa 4: Situação
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  isPaid
                    ? 'border-[#16A66A] bg-[#E6F6EF] dark:bg-[#16A66A]/20 text-[#16A66A] dark:text-[#78D9A6] shadow-2xs'
                    : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1E2420] text-[#5E6963] dark:text-[#95A39B]'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{type === 'entry' ? 'Já recebi' : 'Já paguei'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  !isPaid
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 shadow-2xs'
                    : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1E2420] text-[#5E6963] dark:text-[#95A39B]'
                }`}
              >
                <span>{type === 'entry' ? 'A receber' : 'Pagar depois'}</span>
              </button>
            </div>
          </div>

          {/* ETAPA 5: ORIGEM DO PAGAMENTO (Se já pago e não for entrada) */}
          {isPaid && type !== 'entry' && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-[#F4F8F5] dark:bg-[#1C211E] border border-[#D2DDD6] dark:border-[#28322C]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#02402E] dark:text-[#78D9A6] font-display flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#16A66A]" />
                Etapa 5: De onde saiu o dinheiro?
              </label>

              <div className="space-y-2 pt-1">
                {/* Saldo Livre */}
                <button
                  type="button"
                  onClick={() => {
                    setOriginType('free_balance');
                    setSelectedReserveId(null);
                  }}
                  className={`w-full p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                    originType === 'free_balance'
                      ? 'border-[#16A66A] bg-[#E6F6EF] dark:bg-[#16A66A]/20 shadow-2xs'
                      : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#202723] hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#16A66A]/15 text-[#16A66A] flex items-center justify-center font-bold">
                      <Wallet className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#02402E] dark:text-[#F4F4F5] block">
                        Saldo Livre
                      </span>
                      {reservesSummary && (
                        <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                          Disponível: {formatCurrency(reservesSummary.freeBalance)}
                        </span>
                      )}
                    </div>
                  </div>
                  {originType === 'free_balance' && <Check className="w-4 h-4 text-[#16A66A]" />}
                </button>

                {/* Lista de Reservas Disponíveis */}
                {reserves.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] block px-1">
                      Minhas Reservas / Caixinhas
                    </span>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto no-scrollbar pr-0.5">
                      {reserves.map((res) => {
                        const isSelected = originType === 'reserve' && selectedReserveId === res.id;
                        return (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => {
                              setOriginType('reserve');
                              setSelectedReserveId(res.id);
                            }}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'border-[#16A66A] bg-[#E6F6EF] dark:bg-[#16A66A]/20 shadow-2xs'
                                : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#202723] hover:bg-white/80'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm shrink-0">{res.icon || '🏷️'}</span>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-[#02402E] dark:text-[#F4F4F5] block truncate">
                                  {res.name}
                                </span>
                                <span className="text-[10px] text-[#16A66A] font-semibold">
                                  Saldo: {formatCurrency(res.current_balance)}
                                </span>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#16A66A] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO: MAIS OPÇÕES */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="w-full flex items-center justify-between py-2 text-xs font-bold text-[#5E6963] dark:text-[#95A39B] hover:text-[#02402E] dark:hover:text-[#78D9A6] cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#16A66A]" />
                <span>Mais opções (Categoria, Forma, Notas{type === 'installment' ? ', Parcelas' : ''})</span>
              </div>
              {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showMoreOptions && (
              <div className="p-4 rounded-2xl bg-[#F9FBF9] dark:bg-[#1C211E] border border-[#D2DDD6] dark:border-[#28322C] space-y-3 mt-2 animate-in fade-in duration-150">
                {/* Categoria */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#5E6963] dark:text-[#95A39B] uppercase">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#202723] text-xs font-semibold text-[#02402E] dark:text-[#F4F4F5] focus:ring-2 focus:ring-[#16A66A]"
                  >
                    {CATEGORY_SUGGESTIONS[type]?.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {/* Parcelamento: Quantidade de Parcelas */}
                {type === 'installment' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5E6963] dark:text-[#95A39B] uppercase">
                      Número de Parcelas
                    </label>
                    <div className="flex items-center gap-2">
                      {[2, 3, 6, 10, 12].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setInstallmentsCount(num)}
                          className={`flex-1 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            installmentsCount === num
                              ? 'bg-[#16A66A] text-white border-[#16A66A]'
                              : 'bg-white dark:bg-[#202723] text-[#5E6963] dark:text-[#95A39B] border-[#D2DDD6] dark:border-[#28322C]'
                          }`}
                        >
                          {num}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forma de Pagamento */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#5E6963] dark:text-[#95A39B] uppercase">
                    Forma de Pagamento
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['PIX', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro', 'Boleto'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          paymentMethod === m
                            ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] border-[#02402E]'
                            : 'bg-white dark:bg-[#202723] text-[#5E6963] dark:text-[#95A39B] border-[#D2DDD6] dark:border-[#28322C]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#5E6963] dark:text-[#95A39B] uppercase">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Algum detalhe extra?"
                    className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#202723] text-xs font-medium text-[#02402E] dark:text-[#F4F4F5] focus:ring-2 focus:ring-[#16A66A]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CONFIRMATION SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-[#02402E] hover:bg-[#16A66A] dark:bg-[#78D9A6] dark:text-[#101614] text-white text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
            >
              {isSubmitting ? (
                <span>Salvando lançamento...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar Lançamento ({parsedAmount > 0 ? formatCurrency(parsedAmount) : 'R$ 0,00'})</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
