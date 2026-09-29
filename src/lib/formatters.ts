/**
 * Utilitários de formatação para moeda e data no padrão brasileiro
 */

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatação amigável e compacta para labels internos de gráficos
 * Exemplos:
 * 862.85 -> R$ 863
 * 1298.79 -> R$ 1,3k
 * 2301.15 -> R$ 2,3k
 * 7600 -> R$ 7,6k
 * Nunca exibe floating point bruto
 */
export function formatCompactCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0';
  }
  const rounded = Math.round(value * 100) / 100;
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';

  if (abs >= 1000) {
    const kVal = (abs / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${sign}R$ ${kVal}k`;
  }
  return `${sign}R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

/**
 * Converte string digitada para valor numérico positivo.
 * Suporta formatos: "1500,50", "1.500,50", "1500.50", "R$ 1.500,50"
 */
export function parseCurrencyInput(raw: string): number {
  if (!raw) return 0;
  // Remove símbolos não numéricos, exceto vírgula e ponto
  let clean = raw.replace(/[^\d.,]/g, '').trim();

  // Se tem vírgula como separador decimal (ex: 1.500,50 ou 1500,50)
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Converte data ISO 'YYYY-MM-DD' para 'DD/MM/AAAA'
 */
export function formatDateBR(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  // Se já estiver no formato YYYY-MM-DD
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return dateStr;
  }
}

/**
 * Retorna a data atual no formato 'YYYY-MM-DD' considerando o fuso horário local
 */
export function getISODateToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a data padrão para um novo lançamento considerando a competência (mês/ano) selecionada.
 * - Se a competência selecionada for o mês/ano atual do sistema -> usa a data de hoje ('YYYY-MM-DD').
 * - Se for qualquer outro mês/ano -> usa o primeiro dia do mês ('YYYY-MM-01') de forma estritamente local,
 *   evitando qualquer distorção por fuso horário/timezone.
 */
export function getDefaultDateForBillingCycle(selectedYear?: number, selectedMonth?: number): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (!selectedYear || !selectedMonth) {
    return getISODateToday();
  }

  if (selectedYear === currentYear && selectedMonth === currentMonth) {
    return getISODateToday();
  }

  const y = selectedYear;
  const m = String(selectedMonth).padStart(2, '0');
  return `${y}-${m}-01`;
}

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function getMonthNameBR(month: number): string {
  return MONTH_NAMES[month - 1] || '';
}

export function getMonthYearLabel(year: number, month: number): string {
  const name = getMonthNameBR(month);
  return `${name} de ${year}`;
}

/**
 * Calcula data inicial e final do mês no formato 'YYYY-MM-DD'
 */
export function getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const startMonthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${startMonthStr}-01`;

  // Último dia do mês: dia 0 do mês seguinte
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${startMonthStr}-${String(lastDay).padStart(2, '0')}`;

  return { startDate, endDate };
}
