'use client';

import { useState, useEffect } from 'react';
import { type UserProfile } from '@smex/shared';
import { fetchWithAuth } from './api';

export interface UseAuthReturn {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const res = await fetchWithAuth('/api/v1/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            const raw = data.user || data;
            setUser({
              uid: raw.uid || raw.id,
              inGameId: raw.inGameId || raw.profile?.inGameId || null,
              email: raw.email,
              phoneNumber: raw.phoneNumber || null,
              ign: raw.ign || raw.profile?.username || raw.username || '',
              avatarPreset: raw.avatarPreset || raw.profile?.avatarPreset || 'preset_default_01',
              emailVerified: Boolean(raw.emailVerified),
              role: raw.role,
              isBanned: raw.isBanned,
              banReason: raw.banReason,
            });
          }
        } else {
          if (mounted) {
            setUser(null);
          }
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isStaff = user?.role === 'manager' || user?.role === 'admin';

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    isManager,
    isStaff,
  };
}
