import React from 'react';
import {
  ArrowUpRight,
  FileText,
  CreditCard,
  Calendar,
  ShoppingBag,
  Target,
  Gift,
  CalendarCheck,
  BarChart3,
} from 'lucide-react';
import { ActiveTab } from '../../types';

export interface QuickActionItem {
  id: ActiveTab;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

export const QUICK_ACTION_ITEMS: QuickActionItem[] = [
  {
    id: 'entries',
    label: 'Entradas',
    description: 'Receitas e ganhos',
    icon: ArrowUpRight,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  {
    id: 'fixed_expenses',
    label: 'Gastos Fixos',
    description: 'Contas recorrentes',
    icon: FileText,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
  },
  {
    id: 'variable_expenses',
    label: 'Gastos Variáveis',
    description: 'Despesas do dia a dia',
    icon: CreditCard,
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400',
  },
  {
    id: 'installments',
    label: 'Parcelados',
    description: 'Compras em parcelas',
    icon: Calendar,
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400',
  },
  {
    id: 'market',
    label: 'Mercado',
    description: 'Listas e compras',
    icon: ShoppingBag,
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400',
  },
  {
    id: 'goals',
    label: 'Metas',
    description: 'Objetivos financeiros',
    icon: Target,
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400',
  },
  {
    id: 'wishlist',
    label: 'Lista de Desejos',
    description: 'Sonhos de consumo',
    icon: Gift,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400',
  },
  {
    id: 'closing',
    label: 'Fechamento',
    description: 'Resumo da competência',
    icon: CalendarCheck,
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400',
  },
  {
    id: 'reports',
    label: 'Visão Financeira',
    description: 'Relatórios e análises',
    icon: BarChart3,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
];
