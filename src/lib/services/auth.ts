import { supabase } from '../supabase';
import { AuthUser } from '../../types';

export const authService = {
  async getSession(): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      if (!supabase) return { user: null, error: new Error('Cliente Supabase não inicializado.') };
      const { data, error } = await supabase.auth.getSession();
      if (error) return { user: null, error };
      if (!data.session?.user) return { user: null, error: null };
      return {
        user: {
          id: data.session.user.id,
          email: data.session.user.email || '',
          full_name: data.session.user.user_metadata?.full_name,
        },
        error: null,
      };
    } catch (err: any) {
      return { user: null, error: new Error(err.message || 'Erro ao obter sessão') };
    }
  },

  async signUp({
    email,
    password,
    fullName,
  }: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ user: AuthUser | null; error: Error | null; needsEmailConfirmation?: boolean }> {
    try {
      if (!email || !password || !fullName) {
        return { user: null, error: new Error('Preencha todos os campos obrigatórios.') };
      }
      if (password.length < 6) {
        return { user: null, error: new Error('A senha deve ter pelo menos 6 caracteres.') };
      }

      if (!supabase) {
        return { user: null, error: new Error('Cliente Supabase não inicializado.') };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        return { user: null, error: new Error(error.message) };
      }

      if (!data.user) {
        return { user: null, error: new Error('Não foi possível concluir o cadastro.') };
      }

      // Se o Supabase exigir confirmação de e-mail, data.session será null
      if (!data.session) {
        return {
          user: null,
          error: null,
          needsEmailConfirmation: true,
        };
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || fullName.trim(),
        },
        error: null,
      };
    } catch (err: any) {
      return { user: null, error: new Error(err.message || 'Erro inesperado durante cadastro.') };
    }
  },

  async signIn({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      if (!email || !password) {
        return { user: null, error: new Error('Informe o e-mail e a senha.') };
      }

      if (!supabase) {
        return { user: null, error: new Error('Cliente Supabase não inicializado.') };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { user: null, error: new Error(error.message) };
      }

      if (!data.user || !data.session) {
        return { user: null, error: new Error('Erro ao iniciar sessão. Verifique suas credenciais ou confirmação de e-mail.') };
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name,
        },
        error: null,
      };
    } catch (err: any) {
      return { user: null, error: new Error(err.message || 'Erro inesperado ao entrar.') };
    }
  },

  async signOut(): Promise<{ error: Error | null }> {
    try {
      if (!supabase) return { error: null };
      const { error } = await supabase.auth.signOut();
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao sair da conta.') };
    }
  },

  async resetPassword(email: string): Promise<{ error: Error | null }> {
    try {
      if (!email) {
        return { error: new Error('Por favor, informe seu e-mail cadastrado.') };
      }
      if (!supabase) {
        return { error: new Error('Cliente Supabase não inicializado.') };
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao solicitar recuperação.') };
    }
  },

  async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      if (!newPassword || newPassword.length < 6) {
        return { error: new Error('A nova senha deve ter pelo menos 6 caracteres.') };
      }
      if (!supabase) {
        return { error: new Error('Cliente Supabase não inicializado.') };
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao atualizar senha.') };
    }
  },
};
