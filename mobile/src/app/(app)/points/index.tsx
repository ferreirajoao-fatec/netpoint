import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { usePoints } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { Badge, EmptyState, ErrorView, Fab, Input, ListItem, Loading, Screen, Segmented } from '@/components/ui';
import { useTheme } from '@/theme';
import { pad2 } from '@/lib/labels';

export default function PointsScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ unmapped?: string }>();
  const { canEdit } = usePermissions();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unmapped'>(params.unmapped ? 'unmapped' : 'all');
  const { data, isLoading, error, refetch, isRefetching } = usePoints(q.trim(), filter === 'unmapped');

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching} footer={canEdit && <Fab label="Novo" onPress={() => router.push('/points/form')} />}>
      <Stack.Screen options={{ title: 'Pontos de rede' }} />
      <Input icon="magnify" placeholder="Ex.: RH-PT-07, Sala RH…" value={q} onChangeText={setQ} autoCapitalize="characters" autoCorrect={false} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'unmapped', label: 'Sem identificação' },
        ]}
      />
      {isLoading && <Loading />}
      {error && <ErrorView error={error} onRetry={refetch} />}
      {data?.length === 0 && (
        <EmptyState
          icon="ethernet"
          title={filter === 'unmapped' ? 'Todos os pontos estão identificados 🎉' : 'Nenhum ponto de rede'}
          message={filter === 'unmapped' ? undefined : 'Cadastre as tomadas de rede com uma identificação, como RH-PT-01.'}
        />
      )}
      {data?.map((p) => {
        const t = p.trace;
        const mapped = !!t?.switch;
        return (
          <ListItem
            key={p.id}
            icon="ethernet"
            iconColor={mapped ? '#0891B2' : colors.danger}
            title={p.code}
            subtitle={[
              p.location ?? p.room?.name ?? 'Sem local',
              t?.device ? `🖥 ${t.device.name}` : 'Sem equipamento',
              t?.switch ? `${t.switch.name} · Porta ${pad2(t.switch.port)}` : null,
            ].filter(Boolean).join('\n')}
            right={!mapped ? <Badge label="Sem switch" color={colors.dangerSoft} textColor={colors.danger} /> : undefined}
            onPress={() => router.push(`/points/${p.id}`)}
          />
        );
      })}
    </Screen>
  );
}
