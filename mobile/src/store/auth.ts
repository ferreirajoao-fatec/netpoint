import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { storage } from '@/lib/storage';
import type { Role, User } from '@/api/types';

/**
 * Endereço padrão da API: no navegador usa localhost; no celular com Expo Go,
 * usa o IP do computador que está servindo o app (mesma rede Wi-Fi).
 */
function defaultApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') return 'http://localhost:3000/api';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000/api` : 'http://192.168.0.10:3000/api';
}

interface AuthState {
  ready: boolean;
  token: string | null;
  user: User | null;
  apiUrl: string;
  setSession: (token: string, user: User) => Promise<void>;
  setApiUrl: (url: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  ready: false,
  token: null,
  user: null,
  apiUrl: defaultApiUrl(),
  setSession: async (token, user) => {
    set({ token, user });
    await storage.set('netpoint.token', token);
    await storage.set('netpoint.user', JSON.stringify(user));
  },
  setApiUrl: async (url) => {
    const clean = url.trim().replace(/\/+$/, '');
    set({ apiUrl: clean });
    await storage.set('netpoint.apiUrl', clean);
  },
  logout: async () => {
    set({ token: null, user: null });
    await storage.set('netpoint.token', null);
    await storage.set('netpoint.user', null);
  },
  hydrate: async () => {
    const [token, user, apiUrl] = await Promise.all([
      storage.get('netpoint.token'),
      storage.get('netpoint.user'),
      storage.get('netpoint.apiUrl'),
    ]);
    set({
      ready: true,
      token,
      user: user ? JSON.parse(user) : null,
      ...(apiUrl ? { apiUrl } : {}),
    });
  },
}));

/** Permissões por perfil, espelhando as regras do backend. */
export function usePermissions() {
  const role = useAuth((s) => s.user?.role) as Role | undefined;
  return {
    role,
    canEdit: role === 'ADMIN' || role === 'TECHNICIAN',
    canDelete: role === 'ADMIN',
    isAdmin: role === 'ADMIN',
  };
}
