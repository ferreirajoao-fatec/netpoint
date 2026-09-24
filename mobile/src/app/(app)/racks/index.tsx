import { Stack, router } from 'expo-router';
import { useRacks } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { EmptyState, ErrorView, Fab, ListItem, Loading, Screen } from '@/components/ui';

export default function RacksScreen() {
  const { canEdit } = usePermissions();
  const { data, isLoading, error, refetch, isRefetching } = useRacks();

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching} footer={canEdit && <Fab label="Novo" onPress={() => router.push('/racks/form')} />}>
      <Stack.Screen options={{ title: 'Racks' }} />
      {isLoading && <Loading />}
      {error && <ErrorView error={error} onRetry={refetch} />}
      {data?.length === 0 && <EmptyState icon="server" title="Nenhum rack" message="Cadastre os racks para organizar switches e patch panels." />}
      {data?.map((r) => (
        <ListItem
          key={r.id}
          icon="server"
          iconColor="#0F766E"
          title={r.name}
          subtitle={[r.location ?? 'Sem local', `${r._count?.switches ?? 0} switches · ${r._count?.patchPanels ?? 0} patch panels`].join('\n')}
          onPress={() => router.push(`/racks/${r.id}`)}
        />
      ))}
    </Screen>
  );
}
