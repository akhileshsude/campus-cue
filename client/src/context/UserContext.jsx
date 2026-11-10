import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  computeFirstName, 
  computeInitials, 
  getTimeGreeting, 
  formatGreeting 
} from './userUtils.js';

export { computeFirstName, computeInitials, getTimeGreeting, formatGreeting };

const STORAGE_KEY = 'campus_cue_user';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  // Initialize state from localStorage or Supabase session if present
  const [user, setUser] = useState(() => {
    // 1. Check Supabase / auth session if attached to window / global
    try {
      if (typeof window !== 'undefined' && window.__SUPABASE_USER__) {
        const su = window.__SUPABASE_USER__;
        const metaName = su.user_metadata?.full_name || su.user_metadata?.name;
        const emailFallback = su.email ? su.email.split('@')[0] : '';
        return {
          name: metaName || emailFallback || '',
          email: su.email || '',
          avatarUrl: su.user_metadata?.avatar_url || '',
        };
      }
    } catch (e) {
      console.warn('Error reading Supabase session:', e);
    }

    // 2. Load from localStorage
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            return {
              name: parsed.name || '',
              email: parsed.email || '',
              avatarUrl: parsed.avatarUrl || '',
            };
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read user from localStorage:', e);
    }

    return {
      name: '',
      email: '',
      avatarUrl: '',
    };
  });

  // First run modal state: open if user has no name stored
  const [isFirstRunOpen, setIsFirstRunOpen] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return true;
        const parsed = JSON.parse(stored);
        return !parsed?.name || !parsed.name.trim();
      }
    } catch (e) {
      // safe fallback
    }
    return false;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Save to localStorage whenever user state changes
  const saveUser = useCallback((newUser) => {
    setUser(newUser);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      }
    } catch (e) {
      console.warn('Failed to write user to localStorage:', e);
    }
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const merged = { ...prev, ...updates };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      } catch (e) {
        console.warn('Failed to write user to localStorage:', e);
      }
      return merged;
    });
  }, []);

  const updateName = useCallback((newName) => {
    updateUser({ name: newName });
  }, [updateUser]);

  const initials = useMemo(() => {
    return computeInitials(user.name, user.email);
  }, [user.name, user.email]);

  const firstName = useMemo(() => {
    return computeFirstName(user.name);
  }, [user.name]);

  const greeting = useMemo(() => {
    return formatGreeting(user.name);
  }, [user.name]);

  const value = useMemo(() => ({
    user,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    initials,
    firstName,
    greeting,
    updateUser,
    updateName,
    saveUser,
    isFirstRunOpen,
    setIsFirstRunOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    openSettings: () => setIsSettingsOpen(true),
    closeSettings: () => setIsSettingsOpen(false),
  }), [
    user,
    initials,
    firstName,
    greeting,
    updateUser,
    updateName,
    saveUser,
    isFirstRunOpen,
    isSettingsOpen,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;
