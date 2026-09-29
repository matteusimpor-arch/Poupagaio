import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { Entry, EntryStatus, CreateEntryInput, UpdateEntryInput, EntriesSummary } from '../../types';
import { entriesService } from '../../lib/services/entries';
import { MonthPicker } from './MonthPicker';
import { EntryModal } from './EntryModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { SUPABASE_ENTRIES_MIGRATION_SQL } from '../../lib/entries-sql';
import { formatCurrency, formatDateBR, getMonthYearLabel, getISODateToday } from '../../lib/formatters';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import {
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  Database,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  HelpCircle,
} from 'lucide-react';

interface EntriesScreenProps {
  selectedYear?: number;
  selectedMonth?: number;
  onMonthChange?: (year: number, month: number) => void;
}

export function EntriesScreen({
  selectedYear: initialYear,
  selectedMonth: initialMonth,
  onMonthChange,
}: EntriesScreenProps = {}) {
  const { currentSpace, user } = useAuth();

  // Estado do mês selecionado
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(initialYear || now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || (now.getMonth() + 1));

  useEffect(() => {
    if (initialYear && initialMonth) {
      setSelectedYear(initialYear);
      setSelectedMonth(initialMonth);
    }
  }, [initialYear, initialMonth]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    onMonthChange?.(year, month);
  };

  // Estados de dados
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<EntriesSummary>({
    totalPlanned: 0,
    totalReceived: 0,
    totalPending: 0,
    count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Feedback do mascote / Notificação discreta de sucesso
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Estados de modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
  const [entryToUndoAutoReceive, setEntryToUndoAutoReceive] = useState<Entry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado de cópia do SQL de migração
  const [sqlCopied, setSqlCopied] = useState(false);
  const [checkingTable, setCheckingTable] = useState(false);

  // Carregar lançamentos
  const loadEntries = useCallback(async () => {
    if (!currentSpace) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await entriesService.getEntriesByMonth(
      currentSpace.id,
      selectedYear,
      selectedMonth
    );

    setIsTableMissing(result.isTableMissing);
    if (result.isTableMissing) {
      setEntries([]);
      setSummary({ totalPlanned: 0, totalReceived: 0, totalPending: 0, count: 0 });
    } else if (result.error) {
      setErrorMessage(result.error);
    } else {
      setEntries(result.entries);
      setSummary(result.summary);
    }

    setIsLoading(false);
  }, [currentSpace, selectedYear, selectedMonth]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Limpa mensagem de feedback após 5 segundos
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Handler de Criação / Edição
  const handleSaveEntry = async (data: CreateEntryInput | UpdateEntryInput): Promise<boolean> => {
    if (!user || !currentSpace) return false;

    if (editingEntry) {
      const res = await entriesService.updateEntry(editingEntry.id, data as UpdateEntryInput);
      if (res.error) {
        throw new Error(res.error);
      }
      setFeedbackMessage('Entrada atualizada com sucesso!');
      await loadEntries();
      return true;
    } else {
      const res = await entriesService.createEntry(user.id, data as CreateEntryInput);
      if (res.isTableMissing) {
        setIsTableMissing(true);
        throw new Error('A tabela de entradas ainda precisa ser criada no Supabase.');
      }
      if (res.error) {
        throw new Error(res.error);
      }
      setFeedbackMessage('Entrada adicionada! Seu planejamento está ficando mais completo.');
      await loadEntries();
      return true;
    }
  };

  // Handler de Exclusão
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;

    setIsDeleting(true);
    const res = await entriesService.deleteEntry(entryToDelete.id);
    setIsDeleting(false);

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    setEntryToDelete(null);
    setFeedbackMessage('Entrada excluída com sucesso.');
    await loadEntries();
  };

  // Alternar Status rápido
  const handleToggleStatus = async (entry: Entry) => {
    // Se a entrada está 'received' e possui auto_receive ativado e a data é hoje ou já passou:
    if (entry.status === 'received' && entry.auto_receive && entry.date <= getISODateToday()) {
      setEntryToUndoAutoReceive(entry);
      return;
    }

    const res = await entriesService.toggleStatus(entry.id, entry.status);
    if (!res.error) {
      // Atualização otimista na lista
      const nextStatus: EntryStatus = entry.status === 'received' ? 'pending' : 'received';
      setEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id ? { ...item, status: nextStatus } : item
        )
      );
      // Recarrega para manter totais perfeitamente sincronizados
      loadEntries();
    }
  };

  // Confirmar desativação de baixa automática ao desfazer para 'A receber'
  const handleConfirmUndoAutoReceive = async () => {
    if (!entryToUndoAutoReceive) return;
    const entry = entryToUndoAutoReceive;
    setEntryToUndoAutoReceive(null);
    const res = await entriesService.toggleStatus(entry.id, entry.status, true);
    if (!res.error) {
      setEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id ? { ...item, status: 'pending', auto_receive: false } : item
        )
      );
      setFeedbackMessage('Baixa desfeita e baixa automática desativada.');
      loadEntries();
    }
  };

  // Copiar SQL de Migração
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_ENTRIES_MIGRATION_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = SUPABASE_ENTRIES_MIGRATION_SQL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 3000);
    }
  };

  // Verificar se a tabela foi criada no Supabase
  const handleCheckTable = async () => {
    setCheckingTable(true);
    const exists = await entriesService.checkTableExists();
    setCheckingTable(false);
    if (exists) {
      setIsTableMissing(false);
      loadEntries();
    } else {
      setErrorMessage('A tabela ainda não foi detectada. Verifique se clicou em "Run" no SQL Editor do Supabase.');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (entry: Entry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  return (
    <div id="entries-screen" className="space-y-6 pb-12">
      {/* 1. CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[#075C45] dark:text-[#78D9A6]">
              Entradas
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Receitas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B]">
            Registre tudo o que entra no seu orçamento.
          </p>
        </div>

        {/* Controles do Cabeçalho: Filtro de Mês e Botão Nova Entrada */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <MonthPicker
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => handleMonthChange(y, m)}
          />

          <Button
            type="button"
            id="new-entry-header-btn"
            variant="primary"
            size="md"
            onClick={handleOpenCreateModal}
            className="gap-2 shadow-sm font-bold shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova entrada</span>
          </Button>
        </div>
      </div>

      {/* 2. FEEDBACK DO MASCOTE / SUCESSO DISCRETO */}
      {feedbackMessage && (
        <div
          role="status"
          className="p-3 sm:p-4 rounded-2xl bg-[#16A66A]/10 border border-[#16A66A]/30 dark:bg-[#16A66A]/15 text-[#075C45] dark:text-[#78D9A6] flex items-center gap-3 animate-in fade-in duration-200"
        >
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 border border-[#16A66A]/30 bg-white dark:bg-[#18211D] p-0.5">
            <img
              src={POUPAGAIO_MASCOT_URL}
              alt="Poupagaio"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-xs sm:text-sm font-medium">{feedbackMessage}</p>
        </div>
      )}

      {/* 3. AVISO DE TABELA PENDENTE (SE A TABELA NÃO EXISTIR NO SUPABASE) */}
      {isTableMissing && (
        <div
          id="entries-table-notice"
          className="p-5 sm:p-6 rounded-3xl bg-[#D6A84B]/10 dark:bg-[#D6A84B]/15 border border-[#D6A84B]/30 text-[#202724] dark:text-[#F7F4EA] space-y-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D6A84B]/20 text-[#8A6318] dark:text-[#F2D58A] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold font-display text-[#8A6318] dark:text-[#F2D58A]">
                Tabela "entries" necessária no Supabase
              </h3>
              <p className="text-xs sm:text-sm text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
                Para armazenar as entradas com segurança e isolamento por espaço (Row Level Security), execute a migration SQL abaixo no painel do Supabase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={handleCopySql}
              className="gap-2 cursor-pointer"
            >
              {sqlCopied ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
              <span>{sqlCopied ? 'SQL Copiado para a Área de Transferência!' : 'Copiar SQL de Migração'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckTable}
              isLoading={checkingTable}
              disabled={checkingTable}
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verificar Novamente</span>
            </Button>
          </div>
        </div>
      )}

      {/* 4. MENSAGEM DE ERRO GERAL */}
      {errorMessage && !isTableMissing && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 5. CARDS DE RESUMO DO MÊS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Total Previsto */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Total Previsto
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#075C45] dark:text-[#78D9A6]">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[#075C45] dark:text-[#78D9A6]">
              {formatCurrency(summary.totalPlanned)}
            </div>
          )}
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            {summary.count} {summary.count === 1 ? 'lançamento no mês' : 'lançamentos no mês'}
          </p>
        </div>

        {/* Card 2: Total Recebido */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              Total Recebido
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.totalReceived)}
            </div>
          )}
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            Já confirmado na sua conta
          </p>
        </div>

        {/* Card 3: A Receber */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
              A Receber
            </span>
            <span className="p-1.5 rounded-xl bg-[#D6A84B]/15 text-[#8A6318] dark:text-[#F2D58A]">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[#8A6318] dark:text-[#F2D58A]">
              {formatCurrency(summary.totalPending)}
            </div>
          )}
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            Aguardando recebimento
          </p>
        </div>
      </div>

      {/* 6. LISTAGEM DE ENTRADAS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold font-display text-[#202724] dark:text-[#F7F4EA]">
            Lançamentos de {getMonthYearLabel(selectedYear, selectedMonth)}
          </h2>
          {entries.length > 0 && (
            <span className="text-xs font-medium text-[#5E6963] dark:text-[#95A39B]">
              {entries.length} {entries.length === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>

        {/* Estado de Carregamento */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        )}

        {/* Estado Vazio (Sem Entradas no Mês Selecionado) */}
        {!isLoading && entries.length === 0 && !isTableMissing && (
          <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] text-center flex flex-col items-center justify-center space-y-4 shadow-2xs">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-2 border-[#16A66A]/20 bg-[#F7F4EA] dark:bg-[#121915] p-2 shadow-sm">
              <img
                src={POUPAGAIO_MASCOT_URL}
                alt="Poupagaio Mascote"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-base sm:text-lg font-bold font-display text-[#075C45] dark:text-[#78D9A6]">
                Seu mês começa por aqui! Adicione sua primeira entrada.
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
                Comece registrando seu salário, rendas extras, vendas ou reembolsos para que o Poupagaio calcule seu saldo real.
              </p>
            </div>
            <Button
              type="button"
              id="empty-state-add-entry-btn"
              variant="primary"
              size="md"
              onClick={handleOpenCreateModal}
              className="gap-2 font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Adicionar entrada</span>
            </Button>
          </div>
        )}

        {/* Lista com Lançamentos */}
        {!isLoading && entries.length > 0 && (
          <div className="space-y-2.5">
            {entries.map((entry) => {
              const isReceived = entry.status === 'received';

              return (
                <div
                  key={entry.id}
                  className="p-4 sm:p-4.5 rounded-2xl bg-white dark:bg-[#18211D] border border-[#E8E4D5] dark:border-[#24312B] shadow-2xs hover:border-[#16A66A]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group"
                >
                  {/* Lado Esquerdo: Ícone, Descrição, Categoria, Data */}
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(entry)}
                      title={isReceived ? 'Marcar como A receber' : 'Marcar como Recebido'}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                        isReceived
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-[#D6A84B]/15 text-[#8A6318] dark:text-[#F2D58A]'
                      }`}
                    >
                      {isReceived ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-[#202724] dark:text-[#F7F4EA] truncate">
                          {entry.description}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F7F4EA] dark:bg-[#24312B] text-[#5E6963] dark:text-[#95A39B]">
                          {entry.category}
                        </span>
                        {!isReceived && entry.auto_receive && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#075C45]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] border border-[#075C45]/20 dark:border-[#16A66A]/30 shrink-0">
                            Baixa automática
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#5E6963] dark:text-[#95A39B]">
                        <span>{formatDateBR(entry.date)}</span>
                        {entry.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px] text-[11px] italic">
                              {entry.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Valor, Badge Status e Botões de Ação */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8E4D5]/60 dark:border-[#24312B]/60">
                    <div className="text-left sm:text-right">
                      <div className="text-base sm:text-lg font-extrabold font-display text-emerald-600 dark:text-emerald-400">
                        + {formatCurrency(entry.amount)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(entry)}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold transition-opacity hover:opacity-80 cursor-pointer ${
                          isReceived
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-[#8A6318] dark:text-[#F2D58A]'
                        }`}
                      >
                        {isReceived ? 'Recebido' : 'A receber'}
                      </button>
                    </div>

                    {/* Botões de Ação: Editar e Excluir */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(entry)}
                        aria-label="Editar entrada"
                        className="p-2 rounded-xl text-[#5E6963] dark:text-[#95A39B] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#075C45] dark:hover:text-[#78D9A6] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEntryToDelete(entry)}
                        aria-label="Excluir entrada"
                        className="p-2 rounded-xl text-[#5E6963] dark:text-[#95A39B] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. MODAIS */}
      {currentSpace && (
        <EntryModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEntry(null);
          }}
          onSave={handleSaveEntry}
          editingEntry={editingEntry}
          spaceId={currentSpace.id}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      )}

      <DeleteConfirmModal
        isOpen={Boolean(entryToDelete)}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleConfirmDelete}
        entry={entryToDelete}
        isLoading={isDeleting}
      />

      {entryToUndoAutoReceive &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[10000] animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1C211E] border border-[#D2DDD6] dark:border-[#28322C] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6]">
                    Desfazer baixa automática?
                  </h3>
                  <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] mt-1 leading-relaxed">
                    Esta entrada possui baixa automática. Deseja desativar a baixa automática e retornar para &quot;A receber&quot;?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEntryToUndoAutoReceive(null)}
                  className="cursor-pointer text-xs"
                >
                  Cancelar
                </Button>
                <button
                  type="button"
                  onClick={handleConfirmUndoAutoReceive}
                  className="px-3 py-2 rounded-xl bg-[#075C45] hover:bg-[#075C45]/90 text-white font-bold cursor-pointer text-xs transition-colors flex items-center justify-center"
                >
                  Confirmar e Desativar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
