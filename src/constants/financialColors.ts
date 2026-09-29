/**
 * SISTEMA GLOBAL DE CORES SEMÂNTICAS — POUPAGAIO FINANCE
 * 
 * Fonte única da verdade para cores de categorias financeiras em toda a aplicação.
 * Qualquer representação da mesma categoria deve utilizar estas cores.
 * 
 * REGRAS OBRIGATÓRIAS:
 * - Entradas / Receitas: VERDE (#16A66A)
 * - Gastos Variáveis: VERMELHO (#E11D48)
 * - Gastos Fixos: ROXO (#8B5CF6)
 * - Parcelamentos: LARANJA (#F97316)
 * 
 * MÓDULOS ESPECÍFICOS:
 * - Mercado: Verde Institucional (#02402E)
 * - Metas: Azul Petróleo / Teal (#0D9488)
 * - Lista de Desejos: Rosa (#EC4899)
 * 
 * SITUAÇÕES / STATUS:
 * - Quitado / Recebido / Positivo: Verde (#16A66A)
 * - Próximo / Pendente: Âmbar/Amarelo (#F59E0B)
 * - Atrasado / Alerta: Vermelho (#EF4444)
 * - Linha de Saldo: Azul (#3B82F6)
 */

export const FINANCIAL_COLORS = {
  // 1. ENTRADAS / RECEITAS -> VERDE
  income: {
    primary: '#16A66A',
    hover: '#138A57',
    softLight: '#E8F5EE',
    softDark: '#0A2B1D',
    borderLight: '#B8E2CD',
    borderDark: '#134D35',
    textLight: '#075C45',
    textDark: '#78D9A6',
    iconBg: 'bg-[#16A66A]',
    iconText: 'text-white',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    borderClass: 'border-emerald-200 dark:border-emerald-800/40',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },

  // 2. GASTOS VARIÁVEIS -> VERMELHO
  variableExpense: {
    primary: '#E11D48',
    hover: '#BE123C',
    softLight: '#FFE4E6',
    softDark: '#3B0D18',
    borderLight: '#FECDD3',
    borderDark: '#5C1425',
    textLight: '#9F1239',
    textDark: '#FB7185',
    iconBg: 'bg-[#E11D48]',
    iconText: 'text-white',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-800/40',
    textClass: 'text-rose-600 dark:text-rose-400',
  },

  // 3. GASTOS FIXOS -> ROXO
  fixedExpense: {
    primary: '#8B5CF6',
    hover: '#7C3AED',
    softLight: '#EDE9FE',
    softDark: '#2A124D',
    borderLight: '#DDD6FE',
    borderDark: '#4C1D95',
    textLight: '#6D28D9',
    textDark: '#A78BFA',
    iconBg: 'bg-[#8B5CF6]',
    iconText: 'text-white',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800/40',
    textClass: 'text-purple-600 dark:text-purple-400',
  },

  // 4. PARCELAMENTOS -> LARANJA
  installment: {
    primary: '#F97316',
    hover: '#EA580C',
    softLight: '#FFEDD5',
    softDark: '#3C1A04',
    borderLight: '#FED7AA',
    borderDark: '#662608',
    textLight: '#C2410C',
    textDark: '#FB923C',
    iconBg: 'bg-[#F97316]',
    iconText: 'text-white',
    badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
    borderClass: 'border-orange-200 dark:border-orange-800/40',
    textClass: 'text-orange-600 dark:text-orange-400',
  },

  // MÓDULOS ESPECÍFICOS
  modules: {
    market: {
      primary: '#02402E',
      iconBg: 'bg-[#02402E]',
      iconText: 'text-white',
    },
    goals: {
      primary: '#0D9488',
      iconBg: 'bg-[#0D9488]',
      iconText: 'text-white',
    },
    wishlist: {
      primary: '#EC4899',
      iconBg: 'bg-[#EC4899]',
      iconText: 'text-white',
    },
    closing: {
      primary: '#02402E',
      iconBg: 'bg-[#02402E]',
      iconText: 'text-white',
    },
    support: {
      primary: '#F29F05',
      iconBg: 'bg-[#F29F05]',
      iconText: 'text-white',
    },
  },

  // STATUS & SITUAÇÕES (Não substituem as cores das categorias!)
  status: {
    paid: {
      primary: '#16A66A',
      softLight: '#E8F5EE',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    },
    pending: {
      primary: '#F59E0B',
      softLight: '#FEF3C7',
      textClass: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    },
    overdue: {
      primary: '#EF4444',
      softLight: '#FEE2E2',
      textClass: 'text-rose-600 dark:text-rose-400',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
    },
  },

  // LINHA DE SALDO E TENDÊNCIA
  balanceLine: '#3B82F6',
} as const;

/**
 * Cores padronizadas para o Donut Chart de Composição de Despesas
 * Usado em DashboardHome e ReportsScreen
 */
export const EXPENSE_DONUT_COLORS = {
  fixed: FINANCIAL_COLORS.fixedExpense.primary,          // ROXO (#8B5CF6)
  variable: FINANCIAL_COLORS.variableExpense.primary,    // VERMELHO (#E11D48)
  installments: FINANCIAL_COLORS.installment.primary,    // LARANJA (#F97316)
} as const;

/**
 * Helper para obter os tokens por tipo de fonte / categoria
 */
export function getFinancialCategoryConfig(sourceType: 'fixed' | 'variable' | 'installment' | 'entries' | 'income') {
  switch (sourceType) {
    case 'entries':
    case 'income':
      return {
        label: 'Entradas',
        singularLabel: 'Entrada',
        color: FINANCIAL_COLORS.income.primary,
        colors: FINANCIAL_COLORS.income,
      };
    case 'fixed':
      return {
        label: 'Gastos Fixos',
        singularLabel: 'Gasto Fixo',
        color: FINANCIAL_COLORS.fixedExpense.primary,
        colors: FINANCIAL_COLORS.fixedExpense,
      };
    case 'variable':
      return {
        label: 'Gastos Variáveis',
        singularLabel: 'Gasto Variável',
        color: FINANCIAL_COLORS.variableExpense.primary,
        colors: FINANCIAL_COLORS.variableExpense,
      };
    case 'installment':
      return {
        label: 'Parcelamentos',
        singularLabel: 'Parcelamento',
        color: FINANCIAL_COLORS.installment.primary,
        colors: FINANCIAL_COLORS.installment,
      };
  }
}
