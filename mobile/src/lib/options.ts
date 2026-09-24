import { useDepartments, useDevices, usePatchPanels, usePoints, useRacks, useRooms, useSwitches } from '@/api/hooks';
import type { Option } from '@/components/Select';
import { deviceTypeIcon, pad2 } from './labels';

/** Listas de opções para os seletores dos formulários. */
export const useRoomOptions = (): Option[] =>
  (useRooms().data ?? []).map((r) => ({ value: r.id, label: r.name, subtitle: r.path, icon: 'door' }));

export const useDepartmentOptions = (): Option[] =>
  (useDepartments().data ?? []).map((d) => ({ value: d.id, label: d.name, icon: 'account-group-outline' }));

export const useRackOptions = (): Option[] =>
  (useRacks().data ?? []).map((r) => ({ value: r.id, label: r.name, subtitle: r.location, icon: 'server' }));

export const useSwitchOptions = (): Option[] =>
  (useSwitches().data ?? []).map((s) => ({
    value: s.id,
    label: s.name,
    subtitle: `${s.usage.available} de ${s.portCount} portas livres${s.rack ? ` · ${s.rack.name}` : ''}`,
    icon: 'switch',
  }));

export const usePatchPanelOptions = (): Option[] =>
  (usePatchPanels().data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    subtitle: `${p.rack?.name ?? 'Sem rack'} · ${p.usedPorts}/${p.portCount} em uso`,
    icon: 'view-grid-outline',
  }));

export const usePointOptions = (): Option[] =>
  (usePoints().data ?? []).map((p) => ({
    value: p.id,
    label: p.code,
    subtitle: [
      p.room?.name,
      p.trace?.device ? `Ocupado: ${p.trace.device.name}` : 'Livre',
      p.trace?.switch ? `${p.trace.switch.name} · P${pad2(p.trace.switch.port)}` : null,
    ].filter(Boolean).join(' · '),
    icon: 'ethernet',
  }));

export const useDeviceOptions = (): Option[] =>
  (useDevices().data ?? []).map((d) => ({
    value: d.id,
    label: d.name,
    subtitle: [d.hostname, d.responsibleUser, d.connection ? `No ponto ${d.connection.networkPoint.code}` : null].filter(Boolean).join(' · '),
    icon: deviceTypeIcon(d.type),
  }));
