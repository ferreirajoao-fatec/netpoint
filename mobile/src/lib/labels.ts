import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { DeviceType, HistoryEntry, LocationType, Role } from '@/api/types';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const DEVICE_TYPES: { value: DeviceType; label: string; icon: IconName }[] = [
  { value: 'COMPUTER', label: 'Computador', icon: 'desktop-classic' },
  { value: 'NOTEBOOK', label: 'Notebook', icon: 'laptop' },
  { value: 'PRINTER', label: 'Impressora', icon: 'printer' },
  { value: 'ACCESS_POINT', label: 'Access Point', icon: 'access-point' },
  { value: 'SERVER', label: 'Servidor', icon: 'server' },
  { value: 'CAMERA', label: 'Câmera', icon: 'cctv' },
  { value: 'IP_PHONE', label: 'Telefone IP', icon: 'phone-voip' },
  { value: 'SWITCH', label: 'Switch', icon: 'switch' },
  { value: 'OTHER', label: 'Outro', icon: 'devices' },
];

export const deviceTypeLabel = (t: DeviceType) => DEVICE_TYPES.find((d) => d.value === t)?.label ?? t;
export const deviceTypeIcon = (t: DeviceType): IconName => DEVICE_TYPES.find((d) => d.value === t)?.icon ?? 'devices';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  VIEWER: 'Consulta',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: 'Cria, edita, exclui, importa, exporta e gerencia usuários',
  TECHNICIAN: 'Consulta, cadastra, altera conexões e escaneia QR Codes',
  VIEWER: 'Apenas visualiza as informações',
};

export const LOCATION_TYPES: { value: LocationType; label: string; icon: IconName }[] = [
  { value: 'BUILDING', label: 'Prédio', icon: 'office-building' },
  { value: 'BLOCK', label: 'Bloco', icon: 'domain' },
  { value: 'FLOOR', label: 'Andar', icon: 'layers-outline' },
  { value: 'AREA', label: 'Área', icon: 'map-marker-outline' },
];

export const HISTORY_ACTION: Record<HistoryEntry['action'], { label: string; icon: IconName }> = {
  CREATE: { label: 'Cadastro', icon: 'plus-circle-outline' },
  UPDATE: { label: 'Alteração', icon: 'pencil-outline' },
  DELETE: { label: 'Exclusão', icon: 'delete-outline' },
  CONNECT: { label: 'Conexão', icon: 'lan-connect' },
  DISCONNECT: { label: 'Desconexão', icon: 'lan-disconnect' },
  IMPORT: { label: 'Importação', icon: 'file-import-outline' },
};

export const ENTITY_LABEL: Record<string, string> = {
  Device: 'Equipamento',
  NetworkPoint: 'Ponto de rede',
  Switch: 'Switch',
  Rack: 'Rack',
  PatchPanel: 'Patch panel',
  Location: 'Local',
  Room: 'Sala',
  Department: 'Setor',
  User: 'Usuário',
  Import: 'Importação',
};

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
