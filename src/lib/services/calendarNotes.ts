import { supabase } from '../supabase';
import { isTableMissingError } from './profile';

export interface CalendarNote {
  id: string;
  space_id: string;
  note_date: string; // YYYY-MM-DD
  content: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarNoteInput {
  space_id: string;
  note_date: string;
  content: string;
}

export const calendarNotesService = {
  /**
   * Busca todas as anotações do mês especificado para o espaço
   */
  async getNotesByMonth(
    spaceId: string,
    year: number,
    month: number
  ): Promise<{ notes: CalendarNote[]; isTableMissing: boolean; error?: string }> {
    if (!supabase) return { notes: [], isTableMissing: false, error: 'Conexão Supabase não inicializada.' };
    if (!spaceId) return { notes: [], isTableMissing: false };

    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const { data, error } = await supabase
        .from('calendar_notes')
        .select('*')
        .eq('space_id', spaceId)
        .gte('note_date', startStr)
        .lte('note_date', endStr)
        .order('note_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        if (isTableMissingError(error)) {
          return { notes: [], isTableMissing: true };
        }
        console.warn('Aviso ao buscar calendar_notes:', error.message || error);
        return { notes: [], isTableMissing: false, error: 'Erro ao carregar anotações do calendário.' };
      }

      return { notes: (data as CalendarNote[]) || [], isTableMissing: false };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { notes: [], isTableMissing: true };
      }
      return { notes: [], isTableMissing: false, error: 'Erro ao conectar com as anotações.' };
    }
  },

  /**
   * Cria uma nova anotação em uma data específica
   */
  async createNote(
    userId: string,
    input: CreateCalendarNoteInput
  ): Promise<{ note: CalendarNote | null; isTableMissing?: boolean; error?: string }> {
    if (!supabase) return { note: null, error: 'Conexão Supabase não inicializada.' };

    const content = input.content.trim();
    if (!content) return { note: null, error: 'O conteúdo da anotação não pode ser vazio.' };

    if (!input.space_id) return { note: null, error: 'Espaço não selecionado.' };
    if (!input.note_date) return { note: null, error: 'Data não informada.' };

    try {
      const now = new Date().toISOString();
      const payload = {
        space_id: input.space_id,
        note_date: input.note_date,
        content,
        created_by: userId || null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('calendar_notes')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          return { note: null, isTableMissing: true, error: 'A tabela de anotações (calendar_notes) ainda não existe no Supabase.' };
        }
        console.warn('Aviso ao criar calendar_note:', error.message || error);
        return { note: null, error: 'Erro ao salvar anotação.' };
      }

      return { note: data as CalendarNote };
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return { note: null, isTableMissing: true, error: 'A tabela de anotações (calendar_notes) ainda não existe no Supabase.' };
      }
      return { note: null, error: 'Erro ao salvar anotação.' };
    }
  },

  /**
   * Atualiza o conteúdo de uma anotação existente
   */
  async updateNote(
    id: string,
    content: string
  ): Promise<{ note: CalendarNote | null; error?: string }> {
    if (!supabase) return { note: null, error: 'Conexão Supabase não inicializada.' };

    const trimmed = content.trim();
    if (!trimmed) return { note: null, error: 'O conteúdo da anotação não pode ser vazio.' };

    try {
      const { data, error } = await supabase
        .from('calendar_notes')
        .update({
          content: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.warn('Aviso ao atualizar calendar_note:', error.message || error);
        return { note: null, error: 'Erro ao atualizar anotação.' };
      }

      return { note: data as CalendarNote };
    } catch {
      return { note: null, error: 'Erro ao atualizar anotação.' };
    }
  },

  /**
   * Exclui uma anotação pelo ID
   */
  async deleteNote(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Conexão Supabase não inicializada.' };

    try {
      const { error } = await supabase.from('calendar_notes').delete().eq('id', id);
      if (error) {
        console.warn('Aviso ao deletar calendar_note:', error.message || error);
        return { success: false, error: 'Erro ao excluir anotação.' };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao excluir anotação.' };
    }
  },
};
