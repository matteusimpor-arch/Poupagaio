import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  GoalWithProgress,
  GoalsSummary,
  CreateGoalInput,
  UpdateGoalInput,
  CreateGoalContributionInput,
  Reserve,
  ReservesSummary,
} from '../../types';
import { goalsService, emptyGoalsSummary } from '../../lib/services/goals';
import { reservesService, emptyReservesSummary } from '../../lib/services/reserves';
import { formatCurrency } from '../../lib/formatters';
import { GoalCard } from './GoalCard';
import { GoalModal } from './GoalModal';
import { ContributionModal } from './ContributionModal';
import { GoalHistoryModal } from './GoalHistoryModal';
import { DeleteGoalConfirmModal } from './DeleteGoalConfirmModal';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { GOALS_MIGRATION_SQL } from '../../lib/goals-sql';
import {
  Target,
  Plus,
  TrendingUp,
  Coins,
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertCircle,
  Database,
  Copy,
  Check,
  Flag,
} from 'lucide-react';

export function GoalsScreen() {
  const { currentSpace } = useAuth();

  // Filtro de status: all | active | completed | paused
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');

  // Dados
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [summary, setSummary] = useState<GoalsSummary>(emptyGoalsSummary);
  const [reservesSummary, setReservesSummary] = useState<ReservesSummary>(emptyReservesSummary);
  const [activeReserves, setActiveReserves] = useState<Reserve[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [userFriendlyError, setUserFriendlyError] = useState<string | null>(null);

  // Modais
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<GoalWithProgress | null>(null);

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [goalForContribution, setGoalForContribution] = useState<GoalWithProgress | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [goalForHistory, setGoalForHistory] = useState<GoalWithProgress | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<GoalWithProgress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copiar SQL caso tabela não exista
  const [copiedSql, setCopiedSql] = useState(false);

  // Carregar dados de metas e reservas
  const loadGoalsData = useCallback(async () => {
    if (!currentSpace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setUserFriendlyError(null);

    try {
      const now = new Date();
      const [res, reservesRes] = await Promise.all([
        goalsService.getGoalsWithProgress(currentSpace.id, {
          filterStatus: statusFilter,
        }),
        reservesService.getReservesWithSummary(
          currentSpace.id,
          now.getFullYear(),
          now.getMonth() + 1
        ),
      ]);

      if (reservesRes.reserves) {
        setActiveReserves(reservesRes.reserves);
        setReservesSummary(reservesRes.summary);
      }

      if (res.isTableMissing) {
        setIsTableMissing(true);
        setGoals([]);
        setSummary(emptyGoalsSummary);
      } else if (res.error) {
        setUserFriendlyError(res.error);
      } else {
        setIsTableMissing(false);
        setGoals(res.goals);
        setSummary(res.summary);

        // Se o modal de histórico estiver aberto para uma meta, atualiza a referência dela
        if (goalForHistory) {
          const updatedHistoryGoal = res.goals.find((g) => g.id === goalForHistory.id);
          if (updatedHistoryGoal) {
            setGoalForHistory(updatedHistoryGoal);
          }
        }
      }
    } catch {
      setUserFriendlyError('Não foi possível carregar as metas no momento.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, statusFilter, goalForHistory?.id]);

  useEffect(() => {
    loadGoalsData();
  }, [loadGoalsData]);

  // Salvar Meta (Criar ou Atualizar)
  const handleSaveGoal = async (
    input: CreateGoalInput | UpdateGoalInput
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentSpace?.id) return { success: false, error: 'Espaço não selecionado.' };

    if (goalToEdit) {
      const res = await goalsService.updateGoal(goalToEdit.id, currentSpace.id, input);
      if (res.success) {
        await loadGoalsData();
        return { success: true };
      }
      return { success: false, error: res.error };
    } else {
      const res = await goalsService.createGoal(input as CreateGoalInput);
      if (res.success) {
        await loadGoalsData();
        return { success: true };
      }
      return { success: false, error: res.error };
    }
  };

  // Registrar Aporte
  const handleSaveContribution = async (
    input: CreateGoalContributionInput
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await goalsService.addContribution(input);
    if (res.success) {
      await loadGoalsData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Excluir / Estornar Aporte
  const handleDeleteContribution = async (
    contributionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentSpace?.id) return { success: false, error: 'Espaço não selecionado.' };

    const res = await goalsService.deleteContribution(contributionId, currentSpace.id);
    if (res.success) {
      await loadGoalsData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Excluir Meta
  const handleConfirmDeleteGoal = async () => {
    if (!goalToDelete || !currentSpace?.id) return;

    setIsDeleting(true);
    try {
      const res = await goalsService.deleteGoal(goalToDelete.id, currentSpace.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        setGoalToDelete(null);
        await loadGoalsData();
      } else {
        setUserFriendlyError(res.error || 'Erro ao excluir meta.');
      }
    } catch {
      setUserFriendlyError('Falha ao excluir a meta selecionada.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copiar SQL de migration
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(GOALS_MIGRATION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      {/* 1. Header com Título e Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E2E8E4] dark:border-[#2E3532]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5] tracking-tight">
              Metas
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
            Transforme seus planos em conquistas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setGoalToEdit(null);
              setIsGoalModalOpen(true);
            }}
            className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-3.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nova meta</span>
          </Button>
        </div>
      </div>

      {/* 2. Aviso de Tabela Não Criada no Supabase (se aplicável) */}
      {isTableMissing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-4 h-4" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 font-display">
                Tabelas de Metas e Aportes aguardando criação no Supabase
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                O arquivo de migração <code className="px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/60 font-mono text-[11px]">20260918_create_goals.sql</code> foi preparado. Execute o script no SQL Editor do seu Supabase para ativar o módulo completo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopySql}
              className="gap-1.5 text-xs cursor-pointer border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'SQL copiado!' : 'Copiar SQL de migração'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadGoalsData}
              className="text-xs cursor-pointer"
            >
              Recarregar após executar
            </Button>
          </div>
        </div>
      )}

      {/* Erro amigável */}
      {userFriendlyError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{userFriendlyError}</span>
        </div>
      )}

      {/* 3. Cards de Resumo Global com Dados Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total das Metas */}
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B]">
                Total das metas
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#F3F4F4] dark:bg-[#232725] text-[#5E6963] dark:text-[#95A39B] flex items-center justify-center">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5] truncate">
              {isLoading ? <Skeleton className="h-7 w-28" /> : formatCurrency(summary.totalTarget)}
            </div>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              {summary.goalsCount} {summary.goalsCount === 1 ? 'objetivo cadastrado' : 'objetivos cadastrados'}
            </p>
          </CardContent>
        </Card>

        {/* Valor Acumulado */}
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B]">
                Valor acumulado
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center">
                <Coins className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-display text-[#075C45] dark:text-[#78D9A6] truncate">
              {isLoading ? <Skeleton className="h-7 w-28" /> : formatCurrency(summary.totalAccumulated)}
            </div>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              Soma de todos os aportes realizados
            </p>
          </CardContent>
        </Card>

        {/* Falta Alcançar */}
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B]">
                Falta alcançar
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#F3F4F4] dark:bg-[#232725] text-[#5E6963] dark:text-[#95A39B] flex items-center justify-center">
                <Flag className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-display text-[#202724] dark:text-[#F4F4F5] truncate">
              {isLoading ? <Skeleton className="h-7 w-28" /> : formatCurrency(summary.totalRemaining)}
            </div>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              {summary.completedCount} {summary.completedCount === 1 ? 'meta concluída' : 'metas concluídas'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Filtro de Status */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            statusFilter === 'all'
              ? 'bg-[#075C45] text-white dark:bg-[#16A66A] dark:text-[#101614]'
              : 'bg-white dark:bg-[#232725] text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E2E8E4] dark:border-[#2E3532]'
          }`}
        >
          Todas ({summary.goalsCount})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            statusFilter === 'active'
              ? 'bg-[#075C45] text-white dark:bg-[#16A66A] dark:text-[#101614]'
              : 'bg-white dark:bg-[#232725] text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E2E8E4] dark:border-[#2E3532]'
          }`}
        >
          Em andamento ({summary.activeCount})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('completed')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            statusFilter === 'completed'
              ? 'bg-[#075C45] text-white dark:bg-[#16A66A] dark:text-[#101614]'
              : 'bg-white dark:bg-[#232725] text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E2E8E4] dark:border-[#2E3532]'
          }`}
        >
          Concluídas ({summary.completedCount})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('paused')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            statusFilter === 'paused'
              ? 'bg-[#075C45] text-white dark:bg-[#16A66A] dark:text-[#101614]'
              : 'bg-white dark:bg-[#232725] text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E2E8E4] dark:border-[#2E3532]'
          }`}
        >
          Pausadas ({summary.pausedCount})
        </button>
      </div>

      {/* 5. Lista de Metas / Estado Vazio / Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : goals.length === 0 ? (
        /* Estado Vazio Elegante com Mascote Poupagaio */
        <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] shadow-xs">
          <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-[#16A66A]/30 bg-[#F3F4F4] dark:bg-[#232725] p-1.5 shadow-md">
              <img
                src={POUPAGAIO_MASCOT_URL}
                alt="Poupagaio Mascot"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                {statusFilter === 'all'
                  ? 'Você ainda não criou nenhuma meta.'
                  : 'Nenhuma meta encontrada neste filtro.'}
              </h3>
              <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
                {statusFilter === 'all'
                  ? 'Crie um objetivo e acompanhe seu progresso aos poucos.'
                  : 'Tente alternar para "Todas" para visualizar seus outros objetivos.'}
              </p>
            </div>
            {statusFilter === 'all' && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setGoalToEdit(null);
                  setIsGoalModalOpen(true);
                }}
                className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-4 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Criar primeira meta</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Grid de Cards de Metas */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onOpenContribution={(g) => {
                setGoalForContribution(g);
                setIsContributionModalOpen(true);
              }}
              onOpenHistory={(g) => {
                setGoalForHistory(g);
                setIsHistoryModalOpen(true);
              }}
              onEdit={(g) => {
                setGoalToEdit(g);
                setIsGoalModalOpen(true);
              }}
              onDelete={(g) => {
                setGoalToDelete(g);
                setIsDeleteModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* 6. Modais de Ação */}
      {/* Modal Nova / Editar Meta */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => {
          setIsGoalModalOpen(false);
          setGoalToEdit(null);
        }}
        onSave={handleSaveGoal}
        goalToEdit={goalToEdit}
        spaceId={currentSpace?.id || ''}
      />

      {/* Modal Aporte com Seleção de Origem e Saldo Disponível */}
      <ContributionModal
        isOpen={isContributionModalOpen}
        onClose={() => {
          setIsContributionModalOpen(false);
          setGoalForContribution(null);
        }}
        goal={goalForContribution}
        onSave={handleSaveContribution}
        freeBalance={reservesSummary.freeBalance}
        reserves={activeReserves}
      />

      {/* Modal Histórico de Aportes */}
      <GoalHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setGoalForHistory(null);
        }}
        goal={goalForHistory}
        onDeleteContribution={handleDeleteContribution}
        onOpenAddContribution={() => {
          if (goalForHistory) {
            setGoalForContribution(goalForHistory);
            setIsContributionModalOpen(true);
          }
        }}
      />

      {/* Modal Confirmação de Exclusão de Meta */}
      <DeleteGoalConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setGoalToDelete(null);
        }}
        goal={goalToDelete}
        onConfirm={handleConfirmDeleteGoal}
        isDeleting={isDeleting}
      />
    </div>
  );
}
