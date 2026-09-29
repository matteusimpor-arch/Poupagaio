import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  VariableExpense,
  VariableExpenseStatus,
  CreateVariableExpenseInput,
  UpdateVariableExpenseInput,
  Reserve,
} from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, DollarSign, Calendar, Tag, FileText, CheckCircle2, Clock, AlertCircle, Wallet, Trash2 } from 'lucide-react';
import { parseCurrencyInput, getDefaultDateForBillingCycle, formatCurrency } from '../../lib/formatters';
import { reservesService } from '../../lib/services/reserves';
import { useAuth } from '../../hooks/useAuth';

interface VariableExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateVariableExpenseInput | UpdateVariableExpenseInput) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  editingExpense?: VariableExpense | null;
  spaceId: string;
  selectedYear?: number;
  selectedMonth?: number;
}

export const VARIABLE_EXPENSE_CATEGORIES = [
  'Mercado',
  'Alimentação',
  'Combustível',
  'Transporte',
  'Saúde',
  'Lazer',
  'Compras',
  'Casa',
  'Educação',
  'Manutenção',
  'Outros',
];

export function VariableExpenseModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingExpense,
  spaceId,
  selectedYear,
  selectedMonth,
}: VariableExpenseModalProps) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [date, setDate] = useState(() => getDefaultDateForBillingCycle(selectedYear, selectedMonth));
  const [category, setCategory] = useState('Mercado');
  const [customCategory, setCustomCategory] = useState('');
  const [status, setStatus] = useState<VariableExpenseStatus>('paid');
  const [notes, setNotes] = useState('');

  // Reserve origin state
  const [originType, setOriginType] = useState<'free_balance' | 'reserve'>('free_balance');
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null);
  const [availableReserves, setAvailableReserves] = useState<Reserve[]>([]);
  const [freeBalance, setFreeBalance] = useState<number>(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isEditing = Boolean(editingExpense);

  useEffect(() => {
    if (isOpen) {
      const year = selectedYear || new Date().getFullYear();
      const month = selectedMonth || (new Date().getMonth() + 1);

      // Load reserves for origin selector
      if (spaceId) {
        reservesService.getReservesWithSummary(spaceId, year, month).then((res) => {
          setAvailableReserves(res.reserves);
          setFreeBalance(res.summary.freeBalance);

          if (!editingExpense) {
            // Auto match category to reserve
            const cat = category === 'Outros' ? customCategory : category;
            const match = res.reserves.find(
              (r) =>
                (r.category && r.category.toLowerCase() === cat.toLowerCase()) ||
                r.name.toLowerCase().includes(cat.toLowerCase())
            );
            if (match) {
              setOriginType('reserve');
              setSelectedReserveId(match.id);
            } else {
              setOriginType('free_balance');
              setSelectedReserveId(null);
            }
          }
        });
      }

      if (editingExpense) {
        setDescription(editingExpense.description);
        setRawAmount(editingExpense.amount.toFixed(2).replace('.', ','));
        setDate(editingExpense.date);
        if (VARIABLE_EXPENSE_CATEGORIES.includes(editingExpense.category)) {
          setCategory(editingExpense.category);
          setCustomCategory('');
        } else {
          setCategory('Outros');
          setCustomCategory(editingExpense.category);
        }
        setStatus(editingExpense.status);
        setNotes(editingExpense.notes || '');
      } else {
        setDescription('');
        setRawAmount('');
        setDate(getDefaultDateForBillingCycle(selectedYear, selectedMonth));
        setCategory('Mercado');
        setCustomCategory('');
        setStatus('paid');
        setNotes('');
      }
      setErrors({});
      setGeneralError(null);
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }
  }, [editingExpense, isOpen, selectedYear, selectedMonth, spaceId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // When category changes, auto suggest matching reserve
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (availableReserves.length > 0) {
      const match = availableReserves.find(
        (r) =>
          (r.category && r.category.toLowerCase() === newCat.toLowerCase()) ||
          r.name.toLowerCase().includes(newCat.toLowerCase())
      );
      if (match) {
        setOriginType('reserve');
        setSelectedReserveId(match.id);
      }
    }
  };

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/[^\d.,]/g, '');
    setRawAmount(clean);
    if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!description.trim()) {
      newErrors.description = 'A descrição do gasto é obrigatória.';
    }

    const parsedAmount = parseCurrencyInput(rawAmount);
    if (parsedAmount <= 0) {
      newErrors.amount = 'Informe um valor maior que zero.';
    }

    if (!date) {
      newErrors.date = 'A data do gasto é obrigatória.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);

    const parsedAmount = parseCurrencyInput(rawAmount);
    const resolvedCategory =
      category === 'Outros' && customCategory.trim()
        ? customCategory.trim()
        : category;

    const payload: CreateVariableExpenseInput | UpdateVariableExpenseInput = {
      space_id: spaceId,
      description: description.trim(),
      amount: parsedAmount,
      date,
      category: resolvedCategory,
      status,
      notes: notes.trim() || null,
    };

    try {
      // If was paid and we are editing or creating, handle reserve deduction
      if (status === 'paid' && originType === 'reserve' && selectedReserveId) {
        const reserveObj = availableReserves.find((r) => r.id === selectedReserveId);
        const resBal = reserveObj ? Number(reserveObj.current_balance) || 0 : 0;
        if (parsedAmount > resBal) {
          setGeneralError(
            `Saldo insuficiente na reserva "${reserveObj?.name}". Disponível: ${formatCurrency(resBal)}.`
          );
          setIsSubmitting(false);
          return;
        }
      }

      const success = await onSave(payload);
      if (success) {
        // If paid with reserve or free balance, register payment with origin
        if (status === 'paid' && user?.id) {
          const expenseId = editingExpense?.id || (typeof success === 'string' ? success : crypto.randomUUID());
          await reservesService.payExpenseWithOrigin(user.id, {
            space_id: spaceId,
            expense_type: 'variable',
            expense_id: expenseId,
            amount: parsedAmount,
            payment_date: date,
            origin_type: originType === 'reserve' ? 'reserve' : 'free_balance',
            primary_reserve_id: originType === 'reserve' ? selectedReserveId : null,
          });
        }
        onClose();
      } else {
        setGeneralError('Não foi possível salvar este gasto. Tente novamente.');
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Erro inesperado ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    setGeneralError(null);
    try {
      if (editingExpense && editingExpense.status === 'paid' && user?.id) {
        await reservesService.refundExpensePayment('variable', editingExpense.id, spaceId, user.id);
      }
      const success = await onDelete();
      if (success) {
        onClose();
      } else {
        setGeneralError('Não foi possível excluir a movimentação.');
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Erro ao excluir a movimentação.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="variable-expense-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden animate-in fade-in duration-150"
    >
      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#18211D] border border-red-200 dark:border-red-900 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#202724] dark:text-[#F7F4EA]">
                  Excluir gasto variável?
                </h3>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  Esta ação não pode ser desfeita. Se houver reserva vinculada, o saldo será estornado.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="cursor-pointer text-xs"
              >
                Cancelar
              </Button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-xs transition-colors flex items-center justify-center min-w-[70px] disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-[calc(100vw-24px)] sm:w-full max-w-lg mx-auto bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] box-border animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E4D5] dark:border-[#24312B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D6A84B]/15 text-[#8A6318] dark:text-[#F2D58A] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <h2
              id="variable-expense-modal-title"
              className="text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA]"
            >
              {isEditing ? 'Editar gasto variável' : 'Novo gasto variável'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {generalError && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA]">
              Descrição <span className="text-rose-500">*</span>
            </label>
            <Input
              id="variable-expense-description-input"
              type="text"
              placeholder="Ex: Compras da semana no mercado, Gasolina posto"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              error={errors.description}
              autoFocus={!isEditing}
              className="rounded-2xl"
            />
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Valor */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA]">
                Valor (R$) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5E6963] dark:text-[#95A39B]">
                  <DollarSign className="w-4 h-4" />
                </div>
                <Input
                  id="variable-expense-amount-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={rawAmount}
                  onChange={handleAmountChange}
                  error={errors.amount}
                  className="pl-9 rounded-2xl font-bold"
                />
              </div>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#5E6963] dark:text-[#95A39B]" />
                Data <span className="text-rose-500">*</span>
              </label>
              <Input
                id="variable-expense-date-input"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
                }}
                error={errors.date}
                className="rounded-2xl"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#5E6963] dark:text-[#95A39B]" />
              Categoria
            </label>
            <select
              id="variable-expense-category-select"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-white dark:bg-[#101614] border border-[#E8E4D5] dark:border-[#24312B] text-xs sm:text-sm text-[#202724] dark:text-[#F7F4EA] focus:outline-hidden focus:ring-2 focus:ring-[#16A66A] cursor-pointer"
            >
              {VARIABLE_EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {category === 'Outros' && (
            <div className="space-y-1.5 animate-in fade-in duration-100">
              <label className="text-xs font-medium text-[#5E6963] dark:text-[#95A39B]">
                Qual é a categoria?
              </label>
              <Input
                type="text"
                placeholder="Ex: Farmácia manipulada, Estacionamento"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="rounded-2xl"
              />
            </div>
          )}

          {/* Status: Pago ou Pendente */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA]">
              Status do gasto
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStatus('paid')}
                className={`h-11 px-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  status === 'paid'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600 shadow-2xs'
                    : 'border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#101614] text-[#5E6963] dark:text-[#95A39B] hover:border-[#16A66A]/40'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Pago</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`h-11 px-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  status === 'pending'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-600 shadow-2xs'
                    : 'border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#101614] text-[#5E6963] dark:text-[#95A39B] hover:border-[#16A66A]/40'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Pendente</span>
              </button>
            </div>
          </div>

          {/* DE ONDE SAIU O DINHEIRO (Quando Status = Pago) */}
          {status === 'paid' && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-[#F7FAF8] dark:bg-[#202723] border border-[#E2ECE6] dark:border-[#28322C] animate-in fade-in">
              <label className="text-xs font-bold uppercase tracking-wider text-[#02402E] dark:text-[#78D9A6] block">
                De onde saiu o dinheiro?
              </label>

              <div className="space-y-2">
                <label
                  onClick={() => {
                    setOriginType('free_balance');
                    setSelectedReserveId(null);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    originType === 'free_balance'
                      ? 'border-[#16A66A] bg-[#16A66A]/10 text-[#02402E] dark:text-[#78D9A6] font-bold shadow-2xs'
                      : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="expense_source_modal"
                      checked={originType === 'free_balance'}
                      onChange={() => {
                        setOriginType('free_balance');
                        setSelectedReserveId(null);
                      }}
                      className="w-4 h-4 text-[#16A66A] accent-[#16A66A]"
                    />
                    <Wallet className="w-4 h-4 text-[#16A66A]" />
                    <span className="text-xs">Saldo Livre</span>
                  </div>
                  <span className="text-xs font-bold text-[#16A66A]">
                    {formatCurrency(freeBalance)}
                  </span>
                </label>

                {availableReserves.map((res) => {
                  const isSelected = originType === 'reserve' && selectedReserveId === res.id;
                  const resBal = Number(res.current_balance) || 0;

                  return (
                    <label
                      key={res.id}
                      onClick={() => {
                        setOriginType('reserve');
                        setSelectedReserveId(res.id);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#16A66A] bg-[#16A66A]/10 text-[#02402E] dark:text-[#78D9A6] font-bold shadow-2xs'
                          : 'border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="expense_source_modal"
                          checked={isSelected}
                          onChange={() => {
                            setOriginType('reserve');
                            setSelectedReserveId(res.id);
                          }}
                          className="w-4 h-4 text-[#16A66A] accent-[#16A66A]"
                        />
                        <span className="text-base">{res.icon || '💰'}</span>
                        <span className="text-xs">{res.name}</span>
                      </div>
                      <span className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                        {formatCurrency(resBal)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#5E6963] dark:text-[#95A39B]" />
              Observação <span className="text-[10px] font-normal text-[#5E6963] dark:text-[#95A39B]">(opcional)</span>
            </label>
            <textarea
              id="variable-expense-notes-textarea"
              rows={2}
              placeholder="Ex: Compra feita no cartão de débito ou detalhes da despesa..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#101614] border border-[#E8E4D5] dark:border-[#24312B] text-xs sm:text-sm text-[#202724] dark:text-[#F7F4EA] placeholder-[#5E6963]/60 dark:placeholder-[#95A39B]/60 focus:outline-hidden focus:ring-2 focus:ring-[#16A66A] resize-none"
            />
          </div>

          {/* Rodapé */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-2.5 border-t border-[#E8E4D5] dark:border-[#24312B] w-full">
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting}
                className="w-full sm:w-auto text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 text-center shrink-0 flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
                className="w-full sm:w-auto cursor-pointer rounded-2xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || isDeleting}
                className="w-full sm:w-auto font-bold cursor-pointer rounded-2xl bg-[#02402E] text-white hover:bg-[#16A66A] dark:bg-[#78D9A6] dark:text-[#101614]"
              >
                {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar gasto'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
