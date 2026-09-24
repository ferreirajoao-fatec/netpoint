import { Stack } from 'expo-router';
import { useHistory } from '@/api/hooks';
import { EmptyState, ErrorView, Loading, Screen } from '@/components/ui';
import { HistoryItem } from '@/components/HistoryItem';

export default function HistoryScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useHistory({ take: 100 });
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: 'Histórico de alterações' }} />
      {isLoading && <Loading />}
      {error && <ErrorView error={error} onRetry={refetch} />}
      {data?.length === 0 && <EmptyState icon="history" title="Nenhuma alteração registrada" />}
      {data?.map((h) => <HistoryItem key={h.id} entry={h} />)}
    </Screen>
  );
}
