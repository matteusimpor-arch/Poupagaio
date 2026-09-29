import React, { useState, useEffect } from 'react';
import { Goal, GoalStatus, CreateGoalInput, UpdateGoalInput } from '../../types';
import { GOAL_CATEGORIES } from '../../lib/services/goals';
import { Button } from '../ui/button';
import { ModalPortal } from '../ui/ModalPortal';
import { X, Target, AlertCircle, Calendar, Tag, FileText } from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    input: CreateGoalInput | UpdateGoalInput
  ) => Promise<{ success: boolean; error?: string }>;
  goalToEdit?: Goal | null;
  spaceId: string;
}

export function GoalModal({
  isOpen,
  onClose,
  onSave,
  goalToEdit,
  spaceId,
}: GoalModalProps) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [category, setCategory] = useState<string>('Reserva de emergência');
  const [status, setStatus] = useState<GoalStatus>('active');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (goalToEdit) {
      setName(goalToEdit.name);
      setTargetAmount(String(goalToEdit.target_amount));
      setTargetDate(goalToEdit.target_date || '');
      setCategory(goalToEdit.category || 'Geral');
      setStatus(goalToEdit.status || 'active');
      setNotes(goalToEdit.notes || '');
    } else {
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setCategory('Reserva de emergência');
      setStatus('active');
      setNotes('');
    }
    setErrorMessage(null);
  }, [goalToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Por favor, informe o nome do objetivo.');
      return;
    }

    const numericTarget = parseFloat(targetAmount.replace(',', '.'));
    if (isNaN(numericTarget) || numericTarget <= 0) {
      setErrorMessage('Informe um valor-alvo válido maior que zero.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (goalToEdit) {
        const payload: UpdateGoalInput = {
          name: trimmedName,
          target_amount: numericTarget,
          target_date: targetDate ? targetDate : null,
          category,
          status,
          notes: notes ? notes : null,
        };
        const res = await onSave(payload);
        if (!res.success) {
          setErrorMessage(res.error || 'Erro ao salvar alterações da meta.');
          setIsSubmitting(false);
          return;
        }
      } else {
        const payload: CreateGoalInput = {
          space_id: spaceId,
          name: trimmedName,
          target_amount: numericTarget,
          target_date: targetDate ? targetDate : null,
          category,
          status: 'active',
          notes: notes ? notes : null,
        };
        const res = await onSave(payload);
        if (!res.success) {
          setErrorMessage(res.error || 'Erro ao criar meta.');
          setIsSubmitting(false);
          return;
        }
      }

      onClose();
    } catch {
      setErrorMessage('Ocorreu um erro ao processar a solicitação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E2220] border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E4] dark:border-[#2E3532]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                {goalToEdit ? 'Editar Meta' : 'Nova Meta'}
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                {goalToEdit
                  ? 'Atualize os detalhes do seu objetivo financeiro'
                  : 'Defina seu objetivo e acompanhe seu progresso por aportes'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5E6963] hover:text-[#202724] hover:bg-black/5 dark:text-[#95A39B] dark:hover:text-[#F4F4F5] dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nome da Meta */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5] flex items-center gap-1.5">
              Nome da meta <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reserva de emergência, Viagem para Europa..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] placeholder:text-[#5E6963]/50 focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40"
            />
          </div>

          {/* Grid: Valor-Alvo e Prazo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor-alvo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">
                Valor-alvo (R$) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#5E6963] dark:text-[#95A39B]">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="10000,00"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] placeholder:text-[#5E6963]/50 focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40"
                />
              </div>
            </div>

            {/* Prazo opcional */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#5E6963]" />
                <span>Prazo limite (opcional)</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40"
              />
            </div>
          </div>

          {/* Grid: Categoria e Status (se editando) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5] flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#5E6963]" />
                <span>Categoria</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 cursor-pointer"
              >
                {GOAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status (se editando) */}
            {goalToEdit ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">
                  Status da meta
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as GoalStatus)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 cursor-pointer"
                >
                  <option value="active">Em andamento (Ativa)</option>
                  <option value="completed">Concluída</option>
                  <option value="paused">Pausada</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="p-2.5 rounded-xl bg-[#16A66A]/5 dark:bg-[#16A66A]/10 border border-[#16A66A]/20 text-[11px] text-[#075C45] dark:text-[#78D9A6]">
                  💡 <strong>Aportes:</strong> O valor acumulado será atualizado conforme você registrar aportes para esta meta.
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#5E6963]" />
              <span>Observações (opcional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre a meta, motivação, detalhes do plano..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#232725] text-[#202724] dark:text-[#F4F4F5] placeholder:text-[#5E6963]/50 focus:outline-hidden focus:ring-2 focus:ring-[#16A66A]/40 resize-none"
            />
          </div>

          {/* Aviso de integridade financeira */}
          <div className="p-3 rounded-xl bg-[#EBECEE]/60 dark:bg-[#232725]/60 border border-[#E2E8E4] dark:border-[#2E3532] text-xs text-[#5E6963] dark:text-[#95A39B]">
            O valor acumulado não é editável diretamente. Para adicionar saldo, utilize o botão <strong>Aportar</strong> na tela de metas.
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="cursor-pointer text-xs font-semibold"
            >
              {isSubmitting
                ? 'Salvando...'
                : goalToEdit
                ? 'Salvar alterações'
                : 'Criar meta'}
            </Button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
