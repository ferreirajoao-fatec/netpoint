import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useDevices } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { EmptyState, ErrorView, Fab, Input, ListItem, Loading, Screen } from '@/components/ui';
import { deviceTypeIcon, pad2 } from '@/lib/labels';

export default function DevicesScreen() {
  const { canEdit } = usePermissions();
  const [q, setQ] = useState('');
  const { data, isLoading, error, refetch, isRefetching } = useDevices(q.trim());

  return (
    <Screen
      onRefresh={refetch}
      refreshing={isRefetching}
      footer={canEdit && <Fab label="Novo" onPress={() => router.push('/devices/form')} />}
    >
      <Stack.Screen options={{ title: 'Equipamentos' }} />
      <Input icon="magnify" placeholder="Nome, usuário, hostname, IP, MAC…" value={q} onChangeText={setQ} autoCorrect={false} autoCapitalize="none" />
      {isLoading && <Loading />}
      {error && <ErrorView error={error} onRetry={refetch} />}
      {data?.length === 0 && <EmptyState icon="desktop-classic" title="Nenhum equipamento" message={q ? 'Tente outra busca.' : 'Cadastre o primeiro equipamento.'} />}
      {data?.map((d) => {
        const c = d.connection;
        const where = c ? `${c.networkPoint.code}${c.switchPort ? ` → ${c.switchPort.switch.name} · P${pad2(c.switchPort.number)}` : ''}` : 'Sem conexão';
        return (
          <ListItem
            key={d.id}
            icon={deviceTypeIcon(d.type)}
            iconColor="#7C3AED"
            title={d.name}
            subtitle={[[d.responsibleUser, d.department?.name].filter(Boolean).join(' · '), where].filter(Boolean).join('\n')}
            onPress={() => router.push(`/devices/${d.id}`)}
          />
        );
      })}
    </Screen>
  );
}
