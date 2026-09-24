import { DeviceType, PortStatus } from '@prisma/client';

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const switchPortLabel = (switchName: string, port: number) => `${switchName} · Porta ${pad2(port)}`;
export const patchPortLabel = (panelName: string, port: number) => `${panelName} · Porta ${pad2(port)}`;

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  COMPUTER: 'Computador',
  NOTEBOOK: 'Notebook',
  PRINTER: 'Impressora',
  ACCESS_POINT: 'Access Point',
  SERVER: 'Servidor',
  CAMERA: 'Câmera',
  IP_PHONE: 'Telefone IP',
  SWITCH: 'Switch',
  OTHER: 'Outro',
};

export const PORT_STATUS_LABEL: Record<PortStatus, string> = {
  AVAILABLE: 'Disponível',
  IN_USE: 'Em uso',
  RESERVED: 'Reservada',
  DISABLED: 'Desativada',
  FAULTY: 'Com problema',
};

/**
 * Status exibido da porta: problema/desativada prevalecem; caso contrário,
 * porta com conexão física está em uso.
 */
export function effectivePortStatus(stored: PortStatus, hasConnection: boolean): PortStatus {
  if (stored === 'DISABLED' || stored === 'FAULTY') return stored;
  return hasConnection ? 'IN_USE' : stored;
}

/** Normaliza MAC para o formato A4-B1-C2-D3-E4-F5. Mantém o valor digitado se não for um MAC reconhecível. */
export function normalizeMac(value?: string | null): string | null {
  if (!value) return null;
  const hex = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 12) return value.trim().toUpperCase();
  return hex.match(/.{2}/g)!.join('-');
}

export const MAC_REGEX = /^([0-9A-Fa-f]{2}[:\-.]?){5}[0-9A-Fa-f]{2}$/;
export const IPV4_REGEX = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** Converte string vazia em null (campos opcionais vindos de formulários). */
export const blank = (v?: string | null): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** Para atualizações: campo ausente (undefined) = não alterar; vazio = limpar. */
export const optText = (v?: string | null) => (v === undefined ? undefined : blank(v));
export const optId = (v?: string | null) => (v === undefined ? undefined : v || null);
