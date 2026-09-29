import React from 'react';
import { GoalWithProgress } from '../../types';
import { formatCurrency, formatDateBR } from '../../lib/formatters';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  ShieldCheck,
  Plane,
  Home,
  Car,
  GraduationCap,
  Laptop,
  Wrench,
  Sun,
  Target,
  Plus,
  History,
  Pencil,
  Trash2,
  Calendar,
  Sparkles,
  CheckCircle2,
  PauseCircle,
  Clock,
} from 'lucide-react';

interface GoalCardProps {
  key?: React.Key;
  goal: GoalWithProgress;
  onOpenContribution: (goal: GoalWithProgress) => void;
  onOpenHistory: (goal: GoalWithProgress) => void;
  onEdit: (goal: GoalWithProgress) => void;
  onDelete: (goal: GoalWithProgress) => void;
}

export function GoalCard({
  goal,
  onOpenContribution,
  onOpenHistory,
  onEdit,
  onDelete,
}: GoalCardProps) {
  // Ícone contextual por categoria
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Reserva de emergência':
        return <ShieldCheck className="w-3.5 h-3.5" />;
      case 'Viagem':
        return <Plane className="w-3.5 h-3.5" />;
      case 'Imóvel':
        return <Home className="w-3.5 h-3.5" />;
      case 'Veículo':
        return <Car className="w-3.5 h-3.5" />;
      case 'Educação':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'Tecnologia':
        return <Laptop className="w-3.5 h-3.5" />;
      case 'Reforma':
        return <Wrench className="w-3.5 h-3.5" />;
      case 'Aposentadoria':
        return <Sun className="w-3.5 h-3.5" />;
      default:
        return <Target className="w-3.5 h-3.5" />;
    }
  };

  // Status badge config
  const getStatusBadge = () => {
    if (goal.isTargetReached || goal.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          <span>Concluída</span>
        </span>
      );
    }
    if (goal.status === 'paused') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <PauseCircle className="w-3 h-3" />
          <span>Pausada</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] border border-[#16A66A]/30">
        <Clock className="w-3 h-3" />
        <span>Em andamento</span>
      </span>
    );
  };

  // Cálculo de prazo / dias restantes
  const getDeadlineText = () => {
    if (!goal.target_date) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(goal.target_date + 'T00:00:00');
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        formatted: formatDateBR(goal.target_date),
        label: `Prazo encerrado (${Math.abs(diffDays)}d atrás)`,
        isPast: true,
      };
    }
    if (diffDays === 0) {
      return {
        formatted: formatDateBR(goal.target_date),
        label: 'Vence hoje',
        isPast: false,
      };
    }
    if (diffDays <= 30) {
      return {
        formatted: formatDateBR(goal.target_date),
        label: `em ${diffDays} dias`,
        isPast: false,
      };
    }
    const diffMonths = Math.round(diffDays / 30);
    return {
      formatted: formatDateBR(goal.target_date),
      label: `em ~${diffMonths} meses`,
      isPast: false,
    };
  };

  const deadline = getDeadlineText();
  const clampedProgress = Math.min(100, Math.max(0, goal.progressPercentage));

  return (
    <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Top Bar: Categoria + Status */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F3F4F4] text-[#5E6963] dark:bg-[#232725] dark:text-[#95A39B]">
              {getCategoryIcon(goal.category)}
              <span>{goal.category}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {getStatusBadge()}
            </div>
          </div>

          {/* Goal Name & Deadline */}
          <div className="space-y-1">
            <h4 className="text-base font-bold font-display text-[#202724] dark:text-[#F4F4F5] line-clamp-1">
              {goal.name}
            </h4>

            {deadline && (
              <div className="flex items-center gap-1.5 text-xs text-[#5E6963] dark:text-[#95A39B]">
                <Calendar className="w-3.5 h-3.5 text-[#5E6963]/80" />
                <span>
                  Prazo: <strong>{deadline.formatted}</strong> ({deadline.label})
                </span>
              </div>
            )}

            {goal.notes && (
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B] line-clamp-2 pt-0.5">
                {goal.notes}
              </p>
            )}
          </div>

          {/* Values Section */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs text-[#5E6963] dark:text-[#95A39B] block">
                  Acumulado
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg sm:text-xl font-extrabold font-display text-[#075C45] dark:text-[#78D9A6]">
                    {formatCurrency(goal.accumulatedAmount)}
                  </span>
                  <span className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                    de {formatCurrency(goal.target_amount)}
                  </span>
                </div>
              </div>

              {/* Percentual */}
              <div className="text-right shrink-0">
                <span className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                  {goal.progressPercentage.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Visual Progress Bar (Clamped strictly to 100%) */}
            <div className="w-full bg-[#EBECEE] dark:bg-[#2A302D] h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  goal.isTargetReached
                    ? 'bg-emerald-500'
                    : goal.status === 'paused'
                    ? 'bg-amber-500'
                    : 'bg-[#16A66A]'
                }`}
                style={{ width: `${clampedProgress}%` }}
              />
            </div>

            {/* Remaining / Target Reached Banner */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              {goal.isTargetReached ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Objetivo alcançado! 🎉</span>
                </span>
              ) : (
                <span className="text-[#5E6963] dark:text-[#95A39B]">
                  Faltam <strong>{formatCurrency(goal.remainingAmount)}</strong>
                </span>
              )}

              <span className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                {goal.contributionsCount} {goal.contributionsCount === 1 ? 'aporte' : 'aportes'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#E2E8E4] dark:border-[#2E3532] flex items-center justify-between gap-2">
          {/* Main Action: Aportar */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => onOpenContribution(goal)}
              className="gap-1 text-xs font-semibold cursor-pointer py-1 px-3 h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Aportar</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenHistory(goal)}
              className="gap-1 text-xs cursor-pointer py-1 px-2.5 h-8 text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F4F4F5]"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>
          </div>

          {/* Auxiliary Actions: Edit / Delete */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(goal)}
              title="Editar meta"
              className="p-1.5 rounded-lg text-[#5E6963] hover:text-[#202724] hover:bg-black/5 dark:text-[#95A39B] dark:hover:text-[#F4F4F5] dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(goal)}
              title="Excluir meta"
              className="p-1.5 rounded-lg text-[#5E6963] hover:text-rose-600 hover:bg-rose-50 dark:text-[#95A39B] dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
