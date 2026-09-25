export type Role = 'ADMIN' | 'TECHNICIAN' | 'VIEWER';
export type PortStatus = 'AVAILABLE' | 'IN_USE' | 'RESERVED' | 'DISABLED' | 'FAULTY';
export type DeviceType =
  | 'COMPUTER'
  | 'NOTEBOOK'
  | 'PRINTER'
  | 'ACCESS_POINT'
  | 'SERVER'
  | 'CAMERA'
  | 'IP_PHONE'
  | 'SWITCH'
  | 'OTHER';
export type LocationType = 'BUILDING' | 'BLOCK' | 'FLOOR' | 'AREA';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface Named {
  id: string;
  name: string;
}

export interface Department extends Named {
  _count?: { devices: number; points: number; rooms: number };
}

export interface Location extends Named {
  type: LocationType;
  parentId: string | null;
  path: string;
}

export interface Room extends Named {
  locationId: string | null;
  departmentId: string | null;
  department?: Department | null;
  path?: string | null;
  _count?: { devices: number; points: number; racks: number };
}

export interface LocationNode extends Named {
  type: LocationType;
  parentId: string | null;
  children: LocationNode[];
  rooms: Room[];
}

export interface Trace {
  connectionId: string | null;
  device: {
    id: string;
    name: string;
    type: DeviceType;
    responsibleUser: string | null;
    department: string | null;
    room: string | null;
    hostname: string | null;
    ipAddress: string | null;
    macAddress: string | null;
    assetTag: string | null;
    extension: string | null;
  } | null;
  point: { id: string; code: string; room: string | null; location: string | null; department: string | null } | null;
  patchPanel: { id: string; name: string; portId: string; port: number; rack: string | null } | null;
  switch: {
    id: string;
    name: string;
    portId: string;
    port: number;
    status: PortStatus;
    ipAddress: string | null;
    rack: string | null;
    location: string | null;
  } | null;
  cableLabel: string | null;
  complete: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  responsibleUser: string | null;
  departmentId: string | null;
  department: Department | null;
  roomId: string | null;
  room: Room | null;
  hostname: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  assetTag: string | null;
  extension: string | null;
  notes: string | null;
}

export interface DeviceListItem extends Device {
  connection: {
    networkPoint: { id: string; code: string };
    switchPort: { id: string; number: number; switch: Named } | null;
  } | null;
}

export interface DeviceDetail extends Device {
  trace: Trace;
}

export interface NetworkPoint {
  id: string;
  code: string;
  roomId: string | null;
  room: Room | null;
  departmentId: string | null;
  department: Department | null;
  notes: string | null;
  location: string | null;
  trace: Trace | null;
}

export interface PortUsage {
  total: number;
  used: number;
  available: number;
  reserved: number;
  disabled: number;
  faulty: number;
}

export interface SwitchItem {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  portCount: number;
  ipAddress: string | null;
  macAddress: string | null;
  roomId: string | null;
  room: Room | null;
  rackId: string | null;
  rack: Named | null;
  notes: string | null;
  location: string | null;
  usage: PortUsage;
}

export interface SwitchPort {
  id: string;
  number: number;
  storedStatus: PortStatus;
  status: PortStatus;
  notes: string | null;
  trace: Trace | null;
  /** Porta de outro switch ligada diretamente nesta (comunicação entre switches) */
  uplink: SwitchUplink | null;
}

export interface SwitchUplink {
  switchId: string;
  switchName: string;
  portId: string;
  port: number;
}

export interface SwitchDetail extends SwitchItem {
  ports: SwitchPort[];
}

export interface PatchPanel {
  id: string;
  name: string;
  portCount: number;
  rackId: string | null;
  rack: Named | null;
  notes: string | null;
  usedPorts: number;
}

export interface PatchPanelDetail extends Omit<PatchPanel, 'usedPorts'> {
  ports: { id: string; number: number; trace: Trace | null }[];
}

export interface Rack {
  id: string;
  name: string;
  roomId: string | null;
  room: Room | null;
  notes: string | null;
  location: string | null;
  _count?: { switches: number; patchPanels: number };
}

export interface RackDetail extends Rack {
  switches: (Omit<SwitchItem, 'location' | 'room' | 'rack'>)[];
  patchPanels: PatchPanel[];
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  userName: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CONNECT' | 'DISCONNECT' | 'IMPORT';
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  description: string | null;
}

export interface Dashboard {
  devices: number;
  switches: number;
  points: number;
  portsUsed: number;
  portsAvailable: number;
  portsReserved: number;
  portsProblem: number;
  unmappedPoints: number;
  cables: number;
  racks: number;
  rooms: number;
  recent: HistoryEntry[];
}

export interface SearchResult {
  kind: 'device' | 'point' | 'port' | 'switch' | 'rack';
  id: string;
  title: string;
  subtitle: string | null;
  switchId?: string;
  portNumber?: number;
  trace: Trace | null;
}

export interface ImportReport {
  valid: boolean;
  applied: boolean;
  summary: {
    devicesToCreate: number;
    devicesToUpdate: number;
    pointsToCreate: number;
    pointsToUpdate: number;
    departmentsToCreate: string[];
    roomsToCreate: string[];
  };
  errors: { sheet: string; row: number; message: string }[];
  warnings: { sheet: string; row: number; message: string }[];
}
