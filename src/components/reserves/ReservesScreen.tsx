import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  ArrowRightLeft,
  History,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Wallet,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Star,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Reserve, ReservesSummary, CreateReserveInput, UpdateReserveInput } from '../../types';
import { reservesService, emptyReservesSummary } from '../../lib/services/reserves';
import { RESERVES_MIGRATION_SQL } from '../../lib/reserves-sql';
import { formatCurrency, MONTH_NAMES } from '../../lib/formatters';
import { MonthPicker } from '../entries/MonthPicker';
import { ReserveModal } from './ReserveModal';
import { ReserveActionModal, ReserveActionType } from './ReserveActionModal';
import { ReserveHistoryModal } from './ReserveHistoryModal';
import { DeleteReserveModal } from './DeleteReserveModal';

interface ReservesScreenProps {
  selectedYear: number;
  selectedMonth: number;
  onMonthChange: (year: number, month: number) => void;
}

export function ReservesScreen({
  selectedYear,
  selectedMonth,
  onMonthChange,
}: ReservesScreenProps) {
  const { currentSpace, user } = useAuth();

  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [summary, setSummary] = useState<ReservesSummary>(emptyReservesSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingReserve, setEditingReserve] = useState<Reserve | null>(null);
  const [actionModalData, setActionModalData] = useState<{
    type: ReserveActionType;
    reserve: Reserve;
  } | null>(null);
  const [historyReserve, setHistoryReserve] = useState<Reserve | null>(null);
  const [deletingReserve, setDeletingReserve] = useState<Reserve | null>(null);

  // Copy SQL
  const [sqlCopied, setSqlCopied] = useState(false);

  // Load reserves
  const loadReservesData = useCallback(async () => {
    if (!currentSpace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await reservesService.getReservesWithSummary(
      currentSpace.id,
      selectedYear,
      selectedMonth
    );

    setIsTableMissing(res.isTableMissing);
    if (res.error && !res.isTableMissing) {
      setErrorMessage(res.error);
    } else {
      setReserves(res.reserves);
      setSummary(res.summary);
    }

    setIsLoading(false);
  }, [currentSpace?.id, selectedYear, selectedMonth]);

  useEffect(() => {
    loadReservesData();
  }, [loadReservesData]);

  useEffect(() => {
    if (feedbackMessage) {
      const t = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedbackMessage]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(RESERVES_MIGRATION_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 3000);
    } catch {
      setErrorMessage('Não foi possível copiar o SQL.');
    }
  };

  const handleSaveReserve = async (
    data: CreateReserveInput | UpdateReserveInput
  ): Promise<boolean> => {
    if (!currentSpace || !user) return false;

    if (editingReserve) {
      const res = await reservesService.updateReserve(editingReserve.id, data as UpdateReserveInput);
      if (res.error) {
        setErrorMessage(res.error);
        return false;
      }
      setFeedbackMessage(`Reserva "${res.reserve?.name}" atualizada com sucesso!`);
    } else {
      const res = await reservesService.createReserve(user.id, data as CreateReserveInput);
      if (res.error) {
        setErrorMessage(res.error);
        return false;
      }
      setFeedbackMessage(`Reserva "${res.reserve?.name}" criada com sucesso!`);
    }

    await loadReservesData();
    return true;
  };

  // Distinct categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    reserves.forEach((r) => {
      if (r.category?.trim()) set.add(r.category.trim());
    });
    return Array.from(set);
  }, [reserves]);

  // Filtered reserves
  const filteredReserves = useMemo(() => {
    return reserves.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchCat = r.category?.toLowerCase().includes(q) || false;
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [reserves, categoryFilter, searchQuery]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-4 animate-in fade-in duration-300">
      
      {/* 1. CABEÇALHO DO MÓDULO */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-xs">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#16A66A]/10 text-[#16A66A] flex items-center justify-center shrink-0 shadow-xs">
            <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F7F4EA] tracking-tight truncate">
                Minhas Reservas
              </h1>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-[#16A66A]/20 text-[#16A66A]">
                Caixinhas
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B] truncate sm:whitespace-normal">
              Separe seu saldo em finalidades específicas e pague despesas com clareza.
            </p>
          </div>
        </div>

        {/* Controles: Seletor de Mês e Botão Criar Reserva */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <MonthPicker
            year={selectedYear}
            month={selectedMonth}
            onChange={onMonthChange}
          />
          <button
            type="button"
            onClick={() => {
              setEditingReserve(null);
              setIsCreateModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#02402E] dark:bg-[#16A66A] text-white dark:text-[#101614] font-bold text-xs sm:text-sm hover:bg-[#16A66A] dark:hover:bg-[#02402E] transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Reserva</span>
          </button>
        </div>
      </header>

      {/* SQL Migration Notice if table is missing */}
      {isTableMissing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Tabelas de Reservas Prontas para Sincronização</span>
          </div>
          <p className="text-xs">
            Suas reservas estão funcionando normalmente via armazenamento seguro local. Para sincronizar em tempo real com o banco de dados Supabase, basta executar o script SQL.
          </p>
          <button
            type="button"
            onClick={handleCopySql}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            {sqlCopied ? 'SQL Copiado com Sucesso!' : 'Copiar Script SQL do Supabase'}
          </button>
        </div>
      )}

      {/* Feedback Messages */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. CARDS DE RESUMO FINANCEIRO (SALDO TOTAL, TOTAL RESERVADO, SALDO LIVRE) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Card 1: Saldo Total */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Dinheiro Disponível
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#02402E]/10 dark:bg-[#16A66A]/20 text-[#02402E] dark:text-[#78D9A6] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#02402E] dark:text-[#78D9A6]">
            {formatCurrency(summary.totalBalance)}
          </p>
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            Dinheiro efetivo disponível no mês
          </p>
        </div>

        {/* Card 2: Total Reservado */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Total Reservado
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {formatCurrency(summary.totalReserved)}
          </p>
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            Em {summary.count} {summary.count === 1 ? 'caixinha ativa' : 'caixinhas ativas'}
          </p>
        </div>

        {/* Card 3: Saldo Livre */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#16A66A]/10 to-[#02402E]/10 dark:from-[#16A66A]/20 dark:to-[#02402E]/20 border border-[#16A66A]/30 dark:border-[#16A66A]/40 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#02402E] dark:text-[#78D9A6]">
              Saldo Livre
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#16A66A] text-white flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#16A66A]">
            {formatCurrency(summary.freeBalance)}
          </p>
          <p className="text-[11px] text-[#02402E] dark:text-[#78D9A6] font-medium">
            Saldo Total menos Total Reservado
          </p>
        </div>

      </div>

      {/* 3. BARRA DE BUSCA E FILTROS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5E6963] dark:text-[#95A39B]" />
          <input
            type="text"
            placeholder="Buscar por nome ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#18211D] text-[#202724] dark:text-[#F4F4F5] text-xs focus:outline-none focus:ring-2 focus:ring-[#16A66A]"
          />
        </div>

        {categoriesList.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                  : 'bg-white dark:bg-[#18211D] border border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B]'
              }`}
            >
              Todas
            </button>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                    : 'bg-white dark:bg-[#18211D] border border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. GRID DE CARDS DAS RESERVAS (MOBILE FIRST) */}
      {isLoading ? (
        <div className="py-16 text-center text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
          Carregando reservas financeiras...
        </div>
      ) : filteredReserves.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] rounded-2xl sm:rounded-3xl shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#16A66A]/10 text-[#16A66A] flex items-center justify-center mx-auto">
            <PiggyBank className="w-6 h-6" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#02402E] dark:text-[#78D9A6] font-display">
            Nenhuma reserva encontrada
          </h3>
          <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B] max-w-md mx-auto">
            Separe parte do seu dinheiro para combustível, mercado, contas ou lazer e tenha total controle dos pagamentos.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingReserve(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16A66A] text-white font-bold text-xs sm:text-sm hover:bg-[#02402E] transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Primeira Reserva</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredReserves.map((res) => {
            const currentBal = Number(res.current_balance) || 0;
            const allocated = Number(res.allocated_amount) || 0;
            const percentage = allocated > 0 ? Math.min(100, Math.round((currentBal / allocated) * 100)) : 0;

            return (
              <div
                key={res.id}
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#18211D] border border-[#E2E8E4] dark:border-[#24312B] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#16A66A]/50 transition-all"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#F4F7F5] dark:bg-[#202723] text-xl flex items-center justify-center shrink-0 shadow-2xs">
                      {res.icon || '💰'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-[#02402E] dark:text-[#78D9A6] font-display truncate">
                          {res.name}
                        </h4>
                        {res.is_preferred && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold" title="Reserva preferencial">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Preferencial
                          </span>
                        )}
                      </div>
                      {res.category && (
                        <p className="text-xs text-[#5E6963] dark:text-[#95A39B] truncate">
                          Categoria: <span className="font-semibold">{res.category}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações de Edição e Exclusão */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setHistoryReserve(res)}
                      title="Ver Histórico / Extrato"
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] transition-colors cursor-pointer"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReserve(res);
                        setIsCreateModalOpen(true);
                      }}
                      title="Editar Reserva"
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingReserve(res)}
                      title="Excluir Reserva"
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Saldos e Barra de Progresso */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B] block">Disponível</span>
                      <p className="text-lg sm:text-xl font-extrabold text-[#02402E] dark:text-[#78D9A6] truncate">
                        {formatCurrency(currentBal)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B] block">Planejado</span>
                      <p className="text-xs sm:text-sm font-bold text-[#5E6963] dark:text-[#95A39B]">
                        de {formatCurrency(allocated)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-[#E2ECE6] dark:bg-[#28322C] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor:
                            percentage > 50 ? '#16A66A' : percentage > 20 ? '#F59E0B' : '#E11D48',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#5E6963] dark:text-[#95A39B] font-semibold">
                      <span>{percentage}% restante</span>
                      {res.renew_monthly && <span>Renova todo mês</span>}
                    </div>
                  </div>
                </div>

                {/* Botões de Ação da Caixinha (Mobile First Stack/Grid) */}
                <div className="pt-2 border-t border-[#E2ECE6] dark:border-[#28322C] grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionModalData({ type: 'deposit', reserve: res })}
                    className="py-2 px-2.5 rounded-xl bg-[#16A66A]/10 hover:bg-[#16A66A]/20 text-[#16A66A] font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionModalData({ type: 'withdraw', reserve: res })}
                    className="py-2 px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Retirar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionModalData({ type: 'transfer', reserve: res })}
                    className="py-2 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transferir</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {isCreateModalOpen && (
        <ReserveModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingReserve(null);
          }}
          spaceId={currentSpace?.id || ''}
          userId={user?.id || ''}
          reserve={editingReserve}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onSave={handleSaveReserve}
        />
      )}

      {actionModalData && (
        <ReserveActionModal
          isOpen={!!actionModalData}
          onClose={() => setActionModalData(null)}
          spaceId={currentSpace?.id || ''}
          userId={user?.id || ''}
          actionType={actionModalData.type}
          sourceReserve={actionModalData.reserve}
          allReserves={reserves}
          freeBalance={summary.freeBalance}
          onSuccess={() => {
            setFeedbackMessage('Operação realizada com sucesso!');
            loadReservesData();
          }}
        />
      )}

      {historyReserve && (
        <ReserveHistoryModal
          isOpen={!!historyReserve}
          onClose={() => setHistoryReserve(null)}
          reserve={historyReserve}
        />
      )}

      {deletingReserve && (
        <DeleteReserveModal
          isOpen={!!deletingReserve}
          onClose={() => setDeletingReserve(null)}
          spaceId={currentSpace?.id || ''}
          reserve={deletingReserve}
          onSuccess={() => {
            setFeedbackMessage(`Reserva "${deletingReserve.name}" excluída.`);
            loadReservesData();
          }}
        />
      )}

    </div>
  );
}
