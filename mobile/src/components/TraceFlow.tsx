import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, spacing, useTheme } from '@/theme';
import type { Trace } from '@/api/types';
import { deviceTypeIcon, IconName, pad2 } from '@/lib/labels';

interface Step {
  key: string;
  icon: IconName;
  color: string;
  kicker: string;
  title: string | null;
  lines: (string | null | undefined)[];
  big?: string;
  href?: string;
}

/**
 * Caminho físico da conexão em forma de fluxo vertical:
 *   Equipamento ↓ Ponto de rede ↓ Patch panel ↓ Switch/porta
 * Etapas desconhecidas aparecem tracejadas como "não identificado".
 */
export function TraceFlow({ trace, compact }: { trace: Trace; compact?: boolean }) {
  const { colors } = useTheme();
  const d = trace.device;
  const p = trace.point;
  const pp = trace.patchPanel;
  const sw = trace.switch;

  const steps: Step[] = [
    {
      key: 'device',
      icon: d ? deviceTypeIcon(d.type) : 'desktop-classic',
      color: '#7C3AED',
      kicker: 'Equipamento',
      title: d?.name ?? null,
      lines: d ? [[d.responsibleUser, d.department].filter(Boolean).join(' · '), compact ? null : d.hostname, compact ? null : d.ipAddress] : [],
      href: d ? `/devices/${d.id}` : undefined,
    },
    {
      key: 'point',
      icon: 'ethernet',
      color: '#0891B2',
      kicker: 'Ponto de rede',
      title: p?.code ?? null,
      lines: p ? [compact ? p.room : p.location] : [],
      href: p ? `/points/${p.id}` : undefined,
    },
    {
      key: 'patch',
      icon: 'view-grid-outline',
      color: '#EA580C',
      kicker: 'Patch panel',
      title: pp?.name ?? null,
      big: pp ? `Porta ${pad2(pp.port)}` : undefined,
      lines: pp && !compact ? [pp.rack] : [],
      href: pp ? `/patch-panels/${pp.id}` : undefined,
    },
    {
      key: 'switch',
      icon: 'switch',
      color: '#16A34A',
      kicker: 'Switch',
      title: sw?.name ?? null,
      big: sw ? `Porta ${pad2(sw.port)}` : undefined,
      lines: sw && !compact ? [sw.ipAddress, sw.rack] : [],
      href: sw ? `/switches/${sw.id}?port=${sw.port}` : undefined,
    },
  ];

  // Sem patch panel mas com switch: ligação direta, omite a etapa
  const visible = steps.filter((s) => !(s.key === 'patch' && !pp && sw && p));

  return (
    <View>
      {visible.map((s, i) => (
        <View key={s.key}>
          {i > 0 && (
            <View style={{ alignItems: 'center', paddingVertical: compact ? 2 : 6 }}>
              <MaterialCommunityIcons name="arrow-down-thick" size={compact ? 18 : 24} color={colors.textMuted} />
              {!compact && <Text style={{ color: colors.textMuted, fontSize: 12 }}>conectado ao</Text>}
            </View>
          )}
          <StepCard step={s} compact={compact} />
        </View>
      ))}
      {!compact && trace.cableLabel && (
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }}>Cabo: {trace.cableLabel}</Text>
      )}
    </View>
  );
}

function StepCard({ step, compact }: { step: Step; compact?: boolean }) {
  const { colors } = useTheme();
  const known = !!step.title;
  const lines = step.lines.filter(Boolean) as string[];
  return (
    <Pressable
      disabled={!step.href}
      onPress={() => step.href && router.push(step.href as never)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: compact ? spacing.sm + 2 : spacing.lg,
        borderRadius: radius.lg,
        borderWidth: known ? 0 : 1.5,
        borderStyle: known ? 'solid' : 'dashed',
        borderColor: colors.border,
        borderLeftWidth: known ? 6 : 1.5,
        borderLeftColor: known ? step.color : colors.border,
        backgroundColor: known ? colors.surface : 'transparent',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: compact ? 34 : 48,
          height: compact ? 34 : 48,
          borderRadius: 24,
          backgroundColor: known ? step.color + '22' : colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name={step.icon} size={compact ? 18 : 26} color={known ? step.color : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{step.kicker}</Text>
        <Text style={{ color: known ? colors.text : colors.textMuted, fontSize: compact ? 15 : 18, fontWeight: '700' }} numberOfLines={1}>
          {step.title ?? 'Não identificado'}
        </Text>
        {lines.map((l, i) => (
          <Text key={i} style={{ color: colors.textMuted, fontSize: compact ? 12 : 14 }} numberOfLines={1}>
            {l}
          </Text>
        ))}
      </View>
      {step.big && (
        <View style={{ backgroundColor: step.color, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: compact ? 4 : 8 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: compact ? 13 : 16 }}>{step.big}</Text>
        </View>
      )}
    </Pressable>
  );
}
