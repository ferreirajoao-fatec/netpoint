import { Pressable, Text, View } from 'react-native';
import { PORT_COLORS, radius, spacing, useTheme } from '@/theme';
import type { PortStatus } from '@/api/types';
import { pad2 } from '@/lib/labels';

export interface GridPort {
  number: number;
  status: PortStatus;
}

const PER_ROW = 8;

/**
 * Frente do switch: portas numeradas em linhas de 8, coloridas pelo status.
 * Toque em uma porta para ver o que está conectado.
 */
export function PortGrid({
  ports,
  selected,
  onPress,
  highlight,
}: {
  ports: GridPort[];
  selected?: number | null;
  onPress?: (port: GridPort) => void;
  /** Porta destacada (ex.: a porta encontrada pela busca) */
  highlight?: number | null;
}) {
  const { colors } = useTheme();
  const rows: GridPort[][] = [];
  for (let i = 0; i < ports.length; i += PER_ROW) rows.push(ports.slice(i, i + PER_ROW));

  return (
    <View style={{ backgroundColor: '#1F2937', borderRadius: radius.md, padding: spacing.sm, gap: 6 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
          {row.map((p) => {
            const c = PORT_COLORS[p.status];
            const isSelected = p.number === selected;
            const isHighlight = p.number === highlight;
            return (
              <Pressable
                key={p.number}
                onPress={onPress ? () => onPress(p) : undefined}
                accessibilityRole="button"
                accessibilityLabel={`Porta ${p.number}, ${c.label}`}
                style={({ pressed }) => ({
                  flex: 1,
                  aspectRatio: 1,
                  maxWidth: 56,
                  borderRadius: 6,
                  backgroundColor: c.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isSelected || isHighlight ? 3 : 0,
                  borderColor: isSelected ? '#FFFFFF' : '#60A5FA',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: isSelected ? 1.06 : 1 }],
                })}
              >
                <Text style={{ color: c.fg, fontWeight: '800', fontSize: 13 }}>{pad2(p.number)}</Text>
              </Pressable>
            );
          })}
          {/* completa a última linha para manter o alinhamento */}
          {row.length < PER_ROW && Array.from({ length: PER_ROW - row.length }).map((_, k) => <View key={`f${k}`} style={{ flex: 1, maxWidth: 56 }} />)}
        </View>
      ))}
      {!ports.length && <Text style={{ color: colors.textMuted, padding: spacing.md }}>Sem portas</Text>}
    </View>
  );
}

export function PortLegend() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {(Object.keys(PORT_COLORS) as PortStatus[]).map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: PORT_COLORS[s].bg }} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{PORT_COLORS[s].label}</Text>
        </View>
      ))}
    </View>
  );
}
