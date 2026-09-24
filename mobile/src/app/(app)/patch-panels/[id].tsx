import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { deleteEntity, usePatchPanel, useSave } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { spacing } from '@/theme';
import { Body, Button, Card, ErrorView, Loading, Screen, SectionTitle, Title, confirm, notify } from '@/components/ui';
import { HeaderButtons } from '@/components/HeaderButtons';
import { PortGrid } from '@/components/PortGrid';
import { TraceFlow } from '@/components/TraceFlow';
import { pad2 } from '@/lib/labels';

export default function PatchPanelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEdit, canDelete } = usePermissions();
  const { data: pp, isLoading, error, refetch, isRefetching } = usePatchPanel(id);
  const [selected, setSelected] = useState<number | null>(null);
  const remove = useSave(() => deleteEntity('patch-panels', id));

  if (isLoading) return <Loading />;
  if (error || !pp) return <ErrorView error={error} onRetry={refetch} />;

  const used = pp.ports.filter((p) => p.trace).length;
  const current = pp.ports.find((p) => p.number === selected);

  const onDelete = () =>
    confirm('Excluir patch panel', `Excluir "${pp.name}"? As conexões dos pontos perdem o trecho do patch panel.`, () =>
      remove.mutate(undefined, { onSuccess: () => router.back(), onError: (e) => notify('Erro', e.message) }),
    );

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen
        options={{
          title: pp.name,
          headerRight: () => (
            <HeaderButtons buttons={[{ icon: 'pencil-outline', label: 'Editar', onPress: () => router.push({ pathname: '/patch-panels/form', params: { id: pp.id } }), hidden: !canEdit }]} />
          ),
        }}
      />
      <Card style={{ gap: spacing.xs }}>
        <Title>{pp.name}</Title>
        <Body muted>
          {pp.rack?.name ?? 'Sem rack'} · {used} de {pp.portCount} portas em uso
        </Body>
      </Card>

      <SectionTitle>Portas — toque para ver a conexão</SectionTitle>
      <PortGrid
        ports={pp.ports.map((p) => ({ number: p.number, status: p.trace ? 'IN_USE' : 'AVAILABLE' }))}
        selected={selected}
        onPress={(p) => setSelected(p.number === selected ? null : p.number)}
      />

      {current && (
        <>
          <SectionTitle>Porta {pad2(current.number)}</SectionTitle>
          {current.trace ? <TraceFlow trace={current.trace} compact /> : <Body muted>Porta livre — nenhum ponto de rede passa por ela.</Body>}
        </>
      )}

      {canDelete && <Button title="Excluir patch panel" icon="delete-outline" variant="danger" onPress={onDelete} loading={remove.isPending} style={{ marginTop: spacing.lg }} />}
    </Screen>
  );
}
