import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, useTheme } from '@/theme';
import type { HistoryEntry } from '@/api/types';
import { ENTITY_LABEL, formatDateTime, HISTORY_ACTION } from '@/lib/labels';
import { Card, Row } from './ui';

/** Uma alteração: data, o que mudou, valor anterior → novo e quem fez. */
export function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const { colors } = useTheme();
  const action = HISTORY_ACTION[entry.action] ?? HISTORY_ACTION.UPDATE;
  const hasValues = entry.previousValue !== null || entry.newValue !== null;
  return (
    <Card style={{ gap: spacing.sm, padding: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <MaterialCommunityIcons name={action.icon} size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
            {action.label} · {ENTITY_LABEL[entry.entityType] ?? entry.entityType}
          </Text>
        </Row>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDateTime(entry.createdAt)}</Text>
      </Row>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{entry.entityLabel}</Text>
      {entry.field && <Text style={{ color: colors.textMuted, fontSize: 13 }}>{entry.field}</Text>}
      {hasValues && (
        <View style={{ gap: 4 }}>
          <Row gap={6}>
            <Text style={{ color: colors.textMuted, fontSize: 13, width: 64 }}>Anterior</Text>
            <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '600', flex: 1 }}>{entry.previousValue ?? '—'}</Text>
          </Row>
          <Row gap={6}>
            <Text style={{ color: colors.textMuted, fontSize: 13, width: 64 }}>Novo</Text>
            <Text style={{ color: colors.success, fontSize: 14, fontWeight: '600', flex: 1 }}>{entry.newValue ?? '—'}</Text>
          </Row>
        </View>
      )}
      {entry.description && <Text style={{ color: colors.textMuted, fontSize: 13 }}>{entry.description}</Text>}
      <Row gap={4}>
        <MaterialCommunityIcons name="account-outline" size={14} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{entry.userName}</Text>
      </Row>
    </Card>
  );
}
