import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { spacing, useTheme } from '@/theme';
import { Body, Button, Card, EmptyState, Field, Input, Screen } from '@/components/ui';
import { routeFromQr } from '@/lib/qr';

/** Leitor de QR Code: abre direto a tela do switch, rack, ponto ou equipamento etiquetado. */
export default function QrScannerScreen() {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const handled = useRef(false);

  // A câmera só fica ligada enquanto a aba está visível
  useFocusEffect(
    useCallback(() => {
      handled.current = false;
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  const open = (data: string) => {
    const route = routeFromQr(data);
    if (!route) {
      setMessage('Este QR Code não é uma etiqueta do NetPoint.');
      return false;
    }
    setMessage(null);
    router.push(route as never);
    return true;
  };

  const onScan = ({ data }: { data: string }) => {
    if (handled.current) return;
    handled.current = true;
    if (!open(data)) setTimeout(() => (handled.current = false), 1500);
  };

  if (!permission) return <Screen>{null}</Screen>;

  return (
    <Screen>
      {!permission.granted ? (
        <Card>
          <EmptyState
            icon="camera-outline"
            title="Permita o uso da câmera"
            message="A câmera é usada apenas para ler os QR Codes colados nos switches, racks e pontos de rede."
            action={<Button title="Permitir câmera" icon="camera" onPress={requestPermission} />}
          />
        </Card>
      ) : (
        <View style={styles.cameraBox}>
          {active && (
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
          )}
          <View pointerEvents="none" style={styles.frameWrap}>
            <View style={styles.frame} />
            <Text style={styles.hint}>Aponte para a etiqueta QR</Text>
          </View>
        </View>
      )}

      {message && (
        <Card style={{ backgroundColor: colors.warningSoft, borderWidth: 0 }}>
          <Body bold>{message}</Body>
        </Card>
      )}

      <Card style={{ gap: spacing.md }}>
        <Field label="Sem câmera? Cole o código da etiqueta" hint="Ex.: netpoint://switches/…">
          <Input value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} placeholder="netpoint://…" />
        </Field>
        <Button title="Abrir" icon="open-in-app" variant="secondary" disabled={!manual.trim()} onPress={() => open(manual)} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraBox: { height: 380, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: { width: 220, height: 220, borderRadius: 24, borderWidth: 4, borderColor: '#FFFFFFDD' },
  hint: { color: '#fff', fontWeight: '700', fontSize: 16, textShadowColor: '#000', textShadowRadius: 6 },
});
