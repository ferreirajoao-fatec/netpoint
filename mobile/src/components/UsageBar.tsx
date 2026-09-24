import { View } from 'react-native';
import type { PortUsage } from '@/api/types';
import { PORT_COLORS, useTheme } from '@/theme';

/** Barra de ocupação das portas de um switch. */
export function UsageBar({ usage }: { usage: PortUsage }) {
  const { colors } = useTheme();
  const parts = [
    { n: usage.used, c: PORT_COLORS.IN_USE.bg },
    { n: usage.reserved, c: PORT_COLORS.RESERVED.bg },
    { n: usage.faulty, c: PORT_COLORS.FAULTY.bg },
    { n: usage.disabled, c: PORT_COLORS.DISABLED.bg },
  ];
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, flexDirection: 'row', overflow: 'hidden' }}>
      {parts.map((p, i) => (p.n ? <View key={i} style={{ flex: p.n, backgroundColor: p.c }} /> : null))}
      {usage.available > 0 && <View style={{ flex: usage.available }} />}
    </View>
  );
}
