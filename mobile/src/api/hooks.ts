import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Dashboard,
  Department,
  DeviceDetail,
  DeviceListItem,
  DeviceType,
  HistoryEntry,
  Location,
  LocationNode,
  NetworkPoint,
  PatchPanel,
  PatchPanelDetail,
  Rack,
  RackDetail,
  Room,
  SearchResult,
  SwitchDetail,
  SwitchItem,
  SwitchPort,
  Trace,
  User,
} from './types';

// ------------------------------------------------------------------ Consultas

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: () => api<{ results: SearchResult[] }>('/search', { query: { q } }),
    enabled: q.trim().length > 0,
    placeholderData: (prev) => prev,
  });

export const useTrace = (params: { deviceId?: string; pointId?: string; switchPortId?: string; patchPanelPortId?: string }) =>
  useQuery({
    queryKey: ['trace', params],
    queryFn: () => api<Trace>('/trace', { query: params }),
    enabled: Object.values(params).some(Boolean),
  });

export interface DeviceFilters {
  type?: DeviceType | null;
  departmentId?: string | null;
  connected?: boolean | null;
}
export const useDevices = (q?: string, filters: DeviceFilters = {}) =>
  useQuery({
    queryKey: ['devices', q ?? '', filters.type ?? null, filters.departmentId ?? null, filters.connected ?? null],
    queryFn: () => api<DeviceListItem[]>('/devices', { query: { q, ...filters } }),
    placeholderData: (p) => p,
  });
export const useDevice = (id?: string) =>
  useQuery({ queryKey: ['device', id], queryFn: () => api<DeviceDetail>(`/devices/${id}`), enabled: !!id });

export const usePoints = (q?: string, unmapped?: boolean) =>
  useQuery({
    queryKey: ['points', q ?? '', !!unmapped],
    queryFn: () => api<NetworkPoint[]>('/points', { query: { q, unmapped: unmapped ? 'true' : undefined } }),
    placeholderData: (p) => p,
  });
export const usePoint = (id?: string) =>
  useQuery({ queryKey: ['point', id], queryFn: () => api<NetworkPoint>(`/points/${id}`), enabled: !!id });

export const useSwitches = () => useQuery({ queryKey: ['switches'], queryFn: () => api<SwitchItem[]>('/switches') });
export const useSwitch = (id?: string | null) =>
  useQuery({ queryKey: ['switch', id], queryFn: () => api<SwitchDetail>(`/switches/${id}`), enabled: !!id });

export const useRacks = () => useQuery({ queryKey: ['racks'], queryFn: () => api<Rack[]>('/racks') });
export const useRack = (id?: string) =>
  useQuery({ queryKey: ['rack', id], queryFn: () => api<RackDetail>(`/racks/${id}`), enabled: !!id });

export const usePatchPanels = () => useQuery({ queryKey: ['patch-panels'], queryFn: () => api<PatchPanel[]>('/patch-panels') });
export const usePatchPanel = (id?: string | null) =>
  useQuery({ queryKey: ['patch-panel', id], queryFn: () => api<PatchPanelDetail>(`/patch-panels/${id}`), enabled: !!id });

export const useLocations = () => useQuery({ queryKey: ['locations'], queryFn: () => api<Location[]>('/locations') });
export const useLocationTree = () =>
  useQuery({ queryKey: ['locations', 'tree'], queryFn: () => api<{ roots: LocationNode[]; unassignedRooms: Room[] }>('/locations/tree') });
export const useRooms = () => useQuery({ queryKey: ['rooms'], queryFn: () => api<Room[]>('/rooms') });
export const useDepartments = () => useQuery({ queryKey: ['departments'], queryFn: () => api<Department[]>('/departments') });

export const useHistory = (params: { entityType?: string; entityId?: string; take?: number } = {}) =>
  useQuery({ queryKey: ['history', params], queryFn: () => api<HistoryEntry[]>('/history', { query: params }) });

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/users') });

// ------------------------------------------------------------------ Alterações

/**
 * Mutação genérica: após qualquer alteração invalida todos os dados em cache,
 * já que uma conexão afeta equipamento, ponto, switch, dashboard e histórico ao mesmo tempo.
 */
export function useSave<TBody, TResult = unknown>(fn: (body: TBody) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}

export const saveEntity = <T>(resource: string, id: string | undefined, body: T) =>
  id ? api(`/${resource}/${id}`, { method: 'PATCH', body }) : api<{ id: string }>(`/${resource}`, { method: 'POST', body });

export const deleteEntity = (resource: string, id: string) => api(`/${resource}/${id}`, { method: 'DELETE' });

export const updatePort = (switchId: string, number: number, body: Partial<Pick<SwitchPort, 'status' | 'notes'>> & { networkPointId?: string | null }) =>
  api<SwitchPort>(`/switches/${switchId}/ports/${number}`, { method: 'PATCH', body });
