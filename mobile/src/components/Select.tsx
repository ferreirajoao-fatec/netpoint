import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, spacing, useTheme } from '@/theme';
import type { IconName } from '@/lib/labels';
import { Input, Row, Title } from './ui';

export interface Option {
  value: string;
  label: string;
  subtitle?: string | null;
  icon?: IconName;
}

/**
 * Campo de seleção que abre uma lista em tela cheia com busca —
 * mais fácil de usar no celular do que um dropdown pequeno.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = 'Selecionar',
  title,
  allowClear = true,
  icon,
}: {
  value: string | null | undefined;
  options: Option[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  title?: string;
  allowClear?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return options;
    return options.filter((o) => o.label.toLowerCase().includes(f) || o.subtitle?.toLowerCase().includes(f));
  }, [filter, options]);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
    setFilter('');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 50,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
        }}
      >
        {(selected?.icon ?? icon) && <MaterialCommunityIcons name={(selected?.icon ?? icon)!} size={20} color={colors.textMuted} />}
        <View style={{ flex: 1, paddingVertical: 8 }}>
          <Text style={{ color: selected ? colors.text : colors.textMuted, fontSize: 16 }} numberOfLines={1}>
            {selected?.label ?? placeholder}
          </Text>
          {selected?.subtitle && (
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              {selected.subtitle}
            </Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.md }}>
          <Row style={{ paddingHorizontal: spacing.lg, justifyContent: 'space-between' }}>
            <Title size={20}>{title ?? placeholder}</Title>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Fechar">
              <MaterialCommunityIcons name="close" size={28} color={colors.text} />
            </Pressable>
          </Row>
          <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
            <Input icon="magnify" placeholder="Filtrar…" value={filter} onChangeText={setFilter} autoCorrect={false} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.sm, paddingBottom: insets.bottom + 40 }}
            ListHeaderComponent={
              allowClear && value ? (
                <Pressable onPress={() => pick(null)} style={{ padding: spacing.md, marginBottom: spacing.sm }}>
                  <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 15 }}>Limpar seleção</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.xl }}>Nenhuma opção encontrada</Text>}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => pick(item.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  {item.icon && <MaterialCommunityIcons name={item.icon} size={22} color={active ? colors.primary : colors.textMuted} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.label}</Text>
                    {item.subtitle && <Text style={{ color: colors.textMuted, fontSize: 13 }}>{item.subtitle}</Text>}
                  </View>
                  {active && <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}
