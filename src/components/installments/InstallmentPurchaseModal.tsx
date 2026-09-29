import React, { useState, useEffect, useMemo } from 'react';
import {
  InstallmentPurchaseWithInstallments,
  CreateInstallmentPurchaseInput,
  UpdateInstallmentPurchaseInput,
} from '../../types';
import { INSTALLMENT_CATEGORIES, calculateInstallmentsSchedule } from '../../lib/services/installments';
import { formatCurrency, getDefaultDateForBillingCycle } from '../../lib/formatters';
import { Button } from '../ui/button';
import { ModalPortal } from '../ui/ModalPortal';
import { X, Calendar, AlertCircle, Info, Calculator, CheckCircle2 } from 'lucide-react';

interface InstallmentPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  purchaseToEdit?: InstallmentPurchaseWithInstallments | null;
  onSave: (
    input: CreateInstallmentPurchaseInput | UpdateInstallmentPurchaseInput
  ) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (deleteOption: 'only_installment' | 'full_purchase') => Promise<boolean>;
  selectedYear?: number;
  selectedMonth?: number;
}

export function InstallmentPurchaseModal({
  isOpen,
  onClose,
  spaceId,
  purchaseToEdit,
  onSave,
  onDelete,
  selectedYear,
  selectedMonth,
}: InstallmentPurchaseModalProps) {
  const [description, setDescription] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState<number>(12);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [category, setCategory] = useState<string>('Outros');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOption, setDeleteOption] = useState<'only_installment' | 'full_purchase'>('only_installment');
  const [inputType, setInputType] = useState<'total' | 'parcela'>('total');

  const isEditing = Boolean(purchaseToEdit);
  const hasPaidInstallments = (purchaseToEdit?.paidCount || 0) > 0;

  // Inicializa o formulário com dados existentes ou valores padrão
  useEffect(() => {
    if (purchaseToEdit) {
      setDescription(purchaseToEdit.description || '');
      setRawAmount(purchaseToEdit.total_amount ? String(purchaseToEdit.total_amount) : '');
      setInstallmentCount(purchaseToEdit.installment_count || 12);
      setFirstDueDate(purchaseToEdit.first_due_date || '');
      setCategory(purchaseToEdit.category || 'Outros');
      setNotes(purchaseToEdit.notes || '');
    } else {
      // Criação: herda a competência selecionada
      const defaultDate = getDefaultDateForBillingCycle(selectedYear, selectedMonth);
      setDescription('');
      setRawAmount('');
      setInstallmentCount(12);
      setFirstDueDate(defaultDate);
      setCategory('Outros');
      setNotes('');
    }
    setErrorMessage(null);
    setShowDeleteConfirm(false);
    setIsDeleting(false);
    setDeleteOption('only_installment');
  }, [purchaseToEdit, isOpen, selectedYear, selectedMonth]);

  // Cálculo da simulação de parcelas em tempo real
  const schedulePreview = useMemo(() => {
    const numAmount = parseFloat(rawAmount.replace(',', '.'));
    if (!numAmount || numAmount <= 0 || installmentCount < 2 || !firstDueDate) {
      return null;
    }
    try {
      const schedule = calculateInstallmentsSchedule(numAmount, installmentCount, firstDueDate);
      const firstInstallment = schedule[0];
      const lastInstallment = schedule[schedule.length - 1];
      const isUniform = firstInstallment.amount === lastInstallment.amount;

      return {
        totalAmount: numAmount,
        installmentCount,
        firstAmount: firstInstallment.amount,
        lastAmount: lastInstallment.amount,
        isUniform,
        firstDueDate: firstInstallment.due_date,
        lastDueDate: lastInstallment.due_date,
      };
    } catch {
      return null;
    }
  }, [rawAmount, installmentCount, firstDueDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!description.trim()) {
      setErrorMessage('Por favor, informe a descrição da compra.');
      return;
    }

    const numAmount = parseFloat(rawAmount.replace(',', '.'));
    if (!numAmount || numAmount <= 0) {
      setErrorMessage('Informe um valor total válido maior que zero.');
      return;
    }

    if (installmentCount < 2 || installmentCount > 120) {
      setErrorMessage('A quantidade de parcelas deve estar entre 2 e 120.');
      return;
    }

    if (!firstDueDate) {
      setErrorMessage('Informe a data do primeiro vencimento.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let result;
      if (isEditing) {
        const updatePayload: UpdateInstallmentPurchaseInput = {
          description: description.trim(),
          category,
          notes: notes.trim() || null,
        };
        // Só altera valor/parcelas/vencimento se não houver parcelas pagas
        if (!hasPaidInstallments) {
          updatePayload.total_amount = numAmount;
          updatePayload.installment_count = installmentCount;
          updatePayload.first_due_date = firstDueDate;
        }
        result = await onSave(updatePayload);
      } else {
        const createPayload: CreateInstallmentPurchaseInput = {
          space_id: spaceId,
          description: description.trim(),
          total_amount: numAmount,
          installment_count: installmentCount,
          first_due_date: firstDueDate,
          category,
          notes: notes.trim() || null,
        };
        result = await onSave(createPayload);
      }

      if (result.success) {
        onClose();
      } else {
        setErrorMessage(result.error || 'Erro ao salvar compra parcelada.');
      }
    } catch (err: any) {
      setErrorMessage('Ocorreu um erro ao processar os dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const success = await onDelete(deleteOption);
      if (success) {
        onClose();
      } else {
        setErrorMessage('Não foi possível realizar a exclusão.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao excluir.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const quickCounts = [2, 3, 4, 6, 10, 12, 18, 24, 36, 48];

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C211E] border border-[#D2DDD6] dark:border-[#28322C] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl text-left">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Excluir parcelamento?
                </h3>
                <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] mt-1">
                  Como deseja realizar a exclusão desta movimentação parcelada?
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1 text-left">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer text-xs">
                <input
                  type="radio"
                  name="installment-delete-option"
                  checked={deleteOption === 'only_installment'}
                  onChange={() => setDeleteOption('only_installment')}
                  className="mt-0.5 text-[#16A66A] focus:ring-[#16A66A]"
                />
                <div>
                  <span className="font-bold text-[#202724] dark:text-[#F7F4EA]">Excluir somente esta parcela</span>
                  <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                    Remove apenas a parcela referente a este mês de vencimento. As outras parcelas continuam.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer text-xs">
                <input
                  type="radio"
                  name="installment-delete-option"
                  checked={deleteOption === 'full_purchase'}
                  onChange={() => setDeleteOption('full_purchase')}
                  className="mt-0.5 text-[#16A66A] focus:ring-[#16A66A]"
                />
                <div>
                  <span className="font-bold text-[#202724] dark:text-[#F7F4EA]">Excluir todo o parcelamento</span>
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                    ATENÇÃO: Remove definitivamente a compra e TODAS as suas parcelas associadas.
                  </p>
                </div>
              </label>
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
      <div className="relative w-[calc(100vw-24px)] sm:w-full max-w-lg mx-auto rounded-2xl sm:rounded-3xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-2xl p-4 sm:p-7 max-h-[90vh] overflow-y-auto box-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-[#E2E8E4] dark:border-[#24312B]">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#075C45]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="modal-installment-title"
                className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA] truncate"
              >
                {isEditing ? 'Editar Compra Parcelada' : 'Nova Compra Parcelada'}
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B] truncate sm:whitespace-normal">
                {isEditing
                  ? 'Atualize os dados da sua obrigação'
                  : 'Cadastre a compra para gerar todas as parcelas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aviso amigável quando já existem parcelas pagas */}
        {isEditing && hasPaidInstallments && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Atenção à consistência financeira:</span>
              <p className="mt-0.5">
                Esta compra já possui {purchaseToEdit?.paidCount} parcela(s) paga(s). Para não perder o
                histórico de pagamentos, os valores e prazos estão protegidos. Você pode editar livremente a
                descrição, categoria e observações.
              </p>
            </div>
          </div>
        )}

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Descrição */}
          <div>
            <label
              htmlFor="installment-desc"
              className="block text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] mb-1.5"
            >
              Descrição da Compra *
            </label>
            <input
              id="installment-desc"
              type="text"
              placeholder="Ex: Notebook Dell, Celular, Sofá da Sala"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#141C18] text-[#202724] dark:text-[#F7F4EA] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 transition-all"
              required
            />
          </div>

          {/* Grid: Valor Total e Quantidade de Parcelas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor Total */}
            <div>
              <label
                htmlFor="installment-amount"
                className="block text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] mb-1.5"
              >
                Valor Total (R$) *
              </label>
              <input
                id="installment-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={rawAmount}
                disabled={isEditing && hasPaidInstallments}
                onChange={(e) => setRawAmount(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#141C18] text-[#202724] dark:text-[#F7F4EA] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 transition-all ${
                  isEditing && hasPaidInstallments ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                required
              />
            </div>

            {/* Quantidade de Parcelas */}
            <div>
              <label
                htmlFor="installment-count"
                className="block text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] mb-1.5"
              >
                Nº de Parcelas (2 a 120) *
              </label>
              <input
                id="installment-count"
                type="number"
                min="2"
                max="120"
                value={installmentCount}
                disabled={isEditing && hasPaidInstallments}
                onChange={(e) => setInstallmentCount(parseInt(e.target.value, 10) || 2)}
                className={`w-full px-3.5 py-2.5 rounded-xl border border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#141C18] text-[#202724] dark:text-[#F7F4EA] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 transition-all ${
                  isEditing && hasPaidInstallments ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                required
              />
            </div>
          </div>

          {/* Botões de atalho de parcelas rápidas (se permitido editar) */}
          {(!isEditing || !hasPaidInstallments) && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">Atalhos frequentes:</span>
              <div className="flex flex-wrap gap-1.5">
                {quickCounts.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setInstallmentCount(count)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors cursor-pointer ${
                      installmentCount === count
                        ? 'bg-[#075C45] text-white border-[#075C45] dark:bg-[#16A66A] dark:border-[#16A66A]'
                        : 'border-[#E8E4D5] dark:border-[#24312B] bg-[#F7F4EA] dark:bg-[#101614] text-[#5E6963] dark:text-[#95A39B] hover:border-[#16A66A]'
                    }`}
                  >
                    {count}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grid: Primeiro Vencimento e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primeiro Vencimento */}
            <div>
              <label
                htmlFor="installment-first-date"
                className="block text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] mb-1.5"
              >
                Primeiro Vencimento *
              </label>
              <input
                id="installment-first-date"
                type="date"
                value={firstDueDate}
                disabled={isEditing && hasPaidInstallments}
                onChange={(e) => setFirstDueDate(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#141C18] text-[#202724] dark:text-[#F7F4EA] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 transition-all ${
                  isEditing && hasPaidInstallments ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                required
              />
            </div>

            {/* Categoria */}
            <div>
              <label
                htmlFor="installment-category"
                className="block text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] mb-1.5"
              >
                Categoria
              </label>
              <select
                id="installment-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#141C18] text-[#202724] dark:text-[#F7F4EA] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 transition-all cursor-pointer"
              >
                {INSTALLMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Prévia em tempo real das parcelas calculadas */}
          {schedulePreview && (
            <div className="p-3.5 rounded-2xl bg-[#075C45]/5 dark:bg-[#16A66A]/10 border border-[#075C45]/15 dark:border-[#16A66A]/20 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#075C45] dark:text-[#78D9A6]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simulação do Parcelamento
                </span>
                <span>{schedulePreview.installmentCount}x parcelas</span>
              </div>
              <div className="text-sm font-extrabold text-[#202724] dark:text-[#F7F4EA]">
                {schedulePreview.isUniform ? (
                  <span>
                    {schedulePreview.installmentCount}x de {formatCurrency(schedulePreview.firstAmount)}
                  </span>
                ) : (
                  <span>
                    {schedulePreview.installmentCount - 1}x de {formatCurrency(schedulePreview.firstAmount)} + 1x
                    de {formatCurrency(schedulePreview.lastAmount)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                Total: {formatCurrency(schedulePreview.totalAmount)} • Início: {schedulePreview.firstDueDate} até{' '}
                {schedulePreview.lastDueDate}
              </p>
            </div>
          )}

          {/* Observações */}
          <div>
            <label
              htmlFor="installment-notes"
              className="block text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] mb-1.5"
            >
              Observações (Opcional)
            </label>
            <textarea
              id="installment-notes"
              rows={2}
              placeholder="Ex: Cartão Nubank, compra parcelada na Black Friday..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4D5] dark:border-[#24312B] bg-white dark:bg-[#141C18] text-[#202724] dark:text-[#F7F4EA] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 transition-all resize-none"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-2.5 border-t border-[#E8E4D5] dark:border-[#24312B] w-full">
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
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-xl cursor-pointer font-bold justify-center"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-xl bg-[#075C45] hover:bg-[#075C45]/90 dark:bg-[#16A66A] dark:hover:bg-[#16A66A]/90 text-white font-bold cursor-pointer justify-center whitespace-normal text-center break-words py-2 px-3 text-xs sm:text-sm"
              >
                {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar Compra' : 'Criar Compra e Parcelas'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
