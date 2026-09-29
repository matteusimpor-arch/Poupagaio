import React, { useState, useEffect } from 'react';
import { PiggyBank, Plus, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';
import { Reserve, ReservesSummary, ActiveTab } from '../../types';
import { reservesService, emptyReservesSummary } from '../../lib/services/reserves';
import { formatCurrency } from '../../lib/formatters';

interface DashboardReservesSectionProps {
  spaceId: string;
  selectedYear: number;
  selectedMonth: number;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenCreateReserve?: () => void;
}

export function DashboardReservesSection({
  spaceId,
  selectedYear,
  selectedMonth,
  onSelectTab,
  onOpenCreateReserve,
}: DashboardReservesSectionProps) {
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [summary, setSummary] = useState<ReservesSummary>(emptyReservesSummary);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (spaceId) {
      setIsLoading(true);
      reservesService.getReservesWithSummary(spaceId, selectedYear, selectedMonth).then((res) => {
        setReserves(res.reserves);
        setSummary(res.summary);
        setIsLoading(false);
      });
    }
  }, [spaceId, selectedYear, selectedMonth]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-xs animate-pulse">
        <div className="h-5 w-36 bg-[#E2ECE6] dark:bg-[#28322C] rounded-md mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-[#F4F7F5] dark:bg-[#202723] rounded-xl" />
          <div className="h-12 bg-[#F4F7F5] dark:bg-[#202723] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <section className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-xs space-y-3.5">
      {/* Header da Seção */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#16A66A]/10 text-[#16A66A] flex items-center justify-center shrink-0">
            <PiggyBank className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#02402E] dark:text-[#78D9A6] font-display">
              Minhas Reservas
            </h3>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              {formatCurrency(summary.totalReserved)} guardados em {reserves.length} {reserves.length === 1 ? 'caixinha' : 'caixinhas'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('reserves')}
          className="text-xs font-bold text-[#16A66A] hover:text-[#02402E] dark:hover:text-[#78D9A6] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver todas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista Compacta de Reservas */}
      {reserves.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
            Você ainda não criou reservas financeiras para este mês.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reserves.slice(0, 4).map((res) => {
            const currentBal = Number(res.current_balance) || 0;
            const allocated = Number(res.allocated_amount) || 0;
            const percentage = allocated > 0 ? Math.min(100, Math.round((currentBal / allocated) * 100)) : 0;

            return (
              <div
                key={res.id}
                onClick={() => onSelectTab('reserves')}
                className="p-3 rounded-2xl bg-[#F7FAF8] dark:bg-[#202723] border border-[#E2ECE6] dark:border-[#28322C] hover:border-[#16A66A]/40 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{res.icon || '💰'}</span>
                    <span className="font-bold text-[#02402E] dark:text-[#78D9A6] truncate">
                      {res.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-[#02402E] dark:text-[#78D9A6]">
                      {formatCurrency(currentBal)}
                    </span>
                    <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                      {' '}/ {formatCurrency(allocated)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-0.5">
                  <div className="w-full h-1.5 rounded-full bg-[#E2ECE6] dark:bg-[#28322C] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor:
                          percentage > 50 ? '#16A66A' : percentage > 20 ? '#F59E0B' : '#E11D48',
                      }}
                    />
                  </div>
                  <div className="flex justify-end text-[9px] text-[#5E6963] dark:text-[#95A39B] font-semibold">
                    <span>{percentage}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botões do Rodapé do Card */}
      <div className="pt-2 border-t border-[#E2ECE6] dark:border-[#28322C] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectTab('reserves')}
          className="flex-1 py-2 px-3 rounded-xl bg-[#16A66A]/10 hover:bg-[#16A66A]/20 text-[#16A66A] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Criar Reserva</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('reserves')}
          className="flex-1 py-2 px-3 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Gerenciar Todas</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
}
