import React from 'react';
import { WishlistItem, WishlistPriority, WishlistStatus } from '../../types';
import { formatCurrency, formatDateBR } from '../../lib/formatters';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  Gift,
  Laptop,
  Tv,
  Home,
  Plane,
  GraduationCap,
  Shirt,
  Sparkles,
  Car,
  HeartPulse,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Archive,
  RotateCcw,
} from 'lucide-react';

interface WishlistCardProps {
  key?: React.Key;
  item: WishlistItem;
  onEdit: (item: WishlistItem) => void;
  onUpdateStatus: (item: WishlistItem, newStatus: WishlistStatus) => void;
  onDelete: (item: WishlistItem) => void;
}

export function WishlistCard({
  item,
  onEdit,
  onUpdateStatus,
  onDelete,
}: WishlistCardProps) {
  // Ícone contextual sutil por categoria
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Tecnologia':
        return <Laptop className="w-3.5 h-3.5" />;
      case 'Eletrônicos':
        return <Tv className="w-3.5 h-3.5" />;
      case 'Casa & Móveis':
        return <Home className="w-3.5 h-3.5" />;
      case 'Viagem':
        return <Plane className="w-3.5 h-3.5" />;
      case 'Educação':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'Vestuário':
        return <Shirt className="w-3.5 h-3.5" />;
      case 'Lazer & Hobbies':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'Veículo':
        return <Car className="w-3.5 h-3.5" />;
      case 'Saúde & Bem-estar':
        return <HeartPulse className="w-3.5 h-3.5" />;
      default:
        return <Gift className="w-3.5 h-3.5" />;
    }
  };

  // Badge discreto de prioridade
  const getPriorityBadge = (priority: WishlistPriority) => {
    switch (priority) {
      case 'high':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            Alta
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Média
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-50 text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            Baixa
          </span>
        );
    }
  };

  // Badge de status
  const getStatusBadge = (status: WishlistStatus) => {
    switch (status) {
      case 'purchased':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>Comprado</span>
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
            <Archive className="w-3 h-3" />
            <span>Arquivado</span>
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#22C55E]/10 text-[#16A34A] dark:text-[#22C55E] border border-[#22C55E]/20">
            Ativo
          </span>
        );
    }
  };

  return (
    <Card
      id={`wishlist-card-${item.id}`}
      className={`border rounded-xl transition-all duration-200 bg-white dark:bg-[#1E2220] ${
        item.status === 'purchased'
          ? 'border-emerald-200 dark:border-emerald-900/40 opacity-90'
          : item.status === 'archived'
          ? 'border-zinc-200 dark:border-zinc-800 opacity-75'
          : 'border-[#E2E8E4] dark:border-[#2E3532] hover:border-[#16A34A]/40'
      }`}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3.5">
        {/* Cabeçalho do Card */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300">
                {getCategoryIcon(item.category)}
                <span>{item.category}</span>
              </span>
              {getPriorityBadge(item.priority)}
            </div>
            <div>{getStatusBadge(item.status)}</div>
          </div>

          <div className="pt-0.5">
            <h3 className="font-semibold text-base text-[#181B1A] dark:text-white line-clamp-1">
              {item.name}
            </h3>
            {item.notes && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                {item.notes}
              </p>
            )}
          </div>
        </div>

        {/* Informações centrais: Valor Estimado e Data Desejada */}
        <div className="py-1 border-t border-b border-zinc-100 dark:border-zinc-800/80 flex items-baseline justify-between gap-2">
          <div>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block font-medium">
              Valor estimado
            </span>
            <span className="text-lg font-bold text-[#181B1A] dark:text-white">
              {formatCurrency(item.estimated_amount)}
            </span>
          </div>

          {item.desired_date ? (
            <div className="text-right">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block font-medium">
                Data desejada
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                <Calendar className="w-3 h-3 text-zinc-400" />
                {formatDateBR(item.desired_date)}
              </span>
            </div>
          ) : (
            <div className="text-right">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                Sem data definida
              </span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações Compactas */}
        <div className="pt-1 flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            {/* Se ativo: permitir marcar como comprado ou arquivar */}
            {item.status === 'active' && (
              <>
                <Button
                  id={`btn-buy-wishlist-${item.id}`}
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateStatus(item, 'purchased')}
                  className="h-7 px-2.5 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  title="Marcar como comprado"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Comprado
                </Button>
                <Button
                  id={`btn-archive-wishlist-${item.id}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateStatus(item, 'archived')}
                  className="h-7 px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="Arquivar desejo"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" />
                  Arquivar
                </Button>
              </>
            )}

            {/* Se comprado ou arquivado: permitir reativar */}
            {(item.status === 'purchased' || item.status === 'archived') && (
              <Button
                id={`btn-reactivate-wishlist-${item.id}`}
                variant="outline"
                size="sm"
                onClick={() => onUpdateStatus(item, 'active')}
                className="h-7 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="Reativar desejo"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reativar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-0.5 ml-auto">
            <Button
              id={`btn-edit-wishlist-${item.id}`}
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item)}
              className="h-7 w-7 p-0 text-zinc-500 hover:text-[#181B1A] dark:hover:text-white"
              title="Editar desejo"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              id={`btn-delete-wishlist-${item.id}`}
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item)}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
              title="Excluir desejo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
