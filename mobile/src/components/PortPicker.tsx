import { ActivityIndicator, View } from 'react-native';
import { usePatchPanel, useSwitch } from '@/api/hooks';
import type { PortStatus, SwitchUplink, Trace } from '@/api/types';
import { spacing, useTheme } from '@/theme';
import { pad2 } from '@/lib/labels';
import { Body, Card } from './ui';
import { PortGrid, PortLegend } from './PortGrid';

/**
 * Escolha visual da porta: mostra a frente do switch/patch panel e
 * avisa se a porta escolhida já está ligada a outro ponto.
 */
export function PortPicker({
  kind,
  ownerId,
  value,
  onChange,
  currentPointId,
  uplinkFromPortId,
}: {
  kind: 'switch' | 'patchPanel';
  ownerId: string | null;
  value: number | null;
  onChange: (n: number) => void;
  /** Ponto sendo editado: sua própria porta não conta como ocupada */
  currentPointId?: string;
  /** Escolha da outra ponta de um uplink: porta de origem, que não conta como ocupada */
  uplinkFromPortId?: string;
}) {
  const { colors } = useTheme();
  const sw = useSwitch(kind === 'switch' ? ownerId : null);
  const pp = usePatchPanel(kind === 'patchPanel' ? ownerId : null);
  const loading = kind === 'switch' ? sw.isLoading : pp.isLoading;
  if (!ownerId) return null;
  if (loading) return <ActivityIndicator color={colors.primary} />;

  const ports: { number: number; status: PortStatus; trace: Trace | null; uplink: SwitchUplink | null }[] =
    kind === 'switch'
      ? (sw.data?.ports ?? []).map((p) => ({ number: p.number, status: p.status, trace: p.trace, uplink: p.uplink }))
      : (pp.data?.ports ?? []).map((p) => ({ number: p.number, status: p.trace ? 'IN_USE' : 'AVAILABLE', trace: p.trace, uplink: null }));

  const chosen = ports.find((p) => p.number === value);
  const occupiedByOther = chosen?.trace?.point && chosen.trace.point.id !== currentPointId ? chosen.trace : null;
  const otherUplink = chosen?.uplink && chosen.uplink.portId !== uplinkFromPortId ? chosen.uplink : null;
  const forUplink = uplinkFromPortId !== undefined;

  return (
    <View style={{ gap: spacing.sm }}>
      <PortGrid ports={ports} selected={value} onPress={(p) => onChange(p.number)} />
      {kind === 'switch' && <PortLegend />}
      {chosen && (
        <Card style={{ padding: spacing.md, backgroundColor: occupiedByOther ? colors.warningSoft : colors.surfaceAlt, borderWidth: 0 }}>
          <Body bold>Porta {pad2(chosen.number)} selecionada</Body>
          {occupiedByOther && forUplink ? (
            <Body>{`⚠️ Ligada ao ponto ${occupiedByOther.point!.code}. Desconecte o ponto antes de usá-la como uplink.`}</Body>
          ) : occupiedByOther ? (
            <Body>
              {`⚠️ Hoje ligada ao ponto ${occupiedByOther.point!.code}${occupiedByOther.device ? ` (${occupiedByOther.device.name})` : ''}. Ao salvar, ela será transferida para este ponto.`}
            </Body>
          ) : otherUplink && forUplink ? (
            <Body>{`⚠️ Hoje é uplink para ${otherUplink.switchName} · Porta ${pad2(otherUplink.port)}. Ao salvar, esse uplink será desfeito.`}</Body>
          ) : otherUplink ? (
            <Body>{`⚠️ Uplink para ${otherUplink.switchName} · Porta ${pad2(otherUplink.port)}. Desfaça o uplink antes de ligar um ponto.`}</Body>
          ) : chosen.status === 'FAULTY' || chosen.status === 'DISABLED' ? (
            <Body>⚠️ Esta porta está marcada como {chosen.status === 'FAULTY' ? 'com problema' : 'desativada'}.</Body>
          ) : (
            <Body muted>Porta livre.</Body>
          )}
        </Card>
      )}
    </View>
  );
}
