/**
 * Conteúdo dos QR Codes: um deep link do app, ex. netpoint://switches/<id>.
 * Escaneado pelo leitor do NetPoint (ou pela câmera do celular com o app instalado),
 * abre direto a tela do elemento.
 */
export type QrKind = 'switches' | 'points' | 'devices' | 'racks';

export const QR_KIND_LABEL: Record<QrKind, string> = {
  switches: 'Switch',
  points: 'Ponto de rede',
  devices: 'Equipamento',
  racks: 'Rack',
};

export const qrPayload = (kind: QrKind, id: string) => `netpoint://${kind}/${id}`;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Retorna a rota do app para um QR Code do NetPoint, ou null se não for um código reconhecido. */
export function routeFromQr(data: string): string | null {
  const m = data.trim().match(new RegExp(`^netpoint://(switches|points|devices|racks)/(${UUID})$`, 'i'));
  return m ? `/${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null;
}
