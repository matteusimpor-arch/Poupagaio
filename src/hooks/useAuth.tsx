import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthUser, Profile, Space } from '../types';
import { authService } from '../lib/services/auth';
import { profileService, subscribeToSchemaStatus } from '../lib/services/profile';
import { spaceService } from '../lib/services/space';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  spaces: Space[];
  memberships: { space_id: string; role: any }[];
  currentSpace: Space | null;
  isLoading: boolean;
  isInitializing: boolean;
  isSchemaPending: boolean;
  recheckSchema: () => Promise<boolean>;
  setCurrentSpace: (space: Space) => void;
  signUp: (data: { email: string; password: string; fullName: string }) => Promise<{ error: Error | null }>;
  signIn: (data: { email: string; password: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfileName: (newName: string) => Promise<{ error: Error | null }>;
  createSpace: (name: string, type: 'personal' | 'couple' | 'family' | 'business') => Promise<{ error: Error | null; space?: Space | null }>;
  updateSpaceName: (spaceId: string, newName: string) => Promise<{ error: Error | null; space?: Space | null }>;
  deleteSpace: (spaceId: string) => Promise<{ error: Error | null }>;
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [memberships, setMemberships] = useState<{ space_id: string; role: any }[]>([]);
  const [currentSpace, setCurrentSpaceState] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSchemaPending, setIsSchemaPending] = useState<boolean>(false);

  // Subscribe to schema missing events
  useEffect(() => {
    const unsubscribe = subscribeToSchemaStatus((pending) => {
      setIsSchemaPending(pending);
    });
    return unsubscribe;
  }, []);

  // Initialize and load user data idempotently
  const loadUserData = useCallback(async (authUser: AuthUser) => {
    try {
      setIsLoading(true);

      // 1. Ensure Profile exists (with safe fallback for PGRST205)
      const userProfile = await profileService.ensureProfile(
        authUser.id,
        authUser.full_name || authUser.email.split('@')[0]
      );
      setProfile(userProfile);

      // 2. Ensure Personal Space exists idempotently
      await spaceService.ensurePersonalSpace(authUser.id, 'Pessoal');

      // 3. Fetch all user spaces
      const userSpaces = await spaceService.getUserSpaces(authUser.id);
      setSpaces(userSpaces);

      // Fetch memberships
      const userMemberships = await spaceService.getUserMemberships(authUser.id);
      setMemberships(userMemberships);

      // 4. Set current space (prioritize saved or first space)
      const savedSpaceId = localStorage.getItem(`poupagaio_active_space_${authUser.id}`);
      const active = userSpaces.find((s) => s.id === savedSpaceId) || userSpaces[0] || null;
      setCurrentSpaceState(active);
    } catch (err) {
      console.warn('Notice loading user data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-verify if Supabase tables have been created (profiles, spaces, space_members)
  const recheckSchema = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      setIsLoading(true);
      const [pRes, sRes, mRes] = await Promise.all([
        supabase.from('profiles').select('id').limit(1),
        supabase.from('spaces').select('id').limit(1),
        supabase.from('space_members').select('id').limit(1),
      ]);

      const isMissing = [pRes.error, sRes.error, mRes.error].some(
        (err) => err && (err.code === 'PGRST205' || err.code === '42P01' || err.message?.includes('schema cache'))
      );

      if (isMissing) {
        setIsSchemaPending(true);
        return false;
      }

      setIsSchemaPending(false);
      if (user) {
        await loadUserData(user);
      }
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadUserData]);

  // Check existing session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const { user: sessionUser } = await authService.getSession();
        if (isMounted) {
          if (sessionUser) {
            setUser(sessionUser);
            await loadUserData(sessionUser);
          } else {
            setUser(null);
            setProfile(null);
            setSpaces([]);
            setMemberships([]);
            setCurrentSpaceState(null);
          }
        }
      } catch (err) {
        console.error('Check session error:', err);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    checkSession();

    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange(async (_event, session) => {
          if (!isMounted) return;
          if (session?.user) {
            const authUser: AuthUser = {
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name,
            };
            setUser(authUser);
            await loadUserData(authUser);
          } else {
            setUser(null);
            setProfile(null);
            setSpaces([]);
            setMemberships([]);
            setCurrentSpaceState(null);
          }
          setIsInitializing(false);
        })
      : { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const setCurrentSpace = (space: Space) => {
    setCurrentSpaceState(space);
    if (user) {
      localStorage.setItem(`poupagaio_active_space_${user.id}`, space.id);
    }
  };

  const signUp = async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
    setIsLoading(true);
    try {
      const { user: newUser, error, needsEmailConfirmation } = await authService.signUp({ email, password, fullName });
      if (error) {
        return { error, needsEmailConfirmation: false };
      }
      if (needsEmailConfirmation) {
        return { error: null, needsEmailConfirmation: true };
      }
      if (newUser) {
        setUser(newUser);
        await loadUserData(newUser);
      }
      return { error: null, needsEmailConfirmation: false };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro inesperado.'), needsEmailConfirmation: false };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const { user: authUser, error } = await authService.signIn({ email, password });
      if (error || !authUser) {
        return { error: error || new Error('Credenciais inválidas.') };
      }

      setUser(authUser);
      await loadUserData(authUser);
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao conectar.') };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('poupagaio_theme_session');
      }
      await authService.signOut();
      setUser(null);
      setProfile(null);
      setSpaces([]);
      setMemberships([]);
      setCurrentSpaceState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (newPassword: string) => {
    setIsLoading(true);
    try {
      return await authService.updatePassword(newPassword);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    return await authService.resetPassword(email);
  };

  const updateProfileName = async (newName: string) => {
    if (!user) return { error: new Error('Usuário não autenticado.') };
    try {
      const updated = await profileService.updateProfile(user.id, { full_name: newName });
      if (updated) {
        setProfile(updated);
      }
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao atualizar perfil.') };
    }
  };

  const createSpace = async (name: string, type: 'personal' | 'couple' | 'family' | 'business') => {
    if (!user) return { error: new Error('Usuário não autenticado.') };
    try {
      setIsLoading(true);
      const newSpace = await spaceService.createSpace(user.id, name, type);
      if (newSpace) {
        const userSpaces = await spaceService.getUserSpaces(user.id);
        setSpaces(userSpaces);
        const userMemberships = await spaceService.getUserMemberships(user.id);
        setMemberships(userMemberships);
        setCurrentSpace(newSpace);
        return { error: null, space: newSpace };
      }
      return { error: new Error('Erro ao criar espaço.') };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao criar espaço.') };
    } finally {
      setIsLoading(false);
    }
  };

  const updateSpaceName = async (spaceId: string, newName: string) => {
    if (!user) return { error: new Error('Usuário não autenticado.') };
    try {
      setIsLoading(true);
      const updatedSpace = await spaceService.updateSpaceName(spaceId, newName);
      if (updatedSpace) {
        const userSpaces = await spaceService.getUserSpaces(user.id);
        setSpaces(userSpaces);
        const userMemberships = await spaceService.getUserMemberships(user.id);
        setMemberships(userMemberships);
        if (currentSpace?.id === spaceId) {
          setCurrentSpaceState(updatedSpace);
        }
        return { error: null, space: updatedSpace };
      }
      return { error: new Error('Erro ao atualizar nome do espaço.') };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao atualizar nome do espaço.') };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSpace = async (spaceId: string): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Usuário não autenticado.') };
    try {
      setIsLoading(true);
      const res = await spaceService.deleteSpace(spaceId);
      if (res.error) {
        return { error: new Error(res.error) };
      }

      const [userSpaces, userMemberships] = await Promise.all([
        spaceService.getUserSpaces(user.id),
        spaceService.getUserMemberships(user.id),
      ]);

      setSpaces(userSpaces);
      setMemberships(userMemberships);

      // Se o espaço excluído era o ativo no momento:
      if (currentSpace?.id === spaceId) {
        // Localiza o espaço real type='personal'
        const personalSpace = userSpaces.find((s) => s.type === 'personal') || userSpaces[0] || null;
        setCurrentSpaceState(personalSpace);
        if (personalSpace) {
          localStorage.setItem(`poupagaio_active_space_${user.id}`, personalSpace.id);
        } else {
          localStorage.removeItem(`poupagaio_active_space_${user.id}`);
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erro ao excluir espaço.') };
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        spaces,
        memberships,
        currentSpace,
        isLoading,
        isInitializing,
        isSchemaPending,
        recheckSchema,
        setCurrentSpace,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        updateProfileName,
        createSpace,
        updateSpaceName,
        deleteSpace,
        refreshData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
