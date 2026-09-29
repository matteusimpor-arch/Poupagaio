import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Sparkles, Check, AlertCircle } from 'lucide-react';
import { Reserve, CreateReserveInput, UpdateReserveInput } from '../../types';
import { RESERVE_ICONS, RESERVE_COLORS } from '../../lib/services/reserves';
import { MONTH_NAMES } from '../../lib/formatters';

interface ReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  userId: string;
  reserve?: Reserve | null;
  selectedYear: number;
  selectedMonth: number;
  onSave: (data: CreateReserveInput | UpdateReserveInput) => Promise<boolean>;
}

export function ReserveModal({
  isOpen,
  onClose,
  spaceId,
  userId,
  reserve,
  selectedYear,
  selectedMonth,
  onSave,
}: ReserveModalProps) {
  const isEditing = !!reserve;

  const [name, setName] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`);
  const [category, setCategory] = useState('');
  const [icon, setIcon] = useState('⛽');
  const [color, setColor] = useState('#16A66A');
  const [renewMonthly, setRenewMonthly] = useState(true);
  const [isPreferred, setIsPreferred] = useState(false);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (reserve) {
        setName(reserve.name);
        setAllocatedAmount(String(reserve.allocated_amount || ''));
        setBillingCycle(reserve.billing_cycle);
        setCategory(reserve.category || '');
        setIcon(reserve.icon || '💰');
        setColor(reserve.color || '#16A66A');
        setRenewMonthly(reserve.renew_monthly);
        setIsPreferred(reserve.is_preferred);
        setNotes(reserve.notes || '');
      } else {
        setName('');
        setAllocatedAmount('');
        setBillingCycle(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`);
        setCategory('');
        setIcon('⛽');
        setColor('#16A66A');
        setRenewMonthly(true);
        setIsPreferred(false);
        setNotes('');
      }
      setErrorMessage(null);
    }
  }, [isOpen, reserve, selectedYear, selectedMonth]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Por favor, informe o nome da reserva.');
      return;
    }

    const amt = parseFloat(allocatedAmount.replace(',', '.'));
    if (isNaN(amt) || amt < 0) {
      setErrorMessage('Informe um valor reservado válido (R$ 0,00 ou superior).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing) {
        const payload: UpdateReserveInput = {
          name: name.trim(),
          allocated_amount: amt,
          category: category.trim() || null,
          icon,
          color,
          renew_monthly: renewMonthly,
          is_preferred: isPreferred,
          notes: notes.trim() || null,
        };
        const ok = await onSave(payload);
        if (ok) onClose();
      } else {
        const payload: CreateReserveInput = {
          space_id: spaceId,
          name: name.trim(),
          allocated_amount: amt,
          billing_cycle: billingCycle,
          category: category.trim() || null,
          icon,
          color,
          renew_monthly: renewMonthly,
          is_preferred: isPreferred,
          notes: notes.trim() || null,
        };
        const ok = await onSave(payload);
        if (ok) onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao salvar reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [cycleY, cycleM] = billingCycle.split('-').map(Number);
  const cycleLabel = `${MONTH_NAMES[cycleM - 1]} de ${cycleY}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-[calc(100vw-24px)] max-w-lg bg-white dark:bg-[#18211D] border border-[#E2ECE6] dark:border-[#28322C] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#16A66A]/10 text-[#16A66A] flex items-center justify-center text-lg shrink-0">
              {icon || '💰'}
            </div>
            <div>
              <h2 id="reserve-modal-title" className="text-base sm:text-lg font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
                {isEditing ? 'Editar Reserva' : 'Nova Reserva'}
              </h2>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Separe dinheiro para finalidades específicas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
            
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Informational banner about accounting rule */}
            <div className="p-3 rounded-xl bg-[#E8F2EC] dark:bg-[#202E26] border border-[#C5DED0] dark:border-[#2C4236] text-[#02402E] dark:text-[#78D9A6] text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Regra contábil do Poupagaio:
              </p>
              <p className="text-[11px] text-[#425C4F] dark:text-[#9ECBB2]">
                Criar uma reserva <strong>não é despesa nem receita</strong>. É apenas uma divisão interna do seu saldo total para controle consciente.
              </p>
            </div>

            {/* Nome da Reserva */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Nome da Reserva *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Combustível, Mercado, Contas da Casa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
              />
            </div>

            {/* Valor e Competência Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Valor Reservado (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0,00"
                  value={allocatedAmount}
                  onChange={(e) => setAllocatedAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                  Competência
                </label>
                <div className="px-3.5 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-[#F4F7F5] dark:bg-[#1C221F] text-[#02402E] dark:text-[#78D9A6] font-semibold text-xs sm:text-sm">
                  {cycleLabel}
                </div>
              </div>
            </div>

            {/* Categoria vinculada */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Categoria Vinculada (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Combustível, Alimentação, Moradia"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
              />
              <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                Despesas dessa categoria sugerirão esta reserva automaticamente ao dar baixa.
              </p>
            </div>

            {/* Ícone e Cor Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Ícone Visual
              </label>
              <div className="flex flex-wrap gap-2">
                {RESERVE_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-transform cursor-pointer ${
                      icon === emoji
                        ? 'bg-[#16A66A]/20 ring-2 ring-[#16A66A] scale-110'
                        : 'bg-[#F4F7F5] dark:bg-[#202723] hover:scale-105'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Opções Avançadas (Renovação & Preferencial) */}
            <div className="space-y-2 pt-2 border-t border-[#E2ECE6] dark:border-[#28322C]">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F7FAF8] dark:bg-[#1C2420] border border-[#E2ECE6] dark:border-[#28322C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={renewMonthly}
                  onChange={(e) => setRenewMonthly(e.target.checked)}
                  className="w-4 h-4 text-[#16A66A] accent-[#16A66A]"
                />
                <div>
                  <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">Renovar mensalmente</p>
                  <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                    Planeja esta mesma reserva para os próximos meses automaticamente.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F7FAF8] dark:bg-[#1C2420] border border-[#E2ECE6] dark:border-[#28322C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPreferred}
                  onChange={(e) => setIsPreferred(e.target.checked)}
                  className="w-4 h-4 text-[#16A66A] accent-[#16A66A]"
                />
                <div>
                  <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">Reserva preferencial desta categoria</p>
                  <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                    Acelera o lançamento de gastos sugerindo esta origem em primeiro lugar.
                  </p>
                </div>
              </label>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                Observações (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Detalhes ou metas para esta caixinha..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#161B18] text-[#202724] dark:text-[#F4F4F5] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
              />
            </div>

          </div>

          {/* Footer (Mobile First responsive) */}
          <div className="p-4 sm:p-5 border-t border-[#E2ECE6] dark:border-[#28322C] bg-[#F7FAF8] dark:bg-[#1C2420] flex flex-col sm:flex-row gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B] font-bold text-xs sm:text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-[#02402E] dark:bg-[#16A66A] hover:bg-[#16A66A] dark:hover:bg-[#02402E] text-white dark:text-[#101614] font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Criar Reserva'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
