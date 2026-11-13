import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { authApi } from '../../api/authApi';
import { ApiError } from '../../api/client';
import { saveReturnTo } from './returnTo';
import type { CurrentUser } from './types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: CurrentUser }
  /** Signed in with Supabase, but the API refused the account (e.g. disabled) or is unreachable. */
  | { status: 'error'; error: ApiError | Error };

interface AuthContextValue {
  state: AuthState;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionReady(true);
    });
    // Keep this callback synchronous: Supabase warns against awaiting its own calls inside it.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  // The role comes from our API (users table), never from the token or local state.
  const me = useQuery({
    queryKey: ['auth', 'me', userId],
    queryFn: authApi.me,
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const state: AuthState = useMemo(() => {
    if (!sessionReady) return { status: 'loading' };
    if (!session) return { status: 'signedOut' };
    if (me.isPending) return { status: 'loading' };
    if (me.isError) return { status: 'error', error: me.error };
    return { status: 'signedIn', user: me.data };
  }, [sessionReady, session, me.isPending, me.isError, me.error, me.data]);

  const signInWithGoogle = useCallback(async (returnTo?: string) => {
    saveReturnTo(returnTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Drop every cached response that belonged to the previous user.
    queryClient.clear();
  }, [queryClient]);

  const retry = useCallback(() => {
    void me.refetch();
  }, [me]);

  const value = useMemo(
    () => ({ state, signInWithGoogle, signInWithPassword, signOut, retry }),
    [state, signInWithGoogle, signInWithPassword, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
