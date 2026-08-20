import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from './config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('jwt') || null);
  const [user, setUser] = useState(null); // { Username, IsAdmin, allowedWells }
  const [loading, setLoading] = useState(!!token);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('jwt');
  }, []);

  const fetchMe = useCallback(async (tkn) => {
    if (!tkn) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${tkn}` } });
      if (!res.ok) throw new Error('Failed me');
      const data = await res.json();
      setUser({ ...data.user, allowedWells: data.allowedWells });
    } catch (e) {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) fetchMe(token);
  }, [token, fetchMe]);

  const login = async (username, password) => {
    const tried = [];
    const activeBase = (typeof window !== 'undefined' && window.API_BASE) || API_BASE;
    // Candidate order: current base, explicit 5000, explicit 7157 (backend script default), optional stored override
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('api_base_active') : null;
    const candidatesRaw = [stored, activeBase, 'http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:7157', 'http://127.0.0.1:7157'];
    const candidates = Array.from(new Set(candidatesRaw.filter(Boolean)));

    const attemptFetch = (base) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000); // 6s timeout
      return fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      }).finally(() => clearTimeout(timer));
    };

    let lastError = null;
    for (const base of candidates) {
      console.log('[auth] Attempt login', { base, username });
      try {
        const res = await attemptFetch(base);
        let text = '';
        try { text = await res.text(); } catch { /* ignore */ }
        let dataParsed = null;
        try { dataParsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }
        if (!res.ok) {
          const detail = dataParsed?.detail || text || `HTTP ${res.status}`;
            console.warn('[auth] Failed on base', { base, status: res.status, detail });
          tried.push({ base, status: res.status, detail });
          lastError = new Error(detail);
          continue; // try next
        }
        if (!dataParsed?.token) {
          console.warn('[auth] No token in response', { base, body: text });
          tried.push({ base, status: res.status, detail: 'No token in response' });
          lastError = new Error('No token returned');
          continue;
        }
        // Success – persist chosen base
        if (typeof localStorage !== 'undefined') localStorage.setItem('api_base_active', base);
        if (typeof window !== 'undefined') window.API_BASE = base;
        localStorage.setItem('jwt', dataParsed.token);
        setToken(dataParsed.token);
        await fetchMe(dataParsed.token);
        return dataParsed;
      } catch (err) {
        const msg = err?.name === 'AbortError' ? 'Timeout' : (err?.message || 'Network error');
        console.error('[auth] Network attempt error', { base, msg });
        tried.push({ base, status: 'NETWORK', detail: msg });
        lastError = new Error(msg);
        continue;
      }
    }
    const summary = tried.map(t => `${t.base} => ${t.status} (${t.detail})`).join('\n');
    throw new Error(`Login failed. Attempts:\n${summary}\nLast: ${lastError?.message}`);
  };

  const boundAuthFetch = useCallback((url, options={}) => {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }, [token]);

  const value = { token, user, login, logout, loading, isAdmin: !!user?.IsAdmin, authFetch: boundAuthFetch };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function authFetch(url, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
