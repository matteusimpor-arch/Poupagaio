import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { entriesService } from '../../lib/services/entries';
import { variableExpensesService } from '../../lib/services/variableExpenses';
import { fixedExpensesService } from '../../lib/services/fixedExpenses';
import { installmentsService } from '../../lib/services/installments';
import { reservesService } from '../../lib/services/reserves';
import { formatCurrency } from '../../lib/formatters';
import { Reserve, EntryStatus } from '../../types';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Plus,
  PiggyBank,
  ArrowUpRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export type QuickLaunchType = 'variable_expenses' | 'entries' | 'fixed_expenses' | 'installments';

export interface PoupagaioQuickLaunchData {
  type: QuickLaunchType;
  description: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'received';
  sourceReserveId: string | null; // null = Free balance
  sourceReserveName?: string;
  category: string;
  notes: string;
  dueDay?: number;
  installmentCount?: number;
  cardOrAccount?: string;
}

interface PoupagaioQuickLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: PoupagaioQuickLaunchData | null;
  defaultType?: QuickLaunchType;
}

const CATEGORIES_EXPENSES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Educação',
  'Compras',
  'Assinaturas',
  'Outros',
];

const CATEGORIES_ENTRIES = [
  'Salário',
  'Rendimento',
  'Freelance',
  'Vendas',
  'Presente',
  'Outros',
];

export function PoupagaioQuickLaunchModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  defaultType = 'variable_expenses',
}: PoupagaioQuickLaunchModalProps) {
  const { user, currentSpace } = useAuth();

  // Wizard Step: 1 = Description, 2 = Amount, 3 = Date, 4 = Status, 5 = Payment Origin (if paid), 6 = Summary / Confirmation
  const [step, setStep] = useState<number>(1);

  // Form states
  const [type, setType] = useState<QuickLaunchType>(defaultType);
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'custom'>('today');
  
  // Status: 'paid' (or 'received' for entries) vs 'pending'
  const [isPaid, setIsPaid] = useState<boolean>(true);

  // Payment Origin (for paid expenses)
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null); // null = Free balance
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [freeBalance, setFreeBalance] = useState<number>(0);

  // Accordion "Mais opções"
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDay, setDueDay] = useState<number>(new Date().getDate());
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [cardOrAccount, setCardOrAccount] = useState('');

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or handle initialData
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsSubmitting(false);

      if (initialData) {
        setType(initialData.type);
        setDescription(initialData.description || '');
        setAmountInput(initialData.amount ? String(initialData.amount) : '');
        
        const todayStr = new Date().toISOString().split('T')[0];
        setDate(todayStr);
        setDatePreset('today');

        setIsPaid(initialData.status === 'paid' || initialData.status === 'received');
        setSelectedReserveId(initialData.sourceReserveId || null);
        setCategory(initialData.category || '');
        setNotes(initialData.notes || '');
        if (initialData.dueDay) setDueDay(initialData.dueDay);
        if (initialData.installmentCount) setInstallmentCount(initialData.installmentCount);
        if (initialData.cardOrAccount) setCardOrAccount(initialData.cardOrAccount);

        setStep(1);
      } else {
        setType(defaultType);
        setDescription('');
        setAmountInput('');
        const todayStr = new Date().toISOString().split('T')[0];
        setDate(todayStr);
        setDatePreset('today');
        setIsPaid(true);
        setSelectedReserveId(null);
        setCategory('');
        setNotes('');
        setDueDay(new Date().getDate());
        setInstallmentCount(2);
        setCardOrAccount('');
        setStep(1);
      }
    }
  }, [isOpen, initialData, defaultType]);

  // Load reserves for active space
  useEffect(() => {
    if (isOpen && currentSpace?.id) {
      async function loadReservesData() {
        try {
          const now = new Date();
          const res = await reservesService.getReservesWithSummary(
            currentSpace.id,
            now.getFullYear(),
            now.getMonth() + 1
          );
          setReserves(res.reserves.filter((r) => !r.is_archived));
          setFreeBalance(res.summary.freeBalance || 0);
        } catch (e) {
          console.warn('Erro ao carregar reservas para origem:', e);
        }
      }
      loadReservesData();
    }
  }, [isOpen, currentSpace?.id]);

  if (!isOpen) return null;

  // Handle Date presets
  const handleSelectDatePreset = (preset: 'today' | 'yesterday' | 'custom', customVal?: string) => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === 'today') {
      setDate(today.toISOString().split('T')[0]);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      setDate(yest.toISOString().split('T')[0]);
    } else if (customVal) {
      setDate(customVal);
    }
  };

  const parseAmountNumber = (val: string): number => {
    const cleaned = val.replace(/[^\d.,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const handleNextStep = () => {
    setErrorMsg(null);

    if (step === 1) {
      if (!description.trim()) {
        setErrorMsg('Por favor, informe a descrição do lançamento.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const amt = parseAmountNumber(amountInput);
      if (amt <= 0) {
        setErrorMsg('Por favor, informe um valor maior que R$ 0,00.');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!date) {
        setErrorMsg('Por favor, selecione a data do lançamento.');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      if (isPaid && type !== 'entries') {
        setStep(5);
      } else {
        setStep(6);
      }
      return;
    }

    if (step === 5) {
      setStep(6);
      return;
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    if (step === 6 && (!isPaid || type === 'entries')) {
      setStep(4);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  // Final Submit Handler
  const handleConfirmLaunch = async () => {
    if (!user || !currentSpace?.id) {
      setErrorMsg('Espaço financeiro ou usuário indisponível.');
      return;
    }

    const numAmount = parseAmountNumber(amountInput);
    if (numAmount <= 0) {
      setErrorMsg('Informe um valor válido.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Informe a descrição.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const selectedCat = category.trim() || 'Outros';
      const entryStatus: EntryStatus = isPaid ? 'received' : 'pending';

      let createdExpenseId: string | null = null;
      let success = false;

      if (type === 'entries') {
        const res = await entriesService.createEntry(user.id, {
          space_id: currentSpace.id,
          description: description.trim(),
          amount: numAmount,
          date,
          category: selectedCat,
          status: entryStatus,
          notes: notes.trim() || undefined,
        });
        if (res.error) throw new Error(res.error);
        success = true;
      } else if (type === 'variable_expenses') {
        const res = await variableExpensesService.createVariableExpense(user.id, {
          space_id: currentSpace.id,
          description: description.trim(),
          amount: numAmount,
          date,
          category: selectedCat,
          status: isPaid ? 'paid' : 'pending',
          notes: notes.trim() || undefined,
        });
        if (res.error) throw new Error(res.error);
        if (res.expense?.id) createdExpenseId = res.expense.id;
        success = true;
      } else if (type === 'fixed_expenses') {
        const res = await fixedExpensesService.createFixedExpense(user.id, {
          space_id: currentSpace.id,
          description: description.trim(),
          amount: numAmount,
          due_day: dueDay || new Date().getDate(),
          category: selectedCat,
          notes: notes.trim() || undefined,
        });
        if (res.error) throw new Error(res.error);
        if (res.expense?.id) createdExpenseId = res.expense.id;
        success = true;
      } else if (type === 'installments') {
        const res = await installmentsService.createPurchase({
          space_id: currentSpace.id,
          description: description.trim(),
          total_amount: numAmount,
          installment_count: installmentCount || 2,
          first_due_date: date,
          category: selectedCat,
          notes: notes.trim() || undefined,
        });
        if (res.error) throw new Error(res.error);
        success = true;
      }

      // If paid expense and has reserve or free balance origin, call reserves Service
      if (success && isPaid && type !== 'entries' && createdExpenseId) {
        const expTypeMapped = type === 'variable_expenses' ? 'variable' : type === 'fixed_expenses' ? 'fixed' : 'installment';

        await reservesService.payExpenseWithOrigin(user.id, {
          space_id: currentSpace.id,
          expense_type: expTypeMapped,
          expense_id: createdExpenseId,
          amount: numAmount,
          payment_date: date,
          origin_type: selectedReserveId ? 'reserve' : 'free_balance',
          primary_reserve_id: selectedReserveId,
          notes: notes.trim() || undefined,
        });
      }

      // Save into localStorage for "Repetir último lançamento"
      const selectedReserve = reserves.find((r) => r.id === selectedReserveId);
      const lastTx: PoupagaioQuickLaunchData = {
        type,
        description: description.trim(),
        amount: numAmount,
        date,
        status: isPaid ? (type === 'entries' ? 'received' : 'paid') : 'pending',
        sourceReserveId: selectedReserveId,
        sourceReserveName: selectedReserve ? selectedReserve.name : 'Saldo Livre',
        category: selectedCat,
        notes: notes.trim(),
        dueDay,
        installmentCount,
        cardOrAccount,
      };

      localStorage.setItem('poupagaio-last-transaction', JSON.stringify(lastTx));

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar lançamento rápido:', err);
      setErrorMsg(err.message || 'Não foi possível concluir o lançamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedReserveObj = reserves.find((r) => r.id === selectedReserveId);

  const getTypeName = () => {
    switch (type) {
      case 'entries':
        return 'Entrada / Receita';
      case 'variable_expenses':
        return 'Gasto Variável';
      case 'fixed_expenses':
        return 'Gasto Fixo';
      case 'installments':
        return 'Parcelamento';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="
          w-full max-w-lg bg-white dark:bg-[#1C211E]
          rounded-t-3xl sm:rounded-3xl
          border-t sm:border border-[#D2DDD6] dark:border-[#28322C]
          shadow-2xl overflow-hidden flex flex-col
          max-h-[92vh] sm:max-h-[85vh]
          animate-in slide-in-from-bottom duration-250
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2ECE6] dark:border-[#28322C] bg-[#F4F8F5] dark:bg-[#181C1A] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="p-1 rounded-lg text-[#5E6963] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                title="Voltar etapa"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#F2B807]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#02402E] dark:text-[#78D9A6] truncate font-display">
                Lançamento Rápido • Poupagaio
              </h3>
              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] truncate font-medium">
                {getTypeName()} • Etapa {step} de {isPaid && type !== 'entries' ? 6 : 5}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PROGRESS INDICATOR BAR */}
        <div className="w-full bg-[#E2ECE6] dark:bg-[#28322C] h-1">
          <div
            className="bg-[#16A66A] h-full transition-all duration-300"
            style={{
              width: `${(step / (isPaid && type !== 'entries' ? 6 : 5)) * 100}%`,
            }}
          />
        </div>

        {/* TYPE SELECTION SWITCHER */}
        <div className="p-3 bg-[#F9FBF9] dark:bg-[#151917] border-b border-[#E2ECE6] dark:border-[#28322C] overflow-x-auto no-scrollbar shrink-0">
          <div className="flex gap-1.5 min-w-max">
            {[
              { id: 'variable_expenses', label: 'Gasto Variável', icon: Plus },
              { id: 'entries', label: 'Entrada', icon: ArrowUpRight },
              { id: 'fixed_expenses', label: 'Gasto Fixo', icon: Calendar },
              { id: 'installments', label: 'Parcelamento', icon: CreditCard },
            ].map((t) => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setType(t.id as QuickLaunchType);
                    if (t.id === 'entries') setIsPaid(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] shadow-2xs'
                      : 'bg-white dark:bg-[#1C211E] text-[#5E6963] dark:text-[#95A39B] border border-[#D2DDD6] dark:border-[#28322C]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* MODAL BODY STEP CONTENT */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs font-semibold animate-in fade-in duration-150">
              {errorMsg}
            </div>
          )}

          {/* ==================================================
              ETAPA 1: O que você pagou? / O que você recebeu?
              ================================================== */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="block text-sm font-extrabold text-[#02402E] dark:text-[#78D9A6] font-display">
                  {type === 'entries' ? 'O que você recebeu?' : 'O que você pagou?'}
                </label>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  Informe uma descrição simples (ex: Gasolina, Supermercado, Salário).
                </p>
              </div>

              <input
                type="text"
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && description.trim()) {
                    e.preventDefault();
                    handleNextStep();
                  }
                }}
                placeholder={type === 'entries' ? 'Ex: Salário, Freelance' : 'Ex: Gasolina Shell, Padaria'}
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] text-[#202724] dark:text-[#F4F4F5] font-semibold text-base focus:border-[#16A66A] focus:outline-none transition-all shadow-2xs"
              />

              {/* Quick suggestions */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                  Sugestões frequentes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(type === 'entries'
                    ? ['Salário', 'Freelance', 'Venda OLX', 'Rendimento', 'Presente']
                    : ['Gasolina', 'Mercado', 'Farmácia', 'Restaurante', 'Luz', 'Internet', 'Uber']
                  ).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setDescription(sug)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                        description === sug
                          ? 'bg-[#E6F6EF] border-[#16A66A] text-[#02402E] font-bold'
                          : 'bg-[#F4F8F5] dark:bg-[#222825] border-[#E2ECE6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B] hover:border-[#16A66A]'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================
              ETAPA 2: Quanto?
              ================================================== */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="block text-sm font-extrabold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Quanto?
                </label>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  Valor total em reais para "{description}".
                </p>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-[#16A66A]">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  autoFocus
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && parseAmountNumber(amountInput) > 0) {
                      e.preventDefault();
                      handleNextStep();
                    }
                  }}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] text-[#02402E] dark:text-[#78D9A6] font-black text-2xl focus:border-[#16A66A] focus:outline-none transition-all shadow-2xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                {[50, 100, 150, 200, 300].map((quickAmt) => (
                  <button
                    key={quickAmt}
                    type="button"
                    onClick={() => setAmountInput(String(quickAmt))}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border border-[#E2ECE6] dark:border-[#28322C] bg-[#F4F8F5] dark:bg-[#222825] text-[#02402E] dark:text-[#78D9A6] hover:bg-[#E6F6EF] cursor-pointer transition-colors"
                  >
                    R$ {quickAmt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================
              ETAPA 3: Quando?
              ================================================== */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="block text-sm font-extrabold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Quando?
                </label>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  Selecione a data da movimentação.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectDatePreset('today')}
                  className={`p-3.5 rounded-2xl border text-center cursor-pointer transition-all ${
                    datePreset === 'today'
                      ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] border-[#02402E] font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  <span className="block text-xs font-black">Hoje</span>
                  <span className="text-[10px] opacity-80">
                    {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDatePreset('yesterday')}
                  className={`p-3.5 rounded-2xl border text-center cursor-pointer transition-all ${
                    datePreset === 'yesterday'
                      ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] border-[#02402E] font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  <span className="block text-xs font-black">Ontem</span>
                  <span className="text-[10px] opacity-80">
                    {(() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    })()}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDatePreset('custom')}
                  className={`p-3.5 rounded-2xl border text-center cursor-pointer transition-all ${
                    datePreset === 'custom'
                      ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] border-[#02402E] font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  <span className="block text-xs font-black">Outra data</span>
                  <span className="text-[10px] opacity-80">Escolher</span>
                </button>
              </div>

              {datePreset === 'custom' && (
                <div className="pt-2 animate-in fade-in duration-150">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => handleSelectDatePreset('custom', e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] text-[#202724] dark:text-[#F4F4F5] font-semibold text-sm focus:border-[#16A66A] focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* ==================================================
              ETAPA 4: Situação
              ================================================== */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="block text-sm font-extrabold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Situação
                </label>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  {type === 'entries'
                    ? 'Qual é o status deste recebimento?'
                    : 'Esta despesa já foi paga ou vai pagar depois?'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaid(true)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all space-y-1.5 ${
                    isPaid
                      ? 'bg-[#E6F6EF] dark:bg-[#16A66A]/20 border-[#16A66A] text-[#02402E] dark:text-[#78D9A6] shadow-2xs font-bold'
                      : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black font-display">
                      {type === 'entries' ? 'Já recebi' : 'Já paguei'}
                    </span>
                    <CheckCircle2 className={`w-4 h-4 ${isPaid ? 'text-[#16A66A]' : 'text-gray-300'}`} />
                  </div>
                  <p className="text-[11px] opacity-80 font-normal">
                    {type === 'entries' ? 'Já caiu na conta' : 'Débito executado hoje'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaid(false)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all space-y-1.5 ${
                    !isPaid
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-800 dark:text-amber-300 shadow-2xs font-bold'
                      : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black font-display">
                      {type === 'entries' ? 'A receber' : 'Pagar depois'}
                    </span>
                    <Clock className={`w-4 h-4 ${!isPaid ? 'text-amber-600' : 'text-gray-300'}`} />
                  </div>
                  <p className="text-[11px] opacity-80 font-normal">
                    Ficará pendente na lista
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* ==================================================
              ETAPA 5: Origem do Pagamento (Apenas se pago e despesa)
              ================================================== */}
          {step === 5 && isPaid && type !== 'entries' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="block text-sm font-extrabold text-[#02402E] dark:text-[#78D9A6] font-display">
                  De onde saiu o dinheiro?
                </label>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  Selecione o Saldo Livre ou uma Reserva/Caixinha para abater.
                </p>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                {/* Option 1: Saldo Livre */}
                <button
                  type="button"
                  onClick={() => setSelectedReserveId(null)}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                    selectedReserveId === null
                      ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] border-[#02402E] shadow-2xs'
                      : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#202724] dark:text-[#F4F4F5]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#16A66A]/20 flex items-center justify-center shrink-0">
                      <PiggyBank className="w-4 h-4 text-[#16A66A]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">Saldo Livre</p>
                      <p className="text-[10px] opacity-80">
                        Disponível: {formatCurrency(freeBalance)}
                      </p>
                    </div>
                  </div>
                  {selectedReserveId === null && <Check className="w-4 h-4 shrink-0" />}
                </button>

                {/* Option 2: Reservas */}
                {reserves.map((res) => {
                  const isSelected = selectedReserveId === res.id;
                  const bal = Number(res.current_balance) || 0;
                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setSelectedReserveId(res.id)}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] border-[#02402E] shadow-2xs'
                          : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#202724] dark:text-[#F4F4F5]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">{res.icon || '🏷️'}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold truncate">{res.name}</p>
                          <p className="text-[10px] opacity-80">
                            Saldo: {formatCurrency(bal)}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================================================
              ETAPA 6: Resumo & Confirmação (E "Mais Opções")
              ================================================== */}
          {step === 6 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="block text-sm font-extrabold text-[#02402E] dark:text-[#78D9A6] font-display">
                  Confirmação do Lançamento
                </label>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  Confira os dados antes de salvar definitivamente.
                </p>
              </div>

              {/* SUMMARY CARD */}
              <div className="p-4 rounded-2xl bg-[#F4F8F5] dark:bg-[#181C1A] border border-[#D2DDD6] dark:border-[#28322C] space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
                  <span className="text-[#5E6963] dark:text-[#95A39B]">Tipo:</span>
                  <span className="font-extrabold text-[#02402E] dark:text-[#78D9A6]">{getTypeName()}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
                  <span className="text-[#5E6963] dark:text-[#95A39B]">Descrição:</span>
                  <span className="font-extrabold text-[#202724] dark:text-[#F4F4F5] truncate max-w-[200px]">
                    {description}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
                  <span className="text-[#5E6963] dark:text-[#95A39B]">Valor:</span>
                  <span className="font-black text-sm text-[#16A66A]">
                    {formatCurrency(parseAmountNumber(amountInput))}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
                  <span className="text-[#5E6963] dark:text-[#95A39B]">Data:</span>
                  <span className="font-bold text-[#202724] dark:text-[#F4F4F5]">
                    {date.split('-').reverse().join('/')}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
                  <span className="text-[#5E6963] dark:text-[#95A39B]">Situação:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${
                    isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isPaid ? (type === 'entries' ? 'Recebido' : 'Pago') : 'Pendente'}
                  </span>
                </div>

                {isPaid && type !== 'entries' && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#5E6963] dark:text-[#95A39B]">Origem do dinheiro:</span>
                    <span className="font-bold text-[#02402E] dark:text-[#78D9A6]">
                      {selectedReserveObj ? selectedReserveObj.name : 'Saldo Livre'}
                    </span>
                  </div>
                )}
              </div>

              {/* MAIS OPÇÕES ACCORDION */}
              <div className="border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#141816] flex items-center justify-between text-xs font-bold text-[#02402E] dark:text-[#78D9A6] cursor-pointer"
                >
                  <span>Mais opções (Categoria, Observações)</span>
                  {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showMoreOptions && (
                  <div className="p-4 bg-[#F9FBF9] dark:bg-[#181C1A] border-t border-[#D2DDD6] dark:border-[#28322C] space-y-3 text-xs animate-in fade-in duration-150">
                    {/* Category */}
                    <div className="space-y-1">
                      <label className="block font-bold text-[#5E6963] dark:text-[#95A39B]">Categoria:</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]"
                      >
                        <option value="">Selecione uma categoria...</option>
                        {(type === 'entries' ? CATEGORIES_ENTRIES : CATEGORIES_EXPENSES).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fixed expense due day */}
                    {type === 'fixed_expenses' && (
                      <div className="space-y-1">
                        <label className="block font-bold text-[#5E6963] dark:text-[#95A39B]">Dia de Vencimento:</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={dueDay}
                          onChange={(e) => setDueDay(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]"
                        />
                      </div>
                    )}

                    {/* Installments count */}
                    {type === 'installments' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block font-bold text-[#5E6963] dark:text-[#95A39B]">Nº de Parcelas:</label>
                          <input
                            type="number"
                            min={2}
                            max={72}
                            value={installmentCount}
                            onChange={(e) => setInstallmentCount(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-[#5E6963] dark:text-[#95A39B]">Cartão / Conta:</label>
                          <input
                            type="text"
                            placeholder="Ex: Nubank, Itaú"
                            value={cardOrAccount}
                            onChange={(e) => setCardOrAccount(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] font-semibold text-xs text-[#202724] dark:text-[#F4F4F5]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1">
                      <label className="block font-bold text-[#5E6963] dark:text-[#95A39B]">Observações:</label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Anotação opcional..."
                        className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#141816] font-medium text-xs text-[#202724] dark:text-[#F4F4F5]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER BUTTONS */}
        <div className="p-4 bg-[#F4F8F5] dark:bg-[#181C1A] border-t border-[#E2ECE6] dark:border-[#28322C] shrink-0 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-4 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] text-xs font-bold text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              ← Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] text-xs font-bold text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancelar
            </button>
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex-1 py-3 rounded-2xl bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] font-bold text-xs hover:bg-[#16A66A] transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
            >
              <span>Avançar →</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmLaunch}
              className="flex-1 py-3.5 rounded-2xl bg-[#16A66A] text-white font-black text-xs hover:bg-[#02402E] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar Lançamento Rápido</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
