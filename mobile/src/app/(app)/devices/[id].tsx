import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { deleteEntity, useDevice, useHistory, useSave } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { spacing } from '@/theme';
import { Body, Button, Card, ErrorView, IconBadge, InfoRow, Loading, Row, Screen, SectionTitle, Title, confirm, notify } from '@/components/ui';
import { HeaderButtons } from '@/components/HeaderButtons';
import { HistoryItem } from '@/components/HistoryItem';
import { deviceTypeIcon, deviceTypeLabel, pad2 } from '@/lib/labels';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEdit, canDelete } = usePermissions();
  const { data: d, isLoading, error, refetch, isRefetching } = useDevice(id);
  const history = useHistory({ entityType: 'Device', entityId: id, take: 5 });
  const remove = useSave(() => deleteEntity('devices', id));

  if (isLoading) return <Loading />;
  if (error || !d) return <ErrorView error={error} onRetry={refetch} />;
  const t = d.trace;

  const onDelete = () =>
    confirm('Excluir equipamento', `Excluir "${d.name}"? A conexão com o ponto de rede será liberada.`, () =>
      remove.mutate(undefined, { onSuccess: () => router.back(), onError: (e) => notify('Erro', e.message) }),
    );

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen
        options={{
          title: 'Equipamento',
          headerRight: () => (
            <HeaderButtons
              buttons={[
                { icon: 'qrcode', label: 'QR Code', onPress: () => router.push({ pathname: '/qr-code', params: { kind: 'devices', id: d.id, title: d.name } }) },
                { icon: 'pencil-outline', label: 'Editar', onPress: () => router.push({ pathname: '/devices/form', params: { id: d.id } }), hidden: !canEdit },
              ]}
            />
          ),
        }}
      />

      <Card style={{ gap: spacing.md }}>
        <Row gap={spacing.md}>
          <IconBadge name={deviceTypeIcon(d.type)} color="#7C3AED" size={56} />
          <View style={{ flex: 1 }}>
            <Title>{d.name}</Title>
            <Body muted>{deviceTypeLabel(d.type)}</Body>
          </View>
        </Row>
        <View>
          <InfoRow icon="account-outline" label="Usuário" value={d.responsibleUser} />
          <InfoRow icon="account-group-outline" label="Setor" value={d.department?.name} />
          <InfoRow icon="door" label="Sala" value={d.room?.name} />
          <InfoRow icon="monitor" label="Hostname" value={d.hostname} mono />
          <InfoRow icon="ip-network-outline" label="IP" value={d.ipAddress} mono />
          <InfoRow icon="barcode" label="MAC" value={d.macAddress} mono />
          <InfoRow icon="tag-outline" label="Patrimônio" value={d.assetTag} />
          {(d.type === 'IP_PHONE' || d.extension) && <InfoRow icon="phone-outline" label="Ramal" value={d.extension} />}
        </View>
      </Card>

      <SectionTitle>Conexão</SectionTitle>
      <Card>
        <InfoRow icon="ethernet" label="Ponto de rede" value={t.point?.code} />
        <InfoRow icon="view-grid-outline" label="Patch panel" value={t.patchPanel ? `${t.patchPanel.name} · Porta ${pad2(t.patchPanel.port)}` : null} />
        <InfoRow icon="switch" label="Switch" value={t.switch?.name} />
        <InfoRow icon="numeric" label="Porta" value={t.switch ? pad2(t.switch.port) : null} />
      </Card>
      <Button title="Ver caminho da conexão" icon="transit-connection-variant" onPress={() => router.push({ pathname: '/trace', params: { deviceId: d.id } })} />

      {d.notes && (
        <>
          <SectionTitle>Observações</SectionTitle>
          <Card>
            <Body>{d.notes}</Body>
          </Card>
        </>
      )}

      {!!history.data?.length && <SectionTitle>Histórico</SectionTitle>}
      {history.data?.map((h) => <HistoryItem key={h.id} entry={h} />)}

      {canDelete && <Button title="Excluir equipamento" icon="delete-outline" variant="danger" onPress={onDelete} loading={remove.isPending} style={{ marginTop: spacing.lg }} />}
    </Screen>
  );
}
