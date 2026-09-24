import { Stack, router, useLocalSearchParams } from 'expo-router';
import { deleteEntity, useHistory, usePoint, useSave } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { spacing } from '@/theme';
import { Body, Button, Card, ErrorView, InfoRow, Loading, Screen, SectionTitle, Title, confirm, notify } from '@/components/ui';
import { HeaderButtons } from '@/components/HeaderButtons';
import { HistoryItem } from '@/components/HistoryItem';
import { TraceFlow } from '@/components/TraceFlow';

export default function PointDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEdit, canDelete } = usePermissions();
  const { data: p, isLoading, error, refetch, isRefetching } = usePoint(id);
  const history = useHistory({ entityType: 'NetworkPoint', entityId: id, take: 10 });
  const remove = useSave(() => deleteEntity('points', id));

  if (isLoading) return <Loading />;
  if (error || !p) return <ErrorView error={error} onRetry={refetch} />;

  const onDelete = () =>
    confirm('Excluir ponto de rede', `Excluir o ponto ${p.code}? A porta do switch e do patch panel serão liberadas.`, () =>
      remove.mutate(undefined, { onSuccess: () => router.back(), onError: (e) => notify('Erro', e.message) }),
    );

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen
        options={{
          title: 'Ponto de rede',
          headerRight: () => (
            <HeaderButtons
              buttons={[
                { icon: 'qrcode', label: 'QR Code', onPress: () => router.push({ pathname: '/qr-code', params: { kind: 'points', id: p.id, title: p.code } }) },
                { icon: 'pencil-outline', label: 'Editar', onPress: () => router.push({ pathname: '/points/form', params: { id: p.id } }), hidden: !canEdit },
              ]}
            />
          ),
        }}
      />

      <Card style={{ gap: spacing.sm }}>
        <Title size={28}>{p.code}</Title>
        <InfoRow icon="map-marker-outline" label="Local" value={p.location} />
        <InfoRow icon="account-group-outline" label="Setor" value={p.department?.name} />
        {p.trace?.cableLabel && <InfoRow icon="cable-data" label="Cabo" value={p.trace.cableLabel} />}
      </Card>

      <SectionTitle>Caminho da conexão</SectionTitle>
      {p.trace && <TraceFlow trace={p.trace} />}

      {canEdit && !p.trace?.device && (
        <Button title="Ligar um equipamento neste ponto" icon="link-variant" variant="secondary" onPress={() => router.push({ pathname: '/points/form', params: { id: p.id } })} />
      )}

      {p.notes && (
        <>
          <SectionTitle>Observações</SectionTitle>
          <Card>
            <Body>{p.notes}</Body>
          </Card>
        </>
      )}

      {!!history.data?.length && <SectionTitle>Histórico</SectionTitle>}
      {history.data?.map((h) => <HistoryItem key={h.id} entry={h} />)}

      {canDelete && <Button title="Excluir ponto" icon="delete-outline" variant="danger" onPress={onDelete} loading={remove.isPending} style={{ marginTop: spacing.lg }} />}
    </Screen>
  );
}
