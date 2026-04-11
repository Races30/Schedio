import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Activity } from '@/types';

interface AuthResponse {
  error: Error | null;
  session: Session | null;
  user: User | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  activity: Activity | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  refreshActivity: (userId?: string) => Promise<Activity | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch activity', error);
      setActivity(null);
      return null;
    }

    const nextActivity = (data as Activity | null) ?? null;
    setActivity(nextActivity);
    return nextActivity;
  }, []);

  const hydrateAuth = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setActivity(null);
      setLoading(false);
      return null;
    }

    const nextActivity = await fetchActivity(nextSession.user.id);
    setLoading(false);
    return nextActivity;
  }, [fetchActivity]);

  const refreshActivity = useCallback(async (userId?: string) => {
    const targetUserId = userId ?? user?.id;

    if (!targetUserId) {
      setActivity(null);
      return null;
    }

    setLoading(true);
    const nextActivity = await fetchActivity(targetUserId);
    setLoading(false);
    return nextActivity;
  }, [fetchActivity, user?.id]);

  useEffect(() => {
    const syncAuth = (nextSession: Session | null) => {
      setLoading(true);
      void hydrateAuth(nextSession);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncAuth(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      syncAuth(currentSession);
    });

    return () => subscription.unsubscribe();
  }, [hydrateAuth]);

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    return {
      error: error as Error | null,
      session: data.session ?? null,
      user: data.user ?? null,
    };
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    return {
      error: error as Error | null,
      session: data.session ?? null,
      user: data.user ?? null,
    };
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setActivity(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, activity, loading, signUp, signIn, signOut, refreshActivity }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
