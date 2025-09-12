import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { fetchJson } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try { await checkSession(); } finally { setReady(true); }
    })();
  }, []);

  async function checkSession() {
    try {
      const me = await fetchJson('/api/auth/session');
      if (me?.user) setSession(me);
      else setSession(null);
    } catch {
      setSession(null);
    }
  }

  async function signOutLocal() {
    // local clear only; NextAuth cookie lives in web browser session
    await AsyncStorage.removeItem('meedian_session_hint');
    setSession(null);
  }

  const value = {
    session,
    ready,
    apiBase: API_BASE,
    checkSession,
    signOutLocal,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

