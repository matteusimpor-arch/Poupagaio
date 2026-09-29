import { supabase } from '../supabase';
import { Space, SpaceMember } from '../../types';
import { isTableMissingError, notifySchemaPending } from './profile';

export const spaceService = {
  async getUserSpaces(userId: string): Promise<Space[]> {
    try {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        if (isTableMissingError(error)) {
          notifySchemaPending(true, 'Tabela "spaces" ainda não foi criada no Supabase.');
          return [];
        }
        console.warn('Erro ao consultar espaços no Supabase:', error.message || error);
        return [];
      }

      notifySchemaPending(false);
      return (data as Space[]) || [];
    } catch (err: any) {
      if (isTableMissingError(err)) {
        notifySchemaPending(true);
        return [];
      }
      console.warn('getUserSpaces error:', err?.message || err);
      return [];
    }
  },

  async ensurePersonalSpace(userId: string, spaceName: string = 'Pessoal'): Promise<Space | null> {
    try {
      if (!supabase) return null;
      // 1. Verifica se o usuário já possui um espaço pessoal no Supabase
      const existingSpaces = await this.getUserSpaces(userId);
      const personalSpace = existingSpaces.find((s) => s.owner_id === userId && s.type === 'personal');

      if (personalSpace) {
        return personalSpace;
      }

      const now = new Date().toISOString();

      // 2. Insere exatamente um espaço pessoal
      const { data: spaceData, error: spaceError } = await supabase
        .from('spaces')
        .insert({
          name: spaceName,
          type: 'personal',
          owner_id: userId,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (spaceError) {
        if (isTableMissingError(spaceError)) {
          notifySchemaPending(true, 'Tabela "spaces" pendente de criação no Supabase.');
          return null;
        }

        // Se o trigger do Supabase já tiver criado concorrentemente, busca de novo
        const recheck = await this.getUserSpaces(userId);
        const found = recheck.find((s) => s.owner_id === userId && s.type === 'personal');
        if (found) return found;

        throw spaceError;
      }

      const newSpace = spaceData as Space;

      // 3. O trigger PostgreSQL on_space_created já vincula automaticamente o owner;
      // caso chamado como contingência, trata chave única como sucesso esperado
      const { error: memberError } = await supabase
        .from('space_members')
        .insert({
          space_id: newSpace.id,
          user_id: userId,
          role: 'owner',
          created_at: now,
        });

      if (memberError) {
        const isDuplicate =
          memberError.code === '23505' ||
          memberError.message?.includes('unique') ||
          memberError.message?.includes('duplicate');

        if (!isDuplicate) {
          if (isTableMissingError(memberError)) {
            notifySchemaPending(true);
          } else {
            console.warn('Aviso de associação de membro:', memberError);
          }
        }
      }

      notifySchemaPending(false);
      return newSpace;
    } catch (err: any) {
      if (isTableMissingError(err)) {
        notifySchemaPending(true);
        return null;
      }
      console.error('ensurePersonalSpace error:', err);
      throw err;
    }
  },

  async getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
    try {
      if (!supabase) return [];
      
      // 1. Fetch space members without joining profiles to avoid PGRST205 relationship error
      const { data, error } = await supabase
        .from('space_members')
        .select('*')
        .eq('space_id', spaceId);

      if (error) {
        if (isTableMissingError(error)) {
          notifySchemaPending(true);
          return [];
        }
        console.warn('Erro ao consultar membros no Supabase:', error.message || error);
        return [];
      }

      const members = (data as SpaceMember[]) || [];
      if (members.length === 0) return [];

      // 2. Fetch profiles for these members using .in() filter
      const userIds = members.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        console.warn('Erro ao carregar perfis correspondentes:', profilesError.message || profilesError);
      }

      // Map profiles back to members gracefully
      const membersWithProfiles = members.map(member => {
        const profile = profilesData?.find(p => p.id === member.user_id) || undefined;
        return {
          ...member,
          profile
        };
      });

      return membersWithProfiles;
    } catch (err: any) {
      if (isTableMissingError(err)) {
        notifySchemaPending(true);
        return [];
      }
      console.warn('getSpaceMembers error:', err);
      return [];
    }
  },

  async createSpace(userId: string, name: string, type: 'personal' | 'couple' | 'family' | 'business'): Promise<Space | null> {
    try {
      if (!supabase) return null;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('spaces')
        .insert({
          name,
          type,
          owner_id: userId,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar espaço:', error);
        throw error;
      }
      return data as Space;
    } catch (err) {
      console.error('createSpace error:', err);
      return null;
    }
  },

  async updateSpaceName(spaceId: string, name: string): Promise<Space | null> {
    try {
      if (!supabase) return null;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('spaces')
        .update({
          name,
          updated_at: now
        })
        .eq('id', spaceId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar nome do espaço:', error);
        throw error;
      }
      return data as Space;
    } catch (err) {
      console.error('updateSpaceName error:', err);
      return null;
    }
  },

  async deleteSpace(spaceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabase) return { success: false, error: 'Supabase não inicializado' };
      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', spaceId);

      if (error) {
        console.error('Erro ao excluir espaço:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error('deleteSpace error:', err);
      return { success: false, error: err.message };
    }
  },

  async getUserMemberships(userId: string): Promise<{ space_id: string; role: any }[]> {
    try {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('space_members')
        .select('space_id, role')
        .eq('user_id', userId);

      if (error) {
        console.warn('Erro ao buscar papéis do usuário:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('getUserMemberships error:', err);
      return [];
    }
  }
};
