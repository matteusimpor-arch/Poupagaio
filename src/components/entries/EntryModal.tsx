import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Entry, EntryStatus, CreateEntryInput, UpdateEntryInput } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, DollarSign, Calendar, Tag, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { getISODateToday, parseCurrencyInput, formatCurrency, getDefaultDateForBillingCycle } from '../../lib/formatters';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateEntryInput | UpdateEntryInput) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  editingEntry?: Entry | null;
  spaceId: string;
  selectedYear?: number;
  selectedMonth?: number;
}

const CATEGORY_SUGGESTIONS = [
  'Salário',
  'Renda extra',
  'Venda',
  'Reembolso',
  'Rendimentos',
  'Benefício',
  'Presente',
  'Outros',
];

export function EntryModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingEntry,
  spaceId,
  selectedYear,
  selectedMonth,
}: EntryModalProps) {
  const [description, setDescription] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [date, setDate] = useState(() => getDefaultDateForBillingCycle(selectedYear, selectedMonth));
  const [category, setCategory] = useState('Salário');
  const [customCategory, setCustomCategory] = useState('');
  const [status, setStatus] = useState<EntryStatus>('received');
  const [autoReceive, setAutoReceive] = useState(false);
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUndoAutoReceiveModal, setShowUndoAutoReceiveModal] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isEditing = Boolean(editingEntry);

  useEffect(() => {
    if (editingEntry) {
      setDescription(editingEntry.description);
      // Converte valor float para formato amigável brasileiro (ex: "1500,00")
      setRawAmount(editingEntry.amount.toFixed(2).replace('.', ','));
      setDate(editingEntry.date);
      if (CATEGORY_SUGGESTIONS.includes(editingEntry.category)) {
        setCategory(editingEntry.category);
        setCustomCategory('');
      } else {
        setCategory('Outros');
        setCustomCategory(editingEntry.category);
      }
      setStatus(editingEntry.status);
      setAutoReceive(Boolean(editingEntry.auto_receive));
      setNotes(editingEntry.notes || '');
    } else {
      setDescription('');
      setRawAmount('');
      setDate(getDefaultDateForBillingCycle(selectedYear, selectedMonth));
      setCategory('Salário');
      setCustomCategory('');
      setStatus('received');
      setAutoReceive(false);
      setNotes('');
    }
    setErrors({});
    setGeneralError(null);
    setShowDeleteConfirm(false);
    setShowUndoAutoReceiveModal(false);
    setIsDeleting(false);
  }, [editingEntry, isOpen, selectedYear, selectedMonth]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Permite digitação com números, vírgula e ponto
    setRawAmount(val);
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!description.trim()) {
      newErrors.description = 'A descrição é obrigatória.';
    }

    const numericAmount = parseCurrencyInput(rawAmount);
    if (!rawAmount || isNaN(numericAmount) || numericAmount <= 0) {
      newErrors.amount = 'Informe um valor maior que R$ 0,00.';
    }

    if (!date) {
      newErrors.date = 'A data é obrigatória.';
    }

    if (category === 'Outros' && customCategory.trim().length > 50) {
      newErrors.category = 'A categoria personalizada deve ter no máximo 50 caracteres.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    const finalCategory =
      category === 'Outros' && customCategory.trim()
        ? customCategory.trim()
        : category;

    const numericAmount = parseCurrencyInput(rawAmount);

    try {
      if (isEditing && editingEntry) {
        const payload: UpdateEntryInput = {
          description: description.trim(),
          amount: numericAmount,
          date,
          category: finalCategory,
          status,
          notes: notes.trim() || null,
          auto_receive: status === 'pending' ? autoReceive : false,
        };
        const success = await onSave(payload);
        if (success) {
          onClose();
        }
      } else {
        const payload: CreateEntryInput = {
          space_id: spaceId,
          description: description.trim(),
          amount: numericAmount,
          date,
          category: finalCategory,
          status,
          notes: notes.trim() || null,
          auto_receive: status === 'pending' ? autoReceive : false,
        };
        const success = await onSave(payload);
        if (success) {
          onClose();
        }
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Não foi possível salvar a entrada. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPending = () => {
    // Se estiver editando uma entrada que estava como 'received' e tinha auto_receive=true e a data já passou ou é hoje:
    if (
      isEditing &&
      editingEntry?.status === 'received' &&
      editingEntry?.auto_receive &&
      date <= getISODateToday()
    ) {
      setShowUndoAutoReceiveModal(true);
      return;
    }
    setStatus('pending');
  };

  const handleConfirmUndoAutoReceive = () => {
    setStatus('pending');
    setAutoReceive(false);
    setShowUndoAutoReceiveModal(false);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    setGeneralError(null);
    try {
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
      aria-labelledby="entry-modal-title"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-150"
    >
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[10000] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C211E] border border-[#D2DDD6] dark:border-[#28322C] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Excluir esta movimentação?
                </h3>
                <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] mt-1">
                  Esta ação removerá este lançamento e atualizará os valores financeiros relacionados.
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

      {showUndoAutoReceiveModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[10000] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C211E] border border-[#D2DDD6] dark:border-[#28322C] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Desfazer baixa automática?
                </h3>
                <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] mt-1 leading-relaxed">
                  Esta entrada possui baixa automática. Deseja desativar a baixa automática e retornar para &quot;A receber&quot;?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowUndoAutoReceiveModal(false)}
                className="cursor-pointer text-xs"
              >
                Cancelar
              </Button>
              <button
                type="button"
                onClick={handleConfirmUndoAutoReceive}
                className="px-3 py-2 rounded-xl bg-[#075C45] hover:bg-[#075C45]/90 text-white font-bold cursor-pointer text-xs transition-colors flex items-center justify-center"
              >
                Confirmar e Desativar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-[calc(100vw-24px)] sm:w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xl overflow-hidden flex flex-col my-auto mx-auto box-border animate-in zoom-in-95 duration-150">
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E8E4D5] dark:border-[#24312B] bg-[#F7F4EA]/40 dark:bg-[#121915]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#075C45]/10 dark:bg-[#16A66A]/20 text-[#075C45] dark:text-[#78D9A6] flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 id="entry-modal-title" className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
                {isEditing ? 'Editar Entrada' : 'Nova Entrada'}
              </h3>
              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                {isEditing ? 'Atualize as informações do lançamento' : 'Cadastre um ganho ou receita no seu orçamento'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {generalError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Campo Descrição */}
          <div className="space-y-1.5">
            <Input
              id="entry-description-input"
              label="Descrição *"
              placeholder="Ex: Salário mensal, Freelance, Venda do celular"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              error={errors.description}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Campo Valor e Data (Lado a Lado no Desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor (R$) */}
            <div className="space-y-1.5">
              <label
                htmlFor="entry-amount-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]"
              >
                Valor (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5E6963] dark:text-[#95A39B]">
                  R$
                </span>
                <input
                  id="entry-amount-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={rawAmount}
                  onChange={handleAmountChange}
                  disabled={isSubmitting}
                  className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-white text-[#111827] font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#16A66A] dark:bg-[#222226] dark:text-white dark:border-white/20 shadow-xs ${
                    errors.amount ? 'border-red-500 focus:ring-red-500' : 'border-[#E8E4D5]'
                  }`}
                />
              </div>
              {errors.amount && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errors.amount}</p>
              )}
            </div>

            {/* Data (DD/MM/AAAA) */}
            <div className="space-y-1.5">
              <label
                htmlFor="entry-date-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]"
              >
                Data *
              </label>
              <div className="relative">
                <input
                  id="entry-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
                  }}
                  disabled={isSubmitting}
                  className={`w-full h-11 px-3.5 rounded-xl border bg-white text-[#111827] text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#16A66A] dark:bg-[#222226] dark:text-white dark:border-white/20 shadow-xs ${
                    errors.date ? 'border-red-500 focus:ring-red-500' : 'border-[#E8E4D5]'
                  }`}
                />
              </div>
              {errors.date && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errors.date}</p>
              )}
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label
              htmlFor="entry-category-select"
              className="block text-xs font-semibold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]"
            >
              Categoria
            </label>
            <select
              id="entry-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8E4D5] bg-white text-[#111827] text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#16A66A] dark:bg-[#222226] dark:text-white dark:border-white/20 shadow-xs cursor-pointer"
            >
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Input personalizado se 'Outros' */}
            {category === 'Outros' && (
              <div className="pt-1 animate-in fade-in duration-150">
                <input
                  id="entry-custom-category-input"
                  type="text"
                  placeholder="Especifique a categoria (opcional)"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8E4D5] bg-white text-[#111827] text-xs font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16A66A] dark:bg-[#222226] dark:text-white dark:border-white/20 shadow-xs"
                />
              </div>
            )}
          </div>

          {/* Status (Recebido vs A receber) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                id="status-received-btn"
                onClick={() => setStatus('received')}
                disabled={isSubmitting}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  status === 'received'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-xs'
                    : 'border-[#E8E4D5] bg-white text-[#5E6963] hover:bg-black/5 dark:border-[#24312B] dark:bg-[#18211D] dark:text-[#95A39B]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Recebido</span>
              </button>

              <button
                type="button"
                id="status-pending-btn"
                onClick={handleSelectPending}
                disabled={isSubmitting}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  status === 'pending'
                    ? 'border-[#D6A84B] bg-[#F7F4EA] text-[#8c6511] dark:bg-[#D6A84B]/15 dark:text-[#F2D58A] shadow-xs'
                    : 'border-[#E8E4D5] bg-white text-[#5E6963] hover:bg-black/5 dark:border-[#24312B] dark:bg-[#18211D] dark:text-[#95A39B]'
                }`}
              >
                <Clock className="w-4 h-4 text-[#b07d17] dark:text-[#F2D58A]" />
                <span>A receber</span>
              </button>
            </div>
          </div>

          {/* Opção de Baixa Automática (Apenas se status 'A receber') */}
          {status === 'pending' && (
            <div className="pt-1 animate-in fade-in duration-150">
              <label
                htmlFor="entry-auto-receive-checkbox"
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#F7F4EA]/80 dark:bg-[#1C2320] border border-[#E8E4D5] dark:border-[#28322C] hover:border-[#16A66A]/40 transition-colors cursor-pointer select-none"
              >
                <input
                  id="entry-auto-receive-checkbox"
                  type="checkbox"
                  checked={autoReceive}
                  onChange={(e) => setAutoReceive(e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 w-4 h-4 rounded border-[#D2DDD6] text-[#075C45] focus:ring-[#16A66A] dark:bg-[#222226] dark:border-white/20 cursor-pointer shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[#202724] dark:text-[#F7F4EA] block">
                    Baixa automática na data
                  </span>
                  <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] leading-tight">
                    Quando ativado, esta entrada será marcada automaticamente como recebida na data informada.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Observação (Opcional) */}
          <div className="space-y-1.5">
            <label
              htmlFor="entry-notes-input"
              className="block text-xs font-semibold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]"
            >
              Observação (opcional)
            </label>
            <textarea
              id="entry-notes-input"
              rows={2}
              placeholder="Informações adicionais, pagador ou contexto..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-3 rounded-xl border border-[#E8E4D5] bg-white text-[#111827] text-xs font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16A66A] dark:bg-[#222226] dark:text-white dark:border-white/20 shadow-xs resize-none"
            />
          </div>

          {/* Rodapé / Ações */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-2.5 border-t border-[#E8E4D5] dark:border-[#24312B] w-full mt-auto">
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting}
                className="w-full sm:w-auto text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 text-center shrink-0 flex items-center justify-center gap-1"
              >
                <span>🗑</span>
                <span>Excluir movimentação</span>
              </button>
            )}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto cursor-pointer font-bold justify-center"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="w-full sm:w-auto font-bold cursor-pointer justify-center whitespace-normal text-center break-words py-2 px-3 text-xs sm:text-sm"
              >
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Entrada'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
