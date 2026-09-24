import { useRef } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { spacing } from '@/theme';
import { Body, Button, Card, Screen, Title, notify } from '@/components/ui';
import { QR_KIND_LABEL, QrKind, qrPayload } from '@/lib/qr';

/** Etiqueta QR para imprimir e colar no switch, rack, ponto de rede ou equipamento. */
export default function QrCodeScreen() {
  const { kind, id, title } = useLocalSearchParams<{ kind: QrKind; id: string; title: string }>();
  const svg = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);
  const payload = qrPayload(kind, id);

  const share = () => {
    svg.current?.toDataURL(async (base64) => {
      try {
        const name = `qr-${title.replace(/[^\w-]+/g, '_')}.png`;
        if (Platform.OS === 'web') {
          const a = document.createElement('a');
          a.href = `data:image/png;base64,${base64}`;
          a.download = name;
          a.click();
          return;
        }
        const dir = new Directory(Paths.cache, 'qr');
        if (!dir.exists) dir.create({ intermediates: true });
        const file = new File(dir, name);
        if (file.exists) file.delete();
        file.create();
        file.write(base64, { encoding: 'base64' });
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: `QR Code — ${title}` });
      } catch (e) {
        notify('Não foi possível compartilhar', e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Etiqueta QR Code' }} />
      <Card style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl }}>
        <Body muted>{QR_KIND_LABEL[kind]}</Body>
        <Title size={26}>{title}</Title>
        <View style={{ backgroundColor: '#fff', padding: spacing.lg, borderRadius: 16 }}>
          <QRCode value={payload} size={240} quietZone={8} getRef={(r) => (svg.current = r)} />
        </View>
        <Body muted center size={13}>
          Imprima e cole no {QR_KIND_LABEL[kind].toLowerCase()}. Ao escanear pelo NetPoint, a tela abre direto.
        </Body>
      </Card>
      <Button title="Compartilhar / imprimir" icon="share-variant" onPress={share} />
    </Screen>
  );
}
