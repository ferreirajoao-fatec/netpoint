import { Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSwitches } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import { UsageBar } from '@/components/UsageBar';
import { Body, Card, EmptyState, ErrorView, Fab, IconBadge, Loading, Row, Screen } from '@/components/ui';

export default function SwitchesScreen() {
  const { colors } = useTheme();
  const { canEdit } = usePermissions();
  const { data, isLoading, error, refetch, isRefetching } = useSwitches();

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching} footer={canEdit && <Fab label="Novo" onPress={() => router.push('/switches/form')} />}>
      <Stack.Screen options={{ title: 'Switches' }} />
      {isLoading && <Loading />}
      {error && <ErrorView error={error} onRetry={refetch} />}
      {data?.length === 0 && <EmptyState icon="switch" title="Nenhum switch" message="Cadastre os switches da infraestrutura." />}
      {data?.map((s) => (
        <Card key={s.id} onPress={() => router.push(`/switches/${s.id}`)} style={{ gap: spacing.md }}>
          <Row gap={spacing.md}>
            <IconBadge name="switch" color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Body bold size={17}>
                {s.name}
              </Body>
              <Body muted size={13}>
                {[s.model, s.ipAddress, s.rack?.name].filter(Boolean).join(' · ')}
              </Body>
            </View>
          </Row>
          <UsageBar usage={s.usage} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{s.usage.used} em uso</Text>
            <Text style={{ color: colors.textMuted }}>
              {s.usage.available} livres de {s.portCount}
            </Text>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
