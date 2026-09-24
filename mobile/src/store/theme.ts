import { create } from 'zustand';
import { storage } from '@/lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  setMode: (mode) => {
    set({ mode });
    storage.set('netpoint.theme', mode);
  },
  hydrate: async () => {
    const saved = (await storage.get('netpoint.theme')) as ThemeMode | null;
    if (saved) set({ mode: saved });
  },
}));
