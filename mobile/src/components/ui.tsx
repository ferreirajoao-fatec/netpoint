import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, spacing, useTheme } from '@/theme';
import type { IconName } from '@/lib/labels';

// ------------------------------------------------------------------ Layout

export function Screen({
  children,
  refreshing,
  onRefresh,
  padded = true,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[padded && { padding: spacing.lg }, { paddingBottom: 120, gap: spacing.md }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.75 }]} accessibilityRole="button">
      {children}
    </Pressable>
  );
}

export function Row({ children, style, gap = spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// ------------------------------------------------------------------ Texto

export function Title({ children, size = 22 }: { children: ReactNode; size?: number }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.text, fontSize: size, fontWeight: '700' }}>{children}</Text>;
}

export function Body({ children, muted, bold, size = 15, center, numberOfLines }: { children: ReactNode; muted?: boolean; bold?: boolean; size?: number; center?: boolean; numberOfLines?: number }) {
  const { colors } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={{ color: muted ? colors.textMuted : colors.text, fontSize: size, fontWeight: bold ? '600' : '400', textAlign: center ? 'center' : 'left' }}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</Text>
      {action}
    </Row>
  );
}

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? colors.text} />;
}

/** Ícone dentro de um círculo colorido — usado em cards e listas. */
export function IconBadge({ name, color, size = 44 }: { name: IconName; color?: string; size?: number }) {
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={name} size={size * 0.52} color={c} />
    </View>
  );
}

export function Badge({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: textColor ?? '#fff', fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ Botões

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    ghost: { bg: 'transparent', fg: colors.primary, border: colors.border },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <MaterialCommunityIcons name={icon} size={22} color={palette.fg} />}
          <Text style={{ color: palette.fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Botão flutuante de "novo cadastro". */
export function Fab({ onPress, icon = 'plus', label }: { onPress: () => void; icon?: IconName; label?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Adicionar'}
      style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={26} color={colors.onPrimary} />
      {label && <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

// ------------------------------------------------------------------ Formulários

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      {children}
      {hint && !error && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{hint}</Text>}
      {error && <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>}
    </View>
  );
}

export function Input(props: TextInputProps & { icon?: IconName }) {
  const { colors } = useTheme();
  const { icon, style, ...rest } = props;
  return (
    <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {icon && <MaterialCommunityIcons name={icon} size={20} color={colors.textMuted} />}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[{ flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 }, style]}
        {...rest}
      />
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: colors.surface, shadowColor: colors.shadow, elevation: 2 }]}
          >
            <Text style={{ color: active ? colors.primary : colors.textMuted, fontWeight: '700', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ Listas e informações

export function ListItem({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ paddingVertical: spacing.md }}>
      <Row gap={spacing.md}>
        {icon && <IconBadge name={icon} color={iconColor} size={42} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
        {onPress && <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />}
      </Row>
    </Card>
  );
}

/** Linha "rótulo: valor" usada nas telas de detalhes. */
export function InfoRow({ label, value, icon, mono }: { label: string; value?: string | number | null; icon?: IconName; mono?: boolean }) {
  const { colors } = useTheme();
  return (
    <Row gap={spacing.md} style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      {icon && <MaterialCommunityIcons name={icon} size={20} color={colors.textMuted} />}
      <Text style={{ color: colors.textMuted, fontSize: 14, width: 110 }}>{label}</Text>
      <Text
        selectable
        style={{ color: value ? colors.text : colors.textMuted, fontSize: 15, fontWeight: '600', flex: 1, fontFamily: mono ? Platform.select({ ios: 'Menlo', default: 'monospace' }) : undefined }}
      >
        {value ?? '—'}
      </Text>
    </Row>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <MaterialCommunityIcons name={icon} size={56} color={colors.textMuted} />
      <Body bold size={17} center>
        {title}
      </Body>
      {message && (
        <Body muted center>
          {message}
        </Body>
      )}
      {action}
    </View>
  );
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Body muted>{label}</Body>
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Algo deu errado"
      message={error instanceof Error ? error.message : String(error)}
      action={onRetry && <Button title="Tentar novamente" icon="refresh" variant="secondary" onPress={onRetry} />}
    />
  );
}

// ------------------------------------------------------------------ Diálogos

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function confirm(title: string, message: string, onConfirm: () => void, confirmLabel = 'Excluir') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    minWidth: 60,
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm },
});
