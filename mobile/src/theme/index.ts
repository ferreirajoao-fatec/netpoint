import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/store/theme';
import type { PortStatus } from '@/api/types';

const light = {
  background: '#F3F5F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F7',
  border: '#DDE3EC',
  text: '#0F172A',
  textMuted: '#5B6678',
  primary: '#2563EB',
  primarySoft: '#DBE7FF',
  onPrimary: '#FFFFFF',
  danger: '#DC2626',
  dangerSoft: '#FDE2E2',
  success: '#15803D',
  successSoft: '#DCF5E4',
  warning: '#B45309',
  warningSoft: '#FDF0D5',
  tabBar: '#FFFFFF',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

const dark: typeof light = {
  background: '#0B1120',
  surface: '#151E2F',
  surfaceAlt: '#1D283C',
  border: '#27344B',
  text: '#E8EDF5',
  textMuted: '#93A1B8',
  primary: '#5B8DEF',
  primarySoft: '#1C2D52',
  onPrimary: '#FFFFFF',
  danger: '#F87171',
  dangerSoft: '#3B1717',
  success: '#4ADE80',
  successSoft: '#12301E',
  warning: '#FBBF24',
  warningSoft: '#3A2A0B',
  tabBar: '#111827',
  shadow: 'rgba(0, 0, 0, 0.4)',
};

export type Colors = typeof light;

/** Cores das portas: iguais nos dois temas para o técnico reconhecer o status de relance. */
export const PORT_COLORS: Record<PortStatus, { bg: string; fg: string; label: string }> = {
  IN_USE: { bg: '#16A34A', fg: '#FFFFFF', label: 'Em uso' },
  AVAILABLE: { bg: '#CBD5E1', fg: '#1E293B', label: 'Disponível' },
  RESERVED: { bg: '#F59E0B', fg: '#1F1300', label: 'Reservada' },
  DISABLED: { bg: '#475569', fg: '#E2E8F0', label: 'Desativada' },
  FAULTY: { bg: '#DC2626', fg: '#FFFFFF', label: 'Com problema' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

export function useTheme() {
  const system = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
