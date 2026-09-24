import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { deleteEntity, updatePort, useSave, useSwitch } from '@/api/hooks';
import type { PortStatus, SwitchDetail, SwitchPort } from '@/api/types';
import { usePermissions } from '@/store/auth';
import { PORT_COLORS, radius, spacing, useTheme } from '@/theme';
import { Badge, Body, Button, Card, ErrorView, InfoRow, Loading, Row, Screen, SectionTitle, Title, confirm, notify } from '@/components/ui';
import { HeaderButtons } from '@/components/HeaderButtons';
import { PortGrid, PortLegend } from '@/components/PortGrid';
import { Select } from '@/components/Select';
import { UsageBar } from '@/components/UsageBar';
import { pad2 } from '@/lib/labels';
import { usePointOptions } from '@/lib/options';

export default function SwitchDetailScreen() {
  const { id, port } = useLocalSearchParams<{ id: string; port?: string }>();
  const { canEdit, canDelete } = usePermissions();
  const { data: sw, isLoading, error, refetch, isRefetching } = useSwitch(id);
  const [picked, setPicked] = useState<{ from: string | undefined; number: number | null }>({ from: port, number: port ? Number(port) : null });
  // Um novo link (?port=) sobrepõe a porta escolhida manualmente
  const selected = picked.from === port ? picked.number : port ? Number(port) : null;
  const setSelected = (number: number | null) => setPicked({ from: port, number });
  const remove = useSave(() => deleteEntity('switches', id));

  if (isLoading) return <Loading />;
  if (error || !sw) return <ErrorView error={error} onRetry={refetch} />;

  const current = sw.ports.find((p) => p.number === selected) ?? null;

  const onDelete = () =>
    confirm('Excluir switch', `Excluir "${sw.name}" e o mapeamento de todas as suas portas?`, () =>
      remove.mutate(undefined, { onSuccess: () => router.back(), onError: (e) => notify('Erro', e.message) }),
    );

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen
        options={{
          title: sw.name,
          headerRight: () => (
            <HeaderButtons
              buttons={[
                { icon: 'qrcode', label: 'QR Code', onPress: () => router.push({ pathname: '/qr-code', params: { kind: 'switches', id: sw.id, title: sw.name } }) },
                { icon: 'pencil-outline', label: 'Editar', onPress: () => router.push({ pathname: '/switches/form', params: { id: sw.id } }), hidden: !canEdit },
              ]}
            />
          ),
        }}
      />

      <Card style={{ gap: spacing.sm }}>
        <Title>{sw.name}</Title>
        <Body muted>{[sw.manufacturer, sw.model, `${sw.portCount} portas`].filter(Boolean).join(' · ')}</Body>
        <UsageBar usage={sw.usage} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Body bold>{sw.usage.used} em uso</Body>
          <Body muted>{sw.usage.available} disponíveis</Body>
        </Row>
      </Card>

      <SectionTitle>Portas — toque para ver a conexão</SectionTitle>
      <PortGrid ports={sw.ports} selected={selected} onPress={(p) => setSelected(p.number === selected ? null : p.number)} />
      <PortLegend />

      {current && <PortPanel key={`${current.number}-${current.trace?.point?.id ?? ''}`} sw={sw} port={current} canEdit={canEdit} />}

      <SectionTitle>Informações</SectionTitle>
      <Card>
        <InfoRow icon="ip-network-outline" label="IP" value={sw.ipAddress} mono />
        <InfoRow icon="barcode" label="MAC" value={sw.macAddress} mono />
        <InfoRow icon="map-marker-outline" label="Local" value={sw.location} />
        <InfoRow icon="server" label="Rack" value={sw.rack?.name} />
        {sw.notes && <InfoRow icon="note-text-outline" label="Observações" value={sw.notes} />}
      </Card>
      {sw.rack && <Button title={`Abrir ${sw.rack.name}`} icon="server" variant="ghost" onPress={() => router.push(`/racks/${sw.rack!.id}`)} />}
      {canDelete && <Button title="Excluir switch" icon="delete-outline" variant="danger" onPress={onDelete} loading={remove.isPending} />}
    </Screen>
  );
}

const MANUAL_STATUSES: PortStatus[] = ['AVAILABLE', 'RESERVED', 'IN_USE', 'DISABLED', 'FAULTY'];

/** Detalhe da porta selecionada, no formato pedido: switch, porta, status, ponto, equipamento, usuário, setor, IP, hostname. */
function PortPanel({ sw, port, canEdit }: { sw: SwitchDetail; port: SwitchPort; canEdit: boolean }) {
  const { colors } = useTheme();
  const t = port.trace;
  const color = PORT_COLORS[port.status];
  const points = usePointOptions();
  const [pointId, setPointId] = useState<string | null>(t?.point?.id ?? null);

  const mutate = useSave((body: Parameters<typeof updatePort>[2]) => updatePort(sw.id, port.number, body));
  const run = (body: Parameters<typeof updatePort>[2]) => mutate.mutate(body, { onError: (e) => notify('Não foi possível alterar', e.message) });

  return (
    <Card style={{ gap: spacing.sm, borderLeftWidth: 6, borderLeftColor: color.bg }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Body muted>{sw.name}</Body>
          <Title size={26}>Porta {pad2(port.number)}</Title>
        </View>
        <Badge label={color.label} color={color.bg} textColor={color.fg} />
      </Row>

      {t ? (
        <View>
          <InfoRow icon="ethernet" label="Ponto" value={t.point?.code} />
          {t.patchPanel && <InfoRow icon="view-grid-outline" label="Patch panel" value={`${t.patchPanel.name} · Porta ${pad2(t.patchPanel.port)}`} />}
          <InfoRow icon="desktop-classic" label="Equipamento" value={t.device?.name} />
          <InfoRow icon="account-outline" label="Usuário" value={t.device?.responsibleUser} />
          <InfoRow icon="account-group-outline" label="Setor" value={t.device?.department ?? t.point?.department} />
          <InfoRow icon="ip-network-outline" label="IP" value={t.device?.ipAddress} mono />
          <InfoRow icon="monitor" label="Hostname" value={t.device?.hostname} mono />
        </View>
      ) : (
        <Body muted>{port.status === 'IN_USE' ? 'Em uso sem ponto mapeado (ex.: uplink).' : 'Nenhum ponto de rede ligado nesta porta.'}</Body>
      )}
      {port.notes && <Body muted>📝 {port.notes}</Body>}

      {t?.point && (
        <Button title="Ver caminho da conexão" icon="transit-connection-variant" variant="secondary" onPress={() => router.push({ pathname: '/trace', params: { switchPortId: port.id } })} />
      )}

      {canEdit && (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Body bold>Ponto de rede ligado nesta porta</Body>
          <Select value={pointId} options={points} onChange={setPointId} placeholder="Nenhum" title="Ligar ponto à porta" icon="ethernet" />
          {pointId !== (t?.point?.id ?? null) && (
            <Button
              title={pointId ? 'Confirmar ligação' : 'Desconectar ponto'}
              icon={pointId ? 'link-variant' : 'link-variant-off'}
              variant={pointId ? 'primary' : 'danger'}
              loading={mutate.isPending}
              onPress={() => run({ networkPointId: pointId })}
            />
          )}

          <Body bold>Status da porta</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {MANUAL_STATUSES.map((s) => {
              const active = port.storedStatus === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => !active && run({ status: s })}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radius.pill,
                    borderWidth: 2,
                    borderColor: PORT_COLORS[s].bg,
                    backgroundColor: active ? PORT_COLORS[s].bg : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? PORT_COLORS[s].fg : colors.text, fontWeight: '700', fontSize: 13 }}>{PORT_COLORS[s].label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Body muted size={12}>
            Portas com ponto ligado aparecem como “Em uso” automaticamente, exceto se marcadas como desativadas ou com problema.
          </Body>
        </View>
      )}
    </Card>
  );
}
