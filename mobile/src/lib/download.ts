import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { authHeader, buildUrl } from '@/api/client';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Baixa uma planilha da API e abre o compartilhamento do sistema
 * (salvar em arquivos, enviar por e-mail, WhatsApp, Drive…).
 */
export async function downloadAndShare(path: string, filename: string) {
  const url = buildUrl(path);

  if (Platform.OS === 'web') {
    const res = await fetch(url, { headers: authHeader() });
    if (!res.ok) throw new Error(`Falha ao gerar o arquivo (${res.status})`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }

  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = await File.downloadFileAsync(url, new File(dir, filename), { headers: authHeader(), idempotent: true });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: XLSX, dialogTitle: filename, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
  }
}

export const exportInventory = () => {
  const date = new Date().toISOString().slice(0, 10);
  return downloadAndShare('/excel/export', `netpoint-inventario-${date}.xlsx`);
};
