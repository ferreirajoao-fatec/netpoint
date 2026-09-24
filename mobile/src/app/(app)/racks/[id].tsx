import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { deleteEntity, useRack, useSave } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { spacing } from '@/theme';
import { Body, Button, Card, ErrorView, IconBadge, InfoRow, ListItem, Loading, Row, Screen, SectionTitle, Title, confirm, notify } from '@/components/ui';
import { HeaderButtons } from '@/components/HeaderButtons';
import { UsageBar } from '@/components/UsageBar';

/** Rack: switches e patch panels instalados. Também é aberto pelo QR Code colado no rack. */
export default function RackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEdit, canDelete } = usePermissions();
  const { data: r, isLoading, error, refetch, isRefetching } = useRack(id);
  const remove = useSave(() => deleteEntity('racks', id));

  if (isLoading) return <Loading />;
  if (error || !r) return <ErrorView error={error} onRetry={refetch} />;

  const onDelete = () =>
    confirm('Excluir rack', `Excluir "${r.name}"? Switches e patch panels continuam cadastrados, apenas sem rack.`, () =>
      remove.mutate(undefined, { onSuccess: () => router.back(), onError: (e) => notify('Erro', e.message) }),
    );

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen
        options={{
          title: r.name,
          headerRight: () => (
            <HeaderButtons
              buttons={[
                { icon: 'qrcode', label: 'QR Code', onPress: () => router.push({ pathname: '/qr-code', params: { kind: 'racks', id: r.id, title: r.name } }) },
                { icon: 'pencil-outline', label: 'Editar', onPress: () => router.push({ pathname: '/racks/form', params: { id: r.id } }), hidden: !canEdit },
              ]}
            />
          ),
        }}
      />
      <Card style={{ gap: spacing.sm }}>
        <Row gap={spacing.md}>
          <IconBadge name="server" color="#0F766E" size={52} />
          <Title>{r.name}</Title>
        </Row>
        <InfoRow icon="map-marker-outline" label="Local" value={r.location} />
        {r.notes && <InfoRow icon="note-text-outline" label="Observações" value={r.notes} />}
      </Card>

      <SectionTitle>Switches</SectionTitle>
      {r.switches.length === 0 && <Body muted>Nenhum switch neste rack.</Body>}
      {r.switches.map((s) => (
        <Card key={s.id} onPress={() => router.push(`/switches/${s.id}`)} style={{ gap: spacing.sm }}>
          <Row gap={spacing.md}>
            <IconBadge name="switch" color="#16A34A" size={40} />
            <View style={{ flex: 1 }}>
              <Body bold>{s.name}</Body>
              <Body muted size={13}>
                {s.usage.used} em uso · {s.usage.available} livres de {s.portCount}
              </Body>
            </View>
          </Row>
          <UsageBar usage={s.usage} />
        </Card>
      ))}

      <SectionTitle>Patch panels</SectionTitle>
      {r.patchPanels.length === 0 && <Body muted>Nenhum patch panel neste rack.</Body>}
      {r.patchPanels.map((p) => (
        <ListItem
          key={p.id}
          icon="view-grid-outline"
          iconColor="#EA580C"
          title={p.name}
          subtitle={`${p.usedPorts} de ${p.portCount} portas em uso`}
          onPress={() => router.push(`/patch-panels/${p.id}`)}
        />
      ))}
      {canEdit && <Button title="Adicionar patch panel" icon="plus" variant="secondary" onPress={() => router.push({ pathname: '/patch-panels/form', params: { rackId: r.id } })} />}
      {canDelete && <Button title="Excluir rack" icon="delete-outline" variant="danger" onPress={onDelete} loading={remove.isPending} style={{ marginTop: spacing.lg }} />}
    </Screen>
  );
}
