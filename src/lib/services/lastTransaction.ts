export type QuickEntryType = 'entry' | 'variable_expense' | 'fixed_expense' | 'installment';

export interface LastTransactionData {
  type: QuickEntryType;
  description: string;
  amount: number;
  category: string;
  paymentMethod?: string;
  reserveId?: string | null;
  reserveName?: string;
  isFreeBalance?: boolean;
  notes?: string;
  timestamp: number;
}

const STORAGE_PREFIX = 'poupagaio_last_tx_';

export const lastTransactionService = {
  saveLastTransaction(spaceId: string, data: Omit<LastTransactionData, 'timestamp'>): void {
    if (!spaceId) return;
    try {
      const payload: LastTransactionData = {
        ...data,
        timestamp: Date.now(),
      };
      localStorage.setItem(`${STORAGE_PREFIX}${spaceId}`, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('poupagaio_last_tx_saved', { detail: payload }));
    } catch (err) {
      console.warn('Erro ao salvar último lançamento:', err);
    }
  },

  getLastTransaction(spaceId: string): LastTransactionData | null {
    if (!spaceId) return null;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.description && typeof parsed.amount === 'number') {
        return parsed;
      }
    } catch (err) {
      // Ignore parse errors
    }
    return null;
  },

  clearLastTransaction(spaceId: string): void {
    if (!spaceId) return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${spaceId}`);
      window.dispatchEvent(new CustomEvent('poupagaio_last_tx_saved', { detail: null }));
    } catch (err) {
      // Ignore errors
    }
  },
};
