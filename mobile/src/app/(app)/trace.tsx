import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTrace } from '@/api/hooks';
import { spacing, useTheme } from '@/theme';
import { Badge, Body, Button, Card, ErrorView, Loading, Row, Screen } from '@/components/ui';
import { TraceFlow } from '@/components/TraceFlow';
import { pad2 } from '@/lib/labels';

/** "Ver caminho da conexão": Equipamento → Ponto → Patch panel → Switch/porta. */
export default function TraceScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ deviceId?: string; pointId?: string; switchPortId?: string }>();
  const { data: trace, isLoading, error, refetch, isRefetching } = useTrace(params);

  if (isLoading) return <Loading label="Rastreando conexão…" />;
  if (error || !trace) return <ErrorView error={error} onRetry={refetch} />;

  const sw = trace.switch;
  const answer = trace.device && sw
    ? `${trace.device.name} está na porta ${pad2(sw.port)} do ${sw.name}.`
    : sw && trace.point
      ? `O ponto ${trace.point.code} chega na porta ${pad2(sw.port)} do ${sw.name}.`
      : null;

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: 'Caminho da conexão' }} />

      <Card style={{ backgroundColor: trace.complete ? colors.successSoft : colors.warningSoft, borderWidth: 0, gap: spacing.sm }}>
        <Row>
          <Badge
            label={trace.complete ? 'Caminho completo' : 'Caminho incompleto'}
            color={trace.complete ? colors.success : colors.warning}
            textColor={trace.complete ? '#fff' : '#1F1300'}
          />
        </Row>
        <Body bold size={16}>
          {answer ?? 'Parte do caminho ainda não foi identificada. Complete o cadastro do ponto de rede.'}
        </Body>
      </Card>

      <TraceFlow trace={trace} />

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {sw && <Button title={`Abrir ${sw.name}`} icon="switch" variant="secondary" onPress={() => router.push(`/switches/${sw.id}?port=${sw.port}`)} />}
        {trace.point && (
          <Button title={`Editar ponto ${trace.point.code}`} icon="pencil-outline" variant="ghost" onPress={() => router.push({ pathname: '/points/form', params: { id: trace.point!.id } })} />
        )}
      </View>
    </Screen>
  );
}
