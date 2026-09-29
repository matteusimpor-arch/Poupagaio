import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { checklistService, NormalizedChecklistExpense } from '../../lib/services/checklist';
import { calendarNotesService, CalendarNote } from '../../lib/services/calendarNotes';
import { formatCurrency } from '../../lib/formatters';
import { SupabaseSchemaNotice } from '../layout/SupabaseSchemaNotice';
import { ActiveTab } from '../../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Edit2,
  X,
  StickyNote,
  ArrowLeft,
  Check,
} from 'lucide-react';

interface CalendarScreenProps {
  onSelectTab: (tab: ActiveTab) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarScreen({ onSelectTab }: CalendarScreenProps) {
  const { currentSpace, user } = useAuth();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  const [checklistItems, setChecklistItems] = useState<NormalizedChecklistExpense[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notesTableMissing, setNotesTableMissing] = useState(false);

  // Selected Date state for Day Detail modal
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(todayStr);

  // Note form state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Load checklist items and notes whenever space, month or year changes
  const loadData = async () => {
    if (!currentSpace?.id) return;
    setIsLoading(true);
    setActionError(null);

    try {
      const [checklistRes, notesRes] = await Promise.all([
        checklistService.getMonthlyChecklist(currentSpace.id, currentYear, currentMonth),
        calendarNotesService.getNotesByMonth(currentSpace.id, currentYear, currentMonth),
      ]);

      setChecklistItems(checklistRes.items);
      setNotes(notesRes.notes);
      setNotesTableMissing(notesRes.isTableMissing);
    } catch (err) {
      console.warn('Erro ao carregar dados do calendário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentSpace?.id, currentYear, currentMonth]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleGoToToday = () => {
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
    setSelectedDateStr(todayStr);
  };

  // Toggle checklist payment status
  const handleTogglePayment = async (item: NormalizedChecklistExpense) => {
    if (!currentSpace?.id) return;
    const res = await checklistService.toggleItemPaymentStatus(item, currentSpace.id, currentYear, currentMonth);
    if (res.success) {
      await loadData();
    } else if (res.error) {
      setActionError(res.error);
    }
  };

  // Save new note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSpace?.id || !selectedDateStr || !newNoteContent.trim() || !user?.id) return;

    setIsSavingNote(true);
    setActionError(null);

    const res = await calendarNotesService.createNote(user.id, {
      space_id: currentSpace.id,
      note_date: selectedDateStr,
      content: newNoteContent,
    });

    setIsSavingNote(false);

    if (res.note) {
      setNewNoteContent('');
      await loadData();
    } else if (res.isTableMissing) {
      setNotesTableMissing(true);
      setActionError('A tabela de anotações ainda não foi criada no banco de dados Supabase.');
    } else if (res.error) {
      setActionError(res.error);
    }
  };

  // Update note
  const handleUpdateNote = async (id: string) => {
    if (!editingNoteContent.trim()) return;
    setActionError(null);

    const res = await calendarNotesService.updateNote(id, editingNoteContent);
    if (res.note) {
      setEditingNoteId(null);
      setEditingNoteContent('');
      await loadData();
    } else if (res.error) {
      setActionError(res.error);
    }
  };

  // Delete note
  const handleDeleteNote = async (id: string) => {
    setActionError(null);
    const res = await calendarNotesService.deleteNote(id);
    if (res.success) {
      await loadData();
    } else if (res.error) {
      setActionError(res.error);
    }
  };

  // Build grid of days for the selected month
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayWeekday = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sun, 6 = Sat

  // Group checklist items by date (YYYY-MM-DD)
  const itemsByDate: Record<string, NormalizedChecklistExpense[]> = {};
  checklistItems.forEach((item) => {
    if (!itemsByDate[item.dueDate]) itemsByDate[item.dueDate] = [];
    itemsByDate[item.dueDate].push(item);
  });

  // Group notes by date
  const notesByDate: Record<string, CalendarNote[]> = {};
  notes.forEach((note) => {
    if (!notesByDate[note.note_date]) notesByDate[note.note_date] = [];
    notesByDate[note.note_date].push(note);
  });

  // Items and notes for selected date
  const selectedDateItems = selectedDateStr ? itemsByDate[selectedDateStr] || [] : [];
  const selectedDateNotes = selectedDateStr ? notesByDate[selectedDateStr] || [] : [];

  // Format date display for modal header
  const formatSelectedDateHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const weekday = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${capitalizedWeekday}, ${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1E2220] p-4 rounded-2xl border border-[#E2E8E4] dark:border-[#2E3532] shadow-2xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectTab('home')}
            className="rounded-xl border-[#E2E8E4] dark:border-[#2E3532]"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 text-[#075C45] dark:text-[#78D9A6]" />
            Voltar
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-display text-[#202724] dark:text-[#F4F4F5] flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#16A66A]" />
              Calendário Financeiro
            </h1>
            <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
              Visão completa de vencimentos e anotações por data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGoToToday}
            className="rounded-xl border-[#E2E8E4] dark:border-[#2E3532] text-xs font-semibold"
          >
            Hoje
          </Button>
          <div className="flex items-center gap-1 bg-[#F3F4F4] dark:bg-[#282E2B] p-1 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold min-w-[120px] text-center font-display text-[#075C45] dark:text-[#78D9A6]">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {notesTableMissing && <SupabaseSchemaNotice />}

      {actionError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid Card */}
      <Card className="border-[#E2E8E4] dark:border-[#2E3532] bg-white dark:bg-[#1E2220] overflow-hidden">
        <CardContent className="p-3 sm:p-5 space-y-3">
          {/* Weekday Titles Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pb-2 border-b border-[#E2E8E4] dark:border-[#2E3532]">
            {WEEKDAY_NAMES.map((wd, i) => (
              <div
                key={wd}
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  i === 0 || i === 6 ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-[#5E6963] dark:text-[#95A39B]'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Blank leading cells */}
            {Array.from({ length: firstDayWeekday }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[70px] sm:min-h-[90px] p-1 rounded-xl bg-[#F8F9F8]/50 dark:bg-[#161918]/30 border border-transparent"
              />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDateStr;

              const dayItems = itemsByDate[dateStr] || [];
              const dayNotes = notesByDate[dateStr] || [];

              const hasOverdue = dayItems.some((it) => it.visualStatus === 'overdue');
              const hasToday = dayItems.some((it) => it.visualStatus === 'today');
              const hasUpcoming = dayItems.some((it) => it.visualStatus === 'upcoming');
              const allPaid = dayItems.length > 0 && dayItems.every((it) => it.status === 'paid');
              const dayTotalAmount = dayItems.reduce((acc, it) => acc + it.amount, 0);

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`min-h-[75px] sm:min-h-[95px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#16A66A] bg-[#16A66A]/10 dark:bg-[#16A66A]/20 shadow-xs ring-2 ring-[#16A66A]/30'
                      : isToday
                      ? 'border-[#075C45] bg-[#075C45]/5 dark:border-[#78D9A6] dark:bg-[#78D9A6]/10'
                      : 'border-[#E2E8E4] dark:border-[#2A312E] hover:border-[#16A66A]/50 hover:bg-black/2 dark:hover:bg-white/2 bg-white dark:bg-[#1A1E1C]'
                  }`}
                >
                  {/* Top Day Bar */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center font-display ${
                        isToday
                          ? 'bg-[#075C45] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                          : 'text-[#202724] dark:text-[#F4F4F5]'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Note Indicator Badge */}
                    {dayNotes.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded-md">
                        <StickyNote className="w-2.5 h-2.5" />
                        {dayNotes.length}
                      </span>
                    )}
                  </div>

                  {/* Indicators for Financial Items */}
                  <div className="space-y-1 my-1 min-h-0 overflow-hidden">
                    {dayItems.length > 0 && (
                      <div className="space-y-0.5">
                        {/* Status indicator pill */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold truncate text-[#5E6963] dark:text-[#95A39B]">
                            {dayItems.length} {dayItems.length === 1 ? 'item' : 'itens'}
                          </span>
                          {allPaid ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Tudo pago" />
                          ) : hasOverdue || hasToday ? (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Atrasado/Vence hoje" />
                          ) : hasUpcoming ? (
                            <span className="w-2 h-2 rounded-full bg-amber-500" title="Vence em breve" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-400" title="Pendente" />
                          )}
                        </div>

                        {/* Amount summary */}
                        <p className={`text-[10px] font-semibold truncate ${
                          allPaid
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : hasOverdue || hasToday
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-[#202724] dark:text-[#F4F4F5]'
                        }`}>
                          {formatCurrency(dayTotalAmount)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bottom Day status bar indicator */}
                  {dayItems.length === 0 && dayNotes.length === 0 && (
                    <div className="text-[9px] text-[#5E6963]/40 dark:text-[#95A39B]/30 select-none">
                      —
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Detail Section */}
      {selectedDateStr && (
        <Card className="border-[#16A66A]/40 bg-white dark:bg-[#1E2220] shadow-md animate-in fade-in duration-200">
          <CardContent className="p-4 sm:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-[#2E3532]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#16A66A]/15 text-[#075C45] dark:bg-[#16A66A]/25 dark:text-[#78D9A6] flex items-center justify-center font-bold">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold font-display text-[#202724] dark:text-[#F4F4F5]">
                    {formatSelectedDateHeader(selectedDateStr)}
                  </h2>
                  <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                    Detalhes financeiros e anotações deste dia
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDateStr(null)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Financial Commitments for Selected Day */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#075C45] dark:text-[#78D9A6] flex items-center justify-between">
                  <span>Compromissos Financeiros ({selectedDateItems.length})</span>
                  <span className="text-[11px] font-semibold text-[#5E6963] dark:text-[#95A39B]">
                    Total: {formatCurrency(selectedDateItems.reduce((acc, i) => acc + i.amount, 0))}
                  </span>
                </h3>

                {selectedDateItems.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-[#E2E8E4] dark:border-[#2A312E] rounded-2xl bg-[#F8F9F8]/50 dark:bg-[#161918]/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                    <p className="text-xs font-medium text-[#202724] dark:text-[#F4F4F5]">
                      Nenhum vencimento registrado nesta data.
                    </p>
                    <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
                      Você pode consultar os gastos fixos, variáveis ou parcelados no menu lateral.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {selectedDateItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          item.status === 'paid'
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                            : item.visualStatus === 'overdue' || item.visualStatus === 'today'
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                            : 'bg-[#F8F9F8] dark:bg-[#18201D] border-[#E2E8E4] dark:border-[#2A312E]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleTogglePayment(item)}
                            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              item.status === 'paid'
                                ? 'bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500'
                                : 'border-[#5E6963] dark:border-[#95A39B] hover:border-[#16A66A]'
                            }`}
                          >
                            {item.status === 'paid' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate ${item.status === 'paid' ? 'line-through text-[#5E6963] dark:text-[#95A39B]' : 'text-[#202724] dark:text-[#F4F4F5]'}`}>
                              {item.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#5E6963] dark:text-[#95A39B] font-medium">
                                {item.sourceType === 'fixed' ? 'Gasto Fixo' : item.sourceType === 'variable' ? 'Variável' : `Parcela ${item.installmentNumber}/${item.totalInstallments}`}
                              </span>
                              <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold ${item.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#202724] dark:text-[#F4F4F5]'}`}>
                            {formatCurrency(item.amount)}
                          </p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                            item.status === 'paid'
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : item.visualStatus === 'overdue'
                              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                              : item.visualStatus === 'today'
                              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          }`}>
                            {item.status === 'paid' ? 'Pago' : item.visualStatus === 'overdue' ? 'Atrasado' : item.visualStatus === 'today' ? 'Vence Hoje' : 'A Vencer'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Day Notes */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#075C45] dark:text-[#78D9A6] flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-[#16A66A]" />
                  <span>Anotações Manuais ({selectedDateNotes.length})</span>
                </h3>

                {/* Add Note Form */}
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Escreva um lembrete ou anotação para este dia..."
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E2E8E4] dark:border-[#2E3532] bg-[#F8F9F8] dark:bg-[#18201D] text-[#202724] dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-[#16A66A]/40 resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isSavingNote || !newNoteContent.trim()}
                      size="sm"
                      className="bg-[#16A66A] hover:bg-[#075C45] text-white text-xs rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Anotação
                    </Button>
                  </div>
                </form>

                {/* Notes List */}
                {selectedDateNotes.length === 0 ? (
                  <p className="text-xs text-[#5E6963] dark:text-[#95A39B] italic text-center py-4">
                    Nenhuma anotação cadastrada para este dia.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedDateNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 text-xs space-y-1.5"
                      >
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              rows={2}
                              className="w-full p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#1E2220] text-xs resize-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingNoteId(null)}
                                className="text-xs h-7 px-2"
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleUpdateNote(note.id)}
                                className="bg-[#16A66A] hover:bg-[#075C45] text-white text-xs h-7 px-2 rounded-lg"
                              >
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[#202724] dark:text-[#F4F4F5] whitespace-pre-wrap break-words flex-1">
                              {note.content}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteContent(note.content);
                                }}
                                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
