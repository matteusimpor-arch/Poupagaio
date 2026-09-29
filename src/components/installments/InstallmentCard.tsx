import React, { useState } from 'react';
import { InstallmentPurchaseWithInstallments, InstallmentWithStatus } from '../../types';
import { formatCurrency, formatDateBR } from '../../lib/formatters';
import { Button } from '../ui/button';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  RotateCcw,
  CreditCard,
  Calendar,
  Sparkles,
  ShoppingBag,
  Home,
  Laptop,
  Car,
  GraduationCap,
  HeartPulse,
  Plane,
  Layers,
} from 'lucide-react';

export interface InstallmentCardProps {
  key?: React.Key;
  purchase: InstallmentPurchaseWithInstallments;
  onEdit: (purchase: InstallmentPurchaseWithInstallments) => void;
  onDelete: (purchase: InstallmentPurchaseWithInstallments) => void;
  onMarkPaid: (installmentId: string) => Promise<void>;
  onUnmarkPaid: (installmentId: string) => Promise<void>;
}

export const InstallmentCard: React.FC<InstallmentCardProps> = ({
  purchase,
  onEdit,
  onDelete,
  onMarkPaid,
  onUnmarkPaid,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingInstallmentId, setLoadingInstallmentId] = useState<string | null>(null);
  const [installmentToUnmark, setInstallmentToUnmark] = useState<InstallmentWithStatus | null>(null);

  // Ícone por categoria
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Eletrônicos':
        return <Laptop className="w-4 h-4" />;
      case 'Casa':
        return <Home className="w-4 h-4" />;
      case 'Veículo':
        return <Car className="w-4 h-4" />;
      case 'Educação':
        return <GraduationCap className="w-4 h-4" />;
      case 'Saúde':
        return <HeartPulse className="w-4 h-4" />;
      case 'Viagem':
        return <Plane className="w-4 h-4" />;
      case 'Compras':
        return <ShoppingBag className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const handleTogglePayment = async (installment: InstallmentWithStatus) => {
    setLoadingInstallmentId(installment.id);
    try {
      if (installment.status === 'paid') {
        // Pede confirmação para desfazer pagamento
        setInstallmentToUnmark(installment);
      } else {
        await onMarkPaid(installment.id);
      }
    } finally {
      setLoadingInstallmentId(null);
    }
  };

  const confirmUnmarkPayment = async () => {
    if (!installmentToUnmark) return;
    setLoadingInstallmentId(installmentToUnmark.id);
    try {
      await onUnmarkPaid(installmentToUnmark.id);
      setInstallmentToUnmark(null);
    } finally {
      setLoadingInstallmentId(null);
    }
  };

  const sampleAmount = purchase.installments[0]?.amount || purchase.total_amount / purchase.installment_count;

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-[#E2E8E4] dark:border-[#24312B] bg-white dark:bg-[#18211D] shadow-xs overflow-hidden transition-all duration-200 hover:border-[#16A66A]/30 w-full">
      {/* Cabeçalho da Compra */}
      <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4">
        <div className="flex items-start justify-between gap-2.5 sm:gap-3">
          {/* Informações Principais */}
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl sm:rounded-2xl bg-[#075C45]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center shrink-0 mt-0.5">
              {getCategoryIcon(purchase.category)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F7F4EA] truncate max-w-full">
                  {purchase.description}
                </h3>
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F7F4EA] dark:bg-[#101614] border border-[#E2E8E4] dark:border-[#24312B] text-[#5E6963] dark:text-[#95A39B] shrink-0">
                  {purchase.category}
                </span>
                {purchase.isFullyPaid && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Quitada
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B] mt-0.5 break-words">
                {purchase.installment_count}x de {formatCurrency(sampleAmount)} • Total:{' '}
                <span className="font-semibold text-[#202724] dark:text-[#F7F4EA]">
                  {formatCurrency(purchase.total_amount)}
                </span>
              </p>
            </div>
          </div>

          {/* Botões de Ação na Compra: Editar e Excluir */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(purchase)}
              title="Editar compra"
              aria-label={`Editar compra ${purchase.description}`}
              className="p-1.5 sm:p-2 rounded-xl border border-[#E2E8E4] dark:border-[#24312B] hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] hover:text-[#075C45] dark:hover:text-[#78D9A6] transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(purchase)}
              title="Excluir compra"
              aria-label={`Excluir compra ${purchase.description}`}
              className="p-1.5 sm:p-2 rounded-xl border border-[#E2E8E4] dark:border-[#24312B] hover:bg-rose-500/10 text-[#5E6963] dark:text-[#95A39B] hover:text-rose-600 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Barra de Progresso e Métricas */}
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[#5E6963] dark:text-[#95A39B]">
            <span className="font-medium">
              Progresso:{' '}
              <strong className="text-[#202724] dark:text-[#F7F4EA]">
                {purchase.paidCount} de {purchase.installment_count} pagas
              </strong>{' '}
              ({purchase.progressPercentage}%)
            </span>
            <span className="text-[11px] sm:text-xs">
              Pago: {formatCurrency(purchase.totalPaidAmount)} de {formatCurrency(purchase.total_amount)}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#F7F4EA] dark:bg-[#101614] overflow-hidden border border-[#E2E8E4] dark:border-[#24312B]">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                purchase.isFullyPaid ? 'bg-[#16A66A]' : 'bg-[#075C45] dark:bg-[#78D9A6]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, purchase.progressPercentage))}%` }}
            />
          </div>
        </div>

        {/* Observações se existirem */}
        {purchase.notes && (
          <p className="text-xs italic text-[#5E6963] dark:text-[#95A39B] bg-[#F7F4EA]/50 dark:bg-[#121915] p-2 rounded-xl border border-[#E2E8E4] dark:border-[#24312B] break-words">
            &ldquo;{purchase.notes}&rdquo;
          </p>
        )}

        {/* Botão de Expansão das Parcelas */}
        <div className="pt-2 border-t border-[#E2E8E4] dark:border-[#24312B] flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            Primeiro vencimento: {formatDateBR(purchase.first_due_date)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-[#075C45] dark:text-[#78D9A6] hover:bg-[#075C45]/10 rounded-xl gap-1.5 cursor-pointer px-2.5 h-8"
          >
            {isExpanded ? (
              <>
                <span>Recolher parcelas</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Ver {purchase.installment_count} parcelas</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Lista Detalhada de Parcelas (quando expandido) */}
      {isExpanded && (
        <div className="bg-[#F7F4EA]/40 dark:bg-[#121915]/50 border-t border-[#E2E8E4] dark:border-[#24312B] p-3 sm:p-5 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] pb-0.5">
            Parcelas Detalhadas
          </h4>

          <div className="divide-y divide-[#E2E8E4] dark:divide-[#24312B] rounded-xl sm:rounded-2xl border border-[#E2E8E4] dark:border-[#24312B] bg-white dark:bg-[#18211D] overflow-hidden">
            {purchase.installments.map((inst) => {
              const isLoading = loadingInstallmentId === inst.id;
              return (
                <div
                  key={inst.id}
                  className="p-3 sm:p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  {/* Linha superior no mobile / Grupo esquerdo no desktop */}
                  <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#F7F4EA] dark:bg-[#101614] border border-[#E2E8E4] dark:border-[#24312B] text-[#202724] dark:text-[#F7F4EA] shrink-0">
                        {inst.installment_number}/{purchase.installment_count}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#202724] dark:text-[#F7F4EA] truncate">
                          Vencimento: {formatDateBR(inst.due_date)}
                        </div>
                        {inst.paid_at && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                            Pago em {formatDateBR(inst.paid_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badge de Status no mobile (canto superior direito) */}
                    <div className="sm:hidden shrink-0">
                      {inst.computedStatus === 'paid' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Pago
                        </span>
                      )}
                      {inst.computedStatus === 'upcoming' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                          <Clock className="w-3 h-3" />
                          Próximo
                        </span>
                      )}
                      {inst.computedStatus === 'overdue' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3" />
                          Atrasado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Linha inferior no mobile / Grupo direito no desktop */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-[#E2E8E4]/60 dark:border-[#24312B]/60">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B] sm:hidden">Valor:</span>
                      <span className="text-sm font-extrabold font-display text-[#202724] dark:text-[#F7F4EA]">
                        {formatCurrency(inst.amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Badge de Status no desktop */}
                      <div className="hidden sm:block">
                        {inst.computedStatus === 'paid' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Pago
                          </span>
                        )}
                        {inst.computedStatus === 'upcoming' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                            <Clock className="w-3 h-3" />
                            Próximo
                          </span>
                        )}
                        {inst.computedStatus === 'overdue' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                            <AlertCircle className="w-3 h-3" />
                            Atrasado
                          </span>
                        )}
                      </div>

                      {/* Botão de Marcar / Desmarcar */}
                      {inst.status === 'paid' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleTogglePayment(inst)}
                          title="Desfazer pagamento da parcela"
                          className="text-xs h-8 px-2.5 rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Desfazer
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleTogglePayment(inst)}
                          className="text-xs h-8 px-3 rounded-xl bg-[#075C45] hover:bg-[#075C45]/90 dark:bg-[#16A66A] dark:hover:bg-[#16A66A]/90 text-white font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Marcar pago
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de confirmação para Desfazer Pagamento */}
      {installmentToUnmark && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
                Desfazer Pagamento?
              </h4>
            </div>
            <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
              Deseja reabrir a parcela{' '}
              <strong>
                {installmentToUnmark.installment_number}/{purchase.installment_count}
              </strong>{' '}
              no valor de <strong>{formatCurrency(installmentToUnmark.amount)}</strong>? Ela voltará para o status
              pendente.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInstallmentToUnmark(null)}
                className="rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmUnmarkPayment}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
              >
                Sim, desfazer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
